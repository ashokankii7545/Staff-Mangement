import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { inArray } from 'drizzle-orm';
import { leaveRepository } from './leave.repository.js';
import { userRepository } from '../user/user.repository.js';
import { leaveRequests, users } from '../../db/schema/index.js';
import { db } from '../../config/drizzle.js';

let userId = '';
const leaveIds: string[] = [];
const userIds: string[] = [];
let c = 0;
const uniq = () => `${Date.now()}${c++}`;

beforeAll(async () => {
  const u = await userRepository.queries.create({
    employeeId: `LV${uniq()}`.slice(0, 18), name: 'Leave Tester', email: `lv${uniq()}@ex.com`, role: 'STAFF',
  });
  userId = u.id;
  userIds.push(u.id);
});

afterAll(async () => {
  if (leaveIds.length) await db.delete(leaveRequests).where(inArray(leaveRequests.id, leaveIds));
  if (userIds.length) await db.delete(users).where(inArray(users.id, userIds));
});

describe('LeaveRepository (Postgres)', () => {
  it('creates a leave and populates user on listMine', async () => {
    const lv = await leaveRepository.queries.create({
      user: userId, leaveType: 'CASUAL', startDate: new Date('2031-03-01'), endDate: new Date('2031-03-02'),
      reason: 'trip', status: 'PENDING',
    });
    leaveIds.push(lv.id);
    const mine = await leaveRepository.queries.listMine(userId);
    const found = mine.find((x) => x.id === lv.id);
    expect(found).toBeTruthy();
    expect((found!.user as unknown as { _id: string })._id).toBe(userId); // populated
  });

  it('findOverlapping detects an overlapping pending/approved leave', async () => {
    const lv = await leaveRepository.queries.create({
      user: userId, leaveType: 'SICK', startDate: new Date('2031-06-10'), endDate: new Date('2031-06-15'),
      reason: 'x', status: 'APPROVED',
    });
    leaveIds.push(lv.id);
    const overlap = await leaveRepository.queries.findOverlapping(userId, '2031-06-12', '2031-06-14');
    expect(overlap?.id).toBe(lv.id);
    const noOverlap = await leaveRepository.queries.findOverlapping(userId, '2031-07-01', '2031-07-02');
    expect(noOverlap).toBeNull();
  });

  it('updateById changes status and returns populated approvedBy', async () => {
    const lv = await leaveRepository.queries.create({
      user: userId, leaveType: 'EARNED', startDate: new Date('2031-09-01'), endDate: new Date('2031-09-01'),
      reason: 'y', status: 'PENDING',
    });
    leaveIds.push(lv.id);
    const upd = await leaveRepository.queries.updateById(lv.id, { status: 'APPROVED', approvedBy: userId });
    expect(upd?.status).toBe('APPROVED');
    expect((upd!.approvedBy as unknown as { _id: string })._id).toBe(userId);
  });

  it('countPending counts pending leaves', async () => {
    const n = await leaveRepository.queries.countPending();
    expect(typeof n).toBe('number');
  });
});
