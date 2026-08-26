import jwt from 'jsonwebtoken';
import { config } from '../config/environment.js';
import User from '../models/User.js';

export const getAuthUser = async (token) => {
  if (!token) return null;
  try {
    const cleaned = token.replace('Bearer ', '');
    const decoded = jwt.verify(cleaned, config.jwtSecret);
    const user = await User.findById(decoded.id).lean();
    return user;
  } catch {
    return null;
  }
};

export const requireAuth = (user) => {
  if (!user) throw new Error('Authentication required. Please login.');
  return user;
};

export const requireAdmin = (user) => {
  requireAuth(user);
  if (user.role !== 'ADMIN') throw new Error('Admin access required.');
  return user;
};
