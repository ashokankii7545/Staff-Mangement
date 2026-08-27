import bcrypt from 'bcryptjs';

const SALT_ROUNDS = 12;

export const hashPassword = (plain: string, rounds: number = SALT_ROUNDS): Promise<string> =>
  bcrypt.hash(plain, rounds);

export const comparePasswords = (candidate: string, hash: string): Promise<boolean> =>
  bcrypt.compare(candidate, hash);

/**
 * Verify a candidate password against a user record's stored hash.
 * Replaces the old Mongoose `user.comparePassword()` instance method – users
 * are now plain rows, so comparison lives here. Google-only accounts (no
 * password) always fail verification.
 */
export const verifyPassword = (
  user: { password?: string | null },
  candidate: string,
): Promise<boolean> => {
  if (!user.password) return Promise.resolve(false);
  return comparePasswords(candidate, user.password);
};
