import { describe, it, expect, afterAll } from 'vitest';
import { inArray } from 'drizzle-orm';
import { medicineCatalogRepository } from './medicine.catalog.repository.js';
import { medicineCatalog } from '../../db/schema/index.js';
import { db } from '../../config/drizzle.js';

const ids: string[] = [];
let c = 0;
const uniq = () => `${Date.now()}${c++}`;
afterAll(async () => {
  if (ids.length) await db.delete(medicineCatalog).where(inArray(medicineCatalog.id, ids));
});

describe('MedicineCatalogRepository (Postgres)', () => {
  it('creates and finds by id', async () => {
    const m = await medicineCatalogRepository.queries.create({
      name: `MCT Dolo ${uniq()}`, genericName: 'Paracetamol', manufacturer: 'Micro Labs', price: 30, gstRate: 12,
    });
    ids.push(m.id);
    const found = await medicineCatalogRepository.queries.findById(m.id);
    expect(found?._id).toBe(m._id);
    expect(found?.gstRate).toBe(12);
  });

  it('search matches name/generic/manufacturer with ILIKE (case-insensitive)', async () => {
    const token = `zmed${uniq()}`;
    const m = await medicineCatalogRepository.queries.create({ name: `Brand ${token}`, genericName: 'salt', manufacturer: 'ACME' });
    ids.push(m.id);
    const byName = await medicineCatalogRepository.queries.search(token.toUpperCase());
    expect(byName.some((x) => x.id === m.id)).toBe(true);
    const byMfr = await medicineCatalogRepository.queries.search('acme');
    expect(byMfr.some((x) => x.id === m.id)).toBe(true);
  });

  it('findByNameExact is case-insensitive exact match', async () => {
    const name = `Exactly ${uniq()}`;
    const m = await medicineCatalogRepository.queries.create({ name });
    ids.push(m.id);
    const hit = await medicineCatalogRepository.queries.findByNameExact(name.toLowerCase());
    expect(hit?.id).toBe(m.id);
    const miss = await medicineCatalogRepository.queries.findByNameExact(`${name} extra`);
    expect(miss).toBeNull();
  });

  it('update patches fields; deactivate soft-deletes and hides from search', async () => {
    const token = `zdeact${uniq()}`;
    const m = await medicineCatalogRepository.queries.create({ name: `Deact ${token}` });
    ids.push(m.id);
    const upd = await medicineCatalogRepository.queries.update(m.id, { price: 99 });
    expect(upd?.price).toBe(99);
    await medicineCatalogRepository.deactivate(m.id);
    const search = await medicineCatalogRepository.queries.search(token);
    expect(search.some((x) => x.id === m.id)).toBe(false);
    const all = await medicineCatalogRepository.queries.listAll(true);
    expect(all.some((x) => x.id === m.id)).toBe(true);
  });
});
