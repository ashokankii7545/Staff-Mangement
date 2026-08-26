import type { FilterQuery, Model, SortOrder } from 'mongoose';
import { DatabaseError } from '../errors/app.errors.js';
import { logger } from '../logger/logger.js';

/**
 * ────────────────────────────────────────────────────────────────────────────
 * ⭐ BASE REPOSITORY – THE SHARED QUERY EXECUTOR ⭐
 * ────────────────────────────────────────────────────────────────────────────
 * Every module owns ONE repository class extending this base. Inside it sits a
 * `queries` OBJECT – a catalog of named dynamic queries, e.g.:
 *
 *   public readonly queries = {
 *     findById:        (id: string)   => this.exec('findById', () => ...),
 *     findByEmail:     (email: string)=> this.exec('findByEmail', () => ...),
 *   };
 *
 * Services NEVER touch Mongoose directly – they call
 * `repository.queries.<name>(...)`. All execution funnels through `exec()`,
 * so timing logs, error normalization and future concerns (tracing, caching,
 * transactions) live in exactly ONE place.
 *
 * Note: the generic stays UNCONSTRAINED on purpose – module interfaces stay
 * plain data shapes; all document plumbing is encapsulated below.
 */

/** Internal escape hatch – repositories annotate their public return types. */
/* eslint-disable @typescript-eslint/no-explicit-any */
type AnyModel = Model<any>;
type AnyFilter = FilterQuery<any>;

export abstract class BaseRepository<T extends object = Record<string, any>> {
  protected constructor(private readonly _model: AnyModel) {}

  /** Raw Mongoose model – exposed read-only for advanced use (aggregations). */
  public get model(): AnyModel {
    return this._model;
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
      logger.debug(`[db] ${this._model.modelName}.${operation} (${Date.now() - startedAt}ms)`);
      return result;
    } catch (error) {
      logger.error(
        `[db] ${this._model.modelName}.${operation} FAILED (${Date.now() - startedAt}ms)`,
        error,
      );
      throw DatabaseError.from(error);
    }
  }

  // ── Generic building blocks reused by most module query catalogs ──────────

  protected qFindById(id: string): Promise<any> {
    return this._model.findById(id);
  }

  protected qFindOne(filter: AnyFilter, projection?: string | null): Promise<any> {
    return this._model.findOne(filter, projection ?? null);
  }

  protected qFind(
    filter: AnyFilter,
    options: { sort?: Record<string, SortOrder>; limit?: number; skip?: number } = {},
  ): Promise<any[]> {
    let query = this._model.find(filter);
    if (options.sort) query = query.sort(options.sort);
    if (options.limit !== undefined) query = query.limit(options.limit);
    if (options.skip !== undefined) query = query.skip(options.skip);
    return query.exec();
  }

  protected qCount(filter: AnyFilter): Promise<number> {
    return this._model.countDocuments(filter);
  }

  protected async qExists(filter: AnyFilter): Promise<boolean> {
    const doc = await this._model.exists(filter);
    return doc !== null;
  }

  protected qCreate(data: Record<string, unknown>): Promise<any> {
    return this._model.create(data);
  }

  protected qUpdateOne(
    filter: AnyFilter,
    update: Record<string, unknown>,
    options: Record<string, unknown> = { new: true },
  ): Promise<any> {
    return this._model.findOneAndUpdate(filter as never, update as never, options as never);
  }

  protected qDeleteById(id: string): Promise<any> {
    return this._model.findByIdAndDelete(id);
  }
}

