import { desc, eq } from 'drizzle-orm';
import { BaseRepository } from '../../shared/repository/base-repository.js';
import { populateRefs, populateRefsOne } from '../../shared/repository/populate.util.js';
import { documents } from '../../db/schema/document.schema.js';
import type { IStaffDocument, StaffDocumentModelDoc } from './document.model.js';

const REFS = { uploadedBy: 'user', reviewedBy: 'user' } as const;

/**
 * DocumentRepository – staff document vault data access (Postgres/Drizzle).
 * uploadedBy/reviewedBy are populated with user objects.
 */
export class DocumentRepository extends BaseRepository<typeof documents> {
  private static instance: DocumentRepository | null = null;

  private constructor() {
    super(documents);
  }

  public static getInstance(): DocumentRepository {
    if (!DocumentRepository.instance) {
      DocumentRepository.instance = new DocumentRepository();
    }
    return DocumentRepository.instance;
  }

  /** ── QUERY CATALOG ─────────────────────────────────────────────────────── */
  public readonly queries = {
    listMine: (userId: string): Promise<StaffDocumentModelDoc[]> =>
      this.exec('listMine', async () => {
        const rows = await this.db
          .select()
          .from(documents)
          .where(eq(documents.uploadedBy, userId))
          .orderBy(desc(documents.createdAt));
        return populateRefs(this.withIds(rows), REFS) as Promise<StaffDocumentModelDoc[]>;
      }),

    listAll: (): Promise<StaffDocumentModelDoc[]> =>
      this.exec('listAll', async () => {
        const rows = await this.db
          .select()
          .from(documents)
          .orderBy(desc(documents.createdAt))
          .limit(300);
        return populateRefs(this.withIds(rows), REFS) as Promise<StaffDocumentModelDoc[]>;
      }),

    findById: (id: string): Promise<StaffDocumentModelDoc | null> =>
      this.exec('findById', () => this.qFindById(id) as Promise<StaffDocumentModelDoc | null>),

    findByIdPopulatedUploadedBy: (id: string): Promise<StaffDocumentModelDoc | null> =>
      this.exec('findByIdPopulatedUploadedBy', async () => {
        const row = (await this.qFindById(id)) as StaffDocumentModelDoc | null;
        return populateRefsOne(row, { uploadedBy: 'user' }) as Promise<StaffDocumentModelDoc | null>;
      }),

    create: (data: Partial<IStaffDocument>): Promise<StaffDocumentModelDoc> =>
      this.exec('create', () => this.qInsert(data) as Promise<StaffDocumentModelDoc>),

    deleteById: (id: string): Promise<StaffDocumentModelDoc | null> =>
      this.exec('deleteById', () => this.qDeleteById(id) as Promise<StaffDocumentModelDoc | null>),

    /** Update status/feedback/reviewer, returning the populated row. */
    updateById: (id: string, patch: Partial<IStaffDocument>): Promise<StaffDocumentModelDoc | null> =>
      this.exec('updateById', async () => {
        const row = (await this.qUpdateById(id, patch)) as StaffDocumentModelDoc | null;
        return populateRefsOne(row, REFS) as Promise<StaffDocumentModelDoc | null>;
      }),
  };
}

export const documentRepository = DocumentRepository.getInstance();
