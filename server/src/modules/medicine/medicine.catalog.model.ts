import mongoose, { Schema, type Model } from 'mongoose';

/**
 * Master catalogue entry for a medicine – maintained by the owner/admin.
 * Field set mirrors Indian retail-pharmacy item masters (Netmeds/1MG-style
 * product attributes + Drugs & Cosmetics Act schedules) so billing can reuse
 * the same data later.
 */
export interface IMedicineCatalog {
  /** Brand / trade name, e.g. "Dolo 650" */
  name: string;
  /** Generic / salt composition, e.g. "Paracetamol 650mg" */
  genericName: string;
  /** Manufacturer / company, e.g. "Micro Labs Ltd" */
  manufacturer: string;
  /** Dosage form: Tablet, Capsule, Syrup, Injection… */
  dosageForm: string;
  /** e.g. "650mg", "10ml" */
  strength: string;
  /** Packing info, e.g. "Strip of 15 tablets", "Bottle of 60ml" */
  packSize: string;
  /** Therapeutic class, e.g. "Analgesic / Antipyretic" */
  category: string;
  /** Drugs & Cosmetics Act schedule: OTC | H | H1 | X */
  schedule: string;
  /** Uses / indication, e.g. "Fever, body ache, headache" */
  uses: string;
  /** WHEN the medicine is given, e.g. "1-0-1 after food · max 4 doses/day" */
  dosageTiming: string;
  /** HOW it is given, e.g. "Swallow whole with water · complete the course" */
  directionsForUse: string;
  /** e.g. "Store below 25°C, away from moisture & light" */
  storage: string;
  /** Known side effects / warnings (short) */
  sideEffects: string;
  /** Optional pack shot served from /uploads/medicines */
  image: string;
  /** Selling rate per unit (MRP, inclusive of tax) – billing uses this; staff never see it */
  price: number;
  /** Owner's purchase/cost rate per unit (optional, for future margin reports) */
  purchaseRate: number;
  /** Indian GST slab for this medicine: 0 | 5 | 12 */
  gstRate: number;
  isActive: boolean;
  createdBy?: mongoose.Types.ObjectId | null;
  createdAt?: Date;
  updatedAt?: Date;
}

export type MedicineCatalogDocument = mongoose.HydratedDocument<IMedicineCatalog>;

const medicineCatalogSchema = new Schema<IMedicineCatalog>(
  {
    name: { type: String, required: true, trim: true },
    genericName: { type: String, trim: true, default: '' },
    manufacturer: { type: String, trim: true, default: '' },
    dosageForm: { type: String, trim: true, default: '' },
    strength: { type: String, trim: true, default: '' },
    packSize: { type: String, trim: true, default: '' },
    category: { type: String, trim: true, default: '' },
    schedule: { type: String, trim: true, default: 'OTC' },
    uses: { type: String, trim: true, default: '' },
    dosageTiming: { type: String, trim: true, default: '' },
    directionsForUse: { type: String, trim: true, default: '' },
    storage: { type: String, trim: true, default: '' },
    sideEffects: { type: String, trim: true, default: '' },
    image: { type: String, trim: true, default: '' },
    price: { type: Number, required: true, min: 0, default: 0 },
    purchaseRate: { type: Number, min: 0, default: 0 },
    gstRate: { type: Number, enum: [0, 5, 12], default: 5 },
    isActive: { type: Boolean, default: true },
    createdBy: { type: Schema.Types.ObjectId, ref: 'User', default: null },
  },
  { timestamps: true },
);

// Case-insensitive lookups power both duplicate checks and staff search.
medicineCatalogSchema.index({ name: 1 });
medicineCatalogSchema.index({ isActive: 1, name: 1 });
medicineCatalogSchema.index({ genericName: 'text', name: 'text' });

export const MedicineCatalogModel: Model<IMedicineCatalog> =
  (mongoose.models.MedicineCatalog as Model<IMedicineCatalog>) ||
  mongoose.model<IMedicineCatalog>('MedicineCatalog', medicineCatalogSchema);
