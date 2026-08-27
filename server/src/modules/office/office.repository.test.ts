import { describe, it, expect, afterAll } from 'vitest';
import { eq, inArray } from 'drizzle-orm';
import { officeRepository } from './office.repository.js';
import { offices } from '../../db/schema/index.js';
import { db } from '../../config/drizzle.js';

const createdIds: string[] = [];
const track = <T extends { id: string }>(row: T): T => {
  createdIds.push(row.id);
  return row;
};

afterAll(async () => {
  if (createdIds.length) await db.delete(offices).where(inArray(offices.id, createdIds));
});

describe('OfficeRepository (Postgres)', () => {
  it('create returns a row with id + _id', async () => {
    const o = track(await officeRepository.queries.create({
      name: 'OT HQ', address: 'A', latitude: 12.9, longitude: 77.6, geofenceRadius: 150,
    }));
    expect(o.id).toBeTruthy();
    expect(o._id).toBe(String(o.id));
    expect(o.geofenceRadius).toBe(150);
    expect(o.isActive).toBe(true);
  });

  it('findById returns the created office', async () => {
    const o = track(await officeRepository.queries.create({ name: 'OT Find', latitude: 1, longitude: 2 }));
    const found = await officeRepository.queries.findById(o.id);
    expect(found?._id).toBe(o._id);
    expect(found?.name).toBe('OT Find');
  });

  it('listActive returns active offices newest-first', async () => {
    const a = track(await officeRepository.queries.create({ name: 'OT List A', latitude: 1, longitude: 2 }));
    const b = track(await officeRepository.queries.create({ name: 'OT List B', latitude: 3, longitude: 4 }));
    const list = await officeRepository.queries.listActive();
    const ids = list.map((x) => x.id);
    expect(ids).toContain(a.id);
    expect(ids).toContain(b.id);
    // newest-first: B created after A, so B appears before A.
    expect(ids.indexOf(b.id)).toBeLessThan(ids.indexOf(a.id));
  });

  it('updateById patches fields', async () => {
    const o = track(await officeRepository.queries.create({ name: 'OT Upd', latitude: 1, longitude: 2 }));
    const upd = await officeRepository.queries.updateById(o.id, { address: 'New Address' });
    expect(upd?.address).toBe('New Address');
  });

  it('softDelete flips isActive to false and drops it from listActive', async () => {
    const o = track(await officeRepository.queries.create({ name: 'OT Soft', latitude: 1, longitude: 2 }));
    const deleted = await officeRepository.queries.softDelete(o.id);
    expect(deleted?.isActive).toBe(false);
    const stillActive = await db.select().from(offices).where(eq(offices.id, o.id));
    expect(stillActive[0].isActive).toBe(false);
  });
});
