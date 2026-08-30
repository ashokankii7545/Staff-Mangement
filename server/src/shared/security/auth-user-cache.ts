import type { IUserDocument } from '../../modules/user/user.model.js';

/**
 * ────────────────────────────────────────────────────────────────────────────
 * AUTH USER CACHE – short-TTL in-process cache for authenticated user rows
 * ────────────────────────────────────────────────────────────────────────────
 * Every GraphQL request used to re-`SELECT` the token's user from the remote
 * Postgres cluster (~160ms round-trip) purely to re-check role/active status.
 * A 5s TTL collapses bursts of concurrent requests from the same page-load
 * into a single DB hit. Authoritative invalidation still applies: admin
 * deactivate / approve / role-change flows call `invalidateAuthUser` from the
 * user repository write paths, so access-control decisions stay immediate.
 *
 * NOTE: importable from the repository layer because this module only imports
 * a TYPE (erased at runtime) – no module cycle with auth.guard or user.module.
 */
const AUTH_USER_CACHE_TTL_MS = 5_000;

const cache = new Map<string, { user: IUserDocument | null; at: number }>();

/**
 * Returns the cached user for an id, or `undefined` on cache miss.
 * `null` is a legitimate cached value (account missing/inactive) – by using
 * `undefined` only for misses we don't re-query deactivated users constantly.
 */
export const cachedAuthUser = (id: string): IUserDocument | null | undefined => {
  const hit = cache.get(id);
  if (hit && Date.now() - hit.at < AUTH_USER_CACHE_TTL_MS) return hit.user;
  return undefined;
};

/** Store (or refresh) a user against the cache. */
export const rememberAuthUser = (id: string, user: IUserDocument | null): void => {
  cache.set(id, { user, at: Date.now() });
};

/**
 * Drop a user from the cache. Called by user repository write paths (status /
 * role / active changes) so a deactivated or newly-approved account is picked
 * up on the very next request.
 */
export const invalidateAuthUser = (id: string): void => {
  cache.delete(id);
};