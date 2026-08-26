import { BaseRepository } from '../../shared/repository/base-repository.js';
import {
  StaffDocumentModel,
  type IStaffDocument,
  type StaffDocumentModelDoc,
} from './document.model.js';

/**
 * DocumentRepository – staff document vault data access.
 */
export class DocumentRepository extends BaseRepository<IStaffDocument> {
  private static instance: DocumentRepository | null = null;

  private constructor() {
    super(StaffDocumentModel);
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
      this.exec('listMine', () =>
        StaffDocumentModel.find({ uploadedBy: userId })
          .sort({ createdAt: -1 })
          .populate('uploadedBy')
          .populate('reviewedBy') as Promise<StaffDocumentModelDoc[]>,
      ),

    listAll: (): Promise<StaffDocumentModelDoc[]> =>
      this.exec('listAll', () =>
        StaffDocumentModel.find()
          .sort({ createdAt: -1 })
          .limit(300)
          .populate('uploadedBy')
          .populate('reviewedBy') as Promise<StaffDocumentModelDoc[]>,
      ),

    findById: (id: string): Promise<StaffDocumentModelDoc | null> =>
      this.exec('findById', () => this.qFindById(id) as Promise<StaffDocumentModelDoc | null>),

    findByIdPopulatedUploadedBy: (id: string): Promise<StaffDocumentModelDoc | null> =>
      this.exec('findByIdPopulatedUploadedBy', async () => {
        const doc = await this.qFindById(id);
        return doc ? ((await doc.populate('uploadedBy')) as StaffDocumentModelDoc) : null;
      }),

    create: (data: Partial<IStaffDocument>): Promise<StaffDocumentModelDoc> =>
      this.exec(
        'create',
        async () => (await StaffDocumentModel.create(data as IStaffDocument)) as StaffDocumentModelDoc,
      ),

    deleteById: (id: string): Promise<StaffDocumentModelDoc | null> =>
      this.exec('deleteById', () => this.qDeleteById(id)),
  };
}

export const documentRepository = DocumentRepository.getInstance();
