import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { inArray } from 'drizzle-orm';
import { notificationRepository } from './notification.repository.js';
import { userRepository } from '../user/user.repository.js';
import { notifications, users } from '../../db/schema/index.js';
import { db } from '../../config/drizzle.js';

let userId = '';
const userIds: string[] = [];
let c = 0;
const uniq = () => `${Date.now()}${c++}`;

beforeAll(async () => {
  const u = await userRepository.queries.create({
    employeeId: `NT${uniq()}`.slice(0, 18), name: 'Notif Tester', email: `nt${uniq()}@ex.com`, role: 'ADMIN',
  });
  userId = u.id;
  userIds.push(u.id);
});

afterAll(async () => {
  await db.delete(notifications).where(inArray(notifications.recipient, userIds));
  if (userIds.length) await db.delete(users).where(inArray(users.id, userIds));
});

describe('NotificationRepository (Postgres)', () => {
  it('insertMany + listForRecipient (newest first) + countUnread', async () => {
    // Insert in separate statements so created_at differs and ordering is deterministic.
    await notificationRepository.queries.insertManyNotifications([
      { recipient: userId, type: 'GENERIC', title: 'One', message: '', link: '', meta: {} },
    ]);
    await new Promise((r) => setTimeout(r, 5));
    await notificationRepository.queries.insertManyNotifications([
      { recipient: userId, type: 'GENERIC', title: 'Two', message: '', link: '', meta: {} },
    ]);
    const list = await notificationRepository.queries.listForRecipient(userId);
    expect(list.length).toBeGreaterThanOrEqual(2);
    expect(list[0].title).toBe('Two'); // newest first
    // recipient must be populated (full user object) for the GraphQL User! field.
    expect((list[0].recipient as unknown as { _id: string })._id).toBe(userId);
    expect(await notificationRepository.queries.countUnread(userId)).toBeGreaterThanOrEqual(2);
  });

  it('markAllRead marks everything read', async () => {
    await notificationRepository.queries.insertManyNotifications([
      { recipient: userId, type: 'GENERIC', title: 'X', message: '', link: '', meta: {} },
    ]);
    const n = await notificationRepository.queries.markAllRead(userId);
    expect(n).toBeGreaterThanOrEqual(1);
    expect(await notificationRepository.queries.countUnread(userId)).toBe(0);
  });

  it('findByIdPopulatedRecipient attaches recipient user with _id', async () => {
    const [n] = await notificationRepository.queries.insertManyNotifications([
      { recipient: userId, type: 'GENERIC', title: 'Pop', message: '', link: '', meta: {} },
    ]);
    const pop = await notificationRepository.queries.findByIdPopulatedRecipient(n.id);
    expect((pop!.recipient as unknown as { _id: string })._id).toBe(userId);
  });

  it('meta jsonb queries: deleteSignupRequests + findReminderByKey', async () => {
    await notificationRepository.queries.insertManyNotifications([
      { recipient: userId, type: 'SIGNUP_REQUEST', title: 'sig', message: '', link: '', meta: { userId } },
      { recipient: userId, type: 'PUNCH_REMINDER', title: 'rem', message: '', link: '', meta: { reminderKey: `rk-${userId}` } },
    ]);
    const rem = await notificationRepository.queries.findReminderByKey(`rk-${userId}`);
    expect(rem).toBeTruthy();
    await notificationRepository.queries.deleteSignupRequests(userId);
    const list = await notificationRepository.queries.listForRecipient(userId, { limit: 100 });
    expect(list.some((x) => x.type === 'SIGNUP_REQUEST')).toBe(false);
  });
});
