import jwt, { type SignOptions } from 'jsonwebtoken';
import { env } from '../../config/env.js';
import type { Role } from '../../config/constants.js';

/** Payload embedded inside every access token. */
export interface JwtPayload {
  id: string;
  role: Role;
}

/** Mint an access token for an authenticated user. */
export const signAuthToken = (payload: JwtPayload): string =>
  jwt.sign(payload, env.jwtSecret, { expiresIn: env.jwtExpiresIn } as SignOptions);

/** Verify + decode a token. Throws on invalid/expired tokens. */
export const verifyAuthToken = (token: string): JwtPayload =>
  jwt.verify(token, env.jwtSecret) as JwtPayload;

/** Strip an optional `Bearer ` prefix and trim. */
export const extractBearerToken = (headerValue?: string | null): string =>
  (headerValue ?? '').replace(/^Bearer\s+/i, '').trim();
