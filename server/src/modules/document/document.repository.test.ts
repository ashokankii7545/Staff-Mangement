import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { inArray } from 'drizzle-orm';
import { documentRepository } from './document.repository.js';
import { userRepository } from '../user/user.repository.js';
import { documents, users } from '../../db/schema/index.js';
import { db } from '../../config/drizzle.js';

let userId = '';
let reviewerId = '';
const userIds: string[] = [];
const docIds: string[] = [];
let c = 0;
const uniq = () => `${Date.now()}${c++}`;

beforeAll(async () => {
  const u = await userRepository.queries.create({ employeeId: `DC${uniq()}`.slice(0, 18), name: 'Doc Staff', email: `dc${uniq()}@ex.com`, role: 'STAFF' });
  const r = await userRepository.queries.create({ employeeId: `DR${uniq()}`.slice(0, 18), name: 'Doc Reviewer', email: `dr${uniq()}@ex.com`, role: 'ADMIN' });
  userId = u.id; reviewerId = r.id; userIds.push(u.id, r.id);
});

afterAll(async () => {
  if (docIds.length) await db.delete(documents).where(inArray(documents.id, docIds));
  if (userIds.length) await db.delete(users).where(inArray(users.id, userIds));
});

describe('DocumentRepository (Postgres)', () => {
  it('create + listMine populates uploadedBy', async () => {
    const d = await documentRepository.queries.create({ uploadedBy: userId, title: 'ID', category: 'ID_PROOF', fileUrl: 'http://x', status: 'PENDING' });
    docIds.push(d.id);
    const mine = await documentRepository.queries.listMine(userId);
    const found = mine.find((x) => x.id === d.id);
    expect((found!.uploadedBy as unknown as { _id: string })._id).toBe(userId);
  });

  it('updateById sets status + reviewedBy (populated)', async () => {
    const d = await documentRepository.queries.create({ uploadedBy: userId, title: 'Cert', category: 'CERTIFICATE', fileUrl: 'http://y', status: 'PENDING' });
    docIds.push(d.id);
    const upd = await documentRepository.queries.updateById(d.id, { status: 'VERIFIED', reviewedBy: reviewerId, adminFeedback: 'ok' });
    expect(upd?.status).toBe('VERIFIED');
    expect((upd!.reviewedBy as unknown as { _id: string })._id).toBe(reviewerId);
  });
});
