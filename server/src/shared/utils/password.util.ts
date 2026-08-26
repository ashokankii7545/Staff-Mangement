import bcrypt from 'bcryptjs';

const SALT_ROUNDS = 12;

export const hashPassword = (plain: string, rounds: number = SALT_ROUNDS): Promise<string> =>
  bcrypt.hash(plain, rounds);

export const comparePasswords = (candidate: string, hash: string): Promise<boolean> =>
  bcrypt.compare(candidate, hash);
