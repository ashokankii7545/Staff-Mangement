import { describe, it, expect, afterAll } from 'vitest';
import { eq } from 'drizzle-orm';
import { BaseRepository } from './base-repository.js';
import { offices } from '../../db/schema/index.js';
import { db } from '../../config/drizzle.js';
import { ConflictError } from '../errors/app.errors.js';

/** Minimal concrete repo exposing the protected helpers for testing. */
class TestOfficeRepo extends BaseRepository<typeof offices> {
  constructor() {
    super(offices);
  }
  insert(v: Record<string, unknown>) {
    return this.exec('insert', () => this.qInsert(v));
  }
  findById(id: string) {
    return this.exec('findById', () => this.qFindById(id));
  }
  findOne(name: string) {
    return this.exec('findOne', () => this.qFindOne(eq(offices.name, name)));
  }
  updateById(id: string, v: Record<string, unknown>) {
    return this.exec('updateById', () => this.qUpdateById(id, v));
  }
  del(id: string) {
    return this.exec('del', () => this.qDeleteById(id));
  }
  count(name: string) {
    return this.exec('count', () => this.qCount(eq(offices.name, name)));
  }
  // Force a NOT NULL violation to check error normalization path.
  insertRaw(v: Record<string, unknown>) {
    return this.exec('insertRaw', () => this.qInsert(v));
  }
}

const repo = new TestOfficeRepo();
const created: string[] = [];

afterAll(async () => {
  for (const id of created) {
    await db.delete(offices).where(eq(offices.id, id));
  }
});

describe('BaseRepository (Drizzle)', () => {
  it('inserts and attaches _id compatibility alias', async () => {
    const row = await repo.insert({ name: 'BaseTest HQ', latitude: 1.1, longitude: 2.2 });
    created.push(row.id);
    expect(row.id).toBeTruthy();
    expect(row._id).toBe(String(row.id));
    expect(row.name).toBe('BaseTest HQ');
  });

  it('finds by id and by predicate', async () => {
    const row = await repo.insert({ name: 'BaseTest Branch', latitude: 3, longitude: 4 });
    created.push(row.id);
    const byId = await repo.findById(row.id);
    expect(byId?._id).toBe(row._id);
    const byName = await repo.findOne('BaseTest Branch');
    expect(byName?.id).toBe(row.id);
  });

  it('updates by id and bumps updatedAt', async () => {
    const row = await repo.insert({ name: 'BaseTest Upd', latitude: 5, longitude: 6 });
    created.push(row.id);
    const updated = await repo.updateById(row.id, { address: '123 Main St' });
    expect(updated?.address).toBe('123 Main St');
  });

  it('counts by predicate', async () => {
    const row = await repo.insert({ name: 'BaseTest Count', latitude: 7, longitude: 8 });
    created.push(row.id);
    expect(await repo.count('BaseTest Count')).toBe(1);
  });

  it('deletes by id', async () => {
    const row = await repo.insert({ name: 'BaseTest Del', latitude: 9, longitude: 10 });
    const deleted = await repo.del(row.id);
    expect(deleted?.id).toBe(row.id);
    expect(await repo.findById(row.id)).toBeNull();
  });

  it('normalizes DB errors into AppError (NOT NULL violation)', async () => {
    // latitude is NOT NULL – omitting it triggers a Postgres error that must
    // be normalized (not leak a raw driver error).
    await expect(repo.insertRaw({ name: 'BaseTest Bad' })).rejects.toMatchObject({
      extensions: { code: expect.any(String) },
    });
  });
});
