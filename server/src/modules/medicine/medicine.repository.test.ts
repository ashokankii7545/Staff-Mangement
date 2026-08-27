import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { inArray } from 'drizzle-orm';
import { medicineRepository } from './medicine.repository.js';
import { medicineCatalogRepository } from './medicine.catalog.repository.js';
import { userRepository } from '../user/user.repository.js';
import { medicineRequests, medicineCatalog, users } from '../../db/schema/index.js';
import { db } from '../../config/drizzle.js';

let userId = '';
let handlerId = '';
let catalogId = '';
const userIds: string[] = [];
const reqIds: string[] = [];
const catIds: string[] = [];
let c = 0;
const uniq = () => `${Date.now()}${c++}`;

beforeAll(async () => {
  const u = await userRepository.queries.create({ employeeId: `MR${uniq()}`.slice(0, 18), name: 'Med Staff', email: `mr${uniq()}@ex.com`, role: 'STAFF' });
  const h = await userRepository.queries.create({ employeeId: `MH${uniq()}`.slice(0, 18), name: 'Med Handler', email: `mh${uniq()}@ex.com`, role: 'ADMIN' });
  const cat = await medicineCatalogRepository.queries.create({ name: `MRCat ${uniq()}`, strength: '500mg' });
  userId = u.id; handlerId = h.id; catalogId = cat.id;
  userIds.push(u.id, h.id); catIds.push(cat.id);
});

afterAll(async () => {
  if (reqIds.length) await db.delete(medicineRequests).where(inArray(medicineRequests.id, reqIds));
  if (catIds.length) await db.delete(medicineCatalog).where(inArray(medicineCatalog.id, catIds));
  if (userIds.length) await db.delete(users).where(inArray(users.id, userIds));
});

describe('MedicineRepository (Postgres)', () => {
  it('create + listMine populates requestedBy + catalogMedicine', async () => {
    const r = await medicineRepository.queries.create({
      requestedBy: userId, medicineName: 'Dolo', quantity: 2, unit: 'Strips', urgency: 'NORMAL',
      status: 'PENDING', catalogMedicine: catalogId, isNewMedicine: false,
    });
    reqIds.push(r.id);
    const mine = await medicineRepository.queries.listMine(userId);
    const found = mine.find((x) => x.id === r.id);
    expect((found!.requestedBy as unknown as { _id: string })._id).toBe(userId);
    expect((found!.catalogMedicine as unknown as { _id: string })._id).toBe(catalogId);
  });

  it('updateById sets status + handledBy (populated)', async () => {
    const r = await medicineRepository.queries.create({
      requestedBy: userId, medicineName: 'Crocin', quantity: 1, unit: 'Bottles', urgency: 'URGENT', status: 'PENDING', isNewMedicine: true,
    });
    reqIds.push(r.id);
    const upd = await medicineRepository.queries.updateById(r.id, { status: 'SUPPLIED', handledBy: handlerId });
    expect(upd?.status).toBe('SUPPLIED');
    expect((upd!.handledBy as unknown as { _id: string })._id).toBe(handlerId);
  });
});
