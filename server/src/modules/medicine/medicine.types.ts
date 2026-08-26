export const medicineTypes = /* GraphQL */ `
  """Medicine stock request raised by pharmacy staff for the owner/admin"""
  type MedicineRequest {
    id: ID!
    requestedBy: User!
    medicineName: String!
    strength: String
    quantity: Int!
    unit: String!
    urgency: String!
    notes: String
    status: String!
    adminFeedback: String
    """Master-catalogue entry linked to this request (null when brand-new)"""
    catalogMedicine: MedicineCatalog
    """True when the requested medicine is not yet in the owner's catalogue"""
    isNewMedicine: Boolean
    handledBy: User
    createdAt: DateTime
    updatedAt: DateTime
  }

  input MedicineRequestInput {
    """Optional – set when staff picks an existing catalogue entry"""
    catalogMedicineId: ID
    medicineName: String
    strength: String
    quantity: Int!
    unit: String
    urgency: String
    notes: String
  }

  """Admin-maintained master entry for a medicine (shop catalogue).
  Field set mirrors Indian retail-pharmacy item masters (Netmeds/1MG-style
  product attributes + Drugs & Cosmetics Act schedules)."""
  type MedicineCatalog {
    id: ID!
    """Brand / trade name, e.g. Dolo 650"""
    name: String!
    """Generic / salt composition, e.g. Paracetamol 650mg"""
    genericName: String
    """Manufacturer / company, e.g. Micro Labs Ltd"""
    manufacturer: String
    """Dosage form: Tablet, Capsule, Syrup, Injection..."""
    dosageForm: String
    """e.g. 650mg or 10ml"""
    strength: String
    """Packing, e.g. Strip of 15 tablets"""
    packSize: String
    """Therapeutic class, e.g. Analgesic-Antipyretic"""
    category: String
    """Drugs & Cosmetics Act schedule: OTC | H | H1 | X (Rx = prescription)"""
    schedule: String
    """Uses / indication, e.g. Fever, body ache"""
    uses: String
    """WHEN to give, e.g. 1-0-1 after food, max 4 doses per day"""
    dosageTiming: String
    """HOW to give, e.g. Swallow whole with water, complete the course"""
    directionsForUse: String
    """e.g. Store below 25C, away from moisture"""
    storage: String
    """Known side effects / warnings (short)"""
    sideEffects: String
    """Optional pack shot served from /uploads/medicines"""
    image: String
    """Selling rate per unit (MRP incl. tax) - billing uses this; never shown to staff"""
    price: Float!
    """Owner's purchase/cost rate per unit (optional, margin reports later)"""
    purchaseRate: Float
    """Indian GST slab: 0 | 5 | 12"""
    gstRate: Float
    isActive: Boolean!
    createdBy: User
    createdAt: DateTime
    updatedAt: DateTime
  }

  input MedicineCatalogInput {
    name: String!
    genericName: String
    manufacturer: String
    dosageForm: String
    strength: String
    packSize: String
    category: String
    schedule: String
    uses: String
    dosageTiming: String
    directionsForUse: String
    storage: String
    sideEffects: String
    """Base64 data-URI pack photo (JPG/PNG/WebP ≤3 MB), optional"""
    imageBase64: String
    price: Float!
    purchaseRate: Float
    gstRate: Float
    isActive: Boolean
  }
`;
