import { eq, sql, type SQL } from 'drizzle-orm';
import type { PgTable, PgColumn } from 'drizzle-orm/pg-core';
import { db } from '../../config/drizzle.js';
import { DatabaseError } from '../errors/app.errors.js';
import { logger } from '../logger/logger.js';

/**
 * ────────────────────────────────────────────────────────────────────────────
 * ⭐ BASE REPOSITORY – THE SHARED QUERY EXECUTOR (Drizzle / Postgres) ⭐
 * ────────────────────────────────────────────────────────────────────────────
 * Every module owns ONE repository class extending this base. Inside it sits a
 * `queries` OBJECT – a catalog of named dynamic queries. Services NEVER touch
 * Drizzle directly – they call `repository.queries.<name>(...)`.
 *
 * All execution funnels through `exec()`, so timing logs, error normalization
 * (DatabaseError / ConflictError) and future concerns (tracing, caching) live
 * in exactly ONE place – identical contract to the old Mongoose base.
 *
 * ── _id COMPATIBILITY ──
 * The old code used Mongo `_id` everywhere (`String(user._id)`, populated refs
 * with `._id`). Postgres rows expose `id`. `withId()` attaches a string `_id`
 * alias equal to `id` so higher layers keep working unchanged.
 */

/* eslint-disable @typescript-eslint/no-explicit-any */
type AnyRow = Record<string, any>;

/** A row with the Mongo-style `_id` alias attached. */
export type WithId<T> = T & { _id: string; id: string };

/** Table shape the base needs: a Drizzle table exposing an `id` column. */
export interface TableWithId extends PgTable {
  id: PgColumn;
}

export abstract class BaseRepository<TTable extends TableWithId> {
  protected readonly db = db;

  protected constructor(protected readonly table: TTable) {}

  /** Table name for log lines (best-effort). */
  private get tableName(): string {
    return (this.table as unknown as { [k: symbol]: { name?: string } })[
      Symbol.for('drizzle:Name')
    ]?.name ?? 'table';
  }

  /**
   * Shared query executor – wraps EVERY database call with:
   *  - structured debug logging + duration
   *  - uniform error normalization (DatabaseError / ConflictError)
   */
  protected async exec<R>(operation: string, query: () => Promise<R>): Promise<R> {
    const startedAt = Date.now();
    try {
      const result = await query();
      logger.debug(`[db] ${this.tableName}.${operation} (${Date.now() - startedAt}ms)`);
      return result;
    } catch (error) {
      logger.error(`[db] ${this.tableName}.${operation} FAILED (${Date.now() - startedAt}ms)`, error);
      throw DatabaseError.from(error);
    }
  }

  /** Attach the Mongo-style `_id` alias to a row (or null through). */
  protected withId<T extends AnyRow>(row: T | null | undefined): WithId<T> | null {
    if (!row) return null;
    return { ...row, _id: String(row.id) } as WithId<T>;
  }

  /** Attach `_id` to every row in a list. */
  protected withIds<T extends AnyRow>(rows: T[]): WithId<T>[] {
    return rows.map((r) => ({ ...r, _id: String(r.id) })) as WithId<T>[];
  }

  // ── Generic building blocks reused by module query catalogs ───────────────

  protected async qFindById(id: string): Promise<AnyRow | null> {
    const rows = await this.db
      .select()
      .from(this.table as PgTable)
      .where(eq(this.table.id, id))
      .limit(1);
    return this.withId(rows[0] ?? null);
  }

  protected async qFindOne(where: SQL): Promise<AnyRow | null> {
    const rows = await this.db.select().from(this.table as PgTable).where(where).limit(1);
    return this.withId(rows[0] ?? null);
  }

  protected async qFindMany(where?: SQL): Promise<AnyRow[]> {
    const base = this.db.select().from(this.table as PgTable);
    const rows = where ? await base.where(where) : await base;
    return this.withIds(rows);
  }

  protected async qInsert(values: AnyRow): Promise<AnyRow> {
    const rows = await this.db
      .insert(this.table as PgTable)
      .values(values as never)
      .returning();
    return this.withId(rows[0])!;
  }

  protected async qUpdateById(id: string, values: AnyRow): Promise<AnyRow | null> {
    const rows = await this.db
      .update(this.table as PgTable)
      .set({ ...values, updatedAt: new Date() } as never)
      .where(eq(this.table.id, id))
      .returning();
    return this.withId(rows[0] ?? null);
  }

  protected async qUpdateWhere(where: SQL, values: AnyRow): Promise<AnyRow[]> {
    const rows = await this.db
      .update(this.table as PgTable)
      .set({ ...values, updatedAt: new Date() } as never)
      .where(where)
      .returning();
    return this.withIds(rows);
  }

  protected async qDeleteById(id: string): Promise<AnyRow | null> {
    const rows = await this.db
      .delete(this.table as PgTable)
      .where(eq(this.table.id, id))
      .returning();
    return this.withId(rows[0] ?? null);
  }

  protected async qCount(where?: SQL): Promise<number> {
    const base = this.db
      .select({ count: sql<number>`count(*)::int` })
      .from(this.table as PgTable);
    const rows = where ? await base.where(where) : await base;
    return rows[0]?.count ?? 0;
  }

  protected async qExists(where: SQL): Promise<boolean> {
    return (await this.qCount(where)) > 0;
  }
}
