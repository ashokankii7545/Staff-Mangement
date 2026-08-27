import { AuthenticationError, ForbiddenError } from '../errors/app.errors.js';
import { extractBearerToken, verifyAuthToken } from '../utils/jwt.util.js';
import { userRepository } from '../../modules/user/user.repository.js';
import type { IUserDocument } from '../../modules/user/user.model.js';

/**
 * AUTH GUARDS – the only three functions resolvers may use for access control.
 * Keep them tiny & composable; business rules belong in services.
 */

/** Postgres user ids are uuids; anything else is a stale/invalid token id. */
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Resolve a user from a raw Authorization header (null when anonymous). */
export const getAuthUser = async (
  headerValue?: string | null,
): Promise<IUserDocument | null> => {
  const token = extractBearerToken(headerValue);
  if (!token) return null;
  try {
    const decoded = verifyAuthToken(token);
    // Tokens minted before the Postgres migration carry Mongo ObjectIds, which
    // are not valid uuids – treat them as anonymous (forces a clean re-login)
    // instead of firing a failing query at Postgres on every request.
    if (!decoded.id || !UUID_RE.test(decoded.id)) return null;
    const user = await userRepository.queries.findById(decoded.id);
    // EDGE CASE GUARD: a live token must STILL belong to an ACTIVE + APPROVED
    // account – deactivating someone (or rejecting their signup) takes effect
    // immediately instead of waiting for the 7-day token to expire.
    if (!user || !user.isActive || user.approvalStatus !== 'APPROVED') {
      return null;
    }
    return user;
  } catch {
    // Invalid/expired token == anonymous, never a crash.
    return null;
  }
};

/** Throws unless an authenticated user is present. Returns the user typed. */
export const requireAuth = (user: IUserDocument | null): IUserDocument => {
  if (!user) throw new AuthenticationError('Authentication required. Please login.');
  return user;
};

/** Throws unless an ADMIN is present. */
export const requireAdmin = (user: IUserDocument | null): IUserDocument => {
  const authed = requireAuth(user);
  if (authed.role !== 'ADMIN') throw new ForbiddenError('Admin access required.');
  return authed;
};
