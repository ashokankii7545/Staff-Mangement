import { inArray } from 'drizzle-orm';
import { db } from '../../config/drizzle.js';
import { users } from '../../db/schema/user.schema.js';
import { offices } from '../../db/schema/office.schema.js';
import { medicineCatalog } from '../../db/schema/medicine-catalog.schema.js';

/* eslint-disable @typescript-eslint/no-explicit-any */
type AnyRow = Record<string, any>;

const attachId = (row: AnyRow | undefined): AnyRow | null =>
  row ? { ...row, _id: String(row.id) } : null;

const loadMap = async (
  table: typeof users | typeof offices | typeof medicineCatalog,
  ids: string[],
): Promise<Map<string, AnyRow>> => {
  const unique = [...new Set(ids.filter(Boolean).map(String))];
  if (unique.length === 0) return new Map();
  const rows = await db.select().from(table as any).where(inArray((table as any).id, unique));
  return new Map(rows.map((r: AnyRow) => [String(r.id), attachId(r)!]));
};

/** Which reference tables a given field should resolve against. */
export type RefTable = 'user' | 'office' | 'medicineCatalog';

/**
 * Populate uuid reference fields on a set of rows with the related objects,
 * batching one query per referenced table (DataLoader-style, N+1-safe).
 *
 * Example:
 *   await populateRefs(rows, { user: 'user', approvedBy: 'user', punchedOffice: 'office' })
 * replaces each row's `user`/`approvedBy` uuid with the user object and
 * `punchedOffice` uuid with the office object (each carrying `_id`).
 */
export const populateRefs = async <T extends AnyRow>(
  rows: T[],
  fieldMap: Record<string, RefTable>,
): Promise<T[]> => {
  if (rows.length === 0) return rows;

  const idsByTable: Record<RefTable, string[]> = { user: [], office: [], medicineCatalog: [] };
  for (const row of rows) {
    for (const [field, table] of Object.entries(fieldMap)) {
      const v = row[field];
      if (typeof v === 'string' && v) idsByTable[table].push(v);
    }
  }

  const [userMap, officeMap, catalogMap] = await Promise.all([
    loadMap(users, idsByTable.user),
    loadMap(offices, idsByTable.office),
    loadMap(medicineCatalog, idsByTable.medicineCatalog),
  ]);
  const maps: Record<RefTable, Map<string, AnyRow>> = {
    user: userMap,
    office: officeMap,
    medicineCatalog: catalogMap,
  };

  return rows.map((row) => {
    const clone: AnyRow = { ...row };
    for (const [field, table] of Object.entries(fieldMap)) {
      const v = clone[field];
      if (typeof v === 'string' && v) {
        clone[field] = maps[table].get(v) ?? v;
      }
    }
    return clone as T;
  });
};

/** Populate a single row (or null). */
export const populateRefsOne = async <T extends AnyRow>(
  row: T | null,
  fieldMap: Record<string, RefTable>,
): Promise<T | null> => {
  if (!row) return null;
  const [populated] = await populateRefs([row], fieldMap);
  return populated ?? null;
};
