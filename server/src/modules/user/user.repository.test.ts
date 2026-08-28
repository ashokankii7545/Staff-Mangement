import { describe, it, expect, afterAll } from 'vitest';
import { inArray } from 'drizzle-orm';
import { userRepository } from './user.repository.js';
import { verifyPassword } from '../../shared/utils/password.util.js';
import { users } from '../../db/schema/index.js';
import { db } from '../../config/drizzle.js';

const createdIds: string[] = [];
let counter = 0;
const uniq = () => `${Date.now()}${counter++}`;

const makeUser = async (over: Record<string, unknown> = {}) => {
  const n = uniq();
  const u = await userRepository.queries.create({
    employeeId: `UT${n}`.toUpperCase().slice(0, 18),
    name: `UT User ${n}`,
    email: `ut${n}@example.com`,
    role: 'STAFF',
    leaveBalances: { casual: 10, sick: 6, earned: 0 },
    ...over,
  });
  createdIds.push(u.id);
  return u;
};

afterAll(async () => {
  if (createdIds.length) await db.delete(users).where(inArray(users.id, createdIds));
});

describe('UserRepository (Postgres)', () => {
  it('create hashes the password and stores a bcrypt hash', async () => {
    const u = await makeUser({ password: 'Secret123' });
    expect(u.password).toBeTruthy();
    expect(u.password).not.toBe('Secret123');
    expect(await verifyPassword(u, 'Secret123')).toBe(true);
    expect(await verifyPassword(u, 'wrong')).toBe(false);
  });

  it('findByEmployeeId / findByEmail / findByIdentifier resolve the same user', async () => {
    const u = await makeUser();
    const byEmp = await userRepository.queries.findByEmployeeId(u.employeeId);
    const byEmail = await userRepository.queries.findByEmail(u.email);
    const byIdent = await userRepository.queries.findByIdentifier(u.email);
    expect(byEmp?._id).toBe(u._id);
    expect(byEmail?._id).toBe(u._id);
    expect(byIdent?._id).toBe(u._id);
  });

  it('listUsersPaginated searches with ILIKE across name/email/employeeId', async () => {
    const token = `zzsearch${uniq()}`;
    const u = await makeUser({ name: `Findable ${token}` });
    const res = await userRepository.queries.listUsersPaginated({ page: 1, limit: 10, search: token });
    expect(res.data.some((x) => x.id === u.id)).toBe(true);
    expect(res.pageInfo.totalCount).toBeGreaterThanOrEqual(1);
  });

  it('setLeaveBalance floors and clamps at zero', async () => {
    const u = await makeUser();
    const updated = await userRepository.queries.setLeaveBalance(u.id, 'casual', 7.9);
    expect(updated?.leaveBalances?.casual).toBe(7);
    const clamped = await userRepository.queries.setLeaveBalance(u.id, 'casual', -5);
    expect(clamped?.leaveBalances?.casual).toBe(0);
  });

  it('addLeaveBalance increments atomically', async () => {
    const u = await makeUser({ leaveBalances: { casual: 2, sick: 0, earned: 0 } });
    await userRepository.queries.addLeaveBalance(u.id, 'casual', 3);
    const after = await userRepository.queries.findById(u.id);
    expect(after?.leaveBalances?.casual).toBe(5);
  });

  it('deductLeaveBalanceIfAvailable is race-proof: two concurrent deducts of 6 from 10 -> only one wins', async () => {
    const u = await makeUser({ leaveBalances: { casual: 10, sick: 0, earned: 0 } });
    const [a, b] = await Promise.all([
      userRepository.queries.deductLeaveBalanceIfAvailable(u.id, 'casual', 6),
      userRepository.queries.deductLeaveBalanceIfAvailable(u.id, 'casual', 6),
    ]);
    expect([a, b].filter(Boolean).length).toBe(1); // exactly one succeeded
    const after = await userRepository.queries.findById(u.id);
    expect(after?.leaveBalances?.casual).toBe(4); // 10 - 6, not -2
  });

  it('updateById coerces a non-array restrictedPages ({}) to [] instead of crashing the driver', async () => {
    const u = await makeUser();
    // A client sending `restrictedPages: {}` (object, not array) must not throw
    // "value.map is not a function" from the postgres.js text[] serializer.
    const updated = await userRepository.queries.updateById(u.id, {
      restrictedPages: {} as unknown as string[],
    });
    expect(updated?.restrictedPages).toEqual([]);
  });

  it('deductLeaveBalanceIfAvailable fails when insufficient', async () => {
    const u = await makeUser({ leaveBalances: { casual: 1, sick: 0, earned: 0 } });
    const ok = await userRepository.queries.deductLeaveBalanceIfAvailable(u.id, 'casual', 5);
    expect(ok).toBe(false);
    const after = await userRepository.queries.findById(u.id);
    expect(after?.leaveBalances?.casual).toBe(1);
  });

  it('bulkWrite accrual applies $inc and $set to active users', async () => {
    const u = await makeUser({ leaveBalances: { casual: 1, sick: 1, earned: 1 }, isActive: true });
    await userRepository.queries.bulkWrite([
      { updateMany: { filter: { isActive: true }, update: { $inc: { 'leaveBalances.casual': 2 } } } },
      { updateMany: { filter: { isActive: true }, update: { $set: { 'leaveBalances.sick': 6 } } } },
    ]);
    const after = await userRepository.queries.findById(u.id);
    expect(after?.leaveBalances?.casual).toBe(3);
    expect(after?.leaveBalances?.sick).toBe(6);
  });
});
