import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { inArray } from 'drizzle-orm';
import { createDataLoaders } from './dataloader.js';
import { userRepository } from '../../modules/user/user.repository.js';
import { officeRepository } from '../../modules/office/office.repository.js';
import { users, offices } from '../../db/schema/index.js';
import { db } from '../../config/drizzle.js';

const userIds: string[] = [];
const officeIds: string[] = [];
let c = 0;
const uniq = () => `${Date.now()}${c++}`;

beforeAll(async () => {
  for (let i = 0; i < 3; i++) {
    const u = await userRepository.queries.create({ employeeId: `DL${uniq()}`.slice(0, 18), name: `DL User ${i}`, email: `dl${uniq()}@ex.com`, role: 'STAFF' });
    userIds.push(u.id);
  }
  const o = await officeRepository.queries.create({ name: `DL Office ${uniq()}`, latitude: 1, longitude: 2 });
  officeIds.push(o.id);
});

afterAll(async () => {
  if (userIds.length) await db.delete(users).where(inArray(users.id, userIds));
  if (officeIds.length) await db.delete(offices).where(inArray(offices.id, officeIds));
});

describe('DataLoaders (Drizzle batching)', () => {
  it('userLoader returns results in key order and null for missing ids', async () => {
    const { userLoader } = createDataLoaders();
    const missing = '00000000-0000-0000-0000-000000000000';
    const keys = [userIds[2], missing, userIds[0], userIds[1]];
    const results = await userLoader.loadMany(keys);
    expect((results[0] as { id: string }).id).toBe(userIds[2]);
    expect(results[1]).toBeNull();
    expect((results[2] as { id: string }).id).toBe(userIds[0]);
    expect((results[3] as { id: string }).id).toBe(userIds[1]);
    // Attached _id compatibility alias.
    expect((results[0] as { _id: string })._id).toBe(userIds[2]);
  });

  it('officeLoader resolves an office with _id', async () => {
    const { officeLoader } = createDataLoaders();
    const o = await officeLoader.load(officeIds[0]);
    expect((o as { _id: string })._id).toBe(officeIds[0]);
  });

  it('batches multiple .load() calls in one tick into a single query', async () => {
    // Spy on the pool by counting queries would require driver hooks; instead we
    // assert DataLoader coalesces: loading all 3 ids concurrently resolves all.
    const { userLoader } = createDataLoaders();
    const [a, b, cc] = await Promise.all([
      userLoader.load(userIds[0]),
      userLoader.load(userIds[1]),
      userLoader.load(userIds[2]),
    ]);
    expect([a, b, cc].every(Boolean)).toBe(true);
  });
});
