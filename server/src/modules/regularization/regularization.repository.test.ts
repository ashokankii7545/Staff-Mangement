import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { inArray } from 'drizzle-orm';
import { regularizationRepository } from './regularization.repository.js';
import { userRepository } from '../user/user.repository.js';
import { regularizations, users } from '../../db/schema/index.js';
import { db } from '../../config/drizzle.js';

let userId = '';
let adminId = '';
const userIds: string[] = [];
const regIds: string[] = [];
let c = 0;
const uniq = () => `${Date.now()}${c++}`;

const make = (date: string) => ({
  user: userId, date, checkInTime: '09:00', checkOutTime: '18:00', reason: 'forgot', status: 'PENDING' as const,
});

beforeAll(async () => {
  const u = await userRepository.queries.create({ employeeId: `RG${uniq()}`.slice(0, 18), name: 'Reg Staff', email: `rg${uniq()}@ex.com`, role: 'STAFF' });
  const a = await userRepository.queries.create({ employeeId: `RA${uniq()}`.slice(0, 18), name: 'Reg Admin', email: `ra${uniq()}@ex.com`, role: 'ADMIN' });
  userId = u.id; adminId = a.id; userIds.push(u.id, a.id);
});

afterAll(async () => {
  await db.delete(regularizations).where(inArray(regularizations.user, userIds));
  if (userIds.length) await db.delete(users).where(inArray(users.id, userIds));
});

describe('RegularizationRepository (Postgres)', () => {
  it('create + findByIdPopulatedUser populates user', async () => {
    const r = await regularizationRepository.queries.create(make('2031-02-10'));
    regIds.push(r.id);
    const pop = await regularizationRepository.queries.findByIdPopulatedUser(r.id);
    expect((pop!.user as unknown as { _id: string })._id).toBe(userId);
  });

  it('findDuplicateForDay ignores REJECTED but catches PENDING/APPROVED', async () => {
    const r = await regularizationRepository.queries.create(make('2031-02-11'));
    regIds.push(r.id);
    const dup = await regularizationRepository.queries.findDuplicateForDay(userId, '2031-02-11');
    expect(dup?.id).toBe(r.id);
    await regularizationRepository.queries.updateById(r.id, { status: 'REJECTED' });
    const afterReject = await regularizationRepository.queries.findDuplicateForDay(userId, '2031-02-11');
    expect(afterReject).toBeNull();
  });

  it('updateById approves and populates approvedBy', async () => {
    const r = await regularizationRepository.queries.create(make('2031-02-12'));
    regIds.push(r.id);
    const upd = await regularizationRepository.queries.updateById(r.id, { status: 'APPROVED', approvedBy: adminId });
    expect(upd?.status).toBe('APPROVED');
    expect((upd!.approvedBy as unknown as { _id: string })._id).toBe(adminId);
  });

  it('listStalePending returns old PENDING rows with populated user', async () => {
    const r = await regularizationRepository.queries.create(make('2031-02-13'));
    regIds.push(r.id);
    const future = new Date(Date.now() + 60_000); // cutoff in the future -> includes just-created row
    const stale = await regularizationRepository.queries.listStalePending(future);
    const mine = stale.find((x) => x.id === r.id);
    expect(mine).toBeTruthy();
    expect((mine!.user as unknown as { _id: string })._id).toBe(userId);
  });
});
