import DataLoader from 'dataloader';
import { inArray } from 'drizzle-orm';
import { db } from '../../config/drizzle.js';
import { users } from '../../db/schema/user.schema.js';
import { offices } from '../../db/schema/office.schema.js';
import type { IUserDocument } from '../../modules/user/user.model.js';
import type { OfficeDocument } from '../../modules/office/office.model.js';

export interface DataLoaders {
  userLoader: DataLoader<string, IUserDocument | null>;
  officeLoader: DataLoader<string, OfficeDocument | null>;
}

/* eslint-disable @typescript-eslint/no-explicit-any */
const withId = (row: any) => (row ? { ...row, _id: String(row.id) } : null);

/**
 * Per-request DataLoaders – batch reference lookups so GraphQL field resolvers
 * that resolve `user`/`office` don't trigger N+1 queries. Each batch runs ONE
 * `WHERE id IN (...)` and returns results in the exact order of the keys.
 */
export function createDataLoaders(): DataLoaders {
  return {
    userLoader: new DataLoader<string, IUserDocument | null>(async (keys) => {
      const rows = await db
        .select()
        .from(users)
        .where(inArray(users.id, keys as string[]));
      const map = new Map(rows.map((u) => [String(u.id), withId(u) as IUserDocument]));
      return keys.map((key) => map.get(String(key)) ?? null);
    }),

    officeLoader: new DataLoader<string, OfficeDocument | null>(async (keys) => {
      const rows = await db
        .select()
        .from(offices)
        .where(inArray(offices.id, keys as string[]));
      const map = new Map(rows.map((o) => [String(o.id), withId(o) as OfficeDocument]));
      return keys.map((key) => map.get(String(key)) ?? null);
    }),
  };
}
