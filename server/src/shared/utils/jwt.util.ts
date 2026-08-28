import jwt, { type SignOptions } from 'jsonwebtoken';
import { env } from '../../config/env.js';
import type { Role } from '../../config/constants.js';

/** Payload embedded inside every access token. */
export interface JwtPayload {
  id: string;
  role: Role;
  /** Discriminates the two token families signed with the same secret. */
  type: 'access' | 'refresh';
}

/** Base claims callers provide – `type` is stamped automatically per family. */
export type TokenClaims = Omit<JwtPayload, 'type'>;

/** Mint a short-lived access token for an authenticated user. */
export const signAuthToken = (payload: TokenClaims): string =>
  jwt.sign({ ...payload, type: 'access' }, env.jwtSecret, {
    expiresIn: env.jwtExpiresIn,
  } as SignOptions);

/**
 * Mint a long-lived refresh token. Carries no privileges of its own – it can
 * ONLY be exchanged at the `refreshToken` mutation for a new session pair.
 */
export const signRefreshToken = (payload: TokenClaims): string =>
  jwt.sign({ ...payload, type: 'refresh' }, env.jwtSecret, {
    expiresIn: env.jwtRefreshExpiresIn,
  } as SignOptions);

/** Verify + decode an access token. Throws on invalid/expired tokens. */
export const verifyAuthToken = (token: string): JwtPayload => {
  const decoded = jwt.verify(token, env.jwtSecret) as JwtPayload;
  // A refresh token must never authenticate API calls.
  if (decoded.type === 'refresh') {
    throw new jwt.JsonWebTokenError('Refresh token used as access token');
  }
  return decoded;
};

/** Verify + decode a refresh token. Rejects access tokens passed in. */
export const verifyRefreshToken = (token: string): JwtPayload => {
  const decoded = jwt.verify(token, env.jwtSecret) as JwtPayload;
  if (decoded.type !== 'refresh') {
    throw new jwt.JsonWebTokenError('Access token used as refresh token');
  }
  return decoded;
};

/** Strip an optional `Bearer ` prefix and trim. */
export const extractBearerToken = (headerValue?: string | null): string =>
  (headerValue ?? '').replace(/^Bearer\s+/i, '').trim();
