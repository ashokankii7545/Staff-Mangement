import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { inArray } from 'drizzle-orm';
import { dayOffRepository } from './day-off.repository.js';
import { userRepository } from '../user/user.repository.js';
import { exemptions, users } from '../../db/schema/index.js';
import { db } from '../../config/drizzle.js';

let userId = '';
let adminId = '';
const userIds: string[] = [];
let c = 0;
const uniq = () => `${Date.now()}${c++}`;

beforeAll(async () => {
  const u = await userRepository.queries.create({ employeeId: `DO${uniq()}`.slice(0, 18), name: 'DayOff Staff', email: `do${uniq()}@ex.com`, role: 'STAFF' });
  const a = await userRepository.queries.create({ employeeId: `DA${uniq()}`.slice(0, 18), name: 'DayOff Admin', email: `da${uniq()}@ex.com`, role: 'ADMIN' });
  userId = u.id; adminId = a.id;
  userIds.push(u.id, a.id);
});

afterAll(async () => {
  await db.delete(exemptions).where(inArray(exemptions.user, userIds));
  if (userIds.length) await db.delete(users).where(inArray(users.id, userIds));
});

describe('DayOffRepository (Postgres)', () => {
  it('upsertByUserAndDate creates then updates (unique user+date) and populates', async () => {
    const first = await dayOffRepository.queries.upsertByUserAndDate(userId, '2031-04-01', 'sick', adminId);
    expect((first.user as unknown as { _id: string })._id).toBe(userId);
    expect((first.createdBy as unknown as { _id: string })._id).toBe(adminId);
    expect(first.reason).toBe('sick');
    // Upsert same (user,date) -> updates reason, no duplicate row.
    const second = await dayOffRepository.queries.upsertByUserAndDate(userId, '2031-04-01', 'personal', adminId);
    expect(second.reason).toBe('personal');
    const count = await dayOffRepository.queries.countByDate('2031-04-01');
    expect(count).toBeGreaterThanOrEqual(1);
  });

  it('listByDateRange filters + populates user/createdBy', async () => {
    await dayOffRepository.queries.upsertByUserAndDate(userId, '2031-05-15', 'x', adminId);
    const list = await dayOffRepository.queries.listByDateRange({ startDate: '2031-05-01', endDate: '2031-05-31' });
    const mine = list.find((e) => e.user && (e.user as unknown as { _id: string })._id === userId);
    expect(mine).toBeTruthy();
  });

  it('findByUserAndDate + deleteById', async () => {
    await dayOffRepository.queries.upsertByUserAndDate(userId, '2031-08-20', 'y', adminId);
    const found = await dayOffRepository.queries.findByUserAndDate(userId, '2031-08-20');
    expect(found).toBeTruthy();
    const del = await dayOffRepository.queries.deleteById(found!.id);
    expect(del?.id).toBe(found!.id);
  });
});
