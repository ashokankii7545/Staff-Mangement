import {
  generateRegistrationOptions,
  generateAuthenticationOptions,
  verifyRegistrationResponse,
  verifyAuthenticationResponse,
  type Base64URLString,
  type AuthenticatorTransportFuture,
  type RegistrationResponseJSON,
  type AuthenticationResponseJSON,
} from '@simplewebauthn/server';
import { env } from '../../config/env.js';
import { logger } from '../../shared/logger/logger.js';
import { AppError, AuthenticationError, ValidationError } from '../../shared/errors/app.errors.js';
import { userRepository } from '../user/user.repository.js';
import type { IUserDocument } from '../user/user.model.js';
import type { PasskeyJson } from '../../db/schema/user.schema.js';

const CHALLENGE_TTL_MS = 5 * 60 * 1000;
/** Hard cap – one staff member can register a few devices, never hundreds. */
const MAX_PASSKEYS = 3;

type CeremonyKind = 'registration' | 'authentication';
type PendingMap = Record<CeremonyKind, PendingChallenge | undefined>;

interface PendingChallenge {
  challenge: string;
  createdAt: number;
}

/** Public shape exposed over GraphQL (never leaks the public key). */
export interface PasskeySummary {
  id: string;
  createdAt: string;
  lastUsedAt: string | null;
  deviceType: string | null;
  backedUp: boolean;
}

/**
 * WebAuthnService – server side of the fingerprint/passkey ceremonies.
 *
 * HOW IT WORKS (so "matching" is 100% sound):
 *  - The fingerprint NEVER leaves the staff member's phone. The phone's own
 *    biometric sensor (fingerprint / Face-ID / PIN) proves who they are and
 *    then signs a one-time challenge.
 *  - We only ever store the PUBLIC key; it is useless without the private key
 *    that lives inside the device's secure enclave.
 *  - verifyRegistrationResponse / verifyAuthenticationResponse check the
 *    signature against that public key, pin the exact origin + RP ID, and
 *    REQUIRE user verification (fingerprint/Face-ID/PIN actually used).
 *  - Every challenge is single-use: consumed on the next attempt (success or
 *    failure) so a captured response can never be replayed to fake a punch.
 *  - Challenge state lives in memory (single-instance Node host). A ceremony
 *    is at most a few seconds, so a process restart between begin→finish is a
 *    tolerable edge; the user simply retries.
 */
class WebAuthnService {
  private static instance: WebAuthnService | null = null;

  private readonly pending = new Map<string, PendingMap>();

  private constructor() {}

  public static getInstance(): WebAuthnService {
    if (!WebAuthnService.instance) {
      WebAuthnService.instance = new WebAuthnService();
    }
    return WebAuthnService.instance;
  }

  private get rpId(): string {
    return env.webauthn.rpId;
  }

  private get rpName(): string {
    return env.webauthn.rpName;
  }

  private get origins(): string[] {
    return [...env.webauthn.expectedOrigins];
  }

  private passkeysOf(user: IUserDocument): PasskeyJson[] {
    const raw = (user as unknown as { passkeys?: PasskeyJson[] | null }).passkeys;
    return Array.isArray(raw) ? raw : [];
  }

  private challengeFor(userId: string, kind: CeremonyKind): string {
    const record = this.pending.get(userId)?.[kind];
    if (record && Date.now() - record.createdAt < CHALLENGE_TTL_MS) {
      return record.challenge;
    }
    throw new ValidationError('No pending fingerprint ceremony found. Please start again.');
  }

  private consumeChallenge(userId: string, kind: CeremonyKind): void {
    const entry = this.pending.get(userId);
    if (!entry) return;
    entry[kind] = undefined;
    this.pending.set(userId, entry);
  }

  private rememberChallenge(userId: string, kind: CeremonyKind, challenge: string): void {
    const entry = this.pending.get(userId) ?? ({ registration: undefined, authentication: undefined } as PendingMap);
    entry[kind] = { challenge, createdAt: Date.now() };
    this.pending.set(userId, entry);
  }

  private toSummary(p: PasskeyJson): PasskeySummary {
    return {
      id: p.id,
      createdAt: p.createdAt,
      lastUsedAt: p.lastUsedAt ?? null,
      deviceType: p.deviceType ?? null,
      backedUp: !!p.backedUp,
    };
  }

  /** Read-only summaries for a user (exposed on `me` / profile queries). */
  public summarize(user: IUserDocument): PasskeySummary[] {
    return this.passkeysOf(user).map((p) => this.toSummary(p));
  }

  /** True when the account already has at least one usable passkey. */
  public hasPasskey(user: IUserDocument): boolean {
    return this.passkeysOf(user).length > 0;
  }

  /** Ceremony #1a – build options for `navigator.credentials.create()`. */
  public async beginRegistration(user: IUserDocument): Promise<{ optionsJson: string }> {
    const passkeys = this.passkeysOf(user);
    const options = await generateRegistrationOptions({
      rpName: this.rpName,
      rpID: this.rpId,
      userName: user.email || user.employeeId || String(user._id),
      userDisplayName: user.name || user.employeeId || 'Staff',
      // Stable per-user id – discoverable passkeys are mapped to (rpID + userID).
      userID: new TextEncoder().encode(String(user._id)),
      timeout: 60_000,
      attestationType: 'none',
      authenticatorSelection: {
        // 'required' → the passkey is discoverable AND the device's own sensor
        // (fingerprint / Face-ID / PIN) is a hard requirement, not an option.
        residentKey: 'required',
        userVerification: 'required',
        // Platform authenticator = the staff member's own phone/laptop sensor.
        authenticatorAttachment: 'platform',
      },
      excludeCredentials: passkeys.map((p) => ({
        id: p.id as Base64URLString,
        transports: (p.transports ?? []) as AuthenticatorTransportFuture[],
      })),
      supportedAlgorithmIDs: [-7, -257], // ES256 + RS256
    });

    this.rememberChallenge(String(user._id), 'registration', options.challenge);
    return { optionsJson: JSON.stringify(options) };
  }

  /** Ceremony #1b – verify the browser's attestation and persist the passkey. */
  public async completeRegistration(
    user: IUserDocument,
    responseJson: string,
  ): Promise<{ success: boolean; message: string; passkeys: PasskeySummary[] }> {
    const userId = String(user._id);
    try {
      const response = JSON.parse(responseJson) as RegistrationResponseJSON;
      const verification = await verifyRegistrationResponse({
        response,
        expectedChallenge: this.challengeFor(userId, 'registration'),
        expectedOrigin: this.origins,
        expectedRPID: this.rpId,
        requireUserVerification: true,
      });

      if (!verification.verified || !verification.registrationInfo) {
        throw new AuthenticationError('Fingerprint registration could not be verified. Please try again.');
      }

      const { credential, credentialDeviceType, credentialBackedUp } = verification.registrationInfo;
      const existing = this.passkeysOf(user);
      const updated: PasskeyJson[] = [
        ...existing.filter((p) => p.id !== credential.id).slice(-(MAX_PASSKEYS - 1)),
        {
          id: credential.id,
          publicKey: Buffer.from(credential.publicKey).toString('base64url'),
          counter: credential.counter ?? 0,
          transports: (credential.transports as string[] | undefined) ?? null,
          deviceType: credentialDeviceType,
          backedUp: credentialBackedUp,
          createdAt: new Date().toISOString(),
          lastUsedAt: new Date().toISOString(),
        },
      ];

      await userRepository.queries.updatePasskeys(userId, updated);
      logger.info(`[webauthn] passkey registered for user ${userId}`);

      return {
        success: true,
        message: 'Fingerprint registered successfully.',
        passkeys: updated.map((p) => this.toSummary(p)),
      };
    } catch (error) {
      logger.error('[webauthn] registration verification failed', error);
      if (error instanceof AppError) throw error;
      throw new ValidationError('Fingerprint registration failed. Please try again.');
    } finally {
      this.consumeChallenge(userId, 'registration');
    }
  }


  /** Ceremony #2a – build options for `navigator.credentials.get()` (a punch). */
  public async beginAuthentication(user: IUserDocument): Promise<{ optionsJson: string; hasPasskey: boolean }> {
    const passkeys = this.passkeysOf(user);
    if (passkeys.length === 0) {
      return { optionsJson: '', hasPasskey: false };
    }

    const options = await generateAuthenticationOptions({
      rpID: this.rpId,
      allowCredentials: passkeys.map((p) => ({
        id: p.id as Base64URLString,
        transports: (p.transports ?? []) as AuthenticatorTransportFuture[],
      })),
      userVerification: 'required',
      timeout: 60_000,
    });

    this.rememberChallenge(String(user._id), 'authentication', options.challenge);
    return { optionsJson: JSON.stringify(options), hasPasskey: true };
  }

  /**
   * Ceremony #2b – verify a punch-time assertion against the stored public key.
   * Called from the attendance service; consumes the challenge on every attempt.
   * Throws AuthenticationError when the fingerprint/Face-ID did not verify.
   */
  public async verifyAuthenticationForPunch(user: IUserDocument, responseJson: string): Promise<void> {
    const userId = String(user._id);
    try {
      const response = JSON.parse(responseJson) as AuthenticationResponseJSON;
      const passkeys = this.passkeysOf(user);
      const credential = passkeys.find((p) => p.id === response.id);
      if (!credential) {
        throw new AuthenticationError('Fingerprint not recognised for this account.');
      }

      const verification = await verifyAuthenticationResponse({
        response,
        expectedChallenge: this.challengeFor(userId, 'authentication'),
        expectedOrigin: this.origins,
        expectedRPID: this.rpId,
        requireUserVerification: true,
        credential: {
          id: credential.id as Base64URLString,
          publicKey: new Uint8Array(Buffer.from(credential.publicKey, 'base64url')),
          counter: credential.counter ?? 0,
          transports: (credential.transports ?? []) as AuthenticatorTransportFuture[],
        },
      });

      if (!verification.verified) {
        throw new AuthenticationError('Fingerprint verification failed. Please try again.');
      }

      const { credentialID, newCounter } = verification.authenticationInfo;
      const updated = passkeys.map((p) =>
        p.id === credentialID ? { ...p, counter: newCounter, lastUsedAt: new Date().toISOString() } : p,
      );
      await userRepository.queries.updatePasskeys(userId, updated);
      logger.info(`[webauthn] punch verified for user ${userId} (counter=${newCounter})`);
    } catch (error) {
      logger.error('[webauthn] punch authentication failed', error);
      if (error instanceof AppError) throw error;
      throw new AuthenticationError('Fingerprint verification failed. Please try again.');
    } finally {
      this.consumeChallenge(userId, 'authentication');
    }
  }

  /** Staff self-service: forget a specific device credential. */
  public async removePasskey(user: IUserDocument, credentialId: string): Promise<PasskeySummary[]> {
    const updated = this.passkeysOf(user).filter((p) => p.id !== credentialId);
    await userRepository.queries.updatePasskeys(String(user._id), updated);
    return updated.map((p) => this.toSummary(p));
  }

  /**
   * Admin action: send a "register your fingerprint" reminder email to a
   * specific staff member. Rate-limited to one email per 24h per user.
   */
  public async requestRegistrationEmail(userId: string): Promise<boolean> {
    const user = await userRepository.queries.findById(userId);
    if (!user) throw new ValidationError('User not found.');
    const last = (user as unknown as { lastFingerprintReminderAt?: Date | null }).lastFingerprintReminderAt;
    const lastTs = last ? new Date(last).getTime() : 0;
    if (Date.now() - lastTs < 24 * 60 * 60 * 1000) {
      // Already sent recently – still report success so the admin sees a green toast.
      return true;
    }
    const { mailService } = await import('../../shared/mail/mail.service.js');
    await mailService.sendFingerprintReminderEmail(user);
    await userRepository.queries.markFingerprintReminderSent(userId);
    logger.info(`[webauthn] admin requested fingerprint registration email for user ${userId}`);
    return true;
  }

  /** Admin action: remove a specific device credential from any staff member. */
  public async adminRemovePasskey(userId: string, credentialId: string): Promise<PasskeySummary[]> {
    const user = await userRepository.queries.findById(userId);
    if (!user) throw new ValidationError('User not found.');
    const updated = this.passkeysOf(user).filter((p) => p.id !== credentialId);
    await userRepository.queries.updatePasskeys(userId, updated);
    logger.info(`[webauthn] admin removed passkey ${credentialId} for user ${userId}`);
    return updated.map((p) => this.toSummary(p));
  }
}

export const webauthnService = WebAuthnService.getInstance();
