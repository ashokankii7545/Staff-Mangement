import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { inArray } from 'drizzle-orm';
import { attendanceRepository } from './attendance.repository.js';
import { userRepository } from '../user/user.repository.js';
import { attendance, users } from '../../db/schema/index.js';
import { db } from '../../config/drizzle.js';
import { ConflictError } from '../../shared/errors/app.errors.js';

let userId = '';
const userIds: string[] = [];
const attIds: string[] = [];
let c = 0;
const uniq = () => `${Date.now()}${c++}`;

const punch = (date: string, type: 'CLOCK_IN' | 'CLOCK_OUT') => ({
  user: userId,
  date,
  type,
  selfieUrl: 'http://selfie',
  location: {
    latitude: 28.6, longitude: 77.2, address: 'HQ', withinGeofence: true,
    distanceFromOffice: 5, branchName: 'HQ', isCoverDuty: false,
  },
  approvalStatus: 'PENDING' as const,
});

beforeAll(async () => {
  const u = await userRepository.queries.create({ employeeId: `AT${uniq()}`.slice(0, 18), name: 'Att Tester', email: `at${uniq()}@ex.com`, role: 'STAFF' });
  userId = u.id; userIds.push(u.id);
});

afterAll(async () => {
  await db.delete(attendance).where(inArray(attendance.user, userIds));
  if (userIds.length) await db.delete(users).where(inArray(users.id, userIds));
});

describe('AttendanceRepository (Postgres)', () => {
  it('creates a punch with jsonb location and populates user on findByIdPopulated', async () => {
    const rec = await attendanceRepository.queries.create(punch('2031-02-01', 'CLOCK_IN'));
    attIds.push(rec.id);
    expect(rec.location.branchName).toBe('HQ');
    const pop = await attendanceRepository.queries.findByIdPopulated(rec.id);
    expect((pop!.user as unknown as { _id: string })._id).toBe(userId);
  });

  it('enforces the {user,date,type} unique double-punch guard -> ConflictError', async () => {
    const rec = await attendanceRepository.queries.create(punch('2031-02-02', 'CLOCK_IN'));
    attIds.push(rec.id);
    await expect(attendanceRepository.queries.create(punch('2031-02-02', 'CLOCK_IN'))).rejects.toBeInstanceOf(ConflictError);
    // Different type on the same day is allowed.
    const out = await attendanceRepository.queries.create(punch('2031-02-02', 'CLOCK_OUT'));
    attIds.push(out.id);
    expect(out.type).toBe('CLOCK_OUT');
  });

  it('findByUserDateType finds the exact punch', async () => {
    const rec = await attendanceRepository.queries.create(punch('2031-02-03', 'CLOCK_IN'));
    attIds.push(rec.id);
    const found = await attendanceRepository.queries.findByUserDateType(userId, '2031-02-03', 'CLOCK_IN');
    expect(found?.id).toBe(rec.id);
  });

  it('listByDateRange filters by date + populates user, newest date first', async () => {
    const a = await attendanceRepository.queries.create(punch('2031-03-01', 'CLOCK_IN'));
    const b = await attendanceRepository.queries.create(punch('2031-03-05', 'CLOCK_IN'));
    attIds.push(a.id, b.id);
    const list = await attendanceRepository.queries.listByDateRange({ userId, startDate: '2031-03-01', endDate: '2031-03-31' });
    const ids = list.map((x) => x.id);
    expect(ids.indexOf(b.id)).toBeLessThan(ids.indexOf(a.id)); // 03-05 before 03-01
    expect((list[0].user as unknown as { _id: string })._id).toBe(userId);
  });

  it('updateById approves a flagged punch (populated)', async () => {
    const rec = await attendanceRepository.queries.create(punch('2031-04-10', 'CLOCK_IN'));
    attIds.push(rec.id);
    const upd = await attendanceRepository.queries.updateById(rec.id, { approvalStatus: 'APPROVED', approvedBy: userId });
    expect(upd?.approvalStatus).toBe('APPROVED');
  });

  it('recentActivity returns rows for a user filter', async () => {
    const list = await attendanceRepository.queries.recentActivity({ user: userId }, 5);
    expect(list.every((x) => (x.user as unknown as { _id: string })._id === userId)).toBe(true);
  });
});
