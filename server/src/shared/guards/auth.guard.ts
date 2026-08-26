import { AuthenticationError, ForbiddenError } from '../errors/app.errors.js';
import { extractBearerToken, verifyAuthToken } from '../utils/jwt.util.js';
import { userRepository } from '../../modules/user/user.repository.js';
import type { IUserDocument } from '../../modules/user/user.model.js';

/**
 * AUTH GUARDS – the only three functions resolvers may use for access control.
 * Keep them tiny & composable; business rules belong in services.
 */

/** Resolve a user from a raw Authorization header (null when anonymous). */
export const getAuthUser = async (
  headerValue?: string | null,
): Promise<IUserDocument | null> => {
  const token = extractBearerToken(headerValue);
  if (!token) return null;
  try {
    const decoded = verifyAuthToken(token);
    return await userRepository.queries.findById(decoded.id ?? '');
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
