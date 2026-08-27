import { describe, it, expect, afterAll } from 'vitest';
import { inArray } from 'drizzle-orm';
import { authService } from './auth.service.js';
import { userRepository } from '../user/user.repository.js';
import { verifyAuthToken } from '../../shared/utils/jwt.util.js';
import { users } from '../../db/schema/index.js';
import { db } from '../../config/drizzle.js';

const userIds: string[] = [];
let c = 0;
const uniq = () => `${Date.now()}${c++}`;

afterAll(async () => {
  if (userIds.length) await db.delete(users).where(inArray(users.id, userIds));
});

describe('AuthService (Postgres) – login flow unchanged', () => {
  it('registerStaff → login with employeeId+password issues a valid JWT', async () => {
    const email = `auth${uniq()}@example.com`;
    const created = await authService.registerStaff({
      name: 'Auth Flow', email, password: 'Passw0rd1', role: 'STAFF',
    });
    userIds.push(created.id);
    expect(created.employeeId).toMatch(/^EMP\d+$/);
    expect(created.password).not.toBe('Passw0rd1'); // hashed

    const payload = await authService.loginUser({ employeeId: created.employeeId, password: 'Passw0rd1' });
    expect(payload.token).toBeTruthy();
    const decoded = verifyAuthToken(payload.token);
    expect(decoded.id).toBe(created.id);
    expect(decoded.role).toBe('STAFF');
  });

  it('login rejects a wrong password', async () => {
    const email = `auth${uniq()}@example.com`;
    const created = await authService.registerStaff({ name: 'Wrong Pw', email, password: 'Correct123', role: 'STAFF' });
    userIds.push(created.id);
    await expect(authService.loginUser({ employeeId: created.employeeId, password: 'nope' })).rejects.toBeTruthy();
  });

  it('changeUserPassword rotates the hash; old password stops working', async () => {
    const email = `auth${uniq()}@example.com`;
    const created = await authService.registerStaff({ name: 'Rotate', email, password: 'Initial123', role: 'STAFF' });
    userIds.push(created.id);
    await authService.changeUserPassword({ userId: created.id, currentPassword: 'Initial123', newPassword: 'Updated456' });

    const withNew = await authService.loginUser({ employeeId: created.employeeId, password: 'Updated456' });
    expect(withNew.token).toBeTruthy();
    await expect(authService.loginUser({ employeeId: created.employeeId, password: 'Initial123' })).rejects.toBeTruthy();
  });
});
