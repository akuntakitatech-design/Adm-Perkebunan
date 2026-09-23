import { db, router, json, error, requireAuth, storage, backupAndDeleteWorkspace } from './localSdk';
import { referencePlantationAdditions } from './plantationCoa';

type Role = 'OWNER' | 'ADMIN_PUSAT' | 'FINANCE' | 'ADMIN_KEBUN' | 'VIEWER';
type KebunRecord = {
  code: string;
  name: string;
  owner?: string;
  location: string;
  areaHa: number;
  treeCount?: number;
  status: 'AKTIF' | 'NONAKTIF';
  createdAt: string;
  updatedAt: string;
};
type AccountRecord = {
  name: string;
  type: 'KAS' | 'BANK';
  openingBalance: number;
  bankName: string;
  accountNumber: string;
  createdAt: string;
  updatedAt: string;
};
type WeightBasis = 'LAPANGAN' | 'PABRIK';
type TransportMode = 'TRIP' | 'KG_LAPANGAN' | 'KG_PABRIK';
type MillRecord = {
  name: string;
  location: string;
  active: boolean;
  createdAt: string;
  updatedAt: string;
};
type HarvesterRecord = {
  name: string;
  phone: string;
  active: boolean;
  createdAt: string;
  updatedAt: string;
};
type VehicleRecord = {
  plateNumber: string;
  name: string;
  owner: string;
  ownershipType?: 'OWN' | 'VENDOR';
  supplierId?: string;
  rentMode: TransportMode;
  defaultRate: number;
  active: boolean;
  createdAt: string;
  updatedAt: string;
};
type TbsRateRecord = {
  kebunId: string;
  effectiveDate: string;
  harvestRatePerKg: number;
  harvestWeightBasis: WeightBasis;
  weighingEnabled?: boolean;
  weighingRatePerKg: number;
  weighingWeightBasis?: WeightBasis;
  langsirEnabled: boolean;
  langsirRatePerKg: number;
  langsirWeightBasis: WeightBasis;
  createdAt: string;
  updatedAt: string;
};
type TbsRecord = {
  date: string;
  factoryDate: string;
  doNumber: string;
  kebunId: string;
  millId: string;
  harvesterId: string;
  langsirWorkerId?: string;
  vehicleId: string;
  armadaSupplierBillId?: string;
  fieldWeightKg: number;
  factoryWeightKg: number;
  factoryBrutoWeightKg?: number;
  factoryTareWeightKg?: number;
  factoryNet1WeightKg?: number;
  factoryGrossWeightKg?: number;
  factoryDeductionKg?: number;
  factoryDeductionPct?: number;
  deductionAmount?: number;
  factoryTicketNumber: string;
  pricePerKg: number;
  deductions: number;
  harvestRatePerKg: number;
  harvestWeightBasis: WeightBasis;
  weighingRatePerKg?: number;
  weighingWeightBasis?: WeightBasis;
  weighingCost?: number;
  langsirRatePerKg: number;
  langsirWeightBasis: WeightBasis;
  transportMode: TransportMode;
  transportRate: number;
  harvestCost: number;
  langsirCost: number;
  transportCost: number;
  grossRevenue: number;
  netRevenue: number;
  directCost: number;
  margin: number;
  weightDifferenceKg: number;
  weightDifferencePct: number;
  status: 'LAPANGAN' | 'PABRIK' | 'SELESAI';
  note: string;
  createdBy: string;
  updatedBy: string;
  createdAt: string;
  updatedAt: string;
};
type TbsPaymentAllocation = {
  tbsId: string;
  kebunId: string;
  doNumber: string;
  amount: number;
};
type TbsPaymentRecord = {
  paymentNumber: string;
  date: string;
  millId: string;
  accountId: string;
  amount: number;
  reference: string;
  note: string;
  allocations: TbsPaymentAllocation[];
  transactionIds: string[];
  createdBy: string;
  createdAt: string;
};
type TbsCostComponent = 'PANEN' | 'LANGSIR' | 'ARMADA';
type TbsCostPaymentAllocation = {
  tbsId: string;
  kebunId: string;
  doNumber: string;
  component: TbsCostComponent;
  creditorKey: string;
  creditorName: string;
  amount: number;
};
type TbsCostPaymentRecord = {
  paymentNumber: string;
  date: string;
  component: TbsCostComponent;
  creditorKey: string;
  creditorName: string;
  accountId: string;
  amount: number;
  reference: string;
  note: string;
  allocations: TbsCostPaymentAllocation[];
  transactionIds: string[];
  createdBy: string;
  createdAt: string;
};
type SupplierRecord = {
  code: string;
  name: string;
  contact: string;
  phone: string;
  address: string;
  active: boolean;
  createdAt: string;
  updatedAt: string;
};
type SupplierBillRecord = {
  sourceType?: 'TBS_ARMADA' | 'PURCHASE_INVOICE';
  sourceId?: string;
  accountingDebitAccountId?: string;
  date: string;
  dueDate: string;
  supplierId: string;
  kebunId: string;
  invoiceNumber: string;
  category: string;
  description: string;
  amount: number;
  createdBy: string;
  updatedBy: string;
  createdAt: string;
  updatedAt: string;
};
type SupplierPaymentAllocation = {
  billId: string;
  kebunId: string;
  invoiceNumber: string;
  amount: number;
};
type SupplierPaymentRecord = {
  paymentNumber: string;
  date: string;
  supplierId: string;
  accountId: string;
  amount: number;
  reference: string;
  note: string;
  allocations: SupplierPaymentAllocation[];
  transactionIds: string[];
  createdBy: string;
  createdAt: string;
};
type PayrollManualKind = 'EARNING' | 'DEDUCTION';
type PayrollManualRecord = {
  date: string;
  workerId: string;
  kebunId: string;
  kind: PayrollManualKind;
  category: string;
  amount: number;
  note: string;
  createdBy: string;
  updatedBy: string;
  createdAt: string;
  updatedAt: string;
};
type WorkTypeRecord = {
  name: string;
  unit: string;
  active: boolean;
  createdBy: string;
  updatedBy: string;
  createdAt: string;
  updatedAt: string;
};
type WorkRateRecord = {
  workTypeId: string;
  kebunId: string;
  effectiveDate: string;
  rate: number;
  createdBy: string;
  updatedBy: string;
  createdAt: string;
  updatedAt: string;
};
type WorkEntryRecord = {
  date: string;
  kebunId: string;
  workerId: string;
  workTypeId: string;
  workName: string;
  unit: string;
  quantity: number;
  rate: number;
  amount: number;
  note: string;
  createdBy: string;
  updatedBy: string;
  createdAt: string;
  updatedAt: string;
};
type EmployeeReceivableRecord = {
  date: string;
  workerId: string;
  accountId?: string;
  transactionId?: string;
  description: string;
  totalAmount: number;
  installmentCount: number;
  note: string;
  createdBy: string;
  updatedBy: string;
  createdAt: string;
  updatedAt: string;
};
type EmployeeReceivableOption = {
  receivableId: string;
  description: string;
  totalAmount: number;
  totalDeducted: number;
  outstandingAmount: number;
  installmentCount: number;
  currentInstallment: number;
  suggestedAmount: number;
};
type PayrollLine = {
  sourceKey: string;
  sourceType: 'TBS_PANEN' | 'TBS_TIMBANG' | 'TBS_LANGSIR' | 'KEBUN_WORK' | 'MANUAL' | 'EMPLOYEE_RECEIVABLE';
  sourceId: string;
  kebunId: string;
  date: string;
  kind: PayrollManualKind;
  label: string;
  amount: number;
  doNumber?: string;
};
type PayrollRunRecord = {
  payrollNumber: string;
  periodStart: string;
  periodEnd: string;
  workerId: string;
  workerName: string;
  lines: PayrollLine[];
  grossEarnings: number;
  deductions: number;
  netPay: number;
  status: 'OPEN' | 'PAID';
  paymentDate: string;
  accountId: string;
  reference: string;
  note: string;
  transactionIds: string[];
  createdBy: string;
  createdAt: string;
  updatedAt: string;
};
type PayrollCandidate = {
  workerId: string;
  workerName: string;
  lines: PayrollLine[];
  grossEarnings: number;
  deductions: number;
  netPay: number;
  receivableOptions: EmployeeReceivableOption[];
};
type TbsMasterKind = 'mills' | 'harvesters' | 'vehicles' | 'rates';
type TbsMasterRecord = MillRecord | HarvesterRecord | VehicleRecord | TbsRateRecord;

type TransactionAllocationRecord = { accountId: string; kebunId?: string; amount: number; memo: string };
type TransactionRecord = {
  transactionNumber?: string;
  kind?: 'NORMAL' | 'TRANSFER';
  transferId?: string;
  sourceType?: 'TBS_PAYMENT' | 'TBS_COST_PAYMENT' | 'SUPPLIER_PAYMENT' | 'PAYROLL_PAYMENT' | 'EMPLOYEE_RECEIVABLE_DISBURSEMENT' | 'PURCHASE_INVOICE';
  sourceId?: string;
  date: string;
  kebunId: string;
  accountId: string;
  direction: 'IN' | 'OUT';
  category: string;
  description: string;
  amount: number;
  reference: string;
  allocations?: TransactionAllocationRecord[];
  restrictedProjection?: boolean;
  receiptPath?: string;
  receiptName?: string;
  receiptContentType?: string;
  createdBy?: string;
  updatedBy?: string;
  createdAt: string;
  updatedAt: string;
};
type AccountingGroup = 'ASSET' | 'LIABILITY' | 'EQUITY' | 'REVENUE' | 'EXPENSE';
type AccountingNormalBalance = 'DEBIT' | 'CREDIT';
type AccountingCashFlowClass = 'OPERATING' | 'INVESTING' | 'FINANCING' | 'NON_CASH';
type AccountingAccountRecord = {
  code: string;
  name: string;
  group: AccountingGroup;
  normalBalance: AccountingNormalBalance;
  systemKey: string;
  level?: 1 | 2 | 3 | 4;
  parentId?: string;
  posting?: boolean;
  templateKey?: string;
  cashFlowClass?: AccountingCashFlowClass;
  active: boolean;
  locked: boolean;
  createdBy: string;
  updatedBy: string;
  createdAt: string;
  updatedAt: string;
};
type AccountingSystemMappingRecord = {
  key: string;
  accountId: string;
  createdBy: string;
  updatedBy: string;
  createdAt: string;
  updatedAt: string;
};
type ManualJournalLineRecord = {
  accountId: string;
  kebunId: string;
  debit: number;
  credit: number;
  memo: string;
};
type ManualJournalRecord = {
  journalNumber: string;
  date: string;
  description: string;
  reference: string;
  sourceType?: 'STOCKTAKE';
  sourceId?: string;
  lines: ManualJournalLineRecord[];
  createdBy: string;
  updatedBy: string;
  createdAt: string;
  updatedAt: string;
};
type PurchaseItemKind = 'SERVICE' | 'INVENTORY';
type PurchaseDiscountType = 'AMOUNT' | 'PERCENT';
type PurchaseInvoiceLineRecord = {
  kind: PurchaseItemKind;
  itemId?: string;
  tracksStock?: boolean;
  kebunId?: string;
  warehouseId?: string;
  description: string;
  quantity: number;
  unit: string;
  unitId?: string;
  conversionFactor?: number;
  baseQuantity?: number;
  baseUnit?: string;
  unitPrice: number;
  debitAccountId: string;
  discountType?: PurchaseDiscountType;
  discountValue?: number;
  discountAmount?: number;
  lineTotal: number;
  netTotal?: number;
};
type PurchaseInvoiceRecord = {
  purchaseNumber?: string;
  date: string;
  dueDate: string;
  supplierId: string;
  kebunId: string;
  warehouseId?: string;
  invoiceNumber: string;
  debitAccountId: string;
  lines?: PurchaseInvoiceLineRecord[];
  subtotal?: number;
  discountType?: PurchaseDiscountType;
  discountValue?: number;
  discountAmount?: number;
  vatPercent?: number;
  vatAmount?: number;
  paymentType: 'CASH' | 'CREDIT';
  accountId: string;
  description: string;
  amount: number;
  note: string;
  supplierBillId: string;
  transactionId: string;
  createdBy: string;
  updatedBy: string;
  createdAt: string;
  updatedAt: string;
};

type InventoryGroupRecord = {
  code: string;
  name: string;
  canPurchase: boolean;
  canStore: boolean;
  canSell: boolean;
  purchaseAccountId: string;
  inventoryAccountId: string;
  salesAccountId: string;
  cogsAccountId: string;
  active: boolean;
  createdBy: string;
  updatedBy: string;
  createdAt: string;
  updatedAt: string;
};
type InventoryUnitRecord = {
  code: string;
  name: string;
  active: boolean;
  createdBy: string;
  updatedBy: string;
  createdAt: string;
  updatedAt: string;
};
type InventoryItemUnitConversionRecord = {
  unitId: string;
  factor: number;
  defaultPurchase?: boolean;
  defaultUsage?: boolean;
};
type InventoryItemRecord = {
  code: string;
  name: string;
  groupId: string;
  unitId: string;
  unitConversions?: InventoryItemUnitConversionRecord[];
  openingQuantity: number;
  openingAverageCost: number;
  currentQuantity: number;
  averageCost: number;
  stockValue: number;
  active: boolean;
  createdBy: string;
  updatedBy: string;
  createdAt: string;
  updatedAt: string;
};
type InventoryWarehouseRecord = { code: string; name: string; kebunId: string; manager: string; active: boolean; isDefault: boolean; createdBy: string; updatedBy: string; createdAt: string; updatedAt: string };
type InventoryWarehouseBalanceRecord = { warehouseId: string; itemId: string; quantity: number; stockValue: number; averageCost: number; updatedBy: string; updatedAt: string };
type InventoryUsageLineRecord = { itemId: string; warehouseId?: string; kebunId: string; debitAccountId: string; inventoryAccountId: string; quantity: number; unit: string; inputQuantity?: number; inputUnitId?: string; inputUnit?: string; conversionFactor?: number; unitCost: number; amount: number; memo: string };
type InventoryUsageRecord = { usageNumber: string; date: string; warehouseId?: string; reference: string; description: string; lines: InventoryUsageLineRecord[]; totalAmount: number; createdBy: string; createdAt: string };
type InventoryTransferLineRecord = { itemId: string; quantity: number; unit: string; inputQuantity?: number; inputUnitId?: string; inputUnit?: string; conversionFactor?: number; unitCost: number; amount: number };
type InventoryTransferRecord = { transferNumber: string; date: string; sourceWarehouseId: string; destinationWarehouseId: string; reference: string; description: string; lines: InventoryTransferLineRecord[]; totalAmount: number; status: 'POSTED' | 'REVERSED'; reversedAt?: string; reversedBy?: string; createdBy: string; createdAt: string };
type InventoryStocktakeStatus = 'COUNTING' | 'REVIEW' | 'POSTED' | 'REVERSED';
type InventoryStocktakeLineRecord = { itemId: string; unit: string; systemQuantity: number; systemValue: number; physicalQuantity: number | null; varianceQuantity: number; unitCost: number; varianceValue: number; note: string };
type InventoryStocktakeRecord = { stocktakeNumber: string; date: string; warehouseId: string; pic: string; note: string; status: InventoryStocktakeStatus; lines: InventoryStocktakeLineRecord[]; totalAbsVarianceValue: number; journalId?: string; postedAt?: string; postedBy?: string; reversedAt?: string; reversedBy?: string; createdBy: string; updatedBy: string; createdAt: string; updatedAt: string }; 
type FixedAssetDepreciationMethod = 'NONE' | 'STRAIGHT_LINE' | 'DECLINING_BALANCE' | 'UNITS_OF_PRODUCTION';
type FixedAssetMeasurementModel = 'COST' | 'REVALUATION';
type FixedAssetStatus = 'ACTIVE' | 'DISPOSED' | 'WRITTEN_OFF';
type FixedAssetGroupRecord = { code: string; name: string; templateKey: string; depreciable: boolean; depreciationMethod: FixedAssetDepreciationMethod; usefulLifeMonths: number; defaultResidualRate: number; measurementModel: FixedAssetMeasurementModel; assetAccountId: string; accumulatedDepreciationAccountId: string; depreciationExpenseAccountId: string; gainAccountId: string; lossAccountId: string; active: boolean; createdBy: string; updatedBy: string; createdAt: string; updatedAt: string };
type FixedAssetRecord = { code: string; name: string; groupId: string; kebunId: string; location: string; acquisitionDate: string; availableForUseDate: string; acquisitionCost: number; residualValue: number; usefulLifeMonths: number; depreciationMethod: FixedAssetDepreciationMethod; openingAccumulatedDepreciation: number; openingDepreciationOverride?: boolean; sourceReference: string; serialNumber: string; note: string; status: FixedAssetStatus; createdBy: string; updatedBy: string; createdAt: string; updatedAt: string };
type AccountingPeriodStatus = 'OPEN' | 'CLOSED' | 'LOCKED';
type AccountingSettingsRecord = {
  fiscalYear: number;
  fiscalYearStartMonth: number;
  conversionDate: string;
  setupComplete: boolean;
  openingPosted: boolean;
  createdBy: string;
  updatedBy: string;
  createdAt: string;
  updatedAt: string;
};
type AccountingPeriodRecord = {
  periodKey: string;
  label: string;
  startDate: string;
  endDate: string;
  status: AccountingPeriodStatus;
  fiscalYear: number;
  fiscalYearStartMonth: number;
  createdBy: string;
  updatedBy: string;
  createdAt: string;
  updatedAt: string;
};
type OpeningBalanceLineRecord = {
  accountId: string;
  debit: number;
  credit: number;
  note: string;
  kebunId?: string;
};
type OpeningSubledgerKind = 'CASH_BANK' | 'PKS' | 'EMPLOYEE' | 'SUPPLIER' | 'INVENTORY';
type OpeningSubledgerRecord = {
  kind: OpeningSubledgerKind;
  accountId: string;
  entityId: string;
  description: string;
  reference: string;
  amount: number;
  quantity: number;
  unitCost: number;
  inputQuantity?: number;
  inputUnitId?: string;
  inputUnit?: string;
  conversionFactor?: number;
  inputUnitCost?: number;
  debit: number;
  credit: number;
};
type OpeningFixedAssetRecord = { assetId: string; kebunId: string; assetAccountId: string; accumulatedDepreciationAccountId: string; acquisitionCost: number; accumulatedDepreciation: number; description: string };
type OpeningBalanceBatchRecord = {
  cutoffDate: string;
  status: 'DRAFT' | 'POSTED';
  generalLines: OpeningBalanceLineRecord[];
  subledgers: OpeningSubledgerRecord[];
  fixedAssets?: OpeningFixedAssetRecord[];
  postedLines?: OpeningBalanceLineRecord[];
  totalDebit: number;
  totalCredit: number;
  postedAt?: string;
  postedBy?: string;
  createdBy: string;
  updatedBy: string;
  createdAt: string;
  updatedAt: string;
};

type MembershipRecord = {
  workspaceId: string;
  workspaceName: string;
  role: Role;
  assignedKebunIds: string[];
  joinedAt: string;
};
type MemberRecord = {
  userId: string;
  email: string;
  name: string;
  role: Role;
  assignedKebunIds: string[];
  joinedAt: string;
};
type InviteRecord = {
  workspaceId: string;
  workspaceName: string;
  email: string;
  role: Role;
  assignedKebunIds: string[];
  status: 'OPEN' | 'USED';
  createdAt: string;
  createdBy: string;
  acceptedAt?: string;
  acceptedByUserId?: string;
};
type WorkspaceMeta = {
  name: string;
  ownerUserId: string;
  createdAt: string;
  updatedAt?: string;
  shortName?: string;
  businessType?: string;
  npwp?: string;
  nib?: string;
  address?: string;
  village?: string;
  district?: string;
  city?: string;
  province?: string;
  postalCode?: string;
  phone?: string;
  email?: string;
  website?: string;
  picName?: string;
  picPosition?: string;
  fiscalYearStartMonth?: number;
  currency?: string;
  reportName?: string;
  logoUrl?: string;
};
type UserProfile = { activeWorkspaceId: string; updatedAt: string };
type AuthLike = { userId: string; email?: string; name?: string };

type WorkspaceContext = {
  workspaceId: string;
  workspaceName: string;
  membership: MembershipRecord & { id: string };
  memberships: Array<MembershipRecord & { id: string }>;
};

function dataTable(
  kind: 'kebun' | 'accounts' | 'transactions' | 'mills' | 'harvesters' | 'vehicles' | 'rates' | 'tbs' | 'tbs_payments' | 'tbs_cost_payments' | 'suppliers' | 'supplier_bills' | 'supplier_payments' | 'work_types' | 'work_rates' | 'work_entries' | 'employee_receivables' | 'payroll_manual' | 'payroll_runs' | 'accounting_accounts' | 'accounting_system_mappings' | 'manual_journals' | 'purchase_invoices' | 'inventory_groups' | 'inventory_units' | 'inventory_items' | 'inventory_usages' | 'inventory_warehouses' | 'inventory_warehouse_balances' | 'inventory_transfers' | 'inventory_stocktakes' | 'fixed_asset_groups' | 'fixed_assets' | 'accounting_settings' | 'accounting_periods' | 'opening_balances',
  workspaceId: string
) {
  return `${kind}:${workspaceId}`;
}
function membershipsTable(userId: string) {
  return `workspace_memberships:${userId}`;
}
function profileTable(userId: string) {
  return `workspace_profile:${userId}`;
}
function membersTable(workspaceId: string) {
  return `workspace_members:${workspaceId}`;
}
function invitesTable(workspaceId: string) {
  return `workspace_invites:${workspaceId}`;
}
function metaTable(workspaceId: string) {
  return `workspace_meta:${workspaceId}`;
}
function text(value: unknown, fallback = '') {
  return typeof value === 'string' ? value.trim() : fallback;
}
function money(value: unknown) {
  const n = Number(value);
  return Number.isFinite(n) ? Math.max(0, Math.round(n)) : 0;
}
function decimal(value: unknown) {
  const n = Number(value);
  return Number.isFinite(n) ? Math.max(0, n) : 0;
}
function objectBody(value: unknown) {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}
function now() {
  return new Date().toISOString();
}
function role(value: unknown): Role {
  return ['OWNER', 'ADMIN_PUSAT', 'FINANCE', 'ADMIN_KEBUN', 'VIEWER'].includes(
    text(value)
  )
    ? (text(value) as Role)
    : 'VIEWER';
}
function canManageMaster(value: Role) {
  return value === 'OWNER' || value === 'ADMIN_PUSAT';
}
function canTransact(value: Role) {
  return value !== 'VIEWER';
}
function canTransfer(value: Role) {
  return value === 'OWNER' || value === 'ADMIN_PUSAT' || value === 'FINANCE';
}
function canManageReceivables(value: Role) {
  return value === 'OWNER' || value === 'ADMIN_PUSAT' || value === 'FINANCE';
}
function canManagePayables(value: Role) {
  return value === 'OWNER' || value === 'ADMIN_PUSAT' || value === 'FINANCE';
}
function canManagePayroll(value: Role) {
  return value === 'OWNER' || value === 'ADMIN_PUSAT' || value === 'FINANCE';
}
function canManageAccounting(value: Role) {
  return value === 'OWNER' || value === 'ADMIN_PUSAT' || value === 'FINANCE';
}
function canInvite(value: Role) {
  return value === 'OWNER';
}
function assignedIds(value: unknown) {
  return Array.isArray(value)
    ? value.map(item => text(item)).filter(Boolean).slice(0, 100)
    : [];
}
function transactionNumber(date: string, prefix = 'TRX') {
  const datePart = date.replace(/-/g, '') || new Date().toISOString().slice(0, 10).replace(/-/g, '');
  const timePart = Date.now().toString().slice(-7);
  const suffix = Math.random().toString(36).slice(2, 5).toUpperCase();
  return `${prefix}-${datePart}-${timePart}${suffix}`;
}
function nextSupplierCode(records: Array<SupplierRecord & { id?: string }>) {
  let highest = 0;
  for (const record of records) {
    const match = /^SUP-(\d+)$/i.exec(record.code || '');
    if (match) highest = Math.max(highest, Number(match[1]));
  }
  return `SUP-${String(highest + 1).padStart(3, '0')}`;
}
function receiptExtension(contentType: string) {
  if (contentType === 'image/jpeg') return 'jpg';
  if (contentType === 'image/png') return 'png';
  if (contentType === 'application/pdf') return 'pdf';
  return '';
}
function canAccessKebun(membership: MembershipRecord, kebunId: string) {
  return membership.role !== 'ADMIN_KEBUN' || membership.assignedKebunIds.includes(kebunId);
}
function weightBasis(value: unknown): WeightBasis {
  return text(value) === 'PABRIK' ? 'PABRIK' : 'LAPANGAN';
}
function transportMode(value: unknown): TransportMode {
  const candidate = text(value);
  return candidate === 'KG_LAPANGAN' || candidate === 'KG_PABRIK' ? candidate : 'TRIP';
}
function masterKind(value: string): TbsMasterKind | null {
  return ['mills', 'harvesters', 'vehicles', 'rates'].includes(value)
    ? (value as TbsMasterKind)
    : null;
}
function buildTbsMasterRecord(
  kind: TbsMasterKind,
  body: Record<string, unknown>,
  existing?: TbsMasterRecord
): TbsMasterRecord {
  const stamp = now();
  const createdAt = existing?.createdAt || stamp;
  if (kind === 'mills') {
    const name = text(body.name);
    if (!name) throw new Error('Nama pabrik wajib diisi.');
    return {
      name: name.slice(0, 140),
      location: text(body.location).slice(0, 180),
      active: body.active !== false,
      createdAt,
      updatedAt: stamp,
    };
  }
  if (kind === 'harvesters') {
    const name = text(body.name);
    if (!name) throw new Error('Nama pemanen wajib diisi.');
    return {
      name: name.slice(0, 140),
      phone: text(body.phone).slice(0, 40),
      active: body.active !== false,
      createdAt,
      updatedAt: stamp,
    };
  }
  if (kind === 'vehicles') {
    const plateNumber = text(body.plateNumber).toUpperCase();
    if (!plateNumber) throw new Error('Nomor polisi armada wajib diisi.');
    const requestedSupplierId = text(body.supplierId);
    const ownershipType: 'OWN' | 'VENDOR' = body.ownershipType === 'VENDOR' || (!body.ownershipType && requestedSupplierId) ? 'VENDOR' : 'OWN';
    if (ownershipType === 'VENDOR' && !requestedSupplierId) throw new Error('Pilih Supplier / Vendor Hutang untuk armada vendor.');
    return {
      plateNumber: plateNumber.slice(0, 30),
      name: text(body.name).slice(0, 120),
      owner: text(body.owner).slice(0, 140),
      ownershipType,
      supplierId: ownershipType === 'VENDOR' ? requestedSupplierId : '',
      rentMode: transportMode(body.rentMode),
      defaultRate: money(body.defaultRate),
      active: body.active !== false,
      createdAt,
      updatedAt: stamp,
    };
  }
  const kebunId = text(body.kebunId);
  const effectiveDate = text(body.effectiveDate);
  if (!kebunId || !/^\d{4}-\d{2}-\d{2}$/.test(effectiveDate)) {
    throw new Error('Kebun dan tanggal berlaku tarif wajib diisi.');
  }
  const weighingEnabled = body.weighingEnabled === true || (body.weighingEnabled === undefined && money(body.weighingRatePerKg) > 0);
  return {
    kebunId,
    effectiveDate,
    harvestRatePerKg: money(body.harvestRatePerKg),
    harvestWeightBasis: weightBasis(body.harvestWeightBasis),
    weighingEnabled,
    weighingRatePerKg: weighingEnabled ? money(body.weighingRatePerKg) : 0,
    weighingWeightBasis: weightBasis(body.weighingWeightBasis),
    langsirEnabled: body.langsirEnabled === true,
    langsirRatePerKg: body.langsirEnabled === true ? money(body.langsirRatePerKg) : 0,
    langsirWeightBasis: weightBasis(body.langsirWeightBasis),
    createdAt,
    updatedAt: stamp,
  };
}
function tbsCalculations(body: Record<string, unknown>) {
  const fieldWeightKg = decimal(body.fieldWeightKg);
  const factoryWeightKg = decimal(body.factoryWeightKg);
  const harvestRatePerKg = money(body.harvestRatePerKg);
  const harvestWeightBasis = weightBasis(body.harvestWeightBasis);
  const langsirRatePerKg = money(body.langsirRatePerKg);
  const langsirWeightBasis = weightBasis(body.langsirWeightBasis);
  const weighingRatePerKg = money(body.weighingRatePerKg);
  const weighingWeightBasis = weightBasis(body.weighingWeightBasis);
  const mode = transportMode(body.transportMode);
  const transportRate = money(body.transportRate);
  const pricePerKg = money(body.pricePerKg);
  const deductions = money(body.deductions);
  const harvestWeight = harvestWeightBasis === 'PABRIK' ? factoryWeightKg : fieldWeightKg;
  const weighingWeight = weighingWeightBasis === 'PABRIK' ? factoryWeightKg : fieldWeightKg;
  const langsirWeight = langsirWeightBasis === 'PABRIK' ? factoryWeightKg : fieldWeightKg;
  const transportWeight = mode === 'KG_PABRIK' ? factoryWeightKg : fieldWeightKg;
  const harvestCost = Math.round(harvestWeight * harvestRatePerKg);
  const weighingCost = Math.round(weighingWeight * weighingRatePerKg);
  const langsirCost = Math.round(langsirWeight * langsirRatePerKg);
  const transportCost = mode === 'TRIP' ? transportRate : Math.round(transportWeight * transportRate);
  const grossRevenue = Math.round(factoryWeightKg * pricePerKg);
  const netRevenue = Math.max(0, grossRevenue - deductions);
  const directCost = harvestCost + weighingCost + langsirCost + transportCost;
  const weightDifferenceKg = fieldWeightKg - factoryWeightKg;
  const weightDifferencePct = fieldWeightKg > 0 && factoryWeightKg > 0
    ? (weightDifferenceKg / fieldWeightKg) * 100
    : 0;
  const status: TbsRecord['status'] = factoryWeightKg > 0 && pricePerKg > 0
    ? 'SELESAI'
    : factoryWeightKg > 0
      ? 'PABRIK'
      : 'LAPANGAN';
  return {
    fieldWeightKg,
    factoryWeightKg,
    harvestRatePerKg,
    harvestWeightBasis,
    weighingRatePerKg,
    weighingWeightBasis,
    weighingCost,
    langsirRatePerKg,
    langsirWeightBasis,
    transportMode: mode,
    transportRate,
    pricePerKg,
    deductions,
    harvestCost,
    langsirCost,
    transportCost,
    grossRevenue,
    netRevenue,
    directCost,
    margin: netRevenue - directCost,
    weightDifferenceKg,
    weightDifferencePct,
    status,
  };
}

async function setActiveWorkspace(userId: string, workspaceId: string) {
  const key = profileTable(userId);
  const { items } = await db.list<UserProfile>(key, { limit: 1 });
  const record: UserProfile = { activeWorkspaceId: workspaceId, updatedAt: now() };
  if (items[0]) {
    const [ok] = await db.update(key, [{ id: items[0].id, record }]);
    if (!ok) throw new Error('Gagal memperbarui workspace aktif.');
  } else {
    const [id] = await db.add(key, [record]);
    if (!id) throw new Error('Gagal menyimpan workspace aktif.');
  }
}

async function ensureDefaultWorkspace(user: AuthLike) {
  const membershipKey = membershipsTable(user.userId);
  const existing = await db.list<MembershipRecord>(membershipKey, { limit: 100 });
  if (existing.items.length > 0) return existing.items;
  const workspaceId = user.userId;
  const workspaceName = 'Administrasi Perkebunan';
  const stamp = now();
  const membership: MembershipRecord = {
    workspaceId,
    workspaceName,
    role: 'OWNER',
    assignedKebunIds: [],
    joinedAt: stamp,
  };
  const [membershipId] = await db.add(membershipKey, [membership]);
  if (!membershipId) throw new Error('Gagal membuat workspace awal.');
  const meta = await db.list<WorkspaceMeta>(metaTable(workspaceId), { limit: 1 });
  if (meta.items.length === 0) {
    await db.add(metaTable(workspaceId), [
      { name: workspaceName, ownerUserId: user.userId, createdAt: stamp },
    ]);
  }
  const sharedMembers = await db.list<MemberRecord>(membersTable(workspaceId), {
    limit: 100,
  });
  if (!sharedMembers.items.some(item => item.userId === user.userId)) {
    await db.add(membersTable(workspaceId), [
      {
        userId: user.userId,
        email: user.email || '',
        name: user.name || user.email || 'Owner',
        role: 'OWNER',
        assignedKebunIds: [],
        joinedAt: stamp,
      },
    ]);
  }
  await setActiveWorkspace(user.userId, workspaceId);
  return [{ id: membershipId, ...membership }];
}

async function workspaceContext(user: AuthLike): Promise<WorkspaceContext> {
  let memberships = await ensureDefaultWorkspace(user);
  if (!memberships[0]?.id) {
    memberships = (await db.list<MembershipRecord>(membershipsTable(user.userId), { limit: 100 })).items;
  }
  const profiles = await db.list<UserProfile>(profileTable(user.userId), { limit: 1 });
  const requested = profiles.items[0]?.activeWorkspaceId;
  const membership = memberships.find(item => item.workspaceId === requested) || memberships[0];
  if (!membership) throw new Error('Workspace tidak tersedia.');
  if (requested !== membership.workspaceId) {
    await setActiveWorkspace(user.userId, membership.workspaceId);
  }
  return {
    workspaceId: membership.workspaceId,
    workspaceName: membership.workspaceName,
    membership,
    memberships,
  };
}

async function loadTransactions(workspaceId: string) {
  return (
    await db.list<TransactionRecord>(dataTable('transactions', workspaceId), {
      limit: 500,
    })
  ).items;
}
async function loadTbs(workspaceId: string) {
  return (
    await db.list<TbsRecord>(dataTable('tbs', workspaceId), { limit: 500 })
  ).items;
}
async function loadTbsPayments(workspaceId: string) {
  return (
    await db.list<TbsPaymentRecord>(dataTable('tbs_payments', workspaceId), { limit: 500 })
  ).items;
}
function paidAmountForTbs(payments: Array<TbsPaymentRecord & { id?: string }>, tbsId: string) {
  return payments.reduce(
    (sum, payment) => sum + (payment.allocations || []).filter(item => item.tbsId === tbsId).reduce((value, item) => value + item.amount, 0),
    0
  );
}
function normalizedDoNumber(value: string) {
  return value.trim().toUpperCase();
}
function sameDoGroup(row: TbsRecord, doNumber: string, millId: string) {
  return normalizedDoNumber(row.doNumber) === normalizedDoNumber(doNumber) && row.millId === millId;
}
function allocateProportional(total: number, weights: number[], precision = 0) {
  const factor = 10 ** precision;
  const scaledTotal = Math.round(total * factor);
  const weightTotal = weights.reduce((sum, value) => sum + Math.max(0, value), 0);
  if (scaledTotal <= 0 || weightTotal <= 0) return weights.map(() => 0);
  let assigned = 0;
  return weights.map((weight, index) => {
    if (index === weights.length - 1) return (scaledTotal - assigned) / factor;
    const part = Math.floor((scaledTotal * Math.max(0, weight)) / weightTotal);
    assigned += part;
    return part / factor;
  });
}
async function loadTbsCostPayments(workspaceId: string) {
  return (
    await db.list<TbsCostPaymentRecord>(dataTable('tbs_cost_payments', workspaceId), { limit: 500 })
  ).items;
}
function costComponent(value: unknown): TbsCostComponent | null {
  const candidate = text(value);
  return candidate === 'PANEN' || candidate === 'LANGSIR' || candidate === 'ARMADA'
    ? candidate
    : null;
}
function costAmountForTbs(tbs: TbsRecord, component: TbsCostComponent) {
  if (component === 'PANEN') return tbs.harvestCost;
  if (component === 'LANGSIR') return tbs.langsirCost;
  return tbs.transportCost;
}
function paidCostAmount(
  payments: Array<TbsCostPaymentRecord & { id?: string }>,
  tbsId: string,
  component: TbsCostComponent
) {
  return payments.reduce(
    (sum, payment) => sum + (payment.allocations || []).filter(item => item.tbsId === tbsId && item.component === component).reduce((value, item) => value + item.amount, 0),
    0
  );
}
function costCreditor(
  component: TbsCostComponent,
  tbs: TbsRecord,
  harvesters: Array<HarvesterRecord & { id: string }>,
  vehicles: Array<VehicleRecord & { id: string }>
) {
  if (component === 'ARMADA') {
    const vehicle = vehicles.find(item => item.id === tbs.vehicleId);
    return { key: `ARMADA:${tbs.vehicleId}`, name: vehicle?.owner || vehicle?.plateNumber || 'Vendor Armada' };
  }
  const harvester = harvesters.find(item => item.id === tbs.harvesterId);
  const prefix = component === 'PANEN' ? 'PANEN' : 'LANGSIR';
  return { key: `${prefix}:${tbs.harvesterId}`, name: harvester?.name || 'Pemanen' };
}
function costLabel(component: TbsCostComponent) {
  if (component === 'PANEN') return 'Upah Panen';
  if (component === 'LANGSIR') return 'Upah Langsir';
  return 'Sewa Armada';
}
async function loadSupplierPayments(workspaceId: string) {
  return (
    await db.list<SupplierPaymentRecord>(dataTable('supplier_payments', workspaceId), { limit: 500 })
  ).items;
}
function paidAmountForSupplierBill(
  payments: Array<SupplierPaymentRecord & { id?: string }>,
  billId: string
) {
  return payments.reduce(
    (sum, payment) => sum + (payment.allocations || []).filter(item => item.billId === billId).reduce((value, item) => value + item.amount, 0),
    0
  );
}
function armadaPayableAmount(tbs: TbsRecord) {
  if (tbs.transportMode === 'TRIP') return Math.round(tbs.transportRate);
  if (tbs.transportMode === 'KG_LAPANGAN') return Math.round(tbs.fieldWeightKg * tbs.transportRate);
  const factoryKg = tbs.factoryNet1WeightKg ?? tbs.factoryGrossWeightKg ?? 0;
  return factoryKg > 0 ? Math.round(factoryKg * tbs.transportRate) : 0;
}
function normalizeArmadaTransportCost(tbs: TbsRecord) {
  if (tbs.transportMode !== 'KG_PABRIK') return tbs;
  const transportCost = armadaPayableAmount(tbs);
  if (transportCost === tbs.transportCost) return tbs;
  const directCost = tbs.harvestCost + (tbs.weighingCost || 0) + tbs.langsirCost + transportCost;
  return { ...tbs, transportCost, directCost, margin: tbs.netRevenue - directCost };
}
async function validateArmadaSupplierBillTarget(workspaceId: string, tbs: TbsRecord, vehicleOverride?: VehicleRecord) {
  if (!tbs.armadaSupplierBillId) return;
  const [bill] = await db.get<SupplierBillRecord>(dataTable('supplier_bills', workspaceId), [tbs.armadaSupplierBillId]);
  if (!bill) return;
  const vehicle = vehicleOverride || (await db.get<VehicleRecord>(dataTable('vehicles', workspaceId), [tbs.vehicleId]))[0];
  if (!vehicle) throw new Error('Armada untuk hutang supplier tidak ditemukan.');
  const amount = armadaPayableAmount(tbs);
  const supplierId = vehicle.supplierId || '';
  const payments = await loadSupplierPayments(workspaceId);
  const paid = paidAmountForSupplierBill(payments, tbs.armadaSupplierBillId);
  if (paid <= 0) return;
  if (!supplierId || amount <= 0) throw new Error('Hutang sewa armada sudah memiliki pembayaran dan tidak dapat dilepas dari supplier.');
  if (amount < paid) throw new Error('Biaya sewa armada tidak boleh lebih kecil dari pembayaran supplier yang sudah dilakukan.');
  if (bill.supplierId !== supplierId || bill.kebunId !== tbs.kebunId) throw new Error('Supplier atau kebun armada tidak dapat diubah karena hutang sewa sudah memiliki pembayaran.');
}
async function syncArmadaSupplierBill(workspaceId: string, tbsId: string, input: TbsRecord, actor: string, vehicleOverride?: VehicleRecord) {
  const tbs = normalizeArmadaTransportCost(input);
  await validateArmadaSupplierBillTarget(workspaceId, tbs, vehicleOverride);
  const vehicle = vehicleOverride || (await db.get<VehicleRecord>(dataTable('vehicles', workspaceId), [tbs.vehicleId]))[0];
  if (!vehicle) throw new Error('Armada untuk hutang supplier tidak ditemukan.');
  const supplierId = vehicle.supplierId || '';
  const amount = armadaPayableAmount(tbs);
  const billTable = dataTable('supplier_bills', workspaceId);
  let existingBill: SupplierBillRecord | null = null;
  if (tbs.armadaSupplierBillId) [existingBill] = await db.get<SupplierBillRecord>(billTable, [tbs.armadaSupplierBillId]);
  if (!supplierId || amount <= 0) {
    if (existingBill && tbs.armadaSupplierBillId) {
      const [deleted] = await db.delete(billTable, [tbs.armadaSupplierBillId]);
      if (!deleted) throw new Error('Tagihan otomatis armada gagal dilepas.');
    }
    return { ...tbs, armadaSupplierBillId: '' };
  }
  const [supplier] = await db.get<SupplierRecord>(dataTable('suppliers', workspaceId), [supplierId]);
  if (!supplier) throw new Error('Supplier yang terhubung ke armada tidak ditemukan.');
  const stamp = now();
  const billRecord: SupplierBillRecord = {
    sourceType: 'TBS_ARMADA',
    sourceId: tbsId,
    date: tbs.date,
    dueDate: '',
    supplierId,
    kebunId: tbs.kebunId,
    invoiceNumber: `ARM-${normalizedDoNumber(tbs.doNumber)}-${tbsId.slice(0, 6).toUpperCase()}`.slice(0, 100),
    category: 'Sewa Armada',
    description: `${vehicle.plateNumber} · ${vehicle.name || vehicle.owner || 'Armada'} · DO ${tbs.doNumber}`.slice(0, 500),
    amount,
    createdBy: existingBill?.createdBy || actor,
    updatedBy: actor,
    createdAt: existingBill?.createdAt || stamp,
    updatedAt: stamp,
  };
  if (existingBill && tbs.armadaSupplierBillId) {
    const [updated] = await db.update(billTable, [{ id: tbs.armadaSupplierBillId, record: billRecord }]);
    if (!updated) throw new Error('Tagihan otomatis armada gagal diperbarui.');
    return { ...tbs, armadaSupplierBillId: tbs.armadaSupplierBillId };
  }
  const [billId] = await db.add(billTable, [billRecord]);
  if (!billId) throw new Error('Tagihan otomatis armada gagal dibuat.');
  return { ...tbs, armadaSupplierBillId: billId };
}
async function syncVehicleArmadaBills(workspaceId: string, vehicleId: string, vehicle: VehicleRecord, actor: string) {
  const rows = (await loadTbs(workspaceId)).filter(row => row.vehicleId === vehicleId);
  for (const row of rows) {
    const { id, ...stored } = row;
    const normalized = normalizeArmadaTransportCost(stored);
    const synced = await syncArmadaSupplierBill(workspaceId, id, normalized, actor, vehicle);
    if (synced.armadaSupplierBillId !== stored.armadaSupplierBillId || synced.transportCost !== stored.transportCost) {
      const [updated] = await db.update(dataTable('tbs', workspaceId), [{ id, record: { ...synced, updatedBy: actor, updatedAt: now() } }]);
      if (!updated) throw new Error('Data DO gagal ditautkan ke hutang supplier armada.');
    }
  }
}
async function loadPayrollManual(workspaceId: string) {
  return (
    await db.list<PayrollManualRecord>(dataTable('payroll_manual', workspaceId), { limit: 500 })
  ).items;
}
async function loadEmployeeReceivables(workspaceId: string) {
  return (await db.list<EmployeeReceivableRecord>(dataTable('employee_receivables', workspaceId), { limit: 500 })).items;
}
function plannedInstallmentAmounts(totalAmount: number, installmentCount: number) {
  const count = Math.max(1, Math.floor(installmentCount || 1));
  const base = Math.floor(totalAmount / count);
  const rows = Array.from({ length: count }, () => base);
  rows[count - 1] += totalAmount - base * count;
  return rows;
}
function employeeReceivableDeducted(runs: Array<PayrollRunRecord & { id?: string }>, receivableId: string) {
  return runs.flatMap(run => run.lines || [])
    .filter(line => line.sourceType === 'EMPLOYEE_RECEIVABLE' && line.sourceId === receivableId)
    .reduce((sum, line) => sum + line.amount, 0);
}
function employeeReceivableProgress(record: EmployeeReceivableRecord, receivableId: string, runs: Array<PayrollRunRecord & { id?: string }>) {
  const totalDeducted = Math.min(record.totalAmount, employeeReceivableDeducted(runs, receivableId));
  let applied = totalDeducted;
  const installments = plannedInstallmentAmounts(record.totalAmount, record.installmentCount).map((planned, index) => {
    const deducted = Math.min(planned, applied);
    applied -= deducted;
    return { number: index + 1, planned, deducted, remaining: planned - deducted };
  });
  const current = installments.find(row => row.remaining > 0);
  return {
    totalDeducted,
    outstandingAmount: Math.max(0, record.totalAmount - totalDeducted),
    currentInstallment: current?.number || record.installmentCount,
    suggestedAmount: current?.remaining || 0,
  };
}
function employeeReceivableCashRecord(
  receivableId: string,
  record: EmployeeReceivableRecord,
  workerName: string,
  actor: string,
  existing?: TransactionRecord | null
): TransactionRecord {
  const stamp = now();
  return {
    ...(existing || {}),
    transactionNumber: existing?.transactionNumber || transactionNumber(record.date, 'PIK'),
    kind: 'NORMAL',
    sourceType: 'EMPLOYEE_RECEIVABLE_DISBURSEMENT',
    sourceId: receivableId,
    date: record.date,
    kebunId: '',
    accountId: record.accountId || '',
    direction: 'OUT',
    category: 'Pencairan Piutang Karyawan',
    description: `Piutang ${workerName} · ${record.description}`.slice(0, 500),
    amount: record.totalAmount,
    reference: existing?.reference || '',
    createdBy: existing?.createdBy || actor,
    updatedBy: actor,
    createdAt: existing?.createdAt || stamp,
    updatedAt: stamp,
  };
}
async function loadWorkTypes(workspaceId: string) {
  return (await db.list<WorkTypeRecord>(dataTable('work_types', workspaceId), { limit: 300 })).items;
}
async function loadWorkRates(workspaceId: string) {
  return (await db.list<WorkRateRecord>(dataTable('work_rates', workspaceId), { limit: 500 })).items;
}
async function loadWorkEntries(workspaceId: string) {
  return (await db.list<WorkEntryRecord>(dataTable('work_entries', workspaceId), { limit: 500 })).items;
}
function applicableWorkRate(rates: Array<WorkRateRecord & { id?: string }>, workTypeId: string, kebunId: string, date: string) {
  return rates
    .filter(row => row.workTypeId === workTypeId && row.kebunId === kebunId && row.effectiveDate <= date)
    .sort((a, b) => b.effectiveDate.localeCompare(a.effectiveDate))[0];
}
async function loadPayrollRuns(workspaceId: string) {
  return (
    await db.list<PayrollRunRecord>(dataTable('payroll_runs', workspaceId), { limit: 500 })
  ).items;
}
function payrollTotals(lines: PayrollLine[]) {
  const grossEarnings = lines
    .filter(line => line.kind === 'EARNING')
    .reduce((sum, line) => sum + line.amount, 0);
  const deductions = lines
    .filter(line => line.kind === 'DEDUCTION')
    .reduce((sum, line) => sum + line.amount, 0);
  return { grossEarnings, deductions, netPay: Math.max(0, grossEarnings - deductions) };
}
function payrollRunUsesTbs(runs: Array<PayrollRunRecord & { id?: string }>, tbsId: string) {
  const panen = `TBS_PANEN:${tbsId}`;
  const timbang = `TBS_TIMBANG:${tbsId}`;
  const langsir = `TBS_LANGSIR:${tbsId}`;
  return runs.some(run => (run.lines || []).some(line => line.sourceKey === panen || line.sourceKey === timbang || line.sourceKey === langsir));
}
function payrollRunUsesManual(runs: Array<PayrollRunRecord & { id?: string }>, manualId: string) {
  const key = `MANUAL:${manualId}`;
  return runs.some(run => (run.lines || []).some(line => line.sourceKey === key));
}
function payrollRunUsesWork(runs: Array<PayrollRunRecord & { id?: string }>, workEntryId: string) {
  const key = `WORK:${workEntryId}`;
  return runs.some(run => (run.lines || []).some(line => line.sourceKey === key));
}
function payrollRunUsesEmployeeReceivable(runs: Array<PayrollRunRecord & { id?: string }>, receivableId: string) {
  return runs.some(run => (run.lines || []).some(line => line.sourceType === 'EMPLOYEE_RECEIVABLE' && line.sourceId === receivableId));
}

async function buildPayrollCandidates(
  workspaceId: string,
  membership: MembershipRecord,
  periodStart: string,
  periodEnd: string
): Promise<PayrollCandidate[]> {
  const [tbsRows, workEntries, manualRows, existingRuns, employeeReceivables, legacyPayments, workers] = await Promise.all([
    loadTbs(workspaceId),
    loadWorkEntries(workspaceId),
    loadPayrollManual(workspaceId),
    loadPayrollRuns(workspaceId),
    loadEmployeeReceivables(workspaceId),
    loadTbsCostPayments(workspaceId),
    db.list<HarvesterRecord>(dataTable('harvesters', workspaceId), { limit: 200 }),
  ]);
  const usedKeys = new Set(existingRuns.flatMap(run => (run.lines || []).map(line => line.sourceKey)));
  const grouped = new Map<string, PayrollLine[]>();
  const addLine = (workerId: string, line: PayrollLine) => {
    if (!workerId || usedKeys.has(line.sourceKey) || !canAccessKebun(membership, line.kebunId)) return;
    grouped.set(workerId, [...(grouped.get(workerId) || []), line]);
  };

  tbsRows
    .filter(row => row.date >= periodStart && row.date <= periodEnd)
    .forEach(row => {
      const harvestAmount = Math.max(0, row.harvestCost - paidCostAmount(legacyPayments, row.id, 'PANEN'));
      if (harvestAmount > 0) addLine(row.harvesterId, {
        sourceKey: `TBS_PANEN:${row.id}`,
        sourceType: 'TBS_PANEN',
        sourceId: row.id,
        kebunId: row.kebunId,
        date: row.date,
        kind: 'EARNING',
        label: 'Upah Panen',
        amount: harvestAmount,
        doNumber: row.doNumber,
      });
      const weighingAmount = Math.max(0, row.weighingCost || 0);
      if (weighingAmount > 0) addLine(row.harvesterId, {
        sourceKey: `TBS_TIMBANG:${row.id}`,
        sourceType: 'TBS_TIMBANG',
        sourceId: row.id,
        kebunId: row.kebunId,
        date: row.date,
        kind: 'EARNING',
        label: 'Upah Timbang',
        amount: weighingAmount,
        doNumber: row.doNumber,
      });
      const langsirAmount = Math.max(0, row.langsirCost - paidCostAmount(legacyPayments, row.id, 'LANGSIR'));
      if (langsirAmount > 0) addLine(row.langsirWorkerId || row.harvesterId, {
        sourceKey: `TBS_LANGSIR:${row.id}`,
        sourceType: 'TBS_LANGSIR',
        sourceId: row.id,
        kebunId: row.kebunId,
        date: row.date,
        kind: 'EARNING',
        label: 'Upah Langsir',
        amount: langsirAmount,
        doNumber: row.doNumber,
      });
    });

  workEntries
    .filter(row => row.date >= periodStart && row.date <= periodEnd)
    .forEach(row => addLine(row.workerId, {
      sourceKey: `WORK:${row.id}`,
      sourceType: 'KEBUN_WORK',
      sourceId: row.id,
      kebunId: row.kebunId,
      date: row.date,
      kind: 'EARNING',
      label: row.workName,
      amount: row.amount,
    }));

  manualRows
    .filter(row => row.date >= periodStart && row.date <= periodEnd)
    .forEach(row => addLine(row.workerId, {
      sourceKey: `MANUAL:${row.id}`,
      sourceType: 'MANUAL',
      sourceId: row.id,
      kebunId: row.kebunId,
      date: row.date,
      kind: row.kind,
      label: row.category,
      amount: row.amount,
    }));

  return Array.from(grouped.entries())
    .map(([workerId, lines]) => {
      const sortedLines = [...lines].sort((a, b) => `${a.date}${a.label}`.localeCompare(`${b.date}${b.label}`));
      const receivableOptions = employeeReceivables
        .filter(item => item.workerId === workerId)
        .map(item => {
          const progress = employeeReceivableProgress(item, item.id, existingRuns);
          return {
            receivableId: item.id,
            description: item.description,
            totalAmount: item.totalAmount,
            totalDeducted: progress.totalDeducted,
            outstandingAmount: progress.outstandingAmount,
            installmentCount: item.installmentCount,
            currentInstallment: progress.currentInstallment,
            suggestedAmount: progress.suggestedAmount,
          };
        })
        .filter(item => item.outstandingAmount > 0);
      return {
        workerId,
        workerName: workers.items.find(item => item.id === workerId)?.name || 'Tenaga Kerja',
        lines: sortedLines,
        ...payrollTotals(sortedLines),
        receivableOptions,
      };
    })
    .sort((a, b) => a.workerName.localeCompare(b.workerName));
}

async function validateTbsReferences(
  workspaceId: string,
  membership: MembershipRecord,
  kebunId: string,
  millId: string,
  harvesterId: string,
  vehicleId: string
) {
  if (!canAccessKebun(membership, kebunId)) return 'Kebun ini tidak termasuk akses Anda.';
  const [kebun, mill, harvester, vehicle] = await Promise.all([
    db.get<KebunRecord>(dataTable('kebun', workspaceId), [kebunId]),
    db.get<MillRecord>(dataTable('mills', workspaceId), [millId]),
    db.get<HarvesterRecord>(dataTable('harvesters', workspaceId), [harvesterId]),
    db.get<VehicleRecord>(dataTable('vehicles', workspaceId), [vehicleId]),
  ]);
  if (!kebun[0]) return 'Kebun tidak ditemukan.';
  if (!mill[0]) return 'Pabrik tidak ditemukan.';
  if (!harvester[0]) return 'Pemanen tidak ditemukan.';
  if (!vehicle[0]) return 'Armada tidak ditemukan.';
  return '';
}

async function writeReceipt(
  workspaceId: string,
  txNumber: string,
  body: Record<string, unknown>
) {
  const base64 = text(body.receiptBase64);
  if (!base64) return null;
  const contentType = text(body.receiptContentType);
  const extension = receiptExtension(contentType);
  if (!extension) throw new Error('Format bukti hanya JPG, PNG, atau PDF.');
  if (base64.length > 4_200_000) throw new Error('Ukuran bukti maksimal sekitar 3 MB.');
  const path = `receipts/${workspaceId}/${txNumber}-${Date.now()}.${extension}`;
  const [ok] = await storage.write([{ path, content: base64, contentType }]);
  if (!ok) throw new Error('Gagal mengunggah bukti transaksi.');
  return {
    path,
    name: text(body.receiptName, `bukti.${extension}`).slice(0, 160),
    contentType,
  };
}

function accountingGroup(value: unknown): AccountingGroup {
  const candidate = text(value).toUpperCase();
  return ['ASSET', 'LIABILITY', 'EQUITY', 'REVENUE', 'EXPENSE'].includes(candidate)
    ? candidate as AccountingGroup
    : 'ASSET';
}
function accountingNormalBalance(value: unknown, group?: AccountingGroup): AccountingNormalBalance {
  const candidate = text(value).toUpperCase();
  if (candidate === 'DEBIT' || candidate === 'CREDIT') return candidate;
  return group === 'LIABILITY' || group === 'EQUITY' || group === 'REVENUE' ? 'CREDIT' : 'DEBIT';
}
function accountingLevel(value: unknown): 1 | 2 | 3 | 4 {
  const level = Number(value);
  return level === 1 || level === 2 || level === 3 || level === 4 ? level : 4;
}
function accountingCashFlowClass(value: unknown): AccountingCashFlowClass {
  const candidate = text(value).toUpperCase();
  return ['OPERATING', 'INVESTING', 'FINANCING', 'NON_CASH'].includes(candidate) ? candidate as AccountingCashFlowClass : 'NON_CASH';
}
function normalizeAccountingAccount<T extends AccountingAccountRecord>(item: T): T & { level: 1 | 2 | 3 | 4; parentId: string; posting: boolean; templateKey: string; cashFlowClass: AccountingCashFlowClass } {
  const level = accountingLevel(item.level);
  return { ...item, level, parentId: item.parentId || '', posting: typeof item.posting === 'boolean' ? item.posting : level === 4, templateKey: item.templateKey || '', cashFlowClass: level === 4 ? accountingCashFlowClass(item.cashFlowClass) : 'NON_CASH' };
}
function isPostingAccount(item: AccountingAccountRecord) {
  const normalized = normalizeAccountingAccount(item);
  return normalized.level === 4 && normalized.posting !== false;
}
const defaultAccountingSpecs: Array<Pick<AccountingAccountRecord, 'code' | 'name' | 'group' | 'normalBalance' | 'systemKey'>> = [
  { code: '1201', name: 'Piutang Usaha - PKS', group: 'ASSET', normalBalance: 'DEBIT', systemKey: 'AR_PKS' },
  { code: '1202', name: 'Piutang Karyawan', group: 'ASSET', normalBalance: 'DEBIT', systemKey: 'AR_EMPLOYEE' },
  { code: '1301', name: 'Persediaan Bahan & Perlengkapan Kebun', group: 'ASSET', normalBalance: 'DEBIT', systemKey: 'INVENTORY' },
  { code: '1302', name: 'PPN Masukan', group: 'ASSET', normalBalance: 'DEBIT', systemKey: 'VAT_INPUT' },
  { code: '1501', name: 'Aset Tetap', group: 'ASSET', normalBalance: 'DEBIT', systemKey: 'FIXED_ASSET' },
  { code: '1502', name: 'Tanaman Produktif', group: 'ASSET', normalBalance: 'DEBIT', systemKey: 'BEARER_PLANTS' },
  { code: '2101', name: 'Hutang Supplier', group: 'LIABILITY', normalBalance: 'CREDIT', systemKey: 'AP_SUPPLIER' },
  { code: '2102', name: 'Hutang Gaji / Upah', group: 'LIABILITY', normalBalance: 'CREDIT', systemKey: 'PAYROLL_PAYABLE' },
  { code: '2103', name: 'Potongan Payroll Belum Diselesaikan', group: 'LIABILITY', normalBalance: 'CREDIT', systemKey: 'PAYROLL_DEDUCTION' },
  { code: '2199', name: 'Hutang Lain-lain', group: 'LIABILITY', normalBalance: 'CREDIT', systemKey: 'OTHER_PAYABLE' },
  { code: '3101', name: 'Modal Pemilik', group: 'EQUITY', normalBalance: 'CREDIT', systemKey: 'CAPITAL' },
  { code: '4101', name: 'Pendapatan Penjualan TBS', group: 'REVENUE', normalBalance: 'CREDIT', systemKey: 'REVENUE_TBS' },
  { code: '4199', name: 'Pendapatan Lain-lain', group: 'REVENUE', normalBalance: 'CREDIT', systemKey: 'REVENUE_OTHER' },
  { code: '5101', name: 'Beban Upah Panen', group: 'EXPENSE', normalBalance: 'DEBIT', systemKey: 'EXP_HARVEST' },
  { code: '5102', name: 'Beban Upah Timbang', group: 'EXPENSE', normalBalance: 'DEBIT', systemKey: 'EXP_WEIGH' },
  { code: '5103', name: 'Beban Upah Langsir', group: 'EXPENSE', normalBalance: 'DEBIT', systemKey: 'EXP_LANGSIR' },
  { code: '5104', name: 'Beban Pekerjaan Kebun', group: 'EXPENSE', normalBalance: 'DEBIT', systemKey: 'EXP_WORK' },
  { code: '5105', name: 'Beban Transportasi / Armada', group: 'EXPENSE', normalBalance: 'DEBIT', systemKey: 'EXP_TRANSPORT' },
  { code: '5201', name: 'Beban Pupuk', group: 'EXPENSE', normalBalance: 'DEBIT', systemKey: 'EXP_FERTILIZER' },
  { code: '5202', name: 'Beban Racun & Herbisida', group: 'EXPENSE', normalBalance: 'DEBIT', systemKey: 'EXP_HERBICIDE' },
  { code: '5203', name: 'Beban Perawatan Kebun', group: 'EXPENSE', normalBalance: 'DEBIT', systemKey: 'EXP_MAINTENANCE' },
  { code: '5204', name: 'Beban BBM', group: 'EXPENSE', normalBalance: 'DEBIT', systemKey: 'EXP_FUEL' },
  { code: '5205', name: 'Beban Peralatan & Suku Cadang', group: 'EXPENSE', normalBalance: 'DEBIT', systemKey: 'EXP_TOOLS' },
  { code: '6101', name: 'Beban Administrasi', group: 'EXPENSE', normalBalance: 'DEBIT', systemKey: 'EXP_ADMIN' },
  { code: '6199', name: 'Beban Lain-lain', group: 'EXPENSE', normalBalance: 'DEBIT', systemKey: 'EXP_OTHER' },
];
type ImportantAccountingAccountSpec = { key: string; group: AccountingGroup; fallbackTemplateKey?: string };
const importantAccountingAccountSpecs: ImportantAccountingAccountSpec[] = [
  { key: 'AR_PKS', group: 'ASSET' }, { key: 'AR_EMPLOYEE', group: 'ASSET' }, { key: 'AP_SUPPLIER', group: 'LIABILITY' },
  { key: 'PAYROLL_PAYABLE', group: 'LIABILITY' }, { key: 'PAYROLL_DEDUCTION', group: 'LIABILITY' }, { key: 'OTHER_PAYABLE', group: 'LIABILITY' },
  { key: 'CAPITAL', group: 'EQUITY' }, { key: 'RETAINED_EARNINGS', group: 'EQUITY', fallbackTemplateKey: 'L4-RETAINED' },
  { key: 'CURRENT_YEAR_PROFIT', group: 'EQUITY', fallbackTemplateKey: 'L4-CURRENT-PROFIT' }, { key: 'HISTORICAL_BALANCING', group: 'EQUITY', fallbackTemplateKey: 'L4-HISTORICAL' },
  { key: 'VAT_INPUT', group: 'ASSET' }, { key: 'REVENUE_TBS', group: 'REVENUE' }, { key: 'REVENUE_OTHER', group: 'REVENUE' },
  { key: 'EXP_HARVEST', group: 'EXPENSE' }, { key: 'EXP_WEIGH', group: 'EXPENSE' }, { key: 'EXP_LANGSIR', group: 'EXPENSE' },
  { key: 'EXP_WORK', group: 'EXPENSE' }, { key: 'EXP_TRANSPORT', group: 'EXPENSE' }, { key: 'EXP_FERTILIZER', group: 'EXPENSE' },
  { key: 'EXP_HERBICIDE', group: 'EXPENSE' }, { key: 'EXP_MAINTENANCE', group: 'EXPENSE' }, { key: 'EXP_FUEL', group: 'EXPENSE' },
  { key: 'EXP_TOOLS', group: 'EXPENSE' }, { key: 'EXP_ADMIN', group: 'EXPENSE' }, { key: 'EXP_OTHER', group: 'EXPENSE' },
];
function validImportantMappingAccount(account: (AccountingAccountRecord & { id: string }) | undefined, spec: ImportantAccountingAccountSpec) {
  return Boolean(account && account.active && isPostingAccount(account) && account.group === spec.group);
}
async function ensureAccountingSystemMappings(workspaceId: string, actor: string, sourceAccounts?: Array<AccountingAccountRecord & { id: string }>) {
  const accounts = sourceAccounts || await ensureAccountingAccounts(workspaceId, actor);
  const table = dataTable('accounting_system_mappings', workspaceId);
  const rows = (await db.list<AccountingSystemMappingRecord>(table, { limit: 100 })).items;
  const byKey = new Map(rows.map(item => [item.key, item]));
  const result: Record<string, string> = {};
  const additions: AccountingSystemMappingRecord[] = [];
  const updates: Array<{ id: string; record: AccountingSystemMappingRecord }> = [];
  const stamp = now();
  for (const spec of importantAccountingAccountSpecs) {
    const row = byKey.get(spec.key);
    let account = row ? accounts.find(item => item.id === row.accountId) : undefined;
    if (!validImportantMappingAccount(account, spec)) account = accounts.find(item => item.systemKey === spec.key) || (spec.fallbackTemplateKey ? accounts.find(item => item.templateKey === spec.fallbackTemplateKey) : undefined);
    if (!validImportantMappingAccount(account, spec) || !account) continue;
    result[spec.key] = account.id;
    if (!row) additions.push({ key: spec.key, accountId: account.id, createdBy: actor, updatedBy: actor, createdAt: stamp, updatedAt: stamp });
    else if (row.accountId !== account.id) { const { id, ...record } = row; updates.push({ id, record: { ...record, accountId: account.id, updatedBy: actor, updatedAt: stamp } }); }
  }
  if (additions.length > 0) await db.add(table, additions);
  if (updates.length > 0) await db.update(table, updates);
  return result;
}
async function accountingSystemMappingHasActivity(workspaceId: string) {
  const opening = await loadOpeningBalance(workspaceId);
  if (opening?.status === 'POSTED') return true;
  const results = await Promise.all([
    db.list(dataTable('purchase_invoices', workspaceId), { limit: 1 }), db.list(dataTable('inventory_usages', workspaceId), { limit: 1 }), db.list(dataTable('tbs', workspaceId), { limit: 1 }),
    db.list(dataTable('supplier_bills', workspaceId), { limit: 1 }), db.list(dataTable('work_entries', workspaceId), { limit: 1 }),
    db.list(dataTable('payroll_runs', workspaceId), { limit: 1 }), db.list(dataTable('transactions', workspaceId), { limit: 1 }),
  ]);
  return results.some(item => item.items.length > 0);
}
async function coaSeedSuppressed(workspaceId: string) {
  const markerRows = (await db.list<OneTimeResetMarker>(`admin_reset_markers:${workspaceId}`, { limit: 20 })).items;
  return markerRows.some(item => item.key === ONE_TIME_COA_RESET_KEY && (item.status === 'RUNNING' || item.status === 'COMPLETE'));
}
async function ensureAccountingAccounts(workspaceId: string, actor = 'system') {
  const table = dataTable('accounting_accounts', workspaceId);
  const [existingResult, operationalResult] = await Promise.all([
    db.list<AccountingAccountRecord>(table, { limit: 500 }),
    db.list<AccountRecord>(dataTable('accounts', workspaceId), { limit: 100 }),
  ]);
  const existing = existingResult.items.map(item => normalizeAccountingAccount(item));
  const migrations = existingResult.items.flatMap(item => {
    const normalized = normalizeAccountingAccount(item);
    if (item.level === normalized.level && (item.parentId || '') === normalized.parentId && item.posting === normalized.posting && (item.templateKey || '') === normalized.templateKey) return [];
    const { id, ...record } = normalized;
    return [{ id, record }];
  });
  if (migrations.length > 0) await db.update(table, migrations);
  if (await coaSeedSuppressed(workspaceId)) {
    const current = (await db.list<AccountingAccountRecord>(table, { limit: 500 })).items.map(item => normalizeAccountingAccount(item));
    return current.some(item => item.templateKey === 'L1-ASSET') ? ensureReferenceCashAccounts(workspaceId, actor, current) : current;
  }
  const keys = new Set(existing.map(item => item.systemKey).filter(Boolean));
  const codes = new Set(existing.map(item => item.code));
  const stamp = now();
  const missing: AccountingAccountRecord[] = [];
  for (const spec of defaultAccountingSpecs) {
    if (keys.has(spec.systemKey)) continue;
    missing.push({ ...spec, level: 4, parentId: '', posting: true, templateKey: '', active: true, locked: true, createdBy: actor, updatedBy: actor, createdAt: stamp, updatedAt: stamp });
    keys.add(spec.systemKey);
    codes.add(spec.code);
  }
  let kasIndex = existing.filter(item => item.systemKey.startsWith('CASH:') && item.code.startsWith('1101.')).length + 1;
  let bankIndex = existing.filter(item => item.systemKey.startsWith('CASH:') && item.code.startsWith('1102.')).length + 1;
  for (const operational of operationalResult.items) {
    const systemKey = `CASH:${operational.id}`;
    if (keys.has(systemKey)) continue;
    const prefix = operational.type === 'BANK' ? '1102' : '1101';
    let index = operational.type === 'BANK' ? bankIndex : kasIndex;
    let code = `${prefix}.${String(index).padStart(3, '0')}`;
    while (codes.has(code)) {
      index += 1;
      code = `${prefix}.${String(index).padStart(3, '0')}`;
    }
    if (operational.type === 'BANK') bankIndex = index + 1; else kasIndex = index + 1;
    missing.push({ code, name: operational.name, group: 'ASSET', normalBalance: 'DEBIT', systemKey, level: 4, parentId: '', posting: true, templateKey: '', active: true, locked: true, createdBy: actor, updatedBy: actor, createdAt: stamp, updatedAt: stamp });
    keys.add(systemKey);
    codes.add(code);
  }
  if (missing.length > 0) await db.add(table, missing);
  return (await db.list<AccountingAccountRecord>(table, { limit: 500 })).items.map(item => normalizeAccountingAccount(item));
}
function purchasePaymentType(value: unknown): 'CASH' | 'CREDIT' {
  return text(value).toUpperCase() === 'CASH' ? 'CASH' : 'CREDIT';
}
function purchaseItemKind(value: unknown): PurchaseItemKind {
  return text(value).toUpperCase() === 'INVENTORY' ? 'INVENTORY' : 'SERVICE';
}
function purchaseDiscountType(value: unknown): PurchaseDiscountType {
  return text(value).toUpperCase() === 'PERCENT' ? 'PERCENT' : 'AMOUNT';
}
function validPurchaseDebitAccount(account: AccountingAccountRecord & { id: string }, kind: PurchaseItemKind) {
  if (!account.active || !isPostingAccount(account) || account.systemKey.startsWith('CASH:') || account.systemKey.startsWith('AR_') || account.systemKey === 'VAT_INPUT') return false;
  return kind === 'SERVICE' ? account.group === 'EXPENSE' : account.group === 'ASSET';
}
function nextInventoryCode<T extends { code: string }>(rows: T[], prefix: string) {
  let max = 0;
  const marker = `${prefix.toUpperCase()}-`;
  for (const row of rows) {
    const code = (row.code || '').toUpperCase();
    if (!code.startsWith(marker)) continue;
    const value = Number(code.slice(marker.length));
    if (Number.isFinite(value)) max = Math.max(max, value);
  }
  return `${prefix.toUpperCase()}-${String(max + 1).padStart(3, '0')}`;
}
const INVENTORY_WAREHOUSE_MIGRATION_KEY = 'WAREHOUSE_V1';
function inventoryWarehousePairKey(warehouseId: string, itemId: string) { return `${warehouseId}|${itemId}`; }
async function ensureInventoryWarehouseLayer(workspaceId: string, actor = 'system') {
  const warehouseTable = dataTable('inventory_warehouses', workspaceId);
  const balanceTable = dataTable('inventory_warehouse_balances', workspaceId);
  let warehouses = (await db.list<InventoryWarehouseRecord>(warehouseTable, { limit: 100 })).items;
  if (warehouses.length === 0) {
    const stamp = now();
    await db.add(warehouseTable, [{ code: 'GDG-001', name: 'Gudang Utama', kebunId: '', manager: '', active: true, isDefault: true, createdBy: actor, updatedBy: actor, createdAt: stamp, updatedAt: stamp }]);
    warehouses = (await db.list<InventoryWarehouseRecord>(warehouseTable, { limit: 100 })).items;
  }
  let defaultWarehouse = warehouses.find(item => item.isDefault) || warehouses.find(item => item.active !== false) || warehouses[0];
  if (defaultWarehouse && !defaultWarehouse.isDefault) {
    const { id, ...base } = defaultWarehouse;
    await db.update(warehouseTable, [{ id, record: { ...base, isDefault: true, active: true, updatedBy: actor, updatedAt: now() } }]);
    warehouses = (await db.list<InventoryWarehouseRecord>(warehouseTable, { limit: 100 })).items;
    defaultWarehouse = warehouses.find(item => item.isDefault) || warehouses[0];
  }
  if (!defaultWarehouse) throw new Error('Gudang Utama gagal disiapkan.');
  const markerTable = `inventory_warehouse_migrations:${workspaceId}`;
  const markerRows = (await db.list<{ key: string; completedAt: string }>(markerTable, { limit: 20 })).items;
  if (!markerRows.some(item => item.key === INVENTORY_WAREHOUSE_MIGRATION_KEY)) {
    const [itemsResult, balanceResult, invoiceResult, usageResult] = await Promise.all([
      db.list<InventoryItemRecord>(dataTable('inventory_items', workspaceId), { limit: 500 }),
      db.list<InventoryWarehouseBalanceRecord>(balanceTable, { limit: 2000 }),
      db.list<PurchaseInvoiceRecord>(dataTable('purchase_invoices', workspaceId), { limit: 500 }),
      db.list<InventoryUsageRecord>(dataTable('inventory_usages', workspaceId), { limit: 500 }),
    ]);
    const existingPairs = new Set(balanceResult.items.map(item => inventoryWarehousePairKey(item.warehouseId, item.itemId)));
    const seedBalances = itemsResult.items.flatMap(item => {
      const key = inventoryWarehousePairKey(defaultWarehouse!.id, item.id);
      if (existingPairs.has(key)) return [];
      const quantity = Math.max(0, Number(item.currentQuantity ?? item.openingQuantity ?? 0));
      const stockValue = Math.max(0, Math.round(Number(item.stockValue ?? ((item.openingQuantity || 0) * (item.openingAverageCost || 0)))));
      if (quantity <= 0 && stockValue <= 0) return [];
      return [{ warehouseId: defaultWarehouse!.id, itemId: item.id, quantity, stockValue, averageCost: quantity > 0 ? Number((stockValue / quantity).toFixed(6)) : 0, updatedBy: actor, updatedAt: now() }];
    });
    if (seedBalances.length > 0) await db.add(balanceTable, seedBalances);
    const invoiceUpdates = invoiceResult.items.flatMap(invoice => {
      const nextLines = (invoice.lines || []).map(line => line.kind === 'INVENTORY' && line.tracksStock && !line.warehouseId ? { ...line, warehouseId: defaultWarehouse!.id } : line);
      const changed = nextLines.some((line, index) => line.warehouseId !== (invoice.lines || [])[index]?.warehouseId);
      if (!changed && invoice.warehouseId) return [];
      const { id, ...base } = invoice;
      return [{ id, record: { ...base, warehouseId: invoice.warehouseId || defaultWarehouse!.id, lines: nextLines } }];
    });
    if (invoiceUpdates.length > 0) await db.update(dataTable('purchase_invoices', workspaceId), invoiceUpdates);
    const usageUpdates = usageResult.items.flatMap(usage => {
      const nextLines = (usage.lines || []).map(line => line.warehouseId ? line : { ...line, warehouseId: defaultWarehouse!.id });
      const changed = nextLines.some((line, index) => line.warehouseId !== usage.lines[index]?.warehouseId);
      if (!changed && usage.warehouseId) return [];
      const { id, ...base } = usage;
      return [{ id, record: { ...base, warehouseId: usage.warehouseId || defaultWarehouse!.id, lines: nextLines } }];
    });
    if (usageUpdates.length > 0) await db.update(dataTable('inventory_usages', workspaceId), usageUpdates);
    await db.add(markerTable, [{ key: INVENTORY_WAREHOUSE_MIGRATION_KEY, completedAt: now() }]);
  }
  const balances = (await db.list<InventoryWarehouseBalanceRecord>(balanceTable, { limit: 2000 })).items;
  return { warehouses, balances, defaultWarehouseId: defaultWarehouse.id };
}
async function loadInventoryMaster(workspaceId: string) {
  const [groups, units, items, warehouseLayer] = await Promise.all([
    db.list<InventoryGroupRecord>(dataTable('inventory_groups', workspaceId), { limit: 300 }),
    db.list<InventoryUnitRecord>(dataTable('inventory_units', workspaceId), { limit: 300 }),
    db.list<InventoryItemRecord>(dataTable('inventory_items', workspaceId), { limit: 500 }),
    ensureInventoryWarehouseLayer(workspaceId),
  ]);
  return { groups: groups.items, units: units.items, items: items.items, warehouses: warehouseLayer.warehouses, balances: warehouseLayer.balances, defaultWarehouseId: warehouseLayer.defaultWarehouseId };
}
function normalizeInventoryItemUnitConversions(baseUnitId: string, raw: unknown, units: Array<InventoryUnitRecord & { id: string }>) {
  const rows = Array.isArray(raw) ? raw.slice(0, 20) : [];
  const unitMap = new Map(units.map(item => [item.id, item]));
  const seen = new Set<string>();
  const result: InventoryItemUnitConversionRecord[] = [];
  let purchaseTaken = false;
  let usageTaken = false;
  for (const value of rows) {
    const row = objectBody(value);
    const unitId = text(row.unitId);
    if (!unitId || unitId === baseUnitId || seen.has(unitId)) continue;
    const unit = unitMap.get(unitId);
    const factor = Number(row.factor);
    if (!unit || unit.active === false) throw new Error('Satuan alternatif harus berasal dari Master Satuan yang aktif.');
    if (!Number.isFinite(factor) || factor <= 0) throw new Error('Faktor konversi satuan harus lebih dari nol.');
    const defaultPurchase = row.defaultPurchase === true && !purchaseTaken;
    const defaultUsage = row.defaultUsage === true && !usageTaken;
    if (defaultPurchase) purchaseTaken = true;
    if (defaultUsage) usageTaken = true;
    seen.add(unitId);
    result.push({ unitId, factor: Number(factor.toFixed(6)), defaultPurchase, defaultUsage });
  }
  return result;
}
function inventoryItemUnitChoice(item: InventoryItemRecord & { id?: string }, units: Array<InventoryUnitRecord & { id: string }>, requestedUnitId = '', preferred: 'PURCHASE' | 'USAGE' | 'NONE' = 'NONE') {
  const unitMap = new Map(units.map(unit => [unit.id, unit]));
  const baseUnit = unitMap.get(item.unitId);
  if (!baseUnit || baseUnit.active === false) throw new Error('Satuan dasar barang tidak ditemukan atau nonaktif.');
  const conversions = item.unitConversions || [];
  let unitId = requestedUnitId;
  if (!unitId && preferred === 'PURCHASE') unitId = conversions.find(row => row.defaultPurchase)?.unitId || item.unitId;
  if (!unitId && preferred === 'USAGE') unitId = conversions.find(row => row.defaultUsage)?.unitId || item.unitId;
  if (!unitId) unitId = item.unitId;
  if (unitId === item.unitId) return { unitId, factor: 1, label: baseUnit.code || baseUnit.name, baseLabel: baseUnit.code || baseUnit.name };
  const conversion = conversions.find(row => row.unitId === unitId);
  const unit = unitMap.get(unitId);
  if (!conversion || !unit || unit.active === false || !Number.isFinite(conversion.factor) || conversion.factor <= 0) throw new Error('Satuan transaksi tidak valid untuk barang yang dipilih.');
  return { unitId, factor: conversion.factor, label: unit.code || unit.name, baseLabel: baseUnit.code || baseUnit.name };
}

async function inventoryWarehouseLocked(workspaceId: string, warehouseId: string, excludeStocktakeId = '') {
  const rows = (await db.list<InventoryStocktakeRecord>(dataTable('inventory_stocktakes', workspaceId), { limit: 200 })).items;
  return rows.some(item => item.id !== excludeStocktakeId && item.warehouseId === warehouseId && (item.status === 'COUNTING' || item.status === 'REVIEW'));
}
const fixedAssetDefaultGroupSpecs = [
  { templateKey: 'LAND', code: 'KAT-001', name: 'Tanah', depreciable: false, method: 'NONE' as FixedAssetDepreciationMethod, life: 0, assetCode: '1620-00-000', assetTemplateKey: 'L4-LAND', assetSystemKey: '', accumCode: '', accumTemplateKey: '', expenseCode: '' },
  { templateKey: 'BEARER', code: 'KAT-002', name: 'Tanaman Menghasilkan', depreciable: true, method: 'STRAIGHT_LINE' as FixedAssetDepreciationMethod, life: 240, assetCode: '1630-00-001', assetTemplateKey: '', assetSystemKey: 'BEARER_PLANTS', accumCode: '1630-00-002', accumTemplateKey: 'L4-BEARER-ACCDEP', expenseCode: '5370-00-001' },
  { templateKey: 'INFRA', code: 'KAT-003', name: 'Prasarana', depreciable: true, method: 'STRAIGHT_LINE' as FixedAssetDepreciationMethod, life: 120, assetCode: '1640-00-001', assetTemplateKey: 'REF:1640-00-001', assetSystemKey: '', accumCode: '1640-00-002', accumTemplateKey: 'REF:1640-00-002', expenseCode: '6060-00-002' },
  { templateKey: 'EQUIPMENT', code: 'KAT-004', name: 'Peralatan / Mesin', depreciable: true, method: 'STRAIGHT_LINE' as FixedAssetDepreciationMethod, life: 48, assetCode: '1650-00-001', assetTemplateKey: '', assetSystemKey: 'FIXED_ASSET', accumCode: '1650-00-002', accumTemplateKey: 'REF:1650-00-002', expenseCode: '6060-00-003' },
  { templateKey: 'VEHICLE', code: 'KAT-005', name: 'Kendaraan / Alat Berat', depreciable: true, method: 'STRAIGHT_LINE' as FixedAssetDepreciationMethod, life: 96, assetCode: '1660-00-001', assetTemplateKey: 'L4-VEHICLE', assetSystemKey: '', accumCode: '1660-00-002', accumTemplateKey: 'REF:1660-00-002', expenseCode: '6060-00-001' },
  { templateKey: 'BUILDING', code: 'KAT-006', name: 'Bangunan / Gedung', depreciable: true, method: 'STRAIGHT_LINE' as FixedAssetDepreciationMethod, life: 240, assetCode: '1670-00-001', assetTemplateKey: 'L4-BUILDING', assetSystemKey: '', accumCode: '1670-00-002', accumTemplateKey: 'REF:1670-00-002', expenseCode: '6060-00-004' },
];
function fixedAssetMethod(value: unknown, depreciable = true): FixedAssetDepreciationMethod { if (!depreciable) return 'NONE'; const candidate = text(value).toUpperCase(); return ['STRAIGHT_LINE', 'DECLINING_BALANCE', 'UNITS_OF_PRODUCTION'].includes(candidate) ? candidate as FixedAssetDepreciationMethod : 'STRAIGHT_LINE'; }
function fixedAssetMeasurementModel(value: unknown): FixedAssetMeasurementModel { return text(value).toUpperCase() === 'REVALUATION' ? 'REVALUATION' : 'COST'; }
function fixedAssetStatus(value: unknown): FixedAssetStatus { const candidate = text(value).toUpperCase(); return ['ACTIVE', 'DISPOSED', 'WRITTEN_OFF'].includes(candidate) ? candidate as FixedAssetStatus : 'ACTIVE'; }
function fixedAssetRate(value: unknown) { const n = Number(value); return Number.isFinite(n) ? Math.min(100, Math.max(0, n)) : 0; }
const fixedAssetDayMs = 86_400_000;
function fixedAssetDate(value: string) {
  if (!validIsoDate(value)) return null;
  const parts = value.split('-').map(Number);
  if (parts.length !== 3) return null;
  const parsed = new Date(Date.UTC(parts[0], parts[1] - 1, parts[2]));
  return Number.isFinite(parsed.getTime()) ? parsed : null;
}
function fixedAssetDaysInMonth(year: number, monthIndex: number) {
  return new Date(Date.UTC(year, monthIndex + 1, 0)).getUTCDate();
}
function fixedAssetUsefulLifeEnd(start: Date, usefulLifeMonths: number) {
  const targetIndex = start.getUTCMonth() + usefulLifeMonths;
  const targetYear = start.getUTCFullYear() + Math.floor(targetIndex / 12);
  const targetMonth = targetIndex % 12;
  const targetDay = Math.min(start.getUTCDate(), fixedAssetDaysInMonth(targetYear, targetMonth));
  const anniversary = new Date(Date.UTC(targetYear, targetMonth, targetDay));
  return new Date(anniversary.getTime() - fixedAssetDayMs);
}
function fixedAssetAutomaticOpeningDepreciation(acquisitionCost: number, residualValue: number, usefulLifeMonths: number, depreciationMethod: FixedAssetDepreciationMethod, availableForUseDate: string, throughDate: string) {
  if (depreciationMethod !== 'STRAIGHT_LINE' || usefulLifeMonths <= 0) return 0;
  const start = fixedAssetDate(availableForUseDate);
  const through = fixedAssetDate(throughDate);
  if (!start || !through || start.getTime() > through.getTime()) return 0;
  const depreciableBase = Math.max(0, acquisitionCost - residualValue);
  if (depreciableBase <= 0) return 0;
  const usefulLifeEnd = fixedAssetUsefulLifeEnd(start, usefulLifeMonths);
  if (through.getTime() >= usefulLifeEnd.getTime()) return Math.round(depreciableBase);
  const monthlyDepreciation = depreciableBase / usefulLifeMonths;
  let total = 0;
  let cursor = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth(), 1));
  let guard = 0;
  while (cursor.getTime() <= through.getTime() && guard < usefulLifeMonths + 2) {
    const year = cursor.getUTCFullYear();
    const month = cursor.getUTCMonth();
    const monthStart = new Date(Date.UTC(year, month, 1));
    const monthEnd = new Date(Date.UTC(year, month + 1, 0));
    const activeStart = Math.max(start.getTime(), monthStart.getTime());
    const activeEnd = Math.min(through.getTime(), monthEnd.getTime());
    if (activeStart <= activeEnd) {
      const activeDays = Math.floor((activeEnd - activeStart) / fixedAssetDayMs) + 1;
      total += monthlyDepreciation * activeDays / fixedAssetDaysInMonth(year, month);
    }
    cursor = new Date(Date.UTC(year, month + 1, 1));
    guard += 1;
  }
  return Math.min(Math.round(depreciableBase), Math.max(0, Math.round(total)));
}
function fixedAssetOverrideEnabled(asset: FixedAssetRecord) {
  return asset.openingDepreciationOverride === true || (typeof asset.openingDepreciationOverride !== 'boolean' && asset.openingAccumulatedDepreciation > 0);
}
function fixedAssetEffectiveOpeningDepreciation(asset: FixedAssetRecord, group: FixedAssetGroupRecord | undefined, throughDate: string) {
  if (!group?.depreciable || asset.depreciationMethod === 'NONE') return 0;
  const depreciableBase = Math.max(0, asset.acquisitionCost - asset.residualValue);
  if (fixedAssetOverrideEnabled(asset)) return Math.min(depreciableBase, Math.max(0, asset.openingAccumulatedDepreciation));
  return fixedAssetAutomaticOpeningDepreciation(asset.acquisitionCost, asset.residualValue, asset.usefulLifeMonths, asset.depreciationMethod, asset.availableForUseDate, throughDate);
}
async function fixedAssetOpeningThroughDate(workspaceId: string) {
  const settings = await loadAccountingSettings(workspaceId);
  if (!settings?.setupComplete || !validIsoDate(settings.conversionDate)) return '';
  const periods = await loadAccountingPeriods(workspaceId, settings);
  const closedEnds = periods.filter(item => item.status !== 'OPEN' && item.endDate <= settings.conversionDate).map(item => item.endDate).sort();
  return closedEnds.length > 0 ? closedEnds[closedEnds.length - 1] : settings.conversionDate;
}
function nextFixedAssetCode<T extends { code: string }>(rows: T[], prefix: string, width: number) { let max = 0; const marker = prefix.toUpperCase() + '-'; for (const row of rows) { const code = (row.code || '').toUpperCase(); if (!code.startsWith(marker)) continue; const value = Number(code.slice(marker.length)); if (Number.isFinite(value)) max = Math.max(max, value); } return marker + String(max + 1).padStart(width, '0'); }
function fixedAssetAccountId(accounts: Array<AccountingAccountRecord & { id: string }>, code: string, templateKey = '', systemKey = '') { return accounts.find(item => (systemKey && item.systemKey === systemKey) || (templateKey && item.templateKey === templateKey) || item.code === code)?.id || ''; }
async function loadFixedAssetMaster(workspaceId: string, actor = 'system') {
  const groupTable = dataTable('fixed_asset_groups', workspaceId); const assetTable = dataTable('fixed_assets', workspaceId); let groups = (await db.list<FixedAssetGroupRecord>(groupTable, { limit: 100 })).items; const accounts = await ensureAccountingAccounts(workspaceId, actor); const gainAccountId = fixedAssetAccountId(accounts, '8010-00-002', 'REF:8010-00-002'); const lossAccountId = fixedAssetAccountId(accounts, '9010-00-003', 'REF:9010-00-003');
  if (groups.length === 0) { const stamp = now(); const records: FixedAssetGroupRecord[] = fixedAssetDefaultGroupSpecs.map(spec => ({ code: spec.code, name: spec.name, templateKey: spec.templateKey, depreciable: spec.depreciable, depreciationMethod: spec.method, usefulLifeMonths: spec.life, defaultResidualRate: 0, measurementModel: 'COST', assetAccountId: fixedAssetAccountId(accounts, spec.assetCode, spec.assetTemplateKey, spec.assetSystemKey), accumulatedDepreciationAccountId: spec.accumCode ? fixedAssetAccountId(accounts, spec.accumCode, spec.accumTemplateKey) : '', depreciationExpenseAccountId: spec.expenseCode ? fixedAssetAccountId(accounts, spec.expenseCode, 'REF:' + spec.expenseCode) : '', gainAccountId, lossAccountId, active: true, createdBy: actor, updatedBy: actor, createdAt: stamp, updatedAt: stamp })); await db.add(groupTable, records); groups = (await db.list<FixedAssetGroupRecord>(groupTable, { limit: 100 })).items; }
  else { const validIds = new Set(accounts.map(item => item.id)); const updates: Array<{ id: string; record: FixedAssetGroupRecord }> = []; for (const group of groups) { const spec = fixedAssetDefaultGroupSpecs.find(item => item.templateKey === group.templateKey); if (!spec) continue; const next = { ...group, assetAccountId: group.assetAccountId && validIds.has(group.assetAccountId) ? group.assetAccountId : fixedAssetAccountId(accounts, spec.assetCode, spec.assetTemplateKey, spec.assetSystemKey), accumulatedDepreciationAccountId: group.accumulatedDepreciationAccountId && validIds.has(group.accumulatedDepreciationAccountId) ? group.accumulatedDepreciationAccountId : (spec.accumCode ? fixedAssetAccountId(accounts, spec.accumCode, spec.accumTemplateKey) : ''), depreciationExpenseAccountId: group.depreciationExpenseAccountId && validIds.has(group.depreciationExpenseAccountId) ? group.depreciationExpenseAccountId : (spec.expenseCode ? fixedAssetAccountId(accounts, spec.expenseCode, 'REF:' + spec.expenseCode) : ''), gainAccountId: group.gainAccountId && validIds.has(group.gainAccountId) ? group.gainAccountId : gainAccountId, lossAccountId: group.lossAccountId && validIds.has(group.lossAccountId) ? group.lossAccountId : lossAccountId }; if (next.assetAccountId !== group.assetAccountId || next.accumulatedDepreciationAccountId !== group.accumulatedDepreciationAccountId || next.depreciationExpenseAccountId !== group.depreciationExpenseAccountId || next.gainAccountId !== group.gainAccountId || next.lossAccountId !== group.lossAccountId) { const { id, ...record } = next; updates.push({ id, record: { ...record, updatedBy: actor, updatedAt: now() } }); } } if (updates.length > 0) { await db.update(groupTable, updates); groups = (await db.list<FixedAssetGroupRecord>(groupTable, { limit: 100 })).items; } }
  const rawAssets = (await db.list<FixedAssetRecord>(assetTable, { limit: 500 })).items;
  const openingDepreciationThroughDate = await fixedAssetOpeningThroughDate(workspaceId);
  const assets = rawAssets.map(asset => {
    const group = groups.find(item => item.id === asset.groupId);
    const openingDepreciationOverride = fixedAssetOverrideEnabled(asset);
    return {
      ...asset,
      openingDepreciationOverride,
      openingAccumulatedDepreciation: fixedAssetEffectiveOpeningDepreciation(asset, group, openingDepreciationThroughDate),
      openingDepreciationThroughDate,
    };
  });
  return { groups, assets, openingDepreciationThroughDate };
}
function fixedAssetGroupAccountError(group: Pick<FixedAssetGroupRecord, 'depreciable' | 'depreciationMethod' | 'usefulLifeMonths' | 'defaultResidualRate' | 'assetAccountId' | 'accumulatedDepreciationAccountId' | 'depreciationExpenseAccountId' | 'gainAccountId' | 'lossAccountId'>, accounts: Array<AccountingAccountRecord & { id: string }>) { const byId = new Map(accounts.map(item => [item.id, item])); const asset = byId.get(group.assetAccountId); if (!asset || !asset.active || !isPostingAccount(asset) || asset.group !== 'ASSET') return 'Akun Aset wajib akun posting Level 4 Aset yang aktif.'; if (group.defaultResidualRate < 0 || group.defaultResidualRate > 100) return 'Nilai residu default harus 0–100%.'; if (group.depreciable) { const accumulated = byId.get(group.accumulatedDepreciationAccountId); const expense = byId.get(group.depreciationExpenseAccountId); if (group.usefulLifeMonths <= 0 || group.depreciationMethod === 'NONE') return 'Kelompok yang disusutkan wajib memiliki umur manfaat dan metode penyusutan.'; if (!accumulated || !accumulated.active || !isPostingAccount(accumulated) || accumulated.group !== 'ASSET') return 'Akumulasi Penyusutan wajib akun posting Level 4 Aset yang aktif.'; if (!expense || !expense.active || !isPostingAccount(expense) || expense.group !== 'EXPENSE') return 'Beban Penyusutan wajib akun posting Level 4 Beban yang aktif.'; if (group.assetAccountId === group.accumulatedDepreciationAccountId) return 'Akun Aset dan Akumulasi Penyusutan tidak boleh sama.'; } if (group.gainAccountId) { const gain = byId.get(group.gainAccountId); if (!gain || !gain.active || !isPostingAccount(gain) || gain.group !== 'REVENUE') return 'Laba Pelepasan harus akun posting Pendapatan.'; } if (group.lossAccountId) { const loss = byId.get(group.lossAccountId); if (!loss || !loss.active || !isPostingAccount(loss) || loss.group !== 'EXPENSE') return 'Rugi Pelepasan harus akun posting Beban.'; } return ''; }
function inventoryGroupAccountError(group: Pick<InventoryGroupRecord, 'canPurchase' | 'canStore' | 'canSell' | 'purchaseAccountId' | 'inventoryAccountId' | 'salesAccountId' | 'cogsAccountId'>, accounts: Array<AccountingAccountRecord & { id: string }>) {
  const byId = new Map(accounts.map(item => [item.id, item]));
  if (!group.canPurchase && !group.canStore && !group.canSell) return 'Minimal satu sifat barang harus dipilih.';
  if (group.canPurchase) {
    const account = byId.get(group.purchaseAccountId);
    if (!account || !account.active || !isPostingAccount(account) || !['ASSET', 'EXPENSE'].includes(account.group) || account.systemKey.startsWith('CASH:') || account.systemKey.startsWith('AR_') || account.systemKey === 'VAT_INPUT') return 'Akun Pembelian harus akun posting Level 4 Aset/Beban yang aktif.';
  }
  if (group.canStore) {
    const account = byId.get(group.inventoryAccountId);
    if (!account || !account.active || !isPostingAccount(account) || account.group !== 'ASSET' || account.systemKey.startsWith('CASH:') || account.systemKey.startsWith('AR_') || account.systemKey === 'VAT_INPUT') return 'Akun Persediaan harus akun posting Level 4 Aset yang aktif.';
  }
  if (group.canSell) {
    const sales = byId.get(group.salesAccountId);
    const cogs = byId.get(group.cogsAccountId);
    if (!sales || !sales.active || !isPostingAccount(sales) || sales.group !== 'REVENUE') return 'Akun Penjualan harus akun posting Level 4 Pendapatan yang aktif.';
    if (!cogs || !cogs.active || !isPostingAccount(cogs) || cogs.group !== 'EXPENSE') return 'Akun HPP harus akun posting Level 4 Beban yang aktif.';
  }
  return '';
}
function parsePurchaseLines(raw: unknown, accounts: Array<AccountingAccountRecord & { id: string }>, master: Awaited<ReturnType<typeof loadInventoryMaster>>, fallbackKebunId = '', fallbackWarehouseId = ''): PurchaseInvoiceLineRecord[] {
  if (!Array.isArray(raw) || raw.length === 0) throw new Error('Minimal satu baris pembelian wajib diisi.');
  const itemMap = new Map(master.items.map(item => [item.id, item]));
  const groupMap = new Map(master.groups.map(item => [item.id, item]));
  const unitMap = new Map(master.units.map(item => [item.id, item]));
  return raw.slice(0, 30).map(value => {
    const row = objectBody(value);
    const kind = purchaseItemKind(row.kind);
    const quantity = Number(row.quantity);
    const unitPrice = money(row.unitPrice);
    if (!Number.isFinite(quantity) || quantity <= 0 || unitPrice <= 0) throw new Error('Qty dan harga satuan pembelian harus lebih dari nol.');
    const lineTotal = Math.round(quantity * unitPrice);
    const discountType = purchaseDiscountType(row.discountType);
    const discountValue = discountType === 'PERCENT' ? Math.max(0, Number(row.discountValue) || 0) : money(row.discountValue);
    if (discountType === 'PERCENT' && discountValue > 100) throw new Error('Diskon baris persen maksimal 100%.');
    const discountAmount = discountType === 'PERCENT' ? Math.round(lineTotal * discountValue / 100) : discountValue;
    if (discountAmount > lineTotal) throw new Error('Diskon baris tidak boleh melebihi nilai barang/jasa.');
    const netTotal = Math.max(0, lineTotal - discountAmount);
    const kebunId = text(row.kebunId) || fallbackKebunId;
    const warehouseId = text(row.warehouseId) || fallbackWarehouseId;
    if (kind === 'INVENTORY') {
      const itemId = text(row.itemId);
      const item = itemMap.get(itemId);
      const group = item ? groupMap.get(item.groupId) : undefined;
      const unit = item ? unitMap.get(item.unitId) : undefined;
      if (!item || item.active === false || !group || group.active === false || !unit || unit.active === false || !group.canPurchase) throw new Error('Barang Inventory belum valid/aktif atau kelompoknya tidak diizinkan untuk dibeli.');
      const debitAccountId = group.canStore ? group.inventoryAccountId : group.purchaseAccountId;
      const account = accounts.find(candidate => candidate.id === debitAccountId);
      const validAccount = account && account.active && !account.systemKey.startsWith('CASH:') && !account.systemKey.startsWith('AR_') && account.systemKey !== 'VAT_INPUT' && (group.canStore ? account.group === 'ASSET' : ['ASSET', 'EXPENSE'].includes(account.group));
      if (!validAccount) throw new Error('Mapping akun Inventory pada Kelompok Barang belum valid.');
      if (group.canStore && !warehouseId) throw new Error('Gudang penerimaan wajib dipilih untuk barang yang disimpan sebagai persediaan.');
      if (group.canStore && !master.warehouses.some(candidate => candidate.id === warehouseId && candidate.active !== false)) throw new Error('Gudang penerimaan tidak ditemukan atau sudah nonaktif.');
      const choice = inventoryItemUnitChoice(item, master.units, text(row.unitId), 'PURCHASE');
      const baseQuantity = Number((quantity * choice.factor).toFixed(6));
      return { kind, itemId, tracksStock: group.canStore, kebunId, warehouseId: group.canStore ? warehouseId : '', description: item.name.slice(0, 240), quantity, unit: choice.label.slice(0, 40), unitId: choice.unitId, conversionFactor: choice.factor, baseQuantity, baseUnit: choice.baseLabel.slice(0, 40), unitPrice, debitAccountId, discountType, discountValue, discountAmount, lineTotal, netTotal };
    }
    const description = text(row.description).slice(0, 240);
    const unit = text(row.unit).slice(0, 40);
    const debitAccountId = text(row.debitAccountId);
    const account = accounts.find(item => item.id === debitAccountId);
    if (!description || !unit || !account || !validPurchaseDebitAccount(account, 'SERVICE')) throw new Error('Baris Jasa wajib memiliki uraian, qty, satuan, harga, dan akun Beban.');
    return { kind, itemId: '', tracksStock: false, kebunId, description, quantity, unit, unitPrice, debitAccountId, discountType, discountValue, discountAmount, lineTotal, netTotal };
  });
}
function purchaseNetLineAmounts(invoice: Pick<PurchaseInvoiceRecord, 'lines' | 'subtotal' | 'discountAmount'>) {
  const lines = invoice.lines || [];
  const gross = lines.reduce((sum, line) => sum + line.lineTotal, 0);
  const lineDiscountTotal = lines.reduce((sum, line) => sum + Math.max(0, line.discountAmount || 0), 0);
  const lineNet = lines.map(line => Math.max(0, line.netTotal ?? (line.lineTotal - (line.discountAmount || 0))));
  const lineNetTotal = lineNet.reduce((sum, amount) => sum + amount, 0);
  const additionalDiscount = Math.max(0, (invoice.discountAmount || 0) - lineDiscountTotal);
  if (additionalDiscount <= 0 || lineNetTotal <= 0) return lineNet;
  const targetNet = Math.max(0, lineNetTotal - additionalDiscount);
  let allocated = 0;
  return lineNet.map((amount, index) => {
    const next = index === lineNet.length - 1 ? targetNet - allocated : Math.round(targetNet * amount / Math.max(1, lineNetTotal));
    allocated += next;
    return next;
  });
}
function inventoryContributions(invoice: PurchaseInvoiceRecord | null) {
  const result = new Map<string, { quantity: number; value: number }>();
  if (!invoice?.lines?.length) return result;
  const netAmounts = purchaseNetLineAmounts(invoice);
  invoice.lines.forEach((line, index) => {
    if (line.kind !== 'INVENTORY' || !line.itemId || !line.tracksStock) return;
    const current = result.get(line.itemId) || { quantity: 0, value: 0 };
    current.quantity += line.baseQuantity ?? line.quantity;
    current.value += netAmounts[index] || 0;
    result.set(line.itemId, current);
  });
  return result;
}
function inventoryWarehouseContributions(invoice: PurchaseInvoiceRecord | null, defaultWarehouseId: string) {
  const result = new Map<string, { warehouseId: string; itemId: string; quantity: number; value: number }>();
  if (!invoice?.lines?.length) return result;
  const netAmounts = purchaseNetLineAmounts(invoice);
  invoice.lines.forEach((line, index) => {
    if (line.kind !== 'INVENTORY' || !line.itemId || !line.tracksStock) return;
    const warehouseId = line.warehouseId || invoice.warehouseId || defaultWarehouseId;
    const key = inventoryWarehousePairKey(warehouseId, line.itemId);
    const current = result.get(key) || { warehouseId, itemId: line.itemId, quantity: 0, value: 0 };
    current.quantity += line.baseQuantity ?? line.quantity;
    current.value += netAmounts[index] || 0;
    result.set(key, current);
  });
  return result;
}
async function adjustInventoryForInvoice(workspaceId: string, oldInvoice: PurchaseInvoiceRecord | null, newInvoice: PurchaseInvoiceRecord | null, actor: string) {
  const layer = await ensureInventoryWarehouseLayer(workspaceId, actor);
  const oldWarehouseValues = inventoryWarehouseContributions(oldInvoice, layer.defaultWarehouseId);
  const newWarehouseValues = inventoryWarehouseContributions(newInvoice, layer.defaultWarehouseId);
  const pairKeys = [...new Set([...oldWarehouseValues.keys(), ...newWarehouseValues.keys()])];
  if (pairKeys.length === 0) return;
  const touchedWarehouseIds = [...new Set([...oldWarehouseValues.values(), ...newWarehouseValues.values()].map(item => item.warehouseId))];
  for (const warehouseId of touchedWarehouseIds) if (await inventoryWarehouseLocked(workspaceId, warehouseId)) throw new Error('Gudang sedang dikunci oleh Stok Opname aktif. Selesaikan Stok Opname sebelum transaksi persediaan dilanjutkan.');
  const warehouseMap = new Map(layer.warehouses.map(item => [item.id, item]));
  for (const part of [...oldWarehouseValues.values(), ...newWarehouseValues.values()]) if (!warehouseMap.get(part.warehouseId)) throw new Error('Gudang pada transaksi tidak ditemukan.');
  const oldValues = inventoryContributions(oldInvoice); const newValues = inventoryContributions(newInvoice); const itemIds = [...new Set([...oldValues.keys(), ...newValues.keys()])]; const itemTable = dataTable('inventory_items', workspaceId); const records = await db.get<InventoryItemRecord>(itemTable, itemIds); const itemUpdates: Array<{ id: string; record: InventoryItemRecord }> = []; const itemOriginals: Array<{ id: string; record: InventoryItemRecord }> = [];
  for (let index = 0; index < itemIds.length; index += 1) { const id = itemIds[index]; const item = records[index]; if (!item) throw new Error('Master Barang pada transaksi tidak ditemukan.'); const oldPart = oldValues.get(id) || { quantity: 0, value: 0 }; const newPart = newValues.get(id) || { quantity: 0, value: 0 }; const currentQuantity = Number(item.currentQuantity ?? item.openingQuantity ?? 0); const currentValue = Number(item.stockValue ?? ((item.openingQuantity || 0) * (item.openingAverageCost || 0))); const nextQuantity = currentQuantity - oldPart.quantity + newPart.quantity; const nextValue = currentValue - oldPart.value + newPart.value; if (nextQuantity < -0.000001 || nextValue < -1) throw new Error(`Stok ${item.name} tidak cukup untuk membalik/koreksi pembelian ini.`); const safeQuantity = Math.max(0, nextQuantity); const safeValue = Math.max(0, Math.round(nextValue)); itemOriginals.push({ id, record: item }); itemUpdates.push({ id, record: { ...item, currentQuantity: safeQuantity, stockValue: safeValue, averageCost: safeQuantity > 0 ? Number((safeValue / safeQuantity).toFixed(6)) : 0, updatedBy: actor, updatedAt: now() } }); }
  const balanceMap = new Map(layer.balances.map(item => [inventoryWarehousePairKey(item.warehouseId, item.itemId), item])); const balanceUpdates: Array<{ id: string; record: InventoryWarehouseBalanceRecord }> = []; const balanceOriginals: Array<{ id: string; record: InventoryWarehouseBalanceRecord }> = []; const balanceAdds: InventoryWarehouseBalanceRecord[] = [];
  for (const key of pairKeys) { const oldPart = oldWarehouseValues.get(key); const newPart = newWarehouseValues.get(key); const part = newPart || oldPart!; const existing = balanceMap.get(key); const currentQuantity = Number(existing?.quantity || 0); const currentValue = Number(existing?.stockValue || 0); const nextQuantity = currentQuantity - (oldPart?.quantity || 0) + (newPart?.quantity || 0); const nextValue = currentValue - (oldPart?.value || 0) + (newPart?.value || 0); if (nextQuantity < -0.000001 || nextValue < -1) throw new Error('Stok gudang tidak cukup untuk koreksi pembelian ini.'); const quantity = Math.max(0, nextQuantity); const stockValue = Math.max(0, Math.round(nextValue)); const record: InventoryWarehouseBalanceRecord = { warehouseId: part.warehouseId, itemId: part.itemId, quantity, stockValue, averageCost: quantity > 0 ? Number((stockValue / quantity).toFixed(6)) : 0, updatedBy: actor, updatedAt: now() }; if (existing) { const { id, ...original } = existing; balanceOriginals.push({ id, record: original }); balanceUpdates.push({ id, record }); } else balanceAdds.push(record); }
  const itemResults = itemUpdates.length > 0 ? await db.update(itemTable, itemUpdates) : []; if (itemUpdates.length > 0 && !itemResults.every(Boolean)) { const rollback = itemOriginals.filter((_, index) => itemResults[index]); if (rollback.length > 0) await db.update(itemTable, rollback); throw new Error('Saldo persediaan gagal disinkronkan dengan lengkap.'); }
  const balanceTable = dataTable('inventory_warehouse_balances', workspaceId); const balanceResults = balanceUpdates.length > 0 ? await db.update(balanceTable, balanceUpdates) : []; if (balanceUpdates.length > 0 && !balanceResults.every(Boolean)) { if (itemOriginals.length > 0) await db.update(itemTable, itemOriginals); const rollback = balanceOriginals.filter((_, index) => balanceResults[index]); if (rollback.length > 0) await db.update(balanceTable, rollback); throw new Error('Saldo gudang gagal disinkronkan dengan lengkap.'); }
  if (balanceAdds.length > 0) { const ids = await db.add(balanceTable, balanceAdds); if (ids.length !== balanceAdds.length || ids.some(id => !id)) { if (itemOriginals.length > 0) await db.update(itemTable, itemOriginals); if (balanceOriginals.length > 0) await db.update(balanceTable, balanceOriginals); const created = ids.filter(Boolean); if (created.length > 0) await db.delete(balanceTable, created); throw new Error('Saldo gudang baru gagal dibuat lengkap.'); } }
}
function purchaseInventoryItemIds(lines: PurchaseInvoiceLineRecord[] = []) {
  return [...new Set(lines.filter(line => line.kind === 'INVENTORY' && line.itemId && line.tracksStock).map(line => line.itemId as string))];
}
function inventoryUsageItemIds(lines: InventoryUsageLineRecord[] = []) {
  return [...new Set(lines.map(line => line.itemId).filter(Boolean))];
}
function inventoryMovementKey(date: string, createdAt = '') { return `${date}|${createdAt}`; }
async function hasInventoryUsageAfterPoint(workspaceId: string, itemIds: string[], date: string, createdAt = '', excludeId = '') {
  if (itemIds.length === 0) return false;
  const itemSet = new Set(itemIds);
  const point = inventoryMovementKey(date, createdAt);
  const rows = (await db.list<InventoryUsageRecord>(dataTable('inventory_usages', workspaceId), { limit: 500 })).items;
  return rows.some(item => item.id !== excludeId && inventoryMovementKey(item.date, item.createdAt) > point && item.lines.some(line => itemSet.has(line.itemId)));
}
async function latestInventoryMovementDate(workspaceId: string, itemIds: string[]) {
  if (itemIds.length === 0) return '';
  const itemSet = new Set(itemIds);
  const [invoices, usages] = await Promise.all([
    db.list<PurchaseInvoiceRecord>(dataTable('purchase_invoices', workspaceId), { limit: 500 }),
    db.list<InventoryUsageRecord>(dataTable('inventory_usages', workspaceId), { limit: 500 }),
  ]);
  let latest = '';
  for (const invoice of invoices.items) if ((invoice.lines || []).some(line => line.kind === 'INVENTORY' && line.tracksStock && line.itemId && itemSet.has(line.itemId))) latest = latest > invoice.date ? latest : invoice.date;
  for (const usage of usages.items) if (usage.lines.some(line => itemSet.has(line.itemId))) latest = latest > usage.date ? latest : usage.date;
  return latest;
}
async function prepareInventoryUsage(workspaceId: string, membership: MembershipRecord, rawLines: unknown, date: string, actor: string, fallbackWarehouseId = '') {
  const rows = Array.isArray(rawLines) ? rawLines.slice(0, 100) : []; if (rows.length === 0) throw new Error('Minimal satu baris Pemakaian Barang wajib diisi.'); const [master, accountingAccounts] = await Promise.all([loadInventoryMaster(workspaceId), ensureAccountingAccounts(workspaceId, actor)]); const itemMap = new Map(master.items.map(item => [item.id, item])); const groupMap = new Map(master.groups.map(item => [item.id, item])); const unitMap = new Map(master.units.map(item => [item.id, item])); const accountMap = new Map(accountingAccounts.map(item => [item.id, item])); const warehouseDefault = fallbackWarehouseId || master.defaultWarehouseId;
  const baseLines = rows.map(raw => { const row = objectBody(raw); const itemId = text(row.itemId); const debitAccountId = text(row.debitAccountId); const kebunId = text(row.kebunId); const warehouseId = text(row.warehouseId) || warehouseDefault; const inputQuantity = Number(row.quantity); const item = itemMap.get(itemId); const group = item ? groupMap.get(item.groupId) : undefined; const unit = item ? unitMap.get(item.unitId) : undefined; const debitAccount = accountMap.get(debitAccountId); if (!item || item.active === false || !group || group.active === false || !group.canStore || !group.inventoryAccountId || !unit || unit.active === false) throw new Error('Barang yang dipakai harus aktif, disimpan sebagai persediaan, dan memiliki mapping akun Persediaan.'); if (!master.warehouses.some(candidate => candidate.id === warehouseId && candidate.active !== false)) throw new Error('Gudang sumber wajib dipilih dan harus aktif.'); if (!Number.isFinite(inputQuantity) || inputQuantity <= 0) throw new Error(`Jumlah pemakaian ${item.name} harus lebih dari nol.`); if (!debitAccount || debitAccount.active === false || !isPostingAccount(debitAccount) || !['ASSET', 'EXPENSE'].includes(debitAccount.group) || debitAccount.systemKey.startsWith('CASH:') || debitAccount.systemKey.startsWith('AR_') || debitAccount.systemKey === 'VAT_INPUT') throw new Error(`Akun Pemakaian ${item.name} harus akun posting Level 4 kelompok Aset atau Beban.`); if (debitAccountId === group.inventoryAccountId) throw new Error(`Akun Pemakaian ${item.name} tidak boleh sama dengan akun Persediaannya.`); if (membership.role === 'ADMIN_KEBUN' && !kebunId) throw new Error('Admin Kebun wajib memilih Kebun/Cost Center pada setiap baris Pemakaian Barang.'); if (kebunId && !canAccessKebun(membership, kebunId)) throw new Error('Terdapat Kebun/Cost Center di luar akses Anda.'); const choice = inventoryItemUnitChoice(item, master.units, text(row.unitId), 'USAGE'); const quantity = Number((inputQuantity * choice.factor).toFixed(6)); return { itemId, warehouseId, kebunId, debitAccountId, inventoryAccountId: group.inventoryAccountId, quantity, unit: (unit.code || unit.name).slice(0, 40), inputQuantity, inputUnitId: choice.unitId, inputUnit: choice.label.slice(0, 40), conversionFactor: choice.factor, memo: '' }; });
  const kebunIds = [...new Set(baseLines.map(line => line.kebunId).filter(Boolean))]; if (kebunIds.length > 0) { const kebunRows = await db.get<KebunRecord>(dataTable('kebun', workspaceId), kebunIds); if (kebunRows.some(item => !item)) throw new Error('Kebun/Cost Center pada Pemakaian Barang tidak ditemukan.'); } const usageWarehouseIds = [...new Set(baseLines.map(line => line.warehouseId))]; for (const warehouseId of usageWarehouseIds) if (await inventoryWarehouseLocked(workspaceId, warehouseId)) throw new Error('Gudang sedang dikunci oleh Stok Opname aktif. Selesaikan Stok Opname sebelum Pemakaian Barang dilanjutkan.'); const itemIds = [...new Set(baseLines.map(line => line.itemId))]; const latestDate = await latestInventoryMovementDate(workspaceId, itemIds); if (latestDate && date < latestDate) throw new Error(`Tanggal Pemakaian Barang tidak boleh sebelum transaksi persediaan terakhir (${latestDate}). Gunakan tanggal yang sama/lebih baru agar Moving Average tetap konsisten.`);
  const balanceMap = new Map(master.balances.map(item => [inventoryWarehousePairKey(item.warehouseId, item.itemId), item])); const pairKeys = [...new Set(baseLines.map(line => inventoryWarehousePairKey(line.warehouseId, line.itemId)))]; const finalLines: InventoryUsageLineRecord[] = new Array(baseLines.length); const balanceUpdates: Array<{ id: string; record: InventoryWarehouseBalanceRecord }> = []; const balanceOriginals: Array<{ id: string; record: InventoryWarehouseBalanceRecord }> = []; const issuedByItem = new Map<string, { quantity: number; value: number }>();
  for (const pairKey of pairKeys) { const indexes = baseLines.map((line, index) => inventoryWarehousePairKey(line.warehouseId, line.itemId) === pairKey ? index : -1).filter(index => index >= 0); const sample = baseLines[indexes[0]]; const masterItem = itemMap.get(sample.itemId); const balance = balanceMap.get(pairKey); const issueQuantity = indexes.reduce((sum, index) => sum + baseLines[index].quantity, 0); const currentQuantity = Number(balance?.quantity || 0); const currentValue = Number(balance?.stockValue || 0); if (!masterItem || !balance || currentQuantity <= 0 || issueQuantity - currentQuantity > 0.000001) throw new Error(`Stok ${masterItem?.name || 'barang'} di gudang yang dipilih tidak cukup. Tersedia ${currentQuantity}.`); const unitCost = currentQuantity > 0 ? currentValue / currentQuantity : 0; const issueValue = Math.abs(issueQuantity - currentQuantity) <= 0.000001 ? Math.max(0, Math.round(currentValue)) : Math.max(0, Math.round(issueQuantity * unitCost)); let allocated = 0; indexes.forEach((lineIndex, position) => { const base = baseLines[lineIndex]; const amount = position === indexes.length - 1 ? issueValue - allocated : Math.round(issueValue * base.quantity / issueQuantity); allocated += amount; finalLines[lineIndex] = { ...base, unitCost: Number(unitCost.toFixed(6)), amount: Math.max(0, amount) }; }); const nextQuantity = Math.max(0, currentQuantity - issueQuantity); const nextValue = Math.max(0, Math.round(currentValue - issueValue)); const { id, ...original } = balance; balanceOriginals.push({ id, record: original }); balanceUpdates.push({ id, record: { ...original, quantity: nextQuantity, stockValue: nextValue, averageCost: nextQuantity > 0 ? Number((nextValue / nextQuantity).toFixed(6)) : 0, updatedBy: actor, updatedAt: now() } }); const issued = issuedByItem.get(sample.itemId) || { quantity: 0, value: 0 }; issued.quantity += issueQuantity; issued.value += issueValue; issuedByItem.set(sample.itemId, issued); }
  const itemTable = dataTable('inventory_items', workspaceId); const records = await db.get<InventoryItemRecord>(itemTable, itemIds); const originals: Array<{ id: string; record: InventoryItemRecord }> = []; const updates: Array<{ id: string; record: InventoryItemRecord }> = []; for (let index = 0; index < itemIds.length; index += 1) { const id = itemIds[index]; const record = records[index]; const masterItem = itemMap.get(id); if (!record || !masterItem) throw new Error('Master Barang pada Pemakaian tidak ditemukan.'); const issue = issuedByItem.get(id) || { quantity: 0, value: 0 }; const currentQuantity = Number(record.currentQuantity ?? record.openingQuantity ?? 0); const currentValue = Number(record.stockValue ?? ((record.openingQuantity || 0) * (record.openingAverageCost || 0))); if (issue.quantity - currentQuantity > 0.000001 || issue.value - currentValue > 1) throw new Error(`Saldo total ${masterItem.name} tidak cukup.`); const nextQuantity = Math.max(0, currentQuantity - issue.quantity); const nextValue = Math.max(0, Math.round(currentValue - issue.value)); originals.push({ id, record }); updates.push({ id, record: { ...record, currentQuantity: nextQuantity, stockValue: nextValue, averageCost: nextQuantity > 0 ? Number((nextValue / nextQuantity).toFixed(6)) : 0, updatedBy: actor, updatedAt: now() } }); }
  return { lines: finalLines, warehouseIds: [...new Set(finalLines.map(line => line.warehouseId || warehouseDefault))], totalAmount: finalLines.reduce((sum, line) => sum + line.amount, 0), originals, updates, balanceOriginals, balanceUpdates };
}
function purchaseTotals(lines: PurchaseInvoiceLineRecord[], discountType: PurchaseDiscountType, rawDiscountValue: unknown, rawVatPercent: unknown) {
  const subtotal = lines.reduce((sum, line) => sum + line.lineTotal, 0);
  const lineDiscountAmount = lines.reduce((sum, line) => sum + Math.max(0, line.discountAmount || 0), 0);
  const lineNetTotal = lines.reduce((sum, line) => sum + Math.max(0, line.netTotal ?? (line.lineTotal - (line.discountAmount || 0))), 0);
  const discountValue = discountType === 'PERCENT' ? Math.max(0, Number(rawDiscountValue) || 0) : money(rawDiscountValue);
  if (discountType === 'PERCENT' && discountValue > 100) throw new Error('Diskon persen maksimal 100%.');
  const additionalDiscount = discountType === 'PERCENT' ? Math.round(lineNetTotal * discountValue / 100) : discountValue;
  if (additionalDiscount > lineNetTotal) throw new Error('Diskon tambahan tidak boleh melebihi nilai pembelian setelah diskon baris.');
  const discountAmount = lineDiscountAmount + additionalDiscount;
  const taxableBase = Math.max(0, lineNetTotal - additionalDiscount);
  if (taxableBase <= 0) throw new Error('Total pembelian setelah diskon harus lebih dari nol.');
  const vatPercent = Math.max(0, Number(rawVatPercent) || 0);
  if (!Number.isFinite(vatPercent) || vatPercent > 100) throw new Error('PPN harus berada antara 0% sampai 100%.');
  const vatAmount = Math.round(taxableBase * vatPercent / 100);
  return { subtotal, discountValue, discountAmount, vatPercent, vatAmount, amount: taxableBase + vatAmount };
}
function purchaseDescription(lines: PurchaseInvoiceLineRecord[]) {
  return lines.map(line => line.description).join(' · ').slice(0, 500);
}
function purchaseInvoiceKebunId(lines: PurchaseInvoiceLineRecord[]) {
  const ids = [...new Set(lines.map(line => line.kebunId || '').filter(Boolean))];
  return ids.length === 1 ? ids[0] : '';
}
async function validatePurchaseLineCostCenters(workspaceId: string, membership: MembershipRecord, lines: PurchaseInvoiceLineRecord[]) {
  if (membership.role === 'ADMIN_KEBUN' && lines.some(line => !line.kebunId)) return 'Admin Kebun wajib memilih Kebun/Cost Center pada setiap baris pembelian.';
  const ids = [...new Set(lines.map(line => line.kebunId || '').filter(Boolean))];
  if (ids.some(id => !canAccessKebun(membership, id))) return 'Terdapat Kebun/Cost Center di luar akses Anda.';
  if (ids.length === 0) return '';
  const rows = await db.get<KebunRecord>(dataTable('kebun', workspaceId), ids);
  return rows.every(Boolean) ? '' : 'Kebun/Cost Center pada rincian pembelian tidak ditemukan.';
}
function purchaseBillRecord(invoiceId: string, invoice: PurchaseInvoiceRecord, actor: string, existing?: SupplierBillRecord | null): SupplierBillRecord {
  const stamp = now();
  return {
    ...(existing || {}),
    sourceType: 'PURCHASE_INVOICE',
    sourceId: invoiceId,
    accountingDebitAccountId: invoice.debitAccountId,
    date: invoice.date,
    dueDate: invoice.dueDate,
    supplierId: invoice.supplierId,
    kebunId: invoice.kebunId,
    invoiceNumber: invoice.invoiceNumber || invoice.purchaseNumber || `PB-${invoiceId.slice(0, 8).toUpperCase()}`,
    category: 'Invoice Pembelian',
    description: invoice.description,
    amount: invoice.amount,
    createdBy: existing?.createdBy || actor,
    updatedBy: actor,
    createdAt: existing?.createdAt || stamp,
    updatedAt: stamp,
  };
}
function purchaseCashRecord(invoiceId: string, invoice: PurchaseInvoiceRecord, actor: string, existing?: TransactionRecord | null): TransactionRecord {
  const stamp = now();
  return {
    ...(existing || {}),
    transactionNumber: existing?.transactionNumber || invoice.purchaseNumber || transactionNumber(invoice.date, 'PB'),
    kind: 'NORMAL',
    sourceType: 'PURCHASE_INVOICE',
    sourceId: invoiceId,
    date: invoice.date,
    kebunId: invoice.kebunId,
    accountId: invoice.accountId,
    direction: 'OUT',
    category: 'Pembelian',
    description: invoice.description.slice(0, 500),
    amount: invoice.amount,
    reference: (invoice.invoiceNumber || invoice.purchaseNumber || '').slice(0, 120),
    createdBy: existing?.createdBy || actor,
    updatedBy: actor,
    createdAt: existing?.createdAt || stamp,
    updatedAt: stamp,
  };
}
function validateManualJournalLines(raw: unknown, accounts: Array<AccountingAccountRecord & { id: string }>) {
  if (!Array.isArray(raw) || raw.length < 2 || raw.length > 30) throw new Error('Jurnal manual minimal memiliki 2 baris dan maksimal 30 baris.');
  const validIds = new Set(accounts.filter(item => item.active !== false && isPostingAccount(item)).map(item => item.id));
  const lines: ManualJournalLineRecord[] = raw.map(value => {
    const row = objectBody(value);
    const accountId = text(row.accountId);
    const debit = money(row.debit);
    const credit = money(row.credit);
    if (!validIds.has(accountId)) throw new Error('Pilih akun jurnal yang aktif.');
    if ((debit > 0 && credit > 0) || (debit <= 0 && credit <= 0)) throw new Error('Setiap baris jurnal harus memiliki Debit atau Kredit, tidak keduanya.');
    return { accountId, kebunId: text(row.kebunId), debit, credit, memo: text(row.memo).slice(0, 300) };
  });
  const totalDebit = lines.reduce((sum, item) => sum + item.debit, 0);
  const totalCredit = lines.reduce((sum, item) => sum + item.credit, 0);
  if (totalDebit <= 0 || totalDebit !== totalCredit) throw new Error('Total Debit dan Kredit jurnal harus sama.');
  return lines;
}

type PlantationTemplateSpec = { key: string; level: 1 | 2 | 3 | 4; code: string; name: string; group: AccountingGroup; parentKey?: string };
const plantationTemplateSpecs: PlantationTemplateSpec[] = [
  { key: 'L1-ASSET', level: 1, code: '1', name: 'Aset', group: 'ASSET' },
  { key: 'L1-LIABILITY', level: 1, code: '2', name: 'Liabilitas', group: 'LIABILITY' },
  { key: 'L1-EQUITY', level: 1, code: '3', name: 'Ekuitas', group: 'EQUITY' },
  { key: 'L1-REVENUE', level: 1, code: '4', name: 'Pendapatan', group: 'REVENUE' },
  { key: 'L1-EXPENSE', level: 1, code: '5', name: 'Beban', group: 'EXPENSE' },
  { key: 'L2-CURRENT-ASSET', level: 2, code: '11', name: 'Aset Lancar', group: 'ASSET', parentKey: 'L1-ASSET' },
  { key: 'L2-NURSERY', level: 2, code: '13', name: 'Bibit Siap Tanam', group: 'ASSET', parentKey: 'L1-ASSET' },
  { key: 'L2-TBM', level: 2, code: '14', name: 'Tanaman Belum Menghasilkan', group: 'ASSET', parentKey: 'L1-ASSET' },
  { key: 'L2-FIXED', level: 2, code: '16', name: 'Aset Tetap', group: 'ASSET', parentKey: 'L1-ASSET' },
  { key: 'L2-CIP', level: 2, code: '17', name: 'Aset Dalam Proses', group: 'ASSET', parentKey: 'L1-ASSET' },
  { key: 'L2-OTHER-ASSET', level: 2, code: '19', name: 'Aset Lain-lain', group: 'ASSET', parentKey: 'L1-ASSET' },
  { key: 'L2-CURRENT-LIAB', level: 2, code: '21', name: 'Hutang Lancar', group: 'LIABILITY', parentKey: 'L1-LIABILITY' },
  { key: 'L2-LONG-LIAB', level: 2, code: '24', name: 'Hutang Jangka Panjang', group: 'LIABILITY', parentKey: 'L1-LIABILITY' },
  { key: 'L2-EQUITY', level: 2, code: '31', name: 'Modal & Laba Ditahan', group: 'EQUITY', parentKey: 'L1-EQUITY' },
  { key: 'L2-SALES', level: 2, code: '40', name: 'Penjualan', group: 'REVENUE', parentKey: 'L1-REVENUE' },
  { key: 'L2-OTHER-REV', level: 2, code: '80', name: 'Pendapatan Lain', group: 'REVENUE', parentKey: 'L1-REVENUE' },
  { key: 'L2-MAINT', level: 2, code: '51', name: 'Biaya Pemeliharaan Tanaman', group: 'EXPENSE', parentKey: 'L1-EXPENSE' },
  { key: 'L2-HARVEST', level: 2, code: '52', name: 'Biaya Panen', group: 'EXPENSE', parentKey: 'L1-EXPENSE' },
  { key: 'L2-ESTATE-ADMIN', level: 2, code: '53', name: 'Biaya Administrasi Kebun', group: 'EXPENSE', parentKey: 'L1-EXPENSE' },
  { key: 'L2-GA', level: 2, code: '60', name: 'Biaya Umum & Administrasi', group: 'EXPENSE', parentKey: 'L1-EXPENSE' },
  { key: 'L2-OTHER-EXP', level: 2, code: '90', name: 'Beban Lain', group: 'EXPENSE', parentKey: 'L1-EXPENSE' },
  { key: 'L3-CASH', level: 3, code: '1110', name: 'Kas', group: 'ASSET', parentKey: 'L2-CURRENT-ASSET' },
  { key: 'L3-BANK', level: 3, code: '1120', name: 'Bank', group: 'ASSET', parentKey: 'L2-CURRENT-ASSET' },
  { key: 'L3-AR', level: 3, code: '1131', name: 'Piutang Usaha', group: 'ASSET', parentKey: 'L2-CURRENT-ASSET' },
  { key: 'L3-AR-NON', level: 3, code: '1132', name: 'Piutang Non Usaha', group: 'ASSET', parentKey: 'L2-CURRENT-ASSET' },
  { key: 'L3-INVENTORY', level: 3, code: '1150', name: 'Persediaan', group: 'ASSET', parentKey: 'L2-CURRENT-ASSET' },
  { key: 'L3-PREPAID-TAX', level: 3, code: '1172', name: 'Pajak Dibayar Dimuka', group: 'ASSET', parentKey: 'L2-CURRENT-ASSET' },
  { key: 'L3-NURSERY-COST', level: 3, code: '1310', name: 'Biaya Bibit Siap Tanam', group: 'ASSET', parentKey: 'L2-NURSERY' },
  { key: 'L3-TBM-WAGE', level: 3, code: '1410', name: 'Biaya Gaji/Upah - TBM', group: 'ASSET', parentKey: 'L2-TBM' },
  { key: 'L3-TBM-MAT', level: 3, code: '1420', name: 'Bahan/Perlengkapan - TBM', group: 'ASSET', parentKey: 'L2-TBM' },
  { key: 'L3-TBM-TRANSPORT', level: 3, code: '1430', name: 'Transportasi Tenaga & Bahan - TBM', group: 'ASSET', parentKey: 'L2-TBM' },
  { key: 'L3-TBM-OTHER', level: 3, code: '1490', name: 'Biaya TBM Lainnya', group: 'ASSET', parentKey: 'L2-TBM' },
  { key: 'L3-LAND', level: 3, code: '1620', name: 'Tanah', group: 'ASSET', parentKey: 'L2-FIXED' },
  { key: 'L3-BEARER', level: 3, code: '1630', name: 'Tanaman Menghasilkan', group: 'ASSET', parentKey: 'L2-FIXED' },
  { key: 'L3-INFRA', level: 3, code: '1640', name: 'Prasarana', group: 'ASSET', parentKey: 'L2-FIXED' },
  { key: 'L3-EQUIPMENT', level: 3, code: '1650', name: 'Peralatan/Perlengkapan', group: 'ASSET', parentKey: 'L2-FIXED' },
  { key: 'L3-VEHICLE', level: 3, code: '1660', name: 'Kendaraan/Alat Berat', group: 'ASSET', parentKey: 'L2-FIXED' },
  { key: 'L3-BUILDING', level: 3, code: '1670', name: 'Bangunan', group: 'ASSET', parentKey: 'L2-FIXED' },
  { key: 'L3-CIP', level: 3, code: '1700', name: 'Pekerjaan Dalam Proses', group: 'ASSET', parentKey: 'L2-CIP' },
  { key: 'L3-AP', level: 3, code: '2101', name: 'Hutang Usaha', group: 'LIABILITY', parentKey: 'L2-CURRENT-LIAB' },
  { key: 'L3-OTHER-PAYABLE', level: 3, code: '2102', name: 'Hutang Non Usaha', group: 'LIABILITY', parentKey: 'L2-CURRENT-LIAB' },
  { key: 'L3-ACCRUED', level: 3, code: '2300', name: 'Biaya yang Masih Harus Dibayar', group: 'LIABILITY', parentKey: 'L2-CURRENT-LIAB' },
  { key: 'L3-LONG-DEBT', level: 3, code: '2400', name: 'Hutang Jangka Panjang', group: 'LIABILITY', parentKey: 'L2-LONG-LIAB' },
  { key: 'L3-CAPITAL', level: 3, code: '3110', name: 'Modal', group: 'EQUITY', parentKey: 'L2-EQUITY' },
  { key: 'L3-RETAINED', level: 3, code: '3210', name: 'Laba Ditahan', group: 'EQUITY', parentKey: 'L2-EQUITY' },
  { key: 'L3-TBS-SALES', level: 3, code: '4010', name: 'Penjualan TBS', group: 'REVENUE', parentKey: 'L2-SALES' },
  { key: 'L3-OTHER-SALES', level: 3, code: '4020', name: 'Penjualan Lainnya', group: 'REVENUE', parentKey: 'L2-SALES' },
  { key: 'L3-OTHER-REV', level: 3, code: '8010', name: 'Pendapatan Lain-lain', group: 'REVENUE', parentKey: 'L2-OTHER-REV' },
  { key: 'L3-MAINT-WAGE', level: 3, code: '5110', name: 'Biaya Gaji/Upah - TM', group: 'EXPENSE', parentKey: 'L2-MAINT' },
  { key: 'L3-MAINT-MAT', level: 3, code: '5120', name: 'Bahan/Perlengkapan - TM', group: 'EXPENSE', parentKey: 'L2-MAINT' },
  { key: 'L3-HARVEST-WAGE', level: 3, code: '5210', name: 'Biaya Gaji/Upah Panen', group: 'EXPENSE', parentKey: 'L2-HARVEST' },
  { key: 'L3-HARVEST-MAT', level: 3, code: '5220', name: 'Bahan/Perlengkapan Panen', group: 'EXPENSE', parentKey: 'L2-HARVEST' },
  { key: 'L3-HARVEST-TRANSPORT', level: 3, code: '5230', name: 'Ongkos Angkut TBS', group: 'EXPENSE', parentKey: 'L2-HARVEST' },
  { key: 'L3-ESTATE-ADMIN', level: 3, code: '5390', name: 'Administrasi Kebun', group: 'EXPENSE', parentKey: 'L2-ESTATE-ADMIN' },
  { key: 'L3-GA', level: 3, code: '6090', name: 'Umum & Administrasi', group: 'EXPENSE', parentKey: 'L2-GA' },
  { key: 'L3-OTHER-EXP', level: 3, code: '9010', name: 'Beban Lain-lain', group: 'EXPENSE', parentKey: 'L2-OTHER-EXP' },
  { key: 'L4-HISTORICAL', level: 4, code: '3210-00-999', name: 'Historical Balancing', group: 'EQUITY', parentKey: 'L3-RETAINED' },
  { key: 'L4-RETAINED', level: 4, code: '3210-00-001', name: 'Laba Ditahan Tahun Sebelumnya', group: 'EQUITY', parentKey: 'L3-RETAINED' },
  { key: 'L4-CURRENT-PROFIT', level: 4, code: '3210-00-002', name: 'Laba Tahun Berjalan', group: 'EQUITY', parentKey: 'L3-RETAINED' },
  { key: 'L4-LAND', level: 4, code: '1620-00-000', name: 'Tanah', group: 'ASSET', parentKey: 'L3-LAND' },
  { key: 'L4-BEARER-ACCDEP', level: 4, code: '1630-00-002', name: 'Akumulasi Penyusutan Tanaman Menghasilkan', group: 'ASSET', parentKey: 'L3-BEARER' },
  { key: 'L4-VEHICLE', level: 4, code: '1660-00-001', name: 'Kendaraan/Alat Berat', group: 'ASSET', parentKey: 'L3-VEHICLE' },
  { key: 'L4-BUILDING', level: 4, code: '1670-00-001', name: 'Bangunan', group: 'ASSET', parentKey: 'L3-BUILDING' },
  { key: 'L4-BANK-DEBT', level: 4, code: '2400-00-002', name: 'Hutang Bank Jangka Panjang', group: 'LIABILITY', parentKey: 'L3-LONG-DEBT' },
];
const plantationSystemMapping: Record<string, { code?: string; name?: string; parentKey: string }> = {
  AR_PKS: { code: '1131-00-001', name: 'Piutang Usaha - PKS', parentKey: 'L3-AR' },
  AR_EMPLOYEE: { code: '1132-00-001', name: 'Piutang Karyawan/Pemegang Saham', parentKey: 'L3-AR-NON' },
  INVENTORY: { code: '1150-00-000', name: 'Persediaan', parentKey: 'L3-INVENTORY' },
  VAT_INPUT: { code: '1172-00-002', name: 'PPN Masukan', parentKey: 'L3-PREPAID-TAX' },
  FIXED_ASSET: { code: '1650-00-001', name: 'Peralatan/Perlengkapan', parentKey: 'L3-EQUIPMENT' },
  BEARER_PLANTS: { code: '1630-00-001', name: 'Tanaman Menghasilkan', parentKey: 'L3-BEARER' },
  AP_SUPPLIER: { code: '2101-00-001', name: 'Hutang Usaha', parentKey: 'L3-AP' },
  PAYROLL_PAYABLE: { code: '2300-00-002', name: 'Biaya Gaji/Upah yang Masih Harus Dibayar', parentKey: 'L3-ACCRUED' },
  PAYROLL_DEDUCTION: { code: '2300-00-003', name: 'Potongan Payroll Belum Diselesaikan', parentKey: 'L3-ACCRUED' },
  OTHER_PAYABLE: { code: '2102-00-006', name: 'Hutang Lainnya', parentKey: 'L3-OTHER-PAYABLE' },
  CAPITAL: { code: '3110-00-001', name: 'Modal Saham Disetor', parentKey: 'L3-CAPITAL' },
  REVENUE_TBS: { code: '4010-00-000', name: 'Penjualan TBS', parentKey: 'L3-TBS-SALES' },
  REVENUE_OTHER: { code: '8010-00-999', name: 'Pendapatan Lainnya', parentKey: 'L3-OTHER-REV' },
  EXP_HARVEST: { code: '5210-00-002', name: 'Upah Mendodos/Mengegrek', parentKey: 'L3-HARVEST-WAGE' },
  EXP_WEIGH: { code: '5210-00-005', name: 'Upah Timbang', parentKey: 'L3-HARVEST-WAGE' },
  EXP_LANGSIR: { code: '5210-00-006', name: 'Upah Langsir', parentKey: 'L3-HARVEST-WAGE' },
  EXP_WORK: { code: '5190-00-001', name: 'Biaya Pemeliharaan Tanaman Lainnya - TM', parentKey: 'L3-MAINT-OTHER' },
  EXP_TRANSPORT: { code: '5230-00-001', name: 'Ongkos Angkut TBS', parentKey: 'L3-HARVEST-TRANSPORT' },
  EXP_FERTILIZER: { code: '5122-00-007', name: 'Pupuk - TM', parentKey: 'L3-MAINT-MAT' },
  EXP_HERBICIDE: { code: '5123-00-999', name: 'Bahan Kimia Lainnya - TM', parentKey: 'L3-MAINT-MAT' },
  EXP_MAINTENANCE: { code: '5110-00-105', name: 'Upah Lainnya - TM', parentKey: 'L3-MAINT-WAGE' },
  EXP_FUEL: { code: '5390-00-002', name: 'Biaya BBM Operasional Kebun', parentKey: 'L3-ESTATE-ADMIN' },
  EXP_TOOLS: { code: '5220-00-999', name: 'Bahan/Perlengkapan Panen Lainnya', parentKey: 'L3-HARVEST-MAT' },
  EXP_ADMIN: { code: '5390-00-001', name: 'Biaya Administrasi Kebun Lainnya', parentKey: 'L3-ESTATE-ADMIN' },
  EXP_OTHER: { code: '9010-00-999', name: 'Beban Lainnya', parentKey: 'L3-OTHER-EXP' },
};
function hierarchyError(level: 1 | 2 | 3 | 4, parentId: string, group: AccountingGroup, accounts: Array<AccountingAccountRecord & { id: string }>) {
  if (level === 1) return parentId ? 'Level 1 tidak memiliki parent.' : '';
  const parent = accounts.find(item => item.id === parentId);
  if (!parent) return `Parent Level ${level - 1} wajib dipilih.`;
  const normalized = normalizeAccountingAccount(parent);
  if (normalized.level !== level - 1) return `Parent harus berada pada Level ${level - 1}.`;
  if (normalized.group !== group) return 'Klasifikasi parent harus sama dengan klasifikasi akun.';
  return '';
}
async function applyPlantationTemplate(workspaceId: string, actor: string) {
  const table = dataTable('accounting_accounts', workspaceId);
  const accounts = await ensureAccountingAccounts(workspaceId, actor);
  const working = [...accounts];
  const ids = new Map<string, string>();
  for (const item of working) if (item.templateKey) ids.set(item.templateKey, item.id);
  for (const spec of plantationTemplateSpecs) {
    const parentId = spec.parentKey ? ids.get(spec.parentKey) || '' : '';
    let current = working.find(item => item.templateKey === spec.key) || working.find(item => !item.systemKey && item.code === spec.code && item.name.toLowerCase() === spec.name.toLowerCase());
    if (!current) {
      const stamp = now();
      const record: AccountingAccountRecord = { code: spec.code, name: spec.name, group: spec.group, normalBalance: accountingNormalBalance('', spec.group), systemKey: '', level: spec.level, parentId, posting: spec.level === 4, templateKey: spec.key, active: true, locked: false, createdBy: actor, updatedBy: actor, createdAt: stamp, updatedAt: stamp };
      const [id] = await db.add(table, [record]);
      if (!id) throw new Error(`Template COA gagal membuat ${spec.name}.`);
      current = { id, ...record };
      working.push(current);
    } else {
      const normalized = normalizeAccountingAccount(current);
      const { id, ...record } = normalized;
      const next = { ...record, level: spec.level, parentId, posting: spec.level === 4, templateKey: spec.key, updatedBy: actor, updatedAt: now() };
      const [ok] = await db.update(table, [{ id, record: next }]);
      if (!ok) throw new Error(`Template COA gagal menyusun ${spec.name}.`);
      current = { id, ...next };
      const index = working.findIndex(item => item.id === id);
      if (index >= 0) working[index] = current;
    }
    ids.set(spec.key, current.id);
  }
  const usedCodes = new Map(working.map(item => [item.code.toUpperCase(), item.id]));
  for (const item of working.filter(row => Boolean(row.systemKey))) {
    const mapping = plantationSystemMapping[item.systemKey];
    let parentId = mapping ? ids.get(mapping.parentKey) || '' : '';
    if (item.systemKey.startsWith('CASH:')) {
      const operationalId = item.systemKey.slice(5);
      const [operational] = await db.get<AccountRecord>(dataTable('accounts', workspaceId), [operationalId]);
      parentId = ids.get(operational?.type === 'BANK' ? 'L3-BANK' : 'L3-CASH') || '';
    }
    if (!parentId) continue;
    const normalized = normalizeAccountingAccount(item);
    const alreadyMapped = Boolean(normalized.templateKey);
    let code = !alreadyMapped && mapping?.code ? mapping.code : normalized.code;
    if (usedCodes.has(code.toUpperCase()) && usedCodes.get(code.toUpperCase()) !== item.id) code = normalized.code;
    const name = !alreadyMapped && mapping?.name ? mapping.name : normalized.name;
    const { id, ...record } = normalized;
    const next: AccountingAccountRecord = { ...record, code, name, level: 4, parentId, posting: true, templateKey: normalized.templateKey || `SYS:${normalized.systemKey}`, active: true, updatedBy: actor, updatedAt: now() };
    const [ok] = await db.update(table, [{ id, record: next }]);
    if (!ok) throw new Error(`Template COA gagal memetakan ${normalized.name}.`);
    usedCodes.set(code.toUpperCase(), id);
  }
  return ensureAccountingAccounts(workspaceId, actor);
}
function templateCashFlow(spec: PlantationTemplateSpec & { cashFlowClass?: AccountingCashFlowClass }) {
  if (spec.level !== 4) return 'NON_CASH' as AccountingCashFlowClass;
  if (spec.cashFlowClass) return accountingCashFlowClass(spec.cashFlowClass);
  const value = `${spec.code} ${spec.name}`.toLowerCase();
  if (value.includes('akumulasi') || value.includes('historical') || value.includes('laba tahun') || value.includes('laba ditahan')) return 'NON_CASH' as AccountingCashFlowClass;
  if (/^(12|13|14|16|17|19)/.test(spec.code)) return 'INVESTING' as AccountingCashFlowClass;
  if (/^24/.test(spec.code) || /^3110/.test(spec.code) || spec.code === '3210-00-003') return 'FINANCING' as AccountingCashFlowClass;
  return 'OPERATING' as AccountingCashFlowClass;
}
function systemCashFlowClass(systemKey: string): AccountingCashFlowClass {
  if (systemKey.startsWith('CASH:')) return 'NON_CASH';
  if (['FIXED_ASSET', 'BEARER_PLANTS'].includes(systemKey)) return 'INVESTING';
  if (systemKey === 'CAPITAL') return 'FINANCING';
  return 'OPERATING';
}
async function ensureReferenceCashAccounts(workspaceId: string, actor: string, source: Array<AccountingAccountRecord & { id: string }>) {
  const cashParent = source.find(item => item.templateKey === 'L3-CASH');
  const bankParent = source.find(item => item.templateKey === 'L3-BANK');
  if (!cashParent || !bankParent) return source;
  const operational = (await db.list<AccountRecord>(dataTable('accounts', workspaceId), { limit: 100 })).items;
  const table = dataTable('accounting_accounts', workspaceId);
  const usedCodes = new Set(source.map(item => item.code.toUpperCase()));
  const additions: AccountingAccountRecord[] = [];
  const updates: Array<{ id: string; record: AccountingAccountRecord }> = [];
  const nextCode = (type: 'KAS' | 'BANK') => {
    const prefix = type === 'BANK' ? '1120-00-' : '1110-00-';
    let index = 1;
    let code = `${prefix}${String(index).padStart(3, '0')}`;
    while (usedCodes.has(code.toUpperCase())) { index += 1; code = `${prefix}${String(index).padStart(3, '0')}`; }
    usedCodes.add(code.toUpperCase());
    return code;
  };
  for (const operationalAccount of operational) {
    const systemKey = `CASH:${operationalAccount.id}`;
    const existing = source.find(item => item.systemKey === systemKey);
    const parentId = operationalAccount.type === 'BANK' ? bankParent.id : cashParent.id;
    if (existing) {
      const normalized = normalizeAccountingAccount(existing);
      if (normalized.parentId !== parentId || normalized.cashFlowClass !== 'NON_CASH') {
        const { id, ...record } = normalized;
        updates.push({ id, record: { ...record, level: 4, parentId, posting: true, cashFlowClass: 'NON_CASH', templateKey: normalized.templateKey || `SYS:${systemKey}`, active: true, locked: true, updatedBy: actor, updatedAt: now() } });
      }
      continue;
    }
    const stamp = now();
    additions.push({ code: nextCode(operationalAccount.type), name: operationalAccount.name, group: 'ASSET', normalBalance: 'DEBIT', systemKey, level: 4, parentId, posting: true, templateKey: `SYS:${systemKey}`, cashFlowClass: 'NON_CASH', active: true, locked: true, createdBy: actor, updatedBy: actor, createdAt: stamp, updatedAt: stamp });
  }
  if (updates.length > 0) await db.update(table, updates);
  if (additions.length > 0) await db.add(table, additions);
  return (await db.list<AccountingAccountRecord>(table, { limit: 500 })).items.map(item => normalizeAccountingAccount(item));
}
async function applyReferencePlantationTemplate(workspaceId: string, actor: string) {
  const table = dataTable('accounting_accounts', workspaceId);
  let working = await ensureAccountingAccounts(workspaceId, actor);
  const referenceCodes = new Set(referencePlantationAdditions.map(item => item.code));
  const specs = [...plantationTemplateSpecs.filter(item => !referenceCodes.has(item.code)), ...referencePlantationAdditions] as Array<PlantationTemplateSpec & { cashFlowClass?: AccountingCashFlowClass }>;
  const ids = new Map<string, string>();
  for (const item of working) if (item.templateKey) ids.set(item.templateKey, item.id);
  for (const level of [1, 2, 3, 4] as const) {
    const additions: AccountingAccountRecord[] = [];
    const updates: Array<{ id: string; record: AccountingAccountRecord }> = [];
    for (const spec of specs.filter(item => item.level === level)) {
      const parentId = spec.parentKey ? ids.get(spec.parentKey) || '' : '';
      const current = working.find(item => item.templateKey === spec.key) || working.find(item => !item.systemKey && item.code === spec.code && item.name.toLowerCase() === spec.name.toLowerCase());
      if (current) {
        const normalized = normalizeAccountingAccount(current);
        const { id, ...record } = normalized;
        updates.push({ id, record: { ...record, level, parentId, posting: level === 4, templateKey: spec.key, cashFlowClass: level === 4 ? normalized.cashFlowClass : 'NON_CASH', updatedBy: actor, updatedAt: now() } });
      } else {
        const stamp = now();
        additions.push({ code: spec.code, name: spec.name, group: spec.group, normalBalance: accountingNormalBalance('', spec.group), systemKey: '', level, parentId, posting: level === 4, templateKey: spec.key, cashFlowClass: templateCashFlow(spec), active: true, locked: false, createdBy: actor, updatedBy: actor, createdAt: stamp, updatedAt: stamp });
      }
    }
    if (updates.length > 0) { const results = await db.update(table, updates); if (!results.every(Boolean)) throw new Error(`Template COA Level ${level} belum tersusun lengkap.`); }
    if (additions.length > 0) { const created = await db.add(table, additions); if (created.some(id => !id)) throw new Error(`Template COA Level ${level} belum dibuat lengkap.`); }
    working = (await db.list<AccountingAccountRecord>(table, { limit: 500 })).items.map(item => normalizeAccountingAccount(item));
    ids.clear();
    for (const item of working) if (item.templateKey) ids.set(item.templateKey, item.id);
  }
  const usedCodes = new Set(working.map(item => item.code.toUpperCase()));
  const systemAdds: AccountingAccountRecord[] = [];
  const systemUpdates: Array<{ id: string; record: AccountingAccountRecord }> = [];
  for (const spec of defaultAccountingSpecs) {
    const mapping = plantationSystemMapping[spec.systemKey];
    const parentId = mapping ? ids.get(mapping.parentKey) || '' : '';
    if (!parentId) continue;
    const existing = working.find(item => item.systemKey === spec.systemKey);
    const desired = mapping?.code || spec.code;
    const fallback = spec.code;
    const code = existing ? existing.code : (!usedCodes.has(desired.toUpperCase()) ? desired : fallback);
    if (existing) {
      const normalized = normalizeAccountingAccount(existing);
      const { id, ...record } = normalized;
      systemUpdates.push({ id, record: { ...record, level: 4, parentId, posting: true, templateKey: normalized.templateKey || `SYS:${spec.systemKey}`, cashFlowClass: normalized.cashFlowClass || systemCashFlowClass(spec.systemKey), active: true, locked: true, updatedBy: actor, updatedAt: now() } });
    } else {
      const stamp = now();
      systemAdds.push({ ...spec, code, name: mapping?.name || spec.name, level: 4, parentId, posting: true, templateKey: `SYS:${spec.systemKey}`, cashFlowClass: systemCashFlowClass(spec.systemKey), active: true, locked: true, createdBy: actor, updatedBy: actor, createdAt: stamp, updatedAt: stamp });
      usedCodes.add(code.toUpperCase());
    }
  }
  if (systemUpdates.length > 0) await db.update(table, systemUpdates);
  if (systemAdds.length > 0) await db.add(table, systemAdds);
  working = (await db.list<AccountingAccountRecord>(table, { limit: 500 })).items.map(item => normalizeAccountingAccount(item));
  return ensureReferenceCashAccounts(workspaceId, actor, working);
}
function validIsoDate(value: string) { return /^\d{4}-\d{2}-\d{2}$/.test(value); }
function periodDate(year: number, monthIndex: number, day: number) { return new Date(Date.UTC(year, monthIndex, day)).toISOString().slice(0, 10); }
function fiscalPeriodSpecs(fiscalYear: number, startMonth: number) {
  return Array.from({ length: 12 }, (_, index) => {
    const monthOffset = startMonth - 1 + index;
    const year = fiscalYear + Math.floor(monthOffset / 12);
    const monthIndex = monthOffset % 12;
    const startDate = periodDate(year, monthIndex, 1);
    const endDate = periodDate(year, monthIndex + 1, 0);
    const periodKey = `${year}-${String(monthIndex + 1).padStart(2, '0')}`;
    return { periodKey, label: new Intl.DateTimeFormat('id-ID', { month: 'long', year: 'numeric', timeZone: 'UTC' }).format(new Date(`${startDate}T00:00:00Z`)), startDate, endDate };
  });
}
async function loadAccountingSettings(workspaceId: string) { const result = await db.list<AccountingSettingsRecord>(dataTable('accounting_settings', workspaceId), { limit: 1 }); return result.items[0] || null; }
async function loadAccountingPeriods(workspaceId: string, settings?: (AccountingSettingsRecord & { id?: string }) | null) {
  const rows = (await db.list<AccountingPeriodRecord>(dataTable('accounting_periods', workspaceId), { limit: 120 })).items;
  if (!settings) return rows;
  return rows.filter(item => item.fiscalYear === settings.fiscalYear && item.fiscalYearStartMonth === settings.fiscalYearStartMonth).sort((a, b) => a.startDate.localeCompare(b.startDate));
}
async function accountingDateWriteError(workspaceId: string, date: string) {
  if (!validIsoDate(date)) return '';
  const settings = await loadAccountingSettings(workspaceId);
  if (!settings?.setupComplete) return '';
  if (settings.conversionDate && date <= settings.conversionDate) return `Tanggal ${date} berada pada atau sebelum cut-off ${settings.conversionDate}. Gunakan Saldo Awal untuk data sebelum cut-off.`;
  const periods = await loadAccountingPeriods(workspaceId, settings);
  const period = periods.find(item => date >= item.startDate && date <= item.endDate);
  if (!period) return 'Tanggal berada di luar tahun buku aktif. Atur Tahun Buku terlebih dahulu.';
  if (period.status !== 'OPEN') return `Periode ${period.label} berstatus ${period.status} dan tidak dapat diubah.`;
  return '';
}
function requireOpenAccountingDate(field = 'date') {
  return async (ctx: { body: unknown; user?: AuthLike }) => {
    const body = objectBody(ctx.body);
    const date = text(body[field]);
    if (!date || !ctx.user) return;
    const wc = await workspaceContext(ctx.user);
    const message = await accountingDateWriteError(wc.workspaceId, date);
    if (message) return error(message, 409);
  };
}
async function loadOpeningBalance(workspaceId: string) { const result = await db.list<OpeningBalanceBatchRecord>(dataTable('opening_balances', workspaceId), { limit: 1 }); return result.items[0] || null; }
function effectiveOpeningLines(batch: Pick<OpeningBalanceBatchRecord, 'generalLines' | 'subledgers' | 'fixedAssets'>) {
  const totals = new Map<string, OpeningBalanceLineRecord>();
  const add = (accountId: string, debit: number, credit: number, note: string, kebunId = '') => { const key = accountId + '|' + kebunId; const current = totals.get(key) || { accountId, debit: 0, credit: 0, note: '', kebunId }; current.debit += debit; current.credit += credit; current.note = current.note || note; totals.set(key, current); };
  for (const line of batch.generalLines || []) add(line.accountId, line.debit, line.credit, line.note, line.kebunId || '');
  for (const line of batch.subledgers || []) add(line.accountId, line.debit, line.credit, line.description);
  for (const asset of batch.fixedAssets || []) { add(asset.assetAccountId, asset.acquisitionCost, 0, asset.description, asset.kebunId); if (asset.accumulatedDepreciation > 0 && asset.accumulatedDepreciationAccountId) add(asset.accumulatedDepreciationAccountId, 0, asset.accumulatedDepreciation, asset.description, asset.kebunId); }
  return [...totals.values()].filter(item => item.debit > 0 || item.credit > 0);
}
async function normalizeOpeningDraft(workspaceId: string, body: Record<string, unknown>, actor: string) {
  const settings = await loadAccountingSettings(workspaceId);
  if (!settings?.setupComplete || !validIsoDate(settings.conversionDate)) throw new Error('Atur Tahun Buku dan tanggal cut-off terlebih dahulu.');
  const accounts = await ensureAccountingAccounts(workspaceId, actor);
  const master = await loadInventoryMaster(workspaceId);
  const fixedMaster = await loadFixedAssetMaster(workspaceId, actor);
  const [cashRows, mills, workers, suppliers] = await Promise.all([db.list<AccountRecord>(dataTable('accounts', workspaceId), { limit: 100 }), db.list<MillRecord>(dataTable('mills', workspaceId), { limit: 100 }), db.list<HarvesterRecord>(dataTable('harvesters', workspaceId), { limit: 200 }), db.list<SupplierRecord>(dataTable('suppliers', workspaceId), { limit: 300 })]);
  const bySystem = new Map(accounts.map(item => [item.systemKey, item]));
  const systemMappings = await ensureAccountingSystemMappings(workspaceId, actor, accounts);
  const mappedSystemId = (key: string) => systemMappings[key] || bySystem.get(key)?.id || '';
  const inventoryAccountIds = new Set(master.groups.filter(item => item.canStore && item.inventoryAccountId).map(item => item.inventoryAccountId));
  const controlled = new Set(accounts.filter(item => item.systemKey.startsWith('CASH:') || ['AR_PKS', 'AR_EMPLOYEE', 'AP_SUPPLIER'].includes(item.systemKey)).map(item => item.id));
  inventoryAccountIds.forEach(id => controlled.add(id));
  fixedMaster.groups.forEach(group => { if (group.assetAccountId) controlled.add(group.assetAccountId); if (group.accumulatedDepreciationAccountId) controlled.add(group.accumulatedDepreciationAccountId); });
  const rawGeneral = Array.isArray(body.generalLines) ? body.generalLines.slice(0, 300) : [];
  const generalLines: OpeningBalanceLineRecord[] = rawGeneral.flatMap(value => {
    const row = objectBody(value); const accountId = text(row.accountId); const debit = money(row.debit); const credit = money(row.credit); const account = accounts.find(item => item.id === accountId);
    if (!accountId && debit === 0 && credit === 0) return [];
    if (!account || !account.active || !isPostingAccount(account)) throw new Error('Saldo awal hanya dapat menggunakan akun posting Level 4 yang aktif.');
    if (controlled.has(accountId)) throw new Error(`Akun ${account.name} harus diisi melalui Detail Subledger.`);
    if ((debit > 0 && credit > 0) || (debit <= 0 && credit <= 0)) throw new Error(`Saldo awal ${account.name} harus memiliki Debit atau Kredit, tidak keduanya.`);
    return [{ accountId, debit, credit, note: text(row.note).slice(0, 240) }];
  });
  const rawSubs = Array.isArray(body.subledgers) ? body.subledgers.slice(0, 500) : [];
  const subledgers: OpeningSubledgerRecord[] = rawSubs.flatMap(value => {
    const row = objectBody(value); const kind = text(row.kind).toUpperCase() as OpeningSubledgerKind; const entityId = text(row.entityId);
    if (!['CASH_BANK', 'PKS', 'EMPLOYEE', 'SUPPLIER', 'INVENTORY'].includes(kind)) throw new Error('Jenis detail subledger tidak valid.');
    if (!entityId) return [];
    let accountId = ''; let debit = 0; let credit = 0; let amount = money(row.amount); let quantity = 0; let unitCost = 0;
    if (kind === 'CASH_BANK') { if (!cashRows.items.some(item => item.id === entityId)) throw new Error('Kas/Bank saldo awal tidak ditemukan.'); accountId = bySystem.get(`CASH:${entityId}`)?.id || ''; debit = amount; }
    else if (kind === 'PKS') { if (!mills.items.some(item => item.id === entityId)) throw new Error('PKS saldo awal tidak ditemukan.'); accountId = mappedSystemId('AR_PKS'); debit = amount; }
    else if (kind === 'EMPLOYEE') { if (!workers.items.some(item => item.id === entityId)) throw new Error('Pekerja saldo awal tidak ditemukan.'); accountId = mappedSystemId('AR_EMPLOYEE'); debit = amount; }
    else if (kind === 'SUPPLIER') { if (!suppliers.items.some(item => item.id === entityId)) throw new Error('Supplier saldo awal tidak ditemukan.'); accountId = mappedSystemId('AP_SUPPLIER'); credit = amount; }
    else { const item = master.items.find(candidate => candidate.id === entityId); const group = item ? master.groups.find(candidate => candidate.id === item.groupId) : undefined; if (!item || !group || !group.canStore || !group.inventoryAccountId) throw new Error('Barang saldo awal harus berasal dari kelompok yang Disimpan.'); const inputQuantity = Math.max(0, Number(row.inputQuantity ?? row.quantity) || 0); const choice = inventoryItemUnitChoice(item, master.units, text(row.inputUnitId || row.unitId), 'NONE'); const inputUnitCost = money(row.inputUnitCost ?? row.unitCost); quantity = Number((inputQuantity * choice.factor).toFixed(6)); unitCost = choice.factor > 0 ? Number((inputUnitCost / choice.factor).toFixed(6)) : 0; if (quantity <= 0) throw new Error(`Qty saldo awal ${item.name} harus lebih dari nol.`); amount = Math.round(inputQuantity * inputUnitCost); accountId = group.inventoryAccountId; debit = amount; row.inputQuantity = inputQuantity; row.inputUnitId = choice.unitId; row.inputUnit = choice.label; row.conversionFactor = choice.factor; row.inputUnitCost = inputUnitCost; }
    if (!accountId) throw new Error('Mapping akun subledger belum tersedia.');
    if (kind !== 'INVENTORY' && amount <= 0) throw new Error('Nominal detail subledger harus lebih dari nol.');
    return [{ kind, accountId, entityId, description: text(row.description).slice(0, 200), reference: text(row.reference).slice(0, 120), amount, quantity, unitCost, inputQuantity: kind === 'INVENTORY' ? Number(row.inputQuantity || quantity) : undefined, inputUnitId: kind === 'INVENTORY' ? text(row.inputUnitId) : undefined, inputUnit: kind === 'INVENTORY' ? text(row.inputUnit) : undefined, conversionFactor: kind === 'INVENTORY' ? Number(row.conversionFactor || 1) : undefined, inputUnitCost: kind === 'INVENTORY' ? money(row.inputUnitCost ?? unitCost) : undefined, debit, credit }];
  });
  const fixedAssets: OpeningFixedAssetRecord[] = fixedMaster.assets.filter(asset => asset.status === 'ACTIVE' && asset.acquisitionCost > 0 && asset.acquisitionDate <= settings.conversionDate).map(asset => {
    const group = fixedMaster.groups.find(item => item.id === asset.groupId);
    if (!group || !group.assetAccountId) throw new Error('Mapping akun aset ' + asset.name + ' belum lengkap.');
    if (group.depreciable && asset.availableForUseDate <= settings.conversionDate && !asset.openingDepreciationOverride && !['STRAIGHT_LINE', 'NONE'].includes(asset.depreciationMethod)) throw new Error('Metode penyusutan ' + asset.name + ' membutuhkan Override Manual untuk Saldo Awal.');
    if (group.depreciable && asset.openingAccumulatedDepreciation > 0 && !group.accumulatedDepreciationAccountId) throw new Error('Akun akumulasi penyusutan ' + asset.name + ' belum dipetakan.');
    return { assetId: asset.id, kebunId: asset.kebunId || '', assetAccountId: group.assetAccountId, accumulatedDepreciationAccountId: group.accumulatedDepreciationAccountId || '', acquisitionCost: asset.acquisitionCost, accumulatedDepreciation: group.depreciable ? asset.openingAccumulatedDepreciation : 0, description: 'Saldo awal aset ' + asset.code + ' · ' + asset.name };
  });
  const lines = effectiveOpeningLines({ generalLines, subledgers, fixedAssets }); const totalDebit = lines.reduce((sum, item) => sum + item.debit, 0); const totalCredit = lines.reduce((sum, item) => sum + item.credit, 0);
  return { settings, generalLines, subledgers, fixedAssets, lines, totalDebit, totalCredit };
}
async function postOpeningOperationalBalances(workspaceId: string, batch: OpeningBalanceBatchRecord, actor: string) {
  const cashTable = dataTable('accounts', workspaceId); const itemTable = dataTable('inventory_items', workspaceId); const cashRows = (await db.list<AccountRecord>(cashTable, { limit: 100 })).items; const master = await loadInventoryMaster(workspaceId);
  const cashTotals = new Map<string, number>(); const itemOpening = new Map<string, { quantity: number; value: number }>();
  for (const row of batch.subledgers || []) { if (row.kind === 'CASH_BANK') cashTotals.set(row.entityId, (cashTotals.get(row.entityId) || 0) + row.debit - row.credit); if (row.kind === 'INVENTORY') { const current = itemOpening.get(row.entityId) || { quantity: 0, value: 0 }; current.quantity += row.quantity; current.value += row.amount; itemOpening.set(row.entityId, current); } }
  const cashUpdates = cashRows.map(item => { const { id, ...record } = item; return { id, record: { ...record, openingBalance: Math.max(0, cashTotals.get(id) || 0), updatedAt: now() } }; });
  if (cashUpdates.length > 0) { const results = await db.update(cashTable, cashUpdates); if (!results.every(Boolean)) throw new Error('Saldo awal Kas/Bank gagal diposting lengkap.'); }
  const [purchaseResult, usageResult] = await Promise.all([
    db.list<PurchaseInvoiceRecord>(dataTable('purchase_invoices', workspaceId), { limit: 500 }),
    db.list<InventoryUsageRecord>(dataTable('inventory_usages', workspaceId), { limit: 500 }),
  ]);
  const purchaseRows = purchaseResult.items.filter(item => item.date > batch.cutoffDate);
  const usageRows = usageResult.items.filter(item => item.date > batch.cutoffDate);
  const movement = new Map<string, { quantity: number; value: number }>();
  for (const invoice of purchaseRows) for (const [itemId, part] of inventoryContributions(invoice)) { const current = movement.get(itemId) || { quantity: 0, value: 0 }; current.quantity += part.quantity; current.value += part.value; movement.set(itemId, current); }
  for (const usage of usageRows) for (const line of usage.lines) { const current = movement.get(line.itemId) || { quantity: 0, value: 0 }; current.quantity -= line.quantity; current.value -= line.amount; movement.set(line.itemId, current); }
  const itemUpdates = master.items.map(item => { const opening = itemOpening.get(item.id) || { quantity: 0, value: 0 }; const after = movement.get(item.id) || { quantity: 0, value: 0 }; const openingAverageCost = opening.quantity > 0 ? Number((opening.value / opening.quantity).toFixed(6)) : 0; const currentQuantity = opening.quantity + after.quantity; const stockValue = Math.round(opening.value + after.value); if (currentQuantity < -0.000001 || stockValue < -1) throw new Error(`Saldo Persediaan ${item.name} menjadi negatif setelah Saldo Awal diterapkan.`); const { id, ...record } = item; return { id, record: { ...record, openingQuantity: opening.quantity, openingAverageCost, currentQuantity: Math.max(0, currentQuantity), stockValue: Math.max(0, stockValue), averageCost: currentQuantity > 0 ? Number((Math.max(0, stockValue) / currentQuantity).toFixed(6)) : 0, updatedBy: actor, updatedAt: now() } }; });
  if (itemUpdates.length > 0) { const results = await db.update(itemTable, itemUpdates); if (!results.every(Boolean)) throw new Error('Saldo awal Persediaan gagal diposting lengkap.'); }
  const hasNonDefaultStock = master.balances.some(item => item.warehouseId !== master.defaultWarehouseId && (Number(item.quantity || 0) > 0.000001 || Number(item.stockValue || 0) > 1));
  if (!hasNonDefaultStock) {
    const balanceTable = dataTable('inventory_warehouse_balances', workspaceId); const defaultBalanceMap = new Map(master.balances.filter(item => item.warehouseId === master.defaultWarehouseId).map(item => [item.itemId, item])); const balanceUpdates: Array<{ id: string; record: InventoryWarehouseBalanceRecord }> = []; const balanceAdds: InventoryWarehouseBalanceRecord[] = [];
    for (const update of itemUpdates) { const quantity = Number(update.record.currentQuantity || 0); const stockValue = Number(update.record.stockValue || 0); const existing = defaultBalanceMap.get(update.id); const record: InventoryWarehouseBalanceRecord = { warehouseId: master.defaultWarehouseId, itemId: update.id, quantity, stockValue, averageCost: quantity > 0 ? Number((stockValue / quantity).toFixed(6)) : 0, updatedBy: actor, updatedAt: now() }; if (existing) balanceUpdates.push({ id: existing.id, record }); else if (quantity > 0 || stockValue > 0) balanceAdds.push(record); }
    if (balanceUpdates.length) { const results = await db.update(balanceTable, balanceUpdates); if (!results.every(Boolean)) throw new Error('Saldo awal Gudang Utama gagal disinkronkan lengkap.'); } if (balanceAdds.length) { const ids = await db.add(balanceTable, balanceAdds); if (ids.length !== balanceAdds.length || ids.some(id => !id)) throw new Error('Saldo awal Gudang Utama gagal dibuat lengkap.'); }
  }
}

async function validateTransactionTargets(
  workspaceId: string,
  membership: MembershipRecord,
  kebunId: string,
  accountId: string
) {
  const [account] = await db.get<AccountRecord>(dataTable('accounts', workspaceId), [accountId]);
  if (!account) return 'Akun kas/bank tidak ditemukan.';
  if (!kebunId) return '';
  if (!canAccessKebun(membership, kebunId)) return 'Kebun ini tidak termasuk akses Anda.';
  const [kebun] = await db.get<KebunRecord>(dataTable('kebun', workspaceId), [kebunId]);
  if (!kebun) return 'Kebun tidak ditemukan.';
  return '';
}

function transactionAllocations(value: unknown, defaultKebunId = ''): TransactionAllocationRecord[] {
  if (!Array.isArray(value)) return [];
  return value.slice(0, 50).map(item => {
    const row = objectBody(item);
    const hasKebunId = Object.prototype.hasOwnProperty.call(row, 'kebunId');
    return {
      accountId: text(row.accountId),
      kebunId: hasKebunId ? text(row.kebunId) : defaultKebunId,
      amount: money(row.amount),
      memo: text(row.memo).slice(0, 300),
    };
  });
}

async function validateTransactionAllocations(workspaceId: string, membership: MembershipRecord, allocations: TransactionAllocationRecord[]) {
  if (allocations.length === 0 || allocations.some(item => !item.accountId || item.amount <= 0)) {
    return { error: 'Minimal satu akun lawan Level 4 dan nominal lebih dari nol wajib diisi.', accounts: new Map<string, AccountingAccountRecord>() };
  }
  const ids = Array.from(new Set(allocations.map(item => item.accountId)));
  const rows = await db.get<AccountingAccountRecord>(dataTable('accounting_accounts', workspaceId), ids);
  const accounts = new Map<string, AccountingAccountRecord>();
  ids.forEach((id, index) => {
    const row = rows[index];
    if (row) accounts.set(id, normalizeAccountingAccount(row));
  });
  const kebunIds = Array.from(new Set(allocations.map(item => item.kebunId || '').filter(Boolean)));
  const kebunRows = kebunIds.length > 0 ? await db.get<KebunRecord>(dataTable('kebun', workspaceId), kebunIds) : [];
  const validKebunIds = new Set(kebunIds.filter((_, index) => Boolean(kebunRows[index])));
  for (const allocation of allocations) {
    const account = accounts.get(allocation.accountId);
    if (!account) return { error: 'Akun lawan COA tidak ditemukan.', accounts };
    if (!account.active || !isPostingAccount(account)) return { error: 'Akun lawan harus akun posting Level 4 yang aktif.', accounts };
    if (account.systemKey.startsWith('CASH:')) return { error: 'Kas/Bank tidak boleh menjadi akun lawan. Gunakan menu Transfer untuk pemindahan antar Kas/Bank.', accounts };
    if (membership.role === 'ADMIN_KEBUN' && !allocation.kebunId) return { error: 'Admin Kebun wajib memilih Kebun/Cost Center pada setiap baris.', accounts };
    if (allocation.kebunId && !validKebunIds.has(allocation.kebunId)) return { error: 'Kebun/Cost Center pada rincian tidak ditemukan.', accounts };
    if (allocation.kebunId && !canAccessKebun(membership, allocation.kebunId)) return { error: 'Kebun/Cost Center pada rincian berada di luar akses Anda.', accounts };
  }
  return { error: '', accounts };
}

function transactionAllocationCategory(allocations: TransactionAllocationRecord[], accounts: Map<string, AccountingAccountRecord>) {
  if (allocations.length === 1) {
    const account = accounts.get(allocations[0].accountId);
    if (account) return `${account.code} · ${account.name}`.slice(0, 120);
  }
  return `Multi Akun (${allocations.length})`;
}

function transactionAllocationKebunId(allocation: TransactionAllocationRecord, transactionKebunId: string) {
  return allocation.kebunId === undefined ? transactionKebunId : allocation.kebunId;
}

function transactionSummaryKebunId(allocations: TransactionAllocationRecord[]) {
  const ids = Array.from(new Set(allocations.map(item => item.kebunId || '')));
  return ids.length === 1 ? ids[0] : '';
}

function transactionKebunIds(transaction: TransactionRecord) {
  const ids = transaction.allocations?.length
    ? transaction.allocations.map(item => transactionAllocationKebunId(item, transaction.kebunId))
    : [transaction.kebunId];
  return Array.from(new Set(ids.filter(Boolean)));
}

function transactionAccessibleToMembership(transaction: TransactionRecord, membership: MembershipRecord) {
  if (membership.role !== 'ADMIN_KEBUN') return true;
  const ids = transactionKebunIds(transaction);
  return ids.length > 0 && ids.every(id => canAccessKebun(membership, id));
}

function projectTransactionForMembership<T extends TransactionRecord>(transaction: T, membership: MembershipRecord): T | null {
  if (membership.role !== 'ADMIN_KEBUN') return transaction;
  if (transaction.kind === 'TRANSFER') return null;
  if (!transaction.allocations?.length) return canAccessKebun(membership, transaction.kebunId) ? transaction : null;
  const normalized = transaction.allocations.map(item => ({ ...item, kebunId: transactionAllocationKebunId(item, transaction.kebunId) }));
  const visible = normalized.filter(item => Boolean(item.kebunId) && canAccessKebun(membership, item.kebunId || ''));
  if (visible.length === 0) return null;
  const kebunIds = Array.from(new Set(visible.map(item => item.kebunId || '')));
  const restrictedProjection = visible.length !== normalized.length;
  return {
    ...transaction,
    allocations: visible,
    amount: visible.reduce((sum, item) => sum + item.amount, 0),
    kebunId: kebunIds.length === 1 ? kebunIds[0] : '',
    category: restrictedProjection ? (visible.length === 1 ? 'Alokasi Kas/Bank' : `Multi Akun (${visible.length})`) : transaction.category,
    restrictedProjection,
    receiptPath: restrictedProjection ? undefined : transaction.receiptPath,
    receiptName: restrictedProjection ? undefined : transaction.receiptName,
  };
}

type TransactionResetTableKind =
  | 'transactions'
  | 'tbs_payments'
  | 'tbs_cost_payments'
  | 'supplier_payments'
  | 'payroll_runs'
  | 'payroll_manual'
  | 'employee_receivables'
  | 'work_entries'
  | 'purchase_invoices'
  | 'inventory_usages'
  | 'supplier_bills'
  | 'tbs'
  | 'manual_journals'
  | 'opening_balances'
  | 'accounting_periods'
  | 'accounting_settings';

type OneTimeResetMarker = {
  key: string;
  status: 'RUNNING' | 'COMPLETE';
  startedAt: string;
  completedAt?: string;
  requestedBy: string;
  updatedAt: string;
};

const ONE_TIME_TRANSACTION_RESET_KEY = 'RESET-TRANSACTIONS-2026-09-15';
const ONE_TIME_COA_RESET_KEY = 'RESET-COA-2026-09-15';
const ONE_TIME_TRANSACTION_RESET_TABLES: TransactionResetTableKind[] = [
  'transactions',
  'tbs_payments',
  'tbs_cost_payments',
  'supplier_payments',
  'payroll_runs',
  'payroll_manual',
  'employee_receivables',
  'work_entries',
  'purchase_invoices',
  'inventory_usages',
  'supplier_bills',
  'tbs',
  'manual_journals',
  'opening_balances',
  'accounting_periods',
  'accounting_settings',
];

async function processOneTimeTransactionReset(workspaceId: string, actor: string) {
  const markerTable = `admin_reset_markers:${workspaceId}`;
  const markerRows = (await db.list<OneTimeResetMarker>(markerTable, { limit: 20 })).items;
  const existingMarker = markerRows.find(item => item.key === ONE_TIME_TRANSACTION_RESET_KEY);
  if (existingMarker?.status === 'COMPLETE') {
    return { complete: true, alreadyCompleted: true, table: '', deleted: 0 };
  }

  let markerId = existingMarker?.id || '';
  const startedAt = existingMarker?.startedAt || now();
  const requestedBy = existingMarker?.requestedBy || actor;
  if (!markerId) {
    const [createdId] = await db.add(markerTable, [{
      key: ONE_TIME_TRANSACTION_RESET_KEY,
      status: 'RUNNING',
      startedAt,
      requestedBy,
      updatedAt: startedAt,
    }]);
    if (!createdId) throw new Error('Penanda reset transaksi gagal dibuat.');
    markerId = createdId;
  }

  for (const kind of ONE_TIME_TRANSACTION_RESET_TABLES) {
    const table = dataTable(kind, workspaceId);
    const page = await db.list<Record<string, unknown>>(table, { limit: 250 });
    if (page.items.length === 0) continue;
    if (kind === 'transactions') {
      const receiptPaths = page.items.map(item => text(item.receiptPath)).filter(Boolean);
      if (receiptPaths.length > 0) await storage.delete(receiptPaths);
    }
    const ids = page.items.map(item => item.id);
    const results = await db.delete(table, ids);
    const deleted = results.filter(Boolean).length;
    if (deleted === 0) throw new Error(`Data ${kind} belum dapat dikosongkan.`);
    return { complete: false, alreadyCompleted: false, table: kind, deleted };
  }

  const cashTable = dataTable('accounts', workspaceId);
  const cashRows = (await db.list<AccountRecord>(cashTable, { limit: 100 })).items;
  if (cashRows.length > 0) {
    const stamp = now();
    const updates = cashRows.map(item => {
      const { id, ...record } = item;
      return { id, record: { ...record, openingBalance: 0, updatedAt: stamp } };
    });
    const results = await db.update(cashTable, updates);
    if (!results.every(Boolean)) throw new Error('Saldo awal Kas/Bank belum berhasil dikembalikan ke nol.');
  }

  const inventoryTable = dataTable('inventory_items', workspaceId);
  const inventoryRows = (await db.list<InventoryItemRecord>(inventoryTable, { limit: 500 })).items;
  if (inventoryRows.length > 0) {
    const stamp = now();
    const updates = inventoryRows.map(item => {
      const { id, ...record } = item;
      return {
        id,
        record: {
          ...record,
          openingQuantity: 0,
          openingAverageCost: 0,
          currentQuantity: 0,
          averageCost: 0,
          stockValue: 0,
          updatedBy: actor,
          updatedAt: stamp,
        },
      };
    });
    const results = await db.update(inventoryTable, updates);
    if (!results.every(Boolean)) throw new Error('Saldo persediaan belum berhasil dikembalikan ke nol.');
  }

  const completedAt = now();
  const [markerUpdated] = await db.update(markerTable, [{
    id: markerId,
    record: {
      key: ONE_TIME_TRANSACTION_RESET_KEY,
      status: 'COMPLETE',
      startedAt,
      completedAt,
      requestedBy,
      updatedAt: completedAt,
    },
  }]);
  if (!markerUpdated) throw new Error('Status reset transaksi belum berhasil dikunci.');
  return { complete: true, alreadyCompleted: false, table: '', deleted: 0 };
}

async function processOneTimeCoaReset(workspaceId: string, actor: string) {
  const markerTable = `admin_reset_markers:${workspaceId}`;
  const markerRows = (await db.list<OneTimeResetMarker>(markerTable, { limit: 20 })).items;
  const existingMarker = markerRows.find(item => item.key === ONE_TIME_COA_RESET_KEY);
  if (existingMarker?.status === 'COMPLETE') return { complete: true, alreadyCompleted: true, deleted: 0 };
  let markerId = existingMarker?.id || '';
  const startedAt = existingMarker?.startedAt || now();
  const requestedBy = existingMarker?.requestedBy || actor;
  if (!markerId) {
    const [createdId] = await db.add(markerTable, [{ key: ONE_TIME_COA_RESET_KEY, status: 'RUNNING', startedAt, requestedBy, updatedAt: startedAt }]);
    if (!createdId) throw new Error('Penanda reset COA gagal dibuat.');
    markerId = createdId;
  }
  const groupTable = dataTable('inventory_groups', workspaceId);
  const groupRows = (await db.list<InventoryGroupRecord>(groupTable, { limit: 300 })).items;
  const mappedGroups = groupRows.filter(item => item.purchaseAccountId || item.inventoryAccountId || item.salesAccountId || item.cogsAccountId);
  if (mappedGroups.length > 0) {
    const stamp = now();
    const updates = mappedGroups.map(item => {
      const { id, ...record } = item;
      return { id, record: { ...record, purchaseAccountId: '', inventoryAccountId: '', salesAccountId: '', cogsAccountId: '', updatedBy: actor, updatedAt: stamp } };
    });
    const results = await db.update(groupTable, updates);
    if (!results.every(Boolean)) throw new Error('Mapping akun Master Persediaan belum berhasil dikosongkan.');
  }
  const coaTable = dataTable('accounting_accounts', workspaceId);
  const page = await db.list<AccountingAccountRecord>(coaTable, { limit: 250 });
  if (page.items.length > 0) {
    const results = await db.delete(coaTable, page.items.map(item => item.id));
    const deleted = results.filter(Boolean).length;
    if (deleted === 0) throw new Error('COA belum dapat dikosongkan.');
    return { complete: false, alreadyCompleted: false, deleted };
  }
  const completedAt = now();
  const [markerUpdated] = await db.update(markerTable, [{ id: markerId, record: { key: ONE_TIME_COA_RESET_KEY, status: 'COMPLETE', startedAt, completedAt, requestedBy, updatedAt: completedAt } }]);
  if (!markerUpdated) throw new Error('Status reset COA belum berhasil dikunci.');
  return { complete: true, alreadyCompleted: false, deleted: 0 };
}

export const handler = router({
  'GET /api/_healthcheck': [async () => json({ message: 'Success' })],
  'POST /api/admin/one-time-transaction-reset': [
    requireAuth(),
    async ctx => {
      const wc = await workspaceContext(ctx.user!);
      if (wc.membership.role !== 'OWNER') return error('Hanya Owner yang dapat menjalankan reset transaksi.', 403);
      const body = objectBody(ctx.body);
      if (text(body.key) !== ONE_TIME_TRANSACTION_RESET_KEY) return error('Kunci reset transaksi tidak valid.', 400);
      try {
        return json(await processOneTimeTransactionReset(wc.workspaceId, ctx.user!.email || ctx.user!.userId));
      } catch (err) {
        return error(err instanceof Error ? err.message : 'Reset transaksi belum berhasil diselesaikan.', 500);
      }
    },
  ],
  'POST /api/admin/one-time-coa-reset': [
    requireAuth(),
    async ctx => {
      const wc = await workspaceContext(ctx.user!);
      if (wc.membership.role !== 'OWNER') return error('Hanya Owner yang dapat menjalankan reset COA.', 403);
      const body = objectBody(ctx.body);
      if (text(body.key) !== ONE_TIME_COA_RESET_KEY) return error('Kunci reset COA tidak valid.', 400);
      try { return json(await processOneTimeCoaReset(wc.workspaceId, ctx.user!.email || ctx.user!.userId)); }
      catch (err) { return error(err instanceof Error ? err.message : 'Reset COA belum berhasil diselesaikan.', 500); }
    },
  ],
  'GET /api/accounting/accounts': [
    requireAuth(),
    async ctx => {
      const wc = await workspaceContext(ctx.user!);
      const actor = ctx.user!.email || ctx.user!.userId;
      const accounts = await ensureAccountingAccounts(wc.workspaceId, actor);
      const systemMappings = await ensureAccountingSystemMappings(wc.workspaceId, actor, accounts);
      return json({ accounts, systemMappings });
    },
  ],
  'PUT /api/accounting/system-accounts': [
    requireAuth(),
    async ctx => {
      const wc = await workspaceContext(ctx.user!);
      if (!canManageMaster(wc.membership.role)) return error('Owner/Admin Pusat yang dapat mengubah Setup Akun Penting.', 403);
      const actor = ctx.user!.email || ctx.user!.userId;
      const accounts = await ensureAccountingAccounts(wc.workspaceId, actor);
      const current = await ensureAccountingSystemMappings(wc.workspaceId, actor, accounts);
      const body = objectBody(ctx.body);
      const rows = Array.isArray(body.mappings) ? body.mappings.slice(0, importantAccountingAccountSpecs.length) : [];
      if (rows.length === 0) return error('Mapping Akun Penting wajib diisi.', 400);
      const next = { ...current };
      for (const value of rows) {
        const row = objectBody(value); const key = text(row.key); const accountId = text(row.accountId);
        if (!importantAccountingAccountSpecs.some(item => item.key === key) || !accountId) return error('Mapping Akun Penting tidak valid.', 400);
        next[key] = accountId;
      }
      const seen = new Set<string>();
      for (const spec of importantAccountingAccountSpecs) {
        const accountId = next[spec.key]; const account = accounts.find(item => item.id === accountId);
        if (!accountId || !validImportantMappingAccount(account, spec)) return error(`Akun ${spec.key} wajib akun posting Level 4 ${spec.group} yang aktif.`, 400);
        if (account?.systemKey && account.systemKey !== spec.key) return error(`Akun ${account.code} - ${account.name} sudah mempunyai fungsi sistem lain.`, 409);
        if (seen.has(accountId)) return error('Satu akun tidak boleh dipakai untuk dua fungsi Akun Penting yang berbeda.', 409);
        seen.add(accountId);
      }
      const changed = importantAccountingAccountSpecs.some(spec => next[spec.key] !== current[spec.key]);
      if (changed && await accountingSystemMappingHasActivity(wc.workspaceId)) return error('Setup Akun Penting dikunci karena transaksi operasional sudah ada atau Saldo Awal sudah diposting. Mapping historis tidak boleh berubah.', 409);
      const table = dataTable('accounting_system_mappings', wc.workspaceId);
      const existing = (await db.list<AccountingSystemMappingRecord>(table, { limit: 100 })).items;
      const byKey = new Map(existing.map(item => [item.key, item])); const stamp = now();
      const additions: AccountingSystemMappingRecord[] = []; const updates: Array<{ id: string; record: AccountingSystemMappingRecord }> = [];
      for (const spec of importantAccountingAccountSpecs) {
        const row = byKey.get(spec.key); const accountId = next[spec.key];
        if (!row) additions.push({ key: spec.key, accountId, createdBy: actor, updatedBy: actor, createdAt: stamp, updatedAt: stamp });
        else if (row.accountId !== accountId) { const { id, ...record } = row; updates.push({ id, record: { ...record, accountId, updatedBy: actor, updatedAt: stamp } }); }
      }
      if (additions.length > 0) await db.add(table, additions); if (updates.length > 0) await db.update(table, updates);
      return json({ systemMappings: next });
    },
  ],
  'POST /api/accounting/accounts': [
    requireAuth(),
    async ctx => {
      const wc = await workspaceContext(ctx.user!);
      if (!canManageAccounting(wc.membership.role)) return error('Role Anda tidak memiliki akses mengelola Chart of Accounts.', 403);
      const body = objectBody(ctx.body);
      const code = text(body.code).slice(0, 30);
      const name = text(body.name).slice(0, 160);
      const group = accountingGroup(body.group);
      if (!code || !name) return error('Kode dan nama akun wajib diisi.', 400);
      const table = dataTable('accounting_accounts', wc.workspaceId);
      const existing = await ensureAccountingAccounts(wc.workspaceId, ctx.user!.email || ctx.user!.userId);
      if (existing.some(item => item.code.toUpperCase() === code.toUpperCase())) return error('Kode akun sudah digunakan.', 409);
      const stamp = now();
      const actor = ctx.user!.email || ctx.user!.userId;
      const record: AccountingAccountRecord = { code, name, group, normalBalance: accountingNormalBalance(body.normalBalance, group), systemKey: '', active: body.active !== false, locked: false, createdBy: actor, updatedBy: actor, createdAt: stamp, updatedAt: stamp };
      const [id] = await db.add(table, [record]);
      if (!id) return error('Akun gagal ditambahkan.', 500);
      return json({ id, ...record }, 201);
    },
  ],
  'PUT /api/accounting/accounts/:id': [
    requireAuth(),
    async ctx => {
      const wc = await workspaceContext(ctx.user!);
      if (!canManageAccounting(wc.membership.role)) return error('Role Anda tidak memiliki akses mengelola Chart of Accounts.', 403);
      const table = dataTable('accounting_accounts', wc.workspaceId);
      const [existing] = await db.get<AccountingAccountRecord>(table, [ctx.params.id]);
      if (!existing) return error('Akun tidak ditemukan.', 404);
      if (existing.locked || existing.systemKey) return error('Akun sistem dikunci agar jurnal otomatis tetap konsisten.', 409);
      const body = objectBody(ctx.body);
      const code = text(body.code).slice(0, 30);
      const name = text(body.name).slice(0, 160);
      const group = accountingGroup(body.group);
      if (!code || !name) return error('Kode dan nama akun wajib diisi.', 400);
      const all = (await db.list<AccountingAccountRecord>(table, { limit: 500 })).items;
      if (all.some(item => item.id !== ctx.params.id && item.code.toUpperCase() === code.toUpperCase())) return error('Kode akun sudah digunakan.', 409);
      const record: AccountingAccountRecord = { ...existing, code, name, group, normalBalance: accountingNormalBalance(body.normalBalance, group), active: body.active !== false, updatedBy: ctx.user!.email || ctx.user!.userId, updatedAt: now() };
      const [ok] = await db.update(table, [{ id: ctx.params.id, record }]);
      if (!ok) return error('Akun gagal diperbarui.', 500);
      return json({ id: ctx.params.id, ...record });
    },
  ],
  'DELETE /api/accounting/accounts/:id': [
    requireAuth(),
    async ctx => {
      const wc = await workspaceContext(ctx.user!);
      if (!canManageAccounting(wc.membership.role)) return error('Role Anda tidak memiliki akses mengelola Chart of Accounts.', 403);
      const table = dataTable('accounting_accounts', wc.workspaceId);
      const [existing] = await db.get<AccountingAccountRecord>(table, [ctx.params.id]);
      if (!existing) return error('Akun tidak ditemukan.', 404);
      if (existing.locked || existing.systemKey) return error('Akun sistem tidak dapat dihapus.', 409);
      const [journals, invoices, bills, inventoryGroups, inventoryUsages, transactions] = await Promise.all([
        db.list<ManualJournalRecord>(dataTable('manual_journals', wc.workspaceId), { limit: 500 }),
        db.list<PurchaseInvoiceRecord>(dataTable('purchase_invoices', wc.workspaceId), { limit: 500 }),
        db.list<SupplierBillRecord>(dataTable('supplier_bills', wc.workspaceId), { limit: 500 }),
        db.list<InventoryGroupRecord>(dataTable('inventory_groups', wc.workspaceId), { limit: 300 }),
        db.list<InventoryUsageRecord>(dataTable('inventory_usages', wc.workspaceId), { limit: 500 }),
        db.list<TransactionRecord>(dataTable('transactions', wc.workspaceId), { limit: 500 }),
      ]);
      const usedByInventoryGroup = inventoryGroups.items.some(item => [item.purchaseAccountId, item.inventoryAccountId, item.salesAccountId, item.cogsAccountId].includes(ctx.params.id));
      const usedByCashTransaction = transactions.items.some(item => (item.allocations || []).some(allocation => allocation.accountId === ctx.params.id));
      const usedByInventoryUsage = inventoryUsages.items.some(item => item.lines.some(line => line.debitAccountId === ctx.params.id || line.inventoryAccountId === ctx.params.id));
      if (journals.items.some(item => (item.lines || []).some(line => line.accountId === ctx.params.id)) || invoices.items.some(item => item.debitAccountId === ctx.params.id || (item.lines || []).some(line => line.debitAccountId === ctx.params.id)) || bills.items.some(item => item.accountingDebitAccountId === ctx.params.id) || usedByInventoryGroup || usedByInventoryUsage || usedByCashTransaction) return error('Akun sudah digunakan pada transaksi/jurnal/master persediaan dan tidak dapat dihapus.', 409);
      const [ok] = await db.delete(table, [ctx.params.id]);
      if (!ok) return error('Akun gagal dihapus.', 500);
      return json({ deleted: true });
    },
  ],
  'GET /api/accounting/manual-journals': [
    requireAuth(),
    async ctx => {
      const wc = await workspaceContext(ctx.user!);
      if (!canManageAccounting(wc.membership.role)) return error('Role Anda tidak memiliki akses jurnal akuntansi.', 403);
      const rows = await db.list<ManualJournalRecord>(dataTable('manual_journals', wc.workspaceId), { limit: 500 });
      return json({ journals: rows.items });
    },
  ],
  'POST /api/accounting/coa-template/plantation': [
    requireAuth(),
    async ctx => {
      const wc = await workspaceContext(ctx.user!);
      if (!canManageMaster(wc.membership.role)) return error('Owner/Admin Pusat yang dapat menerapkan Template COA.', 403);
      try { return json({ accounts: await applyReferencePlantationTemplate(wc.workspaceId, ctx.user!.email || ctx.user!.userId) }); }
      catch (err) { return error(err instanceof Error ? err.message : 'Template COA gagal diterapkan.', 500); }
    },
  ],
  'POST /api/accounting/coa': [
    requireAuth(),
    async ctx => {
      const wc = await workspaceContext(ctx.user!);
      if (!canManageMaster(wc.membership.role)) return error('Owner/Admin Pusat yang dapat mengubah hierarki COA.', 403);
      const body = objectBody(ctx.body); const code = text(body.code).slice(0, 40); const name = text(body.name).slice(0, 160); const group = accountingGroup(body.group); const level = accountingLevel(body.level); const parentId = level === 1 ? '' : text(body.parentId);
      if (!code || !name) return error('Kode dan nama COA wajib diisi.', 400);
      const accounts = await ensureAccountingAccounts(wc.workspaceId, ctx.user!.email || ctx.user!.userId); const hierarchy = hierarchyError(level, parentId, group, accounts); if (hierarchy) return error(hierarchy, 400); if (accounts.some(item => item.code.toUpperCase() === code.toUpperCase())) return error('Kode COA sudah digunakan.', 409);
      const cashFlowRaw = text(body.cashFlowClass).toUpperCase(); if (level === 4 && !['OPERATING', 'INVESTING', 'FINANCING', 'NON_CASH'].includes(cashFlowRaw)) return error('Klasifikasi Arus Kas Level 4 wajib dipilih.', 400); const stamp = now(); const actor = ctx.user!.email || ctx.user!.userId; const record: AccountingAccountRecord = { code, name, group, normalBalance: accountingNormalBalance(body.normalBalance, group), systemKey: '', level, parentId, posting: level === 4, templateKey: '', cashFlowClass: level === 4 ? accountingCashFlowClass(cashFlowRaw) : 'NON_CASH', active: body.active !== false, locked: false, createdBy: actor, updatedBy: actor, createdAt: stamp, updatedAt: stamp };
      const [id] = await db.add(dataTable('accounting_accounts', wc.workspaceId), [record]); if (!id) return error('COA gagal ditambahkan.', 500); return json({ id, ...record }, 201);
    },
  ],
  'PUT /api/accounting/coa/:id': [
    requireAuth(),
    async ctx => {
      const wc = await workspaceContext(ctx.user!); if (!canManageMaster(wc.membership.role)) return error('Owner/Admin Pusat yang dapat mengubah hierarki COA.', 403);
      const table = dataTable('accounting_accounts', wc.workspaceId); const [raw] = await db.get<AccountingAccountRecord>(table, [ctx.params.id]); if (!raw) return error('COA tidak ditemukan.', 404); const existing = normalizeAccountingAccount(raw); const body = objectBody(ctx.body); const code = text(body.code).slice(0, 40); const name = text(body.name).slice(0, 160); if (!code || !name) return error('Kode dan nama COA wajib diisi.', 400);
      const all = await ensureAccountingAccounts(wc.workspaceId, ctx.user!.email || ctx.user!.userId);
      if (all.some(item => item.id !== ctx.params.id && item.code.toUpperCase() === code.toUpperCase())) return error('Kode COA sudah digunakan.', 409);
      const mappingRows = (await db.list<AccountingSystemMappingRecord>(dataTable('accounting_system_mappings', wc.workspaceId), { limit: 100 })).items;
      const mappedRow = mappingRows.find(item => item.accountId === ctx.params.id);
      const mappedSpec = mappedRow ? importantAccountingAccountSpecs.find(item => item.key === mappedRow.key) : undefined;
      const requestedGroup = accountingGroup(body.group);
      if (mappedSpec && requestedGroup !== mappedSpec.group) return error('Klasifikasi akun tidak dapat diubah karena akun dipakai oleh Setup Akun Penting.', 409);
      const requestedLevel = existing.systemKey || mappedSpec ? 4 : accountingLevel(body.level);
      if (existing.posting && requestedLevel !== 4) return error('Akun posting Level 4 tidak dapat diubah menjadi header. Buat header baru lalu pindahkan parent akun.', 409);
      const group = existing.systemKey || mappedSpec ? existing.group : requestedGroup;
      const parentId = requestedLevel === 1 ? '' : text(body.parentId); const hierarchy = hierarchyError(requestedLevel, parentId, group, all.filter(item => item.id !== ctx.params.id)); if (hierarchy) return error(hierarchy, 400);
      const cashFlowRaw = text(body.cashFlowClass).toUpperCase(); if (requestedLevel === 4 && !['OPERATING', 'INVESTING', 'FINANCING', 'NON_CASH'].includes(cashFlowRaw)) return error('Klasifikasi Arus Kas Level 4 wajib dipilih.', 400); const record: AccountingAccountRecord = { ...existing, code, name, group, normalBalance: existing.systemKey || mappedSpec ? existing.normalBalance : accountingNormalBalance(body.normalBalance, group), level: requestedLevel, parentId, posting: requestedLevel === 4, cashFlowClass: requestedLevel === 4 ? accountingCashFlowClass(cashFlowRaw) : 'NON_CASH', active: existing.systemKey || mappedSpec ? true : body.active !== false, updatedBy: ctx.user!.email || ctx.user!.userId, updatedAt: now() }; const [ok] = await db.update(table, [{ id: ctx.params.id, record }]); if (!ok) return error('COA gagal diperbarui.', 500); return json({ id: ctx.params.id, ...record });
    },
  ],
  'DELETE /api/accounting/coa/:id': [
    requireAuth(),
    async ctx => {
      const wc = await workspaceContext(ctx.user!); if (!canManageMaster(wc.membership.role)) return error('Owner/Admin Pusat yang dapat menghapus COA.', 403); const accounts = await ensureAccountingAccounts(wc.workspaceId, ctx.user!.email || ctx.user!.userId); const existing = accounts.find(item => item.id === ctx.params.id); if (!existing) return error('COA tidak ditemukan.', 404); if (existing.systemKey || existing.locked) return error('Akun sistem tidak dapat dihapus.', 409); const systemMappingRows = (await db.list<AccountingSystemMappingRecord>(dataTable('accounting_system_mappings', wc.workspaceId), { limit: 100 })).items; if (systemMappingRows.some(item => item.accountId === ctx.params.id)) return error('Akun dipakai oleh Setup Akun Penting dan tidak dapat dihapus.', 409); if (accounts.some(item => item.parentId === ctx.params.id)) return error('COA masih memiliki akun anak. Pindahkan/hapus anak terlebih dahulu.', 409);
      if (isPostingAccount(existing)) {
        const [journals, invoices, bills, inventoryGroups, fixedAssetGroups, inventoryUsages, transactions] = await Promise.all([
          db.list<ManualJournalRecord>(dataTable('manual_journals', wc.workspaceId), { limit: 500 }),
          db.list<PurchaseInvoiceRecord>(dataTable('purchase_invoices', wc.workspaceId), { limit: 500 }),
          db.list<SupplierBillRecord>(dataTable('supplier_bills', wc.workspaceId), { limit: 500 }),
          db.list<InventoryGroupRecord>(dataTable('inventory_groups', wc.workspaceId), { limit: 300 }),
          db.list<FixedAssetGroupRecord>(dataTable('fixed_asset_groups', wc.workspaceId), { limit: 100 }),
          db.list<InventoryUsageRecord>(dataTable('inventory_usages', wc.workspaceId), { limit: 500 }),
          db.list<TransactionRecord>(dataTable('transactions', wc.workspaceId), { limit: 500 }),
        ]);
        const usedByCashTransaction = transactions.items.some(item => (item.allocations || []).some(allocation => allocation.accountId === ctx.params.id));
        const usedByFixedAssetGroup = fixedAssetGroups.items.some(item => [item.assetAccountId, item.accumulatedDepreciationAccountId, item.depreciationExpenseAccountId, item.gainAccountId, item.lossAccountId].includes(ctx.params.id));
        const usedByInventoryUsage = inventoryUsages.items.some(item => item.lines.some(line => line.debitAccountId === ctx.params.id || line.inventoryAccountId === ctx.params.id));
        if (journals.items.some(item => (item.lines || []).some(line => line.accountId === ctx.params.id)) || invoices.items.some(item => (item.lines || []).some(line => line.debitAccountId === ctx.params.id)) || bills.items.some(item => item.accountingDebitAccountId === ctx.params.id) || inventoryGroups.items.some(item => [item.purchaseAccountId, item.inventoryAccountId, item.salesAccountId, item.cogsAccountId].includes(ctx.params.id)) || usedByFixedAssetGroup || usedByInventoryUsage || usedByCashTransaction) return error('Akun posting sudah digunakan dan tidak dapat dihapus.', 409);
      }
      const [ok] = await db.delete(dataTable('accounting_accounts', wc.workspaceId), [ctx.params.id]); if (!ok) return error('COA gagal dihapus.', 500); return json({ deleted: true });
    },
  ],
  'GET /api/accounting/foundation': [
    requireAuth(),
    async ctx => {
      const wc = await workspaceContext(ctx.user!); if (!canManageAccounting(wc.membership.role)) return error('Role Anda tidak memiliki akses fondasi akuntansi.', 403); const settings = await loadAccountingSettings(wc.workspaceId); const periods = await loadAccountingPeriods(wc.workspaceId, settings); const opening = await loadOpeningBalance(wc.workspaceId); const effectiveLines = opening ? (opening.status === 'POSTED' && opening.postedLines?.length ? opening.postedLines : effectiveOpeningLines(opening)) : []; const totalDebit = effectiveLines.reduce((sum, item) => sum + item.debit, 0); const totalCredit = effectiveLines.reduce((sum, item) => sum + item.credit, 0); return json({ settings, periods, opening, effectiveLines, totalDebit, totalCredit });
    },
  ],
  'PUT /api/accounting/settings': [
    requireAuth(),
    async ctx => {
      const wc = await workspaceContext(ctx.user!); if (!canManageMaster(wc.membership.role)) return error('Owner/Admin Pusat yang dapat mengubah pengaturan tahun buku.', 403); const body = objectBody(ctx.body); const fiscalYear = Math.floor(Number(body.fiscalYear)); const fiscalYearStartMonth = Math.floor(Number(body.fiscalYearStartMonth)); const conversionDate = text(body.conversionDate); if (fiscalYear < 2000 || fiscalYear > 2200 || fiscalYearStartMonth < 1 || fiscalYearStartMonth > 12 || !validIsoDate(conversionDate)) return error('Tahun buku, bulan mulai, dan tanggal cut-off wajib valid.', 400);
      const existing = await loadAccountingSettings(wc.workspaceId); const opening = await loadOpeningBalance(wc.workspaceId); if (opening?.status === 'POSTED' && existing && (existing.fiscalYearStartMonth !== fiscalYearStartMonth || existing.conversionDate !== conversionDate)) return error('Bulan mulai tahun buku dan cut-off dikunci setelah Saldo Awal diposting.', 409); const stamp = now(); const actor = ctx.user!.email || ctx.user!.userId; const record: AccountingSettingsRecord = { fiscalYear, fiscalYearStartMonth, conversionDate, setupComplete: true, openingPosted: opening?.status === 'POSTED' || existing?.openingPosted === true, createdBy: existing?.createdBy || actor, updatedBy: actor, createdAt: existing?.createdAt || stamp, updatedAt: stamp }; const table = dataTable('accounting_settings', wc.workspaceId);
      if (existing) { const [ok] = await db.update(table, [{ id: existing.id, record }]); if (!ok) return error('Pengaturan tahun buku gagal diperbarui.', 500); } else { const [id] = await db.add(table, [record]); if (!id) return error('Pengaturan tahun buku gagal disimpan.', 500); }
      const periodTable = dataTable('accounting_periods', wc.workspaceId); const allPeriods = (await db.list<AccountingPeriodRecord>(periodTable, { limit: 120 })).items; for (const spec of fiscalPeriodSpecs(fiscalYear, fiscalYearStartMonth)) { const old = allPeriods.find(item => item.periodKey === spec.periodKey && item.fiscalYear === fiscalYear && item.fiscalYearStartMonth === fiscalYearStartMonth); const forcedLocked = spec.endDate <= conversionDate; const periodRecord: AccountingPeriodRecord = { periodKey: spec.periodKey, label: spec.label, startDate: spec.startDate, endDate: spec.endDate, status: forcedLocked ? 'LOCKED' : old?.status || 'OPEN', fiscalYear, fiscalYearStartMonth, createdBy: old?.createdBy || actor, updatedBy: actor, createdAt: old?.createdAt || stamp, updatedAt: stamp }; if (old) await db.update(periodTable, [{ id: old.id, record: periodRecord }]); else await db.add(periodTable, [periodRecord]); }
      return json({ settings: record, periods: await loadAccountingPeriods(wc.workspaceId, record) });
    },
  ],
  'PUT /api/accounting/periods/:id': [
    requireAuth(),
    async ctx => {
      const wc = await workspaceContext(ctx.user!); if (!canManageMaster(wc.membership.role)) return error('Owner/Admin Pusat yang dapat mengubah status periode.', 403); const table = dataTable('accounting_periods', wc.workspaceId); const [existing] = await db.get<AccountingPeriodRecord>(table, [ctx.params.id]); if (!existing) return error('Periode akuntansi tidak ditemukan.', 404); const status = text(objectBody(ctx.body).status).toUpperCase() as AccountingPeriodStatus; if (!['OPEN', 'CLOSED', 'LOCKED'].includes(status)) return error('Status periode tidak valid.', 400); const settings = await loadAccountingSettings(wc.workspaceId); if (existing.endDate <= (settings?.conversionDate || '') && status !== 'LOCKED') return error('Periode sebelum/hingga cut-off wajib tetap LOCKED.', 409); if (existing.status === 'LOCKED' && status !== 'LOCKED' && wc.membership.role !== 'OWNER') return error('Hanya Owner yang dapat membuka kembali periode LOCKED.', 403); const record: AccountingPeriodRecord = { ...existing, status, updatedBy: ctx.user!.email || ctx.user!.userId, updatedAt: now() }; const [ok] = await db.update(table, [{ id: ctx.params.id, record }]); if (!ok) return error('Status periode gagal diperbarui.', 500); return json({ id: ctx.params.id, ...record });
    },
  ],
  'PUT /api/accounting/opening-balance': [
    requireAuth(),
    async ctx => {
      const wc = await workspaceContext(ctx.user!); if (!canManageAccounting(wc.membership.role)) return error('Role Anda tidak memiliki akses Saldo Awal.', 403); const existing = await loadOpeningBalance(wc.workspaceId); if (existing?.status === 'POSTED') return error('Saldo Awal sudah diposting dan dikunci.', 409); const actor = ctx.user!.email || ctx.user!.userId;
      try { const normalized = await normalizeOpeningDraft(wc.workspaceId, objectBody(ctx.body), actor); const stamp = now(); const record: OpeningBalanceBatchRecord = { cutoffDate: normalized.settings.conversionDate, status: 'DRAFT', generalLines: normalized.generalLines, subledgers: normalized.subledgers, fixedAssets: normalized.fixedAssets, totalDebit: normalized.totalDebit, totalCredit: normalized.totalCredit, createdBy: existing?.createdBy || actor, updatedBy: actor, createdAt: existing?.createdAt || stamp, updatedAt: stamp }; const table = dataTable('opening_balances', wc.workspaceId); if (existing) { const [ok] = await db.update(table, [{ id: existing.id, record }]); if (!ok) return error('Draft Saldo Awal gagal diperbarui.', 500); return json({ id: existing.id, ...record }); } const [id] = await db.add(table, [record]); if (!id) return error('Draft Saldo Awal gagal disimpan.', 500); return json({ id, ...record }, 201); }
      catch (err) { return error(err instanceof Error ? err.message : 'Draft Saldo Awal tidak valid.', 400); }
    },
  ],
  'POST /api/accounting/opening-balance/post': [
    requireAuth(),
    async ctx => {
      const wc = await workspaceContext(ctx.user!); if (!canManageMaster(wc.membership.role)) return error('Owner/Admin Pusat yang dapat memposting Saldo Awal.', 403); const opening = await loadOpeningBalance(wc.workspaceId); if (!opening) return error('Draft Saldo Awal belum tersedia.', 404); if (opening.status === 'POSTED') return error('Saldo Awal sudah diposting.', 409); const actor = ctx.user!.email || ctx.user!.userId;
      try { const normalized = await normalizeOpeningDraft(wc.workspaceId, { generalLines: opening.generalLines, subledgers: opening.subledgers }, actor); if (normalized.totalDebit <= 0 || normalized.totalDebit !== normalized.totalCredit) return error(`Saldo Awal belum seimbang. Debit ${normalized.totalDebit}, Kredit ${normalized.totalCredit}.`, 409); const record: OpeningBalanceBatchRecord = { ...opening, cutoffDate: normalized.settings.conversionDate, status: 'POSTED', generalLines: normalized.generalLines, subledgers: normalized.subledgers, fixedAssets: normalized.fixedAssets, postedLines: normalized.lines, totalDebit: normalized.totalDebit, totalCredit: normalized.totalCredit, postedAt: now(), postedBy: actor, updatedBy: actor, updatedAt: now() }; await postOpeningOperationalBalances(wc.workspaceId, record, actor); const [ok] = await db.update(dataTable('opening_balances', wc.workspaceId), [{ id: opening.id, record }]); if (!ok) return error('Saldo Awal gagal dikunci setelah posting.', 500); const settings = await loadAccountingSettings(wc.workspaceId); if (settings) await db.update(dataTable('accounting_settings', wc.workspaceId), [{ id: settings.id, record: { ...settings, openingPosted: true, updatedBy: actor, updatedAt: now() } }]); return json({ id: opening.id, ...record }); }
      catch (err) { return error(err instanceof Error ? err.message : 'Saldo Awal gagal diposting.', 500); }
    },
  ],
  'POST /api/accounting/manual-journals': [
    requireAuth(),
    requireOpenAccountingDate('date'),
    async ctx => {
      const wc = await workspaceContext(ctx.user!);
      if (!canManageAccounting(wc.membership.role)) return error('Role Anda tidak memiliki akses membuat jurnal manual.', 403);
      const body = objectBody(ctx.body);
      const date = text(body.date);
      const description = text(body.description).slice(0, 300);
      if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !description) return error('Tanggal dan keterangan jurnal wajib diisi.', 400);
      const accounts = await ensureAccountingAccounts(wc.workspaceId, ctx.user!.email || ctx.user!.userId);
      let lines: ManualJournalLineRecord[];
      try { lines = validateManualJournalLines(body.lines, accounts); } catch (err) { return error(err instanceof Error ? err.message : 'Jurnal tidak valid.', 400); }
      const stamp = now();
      const actor = ctx.user!.email || ctx.user!.userId;
      const record: ManualJournalRecord = { journalNumber: transactionNumber(date, 'JRN'), date, description, reference: text(body.reference).slice(0, 120), lines, createdBy: actor, updatedBy: actor, createdAt: stamp, updatedAt: stamp };
      const [id] = await db.add(dataTable('manual_journals', wc.workspaceId), [record]);
      if (!id) return error('Jurnal manual gagal disimpan.', 500);
      return json({ id, ...record }, 201);
    },
  ],
  'PUT /api/accounting/manual-journals/:id': [
    requireAuth(),
    requireOpenAccountingDate('date'),
    async ctx => {
      const wc = await workspaceContext(ctx.user!);
      if (!canManageAccounting(wc.membership.role)) return error('Role Anda tidak memiliki akses mengubah jurnal manual.', 403);
      const table = dataTable('manual_journals', wc.workspaceId);
      const [existing] = await db.get<ManualJournalRecord>(table, [ctx.params.id]);
      if (!existing) return error('Jurnal manual tidak ditemukan.', 404);
      if (existing.sourceType === 'STOCKTAKE') return error('Jurnal Stok Opname dikelola dari menu Stok Opname dan tidak dapat diedit manual.', 409);
      const existingPeriodError = await accountingDateWriteError(wc.workspaceId, existing.date);
      if (existingPeriodError) return error(existingPeriodError, 409);
      const body = objectBody(ctx.body);
      const date = text(body.date);
      const description = text(body.description).slice(0, 300);
      if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !description) return error('Tanggal dan keterangan jurnal wajib diisi.', 400);
      const accounts = await ensureAccountingAccounts(wc.workspaceId, ctx.user!.email || ctx.user!.userId);
      let lines: ManualJournalLineRecord[];
      try { lines = validateManualJournalLines(body.lines, accounts); } catch (err) { return error(err instanceof Error ? err.message : 'Jurnal tidak valid.', 400); }
      const record: ManualJournalRecord = { ...existing, date, description, reference: text(body.reference).slice(0, 120), lines, updatedBy: ctx.user!.email || ctx.user!.userId, updatedAt: now() };
      const [ok] = await db.update(table, [{ id: ctx.params.id, record }]);
      if (!ok) return error('Jurnal manual gagal diperbarui.', 500);
      return json({ id: ctx.params.id, ...record });
    },
  ],
  'DELETE /api/accounting/manual-journals/:id': [
    requireAuth(),
    async ctx => {
      const wc = await workspaceContext(ctx.user!);
      if (!canManageAccounting(wc.membership.role)) return error('Role Anda tidak memiliki akses menghapus jurnal manual.', 403);
      const table = dataTable('manual_journals', wc.workspaceId);
      const [existing] = await db.get<ManualJournalRecord>(table, [ctx.params.id]);
      if (!existing) return error('Jurnal manual tidak ditemukan.', 404);
      if (existing.sourceType === 'STOCKTAKE') return error('Jurnal Stok Opname dikelola dari menu Stok Opname dan tidak dapat dihapus manual.', 409);
      const periodError = await accountingDateWriteError(wc.workspaceId, existing.date);
      if (periodError) return error(periodError, 409);
      const [ok] = await db.delete(table, [ctx.params.id]);
      if (!ok) return error('Jurnal manual tidak ditemukan.', 404);
      return json({ deleted: true });
    },
  ],
  'GET /api/fixed-assets/master': [requireAuth(), async ctx => { const wc = await workspaceContext(ctx.user!); if (!canManageAccounting(wc.membership.role)) return error('Role Anda tidak memiliki akses data Aset Tetap.', 403); return json(await loadFixedAssetMaster(wc.workspaceId, ctx.user!.email || ctx.user!.userId)); }],
  'POST /api/fixed-assets/groups': [requireAuth(), async ctx => { const wc = await workspaceContext(ctx.user!); if (!canManageMaster(wc.membership.role)) return error('Owner/Admin Pusat yang dapat menambah Kelompok Aset Tetap.', 403); const body = objectBody(ctx.body); const master = await loadFixedAssetMaster(wc.workspaceId, ctx.user!.email || ctx.user!.userId); const accounts = await ensureAccountingAccounts(wc.workspaceId, ctx.user!.email || ctx.user!.userId); const name = text(body.name).slice(0, 120); const code = text(body.code).toUpperCase().slice(0, 40) || nextFixedAssetCode(master.groups, 'KAT', 3); if (!name) return error('Nama Kelompok Aset Tetap wajib diisi.', 400); if (master.groups.some(item => item.code.toUpperCase() === code || item.name.toLowerCase() === name.toLowerCase())) return error('Kode atau nama Kelompok Aset Tetap sudah digunakan.', 409); const depreciable = body.depreciable !== false; const recordBase = { depreciable, depreciationMethod: fixedAssetMethod(body.depreciationMethod, depreciable), usefulLifeMonths: depreciable ? Math.max(0, Math.floor(Number(body.usefulLifeMonths) || 0)) : 0, defaultResidualRate: fixedAssetRate(body.defaultResidualRate), measurementModel: fixedAssetMeasurementModel(body.measurementModel), assetAccountId: text(body.assetAccountId), accumulatedDepreciationAccountId: depreciable ? text(body.accumulatedDepreciationAccountId) : '', depreciationExpenseAccountId: depreciable ? text(body.depreciationExpenseAccountId) : '', gainAccountId: text(body.gainAccountId), lossAccountId: text(body.lossAccountId) }; const accountError = fixedAssetGroupAccountError(recordBase, accounts); if (accountError) return error(accountError, 400); const stamp = now(); const actor = ctx.user!.email || ctx.user!.userId; const record: FixedAssetGroupRecord = { code, name, templateKey: '', ...recordBase, active: body.active !== false, createdBy: actor, updatedBy: actor, createdAt: stamp, updatedAt: stamp }; const [id] = await db.add(dataTable('fixed_asset_groups', wc.workspaceId), [record]); if (!id) return error('Kelompok Aset Tetap gagal disimpan.', 500); return json({ id, ...record }, 201); }],
  'PUT /api/fixed-assets/groups/:id': [requireAuth(), async ctx => { const wc = await workspaceContext(ctx.user!); if (!canManageMaster(wc.membership.role)) return error('Owner/Admin Pusat yang dapat mengubah Kelompok Aset Tetap.', 403); const table = dataTable('fixed_asset_groups', wc.workspaceId); const [existing] = await db.get<FixedAssetGroupRecord>(table, [ctx.params.id]); if (!existing) return error('Kelompok Aset Tetap tidak ditemukan.', 404); const body = objectBody(ctx.body); const master = await loadFixedAssetMaster(wc.workspaceId, ctx.user!.email || ctx.user!.userId); const accounts = await ensureAccountingAccounts(wc.workspaceId, ctx.user!.email || ctx.user!.userId); const name = text(body.name).slice(0, 120); const code = text(body.code).toUpperCase().slice(0, 40) || existing.code; if (!name) return error('Nama Kelompok Aset Tetap wajib diisi.', 400); if (master.groups.some(item => item.id !== ctx.params.id && (item.code.toUpperCase() === code || item.name.toLowerCase() === name.toLowerCase()))) return error('Kode atau nama Kelompok Aset Tetap sudah digunakan.', 409); const depreciable = body.depreciable !== false; const nextBase = { depreciable, depreciationMethod: fixedAssetMethod(body.depreciationMethod, depreciable), usefulLifeMonths: depreciable ? Math.max(0, Math.floor(Number(body.usefulLifeMonths) || 0)) : 0, defaultResidualRate: fixedAssetRate(body.defaultResidualRate), measurementModel: fixedAssetMeasurementModel(body.measurementModel), assetAccountId: text(body.assetAccountId), accumulatedDepreciationAccountId: depreciable ? text(body.accumulatedDepreciationAccountId) : '', depreciationExpenseAccountId: depreciable ? text(body.depreciationExpenseAccountId) : '', gainAccountId: text(body.gainAccountId), lossAccountId: text(body.lossAccountId) }; const accountError = fixedAssetGroupAccountError(nextBase, accounts); if (accountError) return error(accountError, 400); const settings = await loadAccountingSettings(wc.workspaceId); const hasOpeningAssets = Boolean(settings?.openingPosted && master.assets.some(asset => asset.groupId === ctx.params.id && asset.acquisitionDate <= settings.conversionDate)); if (hasOpeningAssets && (existing.assetAccountId !== nextBase.assetAccountId || existing.accumulatedDepreciationAccountId !== nextBase.accumulatedDepreciationAccountId || existing.depreciable !== nextBase.depreciable || existing.depreciationMethod !== nextBase.depreciationMethod || existing.usefulLifeMonths !== nextBase.usefulLifeMonths || existing.defaultResidualRate !== nextBase.defaultResidualRate)) return error('Kebijakan dan mapping akun kelompok dikunci karena sudah membentuk Saldo Awal Aset Tetap.', 409); const record: FixedAssetGroupRecord = { ...existing, code, name, ...nextBase, active: body.active !== false, updatedBy: ctx.user!.email || ctx.user!.userId, updatedAt: now() }; const [ok] = await db.update(table, [{ id: ctx.params.id, record }]); if (!ok) return error('Kelompok Aset Tetap gagal diperbarui.', 500); return json({ id: ctx.params.id, ...record }); }],
  'DELETE /api/fixed-assets/groups/:id': [requireAuth(), async ctx => { const wc = await workspaceContext(ctx.user!); if (!canManageMaster(wc.membership.role)) return error('Owner/Admin Pusat yang dapat menghapus Kelompok Aset Tetap.', 403); const assets = (await db.list<FixedAssetRecord>(dataTable('fixed_assets', wc.workspaceId), { limit: 500 })).items; if (assets.some(item => item.groupId === ctx.params.id)) return error('Kelompok masih digunakan Daftar Aset Tetap. Nonaktifkan bila tidak digunakan lagi.', 409); const [ok] = await db.delete(dataTable('fixed_asset_groups', wc.workspaceId), [ctx.params.id]); if (!ok) return error('Kelompok Aset Tetap tidak ditemukan.', 404); return json({ deleted: true }); }],
  'POST /api/fixed-assets/assets': [requireAuth(), async ctx => {
    const wc = await workspaceContext(ctx.user!);
    if (!canManageMaster(wc.membership.role)) return error('Owner/Admin Pusat yang dapat menambah Aset Tetap.', 403);
    const body = objectBody(ctx.body);
    const master = await loadFixedAssetMaster(wc.workspaceId, ctx.user!.email || ctx.user!.userId);
    const groupId = text(body.groupId);
    const group = master.groups.find(item => item.id === groupId && item.active);
    if (!group) return error('Pilih Kelompok Aset Tetap yang aktif.', 400);
    const name = text(body.name).slice(0, 160);
    const code = text(body.code).toUpperCase().slice(0, 40) || nextFixedAssetCode(master.assets, 'AST', 4);
    const acquisitionDate = text(body.acquisitionDate);
    const availableForUseDate = text(body.availableForUseDate) || acquisitionDate;
    const acquisitionCost = money(body.acquisitionCost);
    const residualValue = body.residualValue === '' || body.residualValue == null ? Math.round(acquisitionCost * group.defaultResidualRate / 100) : money(body.residualValue);
    const usefulLifeMonths = group.depreciable ? Math.max(0, Math.floor(Number(body.usefulLifeMonths) || group.usefulLifeMonths)) : 0;
    const depreciationMethod = group.depreciable ? fixedAssetMethod(body.depreciationMethod || group.depreciationMethod, true) : 'NONE';
    const openingDepreciationOverride = group.depreciable && body.openingDepreciationOverride === true;
    const openingThroughDate = await fixedAssetOpeningThroughDate(wc.workspaceId);
    const openingAccumulatedDepreciation = group.depreciable ? (openingDepreciationOverride ? money(body.openingAccumulatedDepreciation) : fixedAssetAutomaticOpeningDepreciation(acquisitionCost, residualValue, usefulLifeMonths, depreciationMethod, availableForUseDate, openingThroughDate)) : 0;
    if (!name || !validIsoDate(acquisitionDate) || !validIsoDate(availableForUseDate) || acquisitionCost <= 0) return error('Nama, tanggal perolehan, tanggal siap digunakan, dan harga perolehan wajib valid.', 400);
    if (availableForUseDate < acquisitionDate) return error('Tanggal siap digunakan tidak boleh sebelum tanggal perolehan.', 400);
    if (residualValue > acquisitionCost) return error('Nilai residu tidak boleh melebihi harga perolehan.', 400);
    if (openingAccumulatedDepreciation > acquisitionCost - residualValue) return error('Akumulasi penyusutan awal tidak boleh melebihi nilai yang dapat disusutkan.', 400);
    if (group.depreciable && usefulLifeMonths <= 0) return error('Umur manfaat aset yang disusutkan wajib lebih dari nol.', 400);
    if (group.depreciable && !openingDepreciationOverride && !['STRAIGHT_LINE', 'NONE'].includes(depreciationMethod) && openingThroughDate && availableForUseDate <= openingThroughDate) return error('Metode Saldo Menurun/Unit Produksi membutuhkan Override Manual untuk Akumulasi Penyusutan Saldo Awal.', 400);
    if (master.assets.some(item => item.code.toUpperCase() === code)) return error('Kode Aset Tetap sudah digunakan.', 409);
    const kebunId = text(body.kebunId);
    if (kebunId) { const [kebun] = await db.get<KebunRecord>(dataTable('kebun', wc.workspaceId), [kebunId]); if (!kebun) return error('Kebun/Cost Center tidak ditemukan.', 400); }
    const settings = await loadAccountingSettings(wc.workspaceId);
    if (settings?.openingPosted && acquisitionDate <= settings.conversionDate) return error('Saldo Awal sudah diposting. Aset sebelum/hingga cut-off tidak dapat ditambahkan lagi.', 409);
    if (settings?.openingPosted && acquisitionDate > settings.conversionDate && openingDepreciationOverride) return error('Aset setelah cut-off tidak memakai Override Akumulasi Penyusutan Saldo Awal.', 400);
    const stamp = now();
    const actor = ctx.user!.email || ctx.user!.userId;
    const record: FixedAssetRecord = { code, name, groupId, kebunId, location: text(body.location).slice(0, 160), acquisitionDate, availableForUseDate, acquisitionCost, residualValue, usefulLifeMonths, depreciationMethod, openingAccumulatedDepreciation, openingDepreciationOverride, sourceReference: text(body.sourceReference).slice(0, 120), serialNumber: text(body.serialNumber).slice(0, 120), note: text(body.note).slice(0, 300), status: fixedAssetStatus(body.status), createdBy: actor, updatedBy: actor, createdAt: stamp, updatedAt: stamp };
    const [id] = await db.add(dataTable('fixed_assets', wc.workspaceId), [record]);
    if (!id) return error('Aset Tetap gagal disimpan.', 500);
    return json({ id, ...record }, 201);
  }],
  'PUT /api/fixed-assets/assets/:id': [requireAuth(), async ctx => {
    const wc = await workspaceContext(ctx.user!);
    if (!canManageMaster(wc.membership.role)) return error('Owner/Admin Pusat yang dapat mengubah Aset Tetap.', 403);
    const table = dataTable('fixed_assets', wc.workspaceId);
    const [existing] = await db.get<FixedAssetRecord>(table, [ctx.params.id]);
    if (!existing) return error('Aset Tetap tidak ditemukan.', 404);
    const body = objectBody(ctx.body);
    const master = await loadFixedAssetMaster(wc.workspaceId, ctx.user!.email || ctx.user!.userId);
    const groupId = text(body.groupId);
    const group = master.groups.find(item => item.id === groupId);
    if (!group) return error('Kelompok Aset Tetap tidak ditemukan.', 400);
    const name = text(body.name).slice(0, 160);
    const code = text(body.code).toUpperCase().slice(0, 40) || existing.code;
    const acquisitionDate = text(body.acquisitionDate);
    const availableForUseDate = text(body.availableForUseDate) || acquisitionDate;
    const acquisitionCost = money(body.acquisitionCost);
    const residualValue = money(body.residualValue);
    const usefulLifeMonths = group.depreciable ? Math.max(0, Math.floor(Number(body.usefulLifeMonths) || group.usefulLifeMonths)) : 0;
    const depreciationMethod = group.depreciable ? fixedAssetMethod(body.depreciationMethod || group.depreciationMethod, true) : 'NONE';
    const openingDepreciationOverride = group.depreciable && body.openingDepreciationOverride === true;
    const openingThroughDate = await fixedAssetOpeningThroughDate(wc.workspaceId);
    const openingAccumulatedDepreciation = group.depreciable ? (openingDepreciationOverride ? money(body.openingAccumulatedDepreciation) : fixedAssetAutomaticOpeningDepreciation(acquisitionCost, residualValue, usefulLifeMonths, depreciationMethod, availableForUseDate, openingThroughDate)) : 0;
    const status = fixedAssetStatus(body.status);
    if (!name || !validIsoDate(acquisitionDate) || !validIsoDate(availableForUseDate) || acquisitionCost <= 0) return error('Nama, tanggal dan harga perolehan wajib valid.', 400);
    if (availableForUseDate < acquisitionDate) return error('Tanggal siap digunakan tidak boleh sebelum tanggal perolehan.', 400);
    if (residualValue > acquisitionCost || openingAccumulatedDepreciation > acquisitionCost - residualValue) return error('Nilai residu/akumulasi penyusutan awal melebihi batas nilai aset.', 400);
    if (group.depreciable && usefulLifeMonths <= 0) return error('Umur manfaat wajib lebih dari nol.', 400);
    if (group.depreciable && !openingDepreciationOverride && !['STRAIGHT_LINE', 'NONE'].includes(depreciationMethod) && openingThroughDate && availableForUseDate <= openingThroughDate) return error('Metode Saldo Menurun/Unit Produksi membutuhkan Override Manual untuk Akumulasi Penyusutan Saldo Awal.', 400);
    if (master.assets.some(item => item.id !== ctx.params.id && item.code.toUpperCase() === code)) return error('Kode Aset Tetap sudah digunakan.', 409);
    const kebunId = text(body.kebunId);
    if (kebunId) { const [kebun] = await db.get<KebunRecord>(dataTable('kebun', wc.workspaceId), [kebunId]); if (!kebun) return error('Kebun/Cost Center tidak ditemukan.', 400); }
    const settings = await loadAccountingSettings(wc.workspaceId);
    const existingOverride = fixedAssetOverrideEnabled(existing);
    if (settings?.openingPosted && existing.acquisitionDate <= settings.conversionDate) {
      const financialChanged = existing.groupId !== groupId || existing.kebunId !== kebunId || existing.acquisitionDate !== acquisitionDate || existing.availableForUseDate !== availableForUseDate || existing.acquisitionCost !== acquisitionCost || existing.residualValue !== residualValue || existing.usefulLifeMonths !== usefulLifeMonths || existing.depreciationMethod !== depreciationMethod || existing.openingAccumulatedDepreciation !== openingAccumulatedDepreciation || existingOverride !== openingDepreciationOverride || existing.status !== status;
      if (financialChanged) return error('Nilai finansial aset sebelum/hingga cut-off dikunci setelah Saldo Awal diposting.', 409);
    }
    if (settings?.openingPosted && acquisitionDate > settings.conversionDate && openingDepreciationOverride) return error('Aset setelah cut-off tidak memakai Override Akumulasi Penyusutan Saldo Awal.', 400);
    const record: FixedAssetRecord = { ...existing, code, name, groupId, kebunId, location: text(body.location).slice(0, 160), acquisitionDate, availableForUseDate, acquisitionCost, residualValue, usefulLifeMonths, depreciationMethod, openingAccumulatedDepreciation, openingDepreciationOverride, sourceReference: text(body.sourceReference).slice(0, 120), serialNumber: text(body.serialNumber).slice(0, 120), note: text(body.note).slice(0, 300), status, updatedBy: ctx.user!.email || ctx.user!.userId, updatedAt: now() };
    const [ok] = await db.update(table, [{ id: ctx.params.id, record }]);
    if (!ok) return error('Aset Tetap gagal diperbarui.', 500);
    return json({ id: ctx.params.id, ...record });
  }],
  'DELETE /api/fixed-assets/assets/:id': [requireAuth(), async ctx => { const wc = await workspaceContext(ctx.user!); if (!canManageMaster(wc.membership.role)) return error('Owner/Admin Pusat yang dapat menghapus Aset Tetap.', 403); const table = dataTable('fixed_assets', wc.workspaceId); const [existing] = await db.get<FixedAssetRecord>(table, [ctx.params.id]); if (!existing) return error('Aset Tetap tidak ditemukan.', 404); const settings = await loadAccountingSettings(wc.workspaceId); if (settings?.openingPosted && existing.acquisitionDate <= settings.conversionDate) return error('Aset sudah menjadi bagian Saldo Awal dan tidak dapat dihapus.', 409); const [ok] = await db.delete(table, [ctx.params.id]); if (!ok) return error('Aset Tetap gagal dihapus.', 500); return json({ deleted: true }); }],
  'GET /api/inventory/master': [
    requireAuth(),
    async ctx => {
      const wc = await workspaceContext(ctx.user!);
      if (!canManagePayables(wc.membership.role)) return error('Role Anda tidak memiliki akses Master Persediaan.', 403);
      return json(await loadInventoryMaster(wc.workspaceId));
    },
  ],
  'POST /api/inventory/warehouses': [
    requireAuth(),
    async ctx => {
      const wc = await workspaceContext(ctx.user!); if (!canManageMaster(wc.membership.role)) return error('Owner/Admin Pusat yang dapat menambah Gudang.', 403); const body = objectBody(ctx.body); const master = await loadInventoryMaster(wc.workspaceId); const name = text(body.name).slice(0, 120); const code = text(body.code).toUpperCase().slice(0, 30) || nextInventoryCode(master.warehouses, 'GDG'); const kebunId = text(body.kebunId); if (!name) return error('Nama Gudang wajib diisi.', 400); if (master.warehouses.some(item => item.code.toUpperCase() === code || item.name.toLowerCase() === name.toLowerCase())) return error('Kode atau nama Gudang sudah digunakan.', 409); if (kebunId) { const [kebun] = await db.get<KebunRecord>(dataTable('kebun', wc.workspaceId), [kebunId]); if (!kebun) return error('Kebun terkait tidak ditemukan.', 404); } const stamp = now(); const actor = ctx.user!.email || ctx.user!.userId; const record: InventoryWarehouseRecord = { code, name, kebunId, manager: text(body.manager).slice(0, 120), active: body.active !== false, isDefault: false, createdBy: actor, updatedBy: actor, createdAt: stamp, updatedAt: stamp }; const [id] = await db.add(dataTable('inventory_warehouses', wc.workspaceId), [record]); if (!id) return error('Gudang gagal disimpan.', 500); return json({ id, ...record }, 201);
    },
  ],
  'PUT /api/inventory/warehouses/:id': [
    requireAuth(),
    async ctx => {
      const wc = await workspaceContext(ctx.user!); if (!canManageMaster(wc.membership.role)) return error('Owner/Admin Pusat yang dapat mengubah Gudang.', 403); const table = dataTable('inventory_warehouses', wc.workspaceId); const [existing] = await db.get<InventoryWarehouseRecord>(table, [ctx.params.id]); if (!existing) return error('Gudang tidak ditemukan.', 404); const body = objectBody(ctx.body); const master = await loadInventoryMaster(wc.workspaceId); const name = text(body.name).slice(0, 120); const code = text(body.code).toUpperCase().slice(0, 30) || existing.code; const kebunId = text(body.kebunId); const active = existing.isDefault ? true : body.active !== false; if (!name) return error('Nama Gudang wajib diisi.', 400); if (master.warehouses.some(item => item.id !== ctx.params.id && (item.code.toUpperCase() === code || item.name.toLowerCase() === name.toLowerCase()))) return error('Kode atau nama Gudang sudah digunakan.', 409); if (!active && master.balances.some(item => item.warehouseId === ctx.params.id && (item.quantity > 0.000001 || item.stockValue > 1))) return error('Gudang masih memiliki stok dan tidak dapat dinonaktifkan.', 409); if (kebunId) { const [kebun] = await db.get<KebunRecord>(dataTable('kebun', wc.workspaceId), [kebunId]); if (!kebun) return error('Kebun terkait tidak ditemukan.', 404); } const record: InventoryWarehouseRecord = { ...existing, code, name, kebunId, manager: text(body.manager).slice(0, 120), active, isDefault: existing.isDefault, updatedBy: ctx.user!.email || ctx.user!.userId, updatedAt: now() }; const [ok] = await db.update(table, [{ id: ctx.params.id, record }]); if (!ok) return error('Gudang gagal diperbarui.', 500); return json({ id: ctx.params.id, ...record });
    },
  ],
  'POST /api/inventory/groups': [
    requireAuth(),
    async ctx => {
      const wc = await workspaceContext(ctx.user!);
      if (!canManageMaster(wc.membership.role)) return error('Owner/Admin Pusat yang dapat menambah Kelompok Barang.', 403);
      const body = objectBody(ctx.body);
      const table = dataTable('inventory_groups', wc.workspaceId);
      const rows = (await db.list<InventoryGroupRecord>(table, { limit: 300 })).items;
      const name = text(body.name).slice(0, 120);
      const code = text(body.code).toUpperCase().slice(0, 40) || nextInventoryCode(rows, 'KLB');
      if (!name) return error('Nama Kelompok Barang wajib diisi.', 400);
      if (rows.some(item => item.code.toUpperCase() === code || item.name.toLowerCase() === name.toLowerCase())) return error('Kode atau nama Kelompok Barang sudah digunakan.', 409);
      const accounts = await ensureAccountingAccounts(wc.workspaceId, ctx.user!.email || ctx.user!.userId);
      const group = {
        canPurchase: body.canPurchase !== false,
        canStore: body.canStore === true,
        canSell: body.canSell === true,
        purchaseAccountId: text(body.purchaseAccountId),
        inventoryAccountId: text(body.inventoryAccountId),
        salesAccountId: text(body.salesAccountId),
        cogsAccountId: text(body.cogsAccountId),
      };
      const accountError = inventoryGroupAccountError(group, accounts);
      if (accountError) return error(accountError, 400);
      const stamp = now();
      const actor = ctx.user!.email || ctx.user!.userId;
      const record: InventoryGroupRecord = { code, name, ...group, active: body.active !== false, createdBy: actor, updatedBy: actor, createdAt: stamp, updatedAt: stamp };
      const [id] = await db.add(table, [record]);
      if (!id) return error('Kelompok Barang gagal disimpan.', 500);
      return json({ id, ...record }, 201);
    },
  ],
  'PUT /api/inventory/groups/:id': [
    requireAuth(),
    async ctx => {
      const wc = await workspaceContext(ctx.user!);
      if (!canManageMaster(wc.membership.role)) return error('Owner/Admin Pusat yang dapat mengubah Kelompok Barang.', 403);
      const table = dataTable('inventory_groups', wc.workspaceId);
      const [existing] = await db.get<InventoryGroupRecord>(table, [ctx.params.id]);
      if (!existing) return error('Kelompok Barang tidak ditemukan.', 404);
      const body = objectBody(ctx.body);
      const rows = (await db.list<InventoryGroupRecord>(table, { limit: 300 })).items;
      const name = text(body.name).slice(0, 120);
      const code = text(body.code).toUpperCase().slice(0, 40) || existing.code;
      if (!name) return error('Nama Kelompok Barang wajib diisi.', 400);
      if (rows.some(item => item.id !== ctx.params.id && (item.code.toUpperCase() === code || item.name.toLowerCase() === name.toLowerCase()))) return error('Kode atau nama Kelompok Barang sudah digunakan.', 409);
      const accounts = await ensureAccountingAccounts(wc.workspaceId, ctx.user!.email || ctx.user!.userId);
      const group = { canPurchase: body.canPurchase !== false, canStore: body.canStore === true, canSell: body.canSell === true, purchaseAccountId: text(body.purchaseAccountId), inventoryAccountId: text(body.inventoryAccountId), salesAccountId: text(body.salesAccountId), cogsAccountId: text(body.cogsAccountId) };
      const accountError = inventoryGroupAccountError(group, accounts);
      if (accountError) return error(accountError, 400);
      const record: InventoryGroupRecord = { ...existing, code, name, ...group, active: body.active !== false, updatedBy: ctx.user!.email || ctx.user!.userId, updatedAt: now() };
      const [ok] = await db.update(table, [{ id: ctx.params.id, record }]);
      if (!ok) return error('Kelompok Barang gagal diperbarui.', 500);
      return json({ id: ctx.params.id, ...record });
    },
  ],
  'DELETE /api/inventory/groups/:id': [
    requireAuth(),
    async ctx => {
      const wc = await workspaceContext(ctx.user!);
      if (!canManageMaster(wc.membership.role)) return error('Owner/Admin Pusat yang dapat menghapus Kelompok Barang.', 403);
      const items = (await db.list<InventoryItemRecord>(dataTable('inventory_items', wc.workspaceId), { limit: 500 })).items;
      if (items.some(item => item.groupId === ctx.params.id)) return error('Kelompok masih dipakai Master Barang. Nonaktifkan bila tidak digunakan lagi.', 409);
      const [ok] = await db.delete(dataTable('inventory_groups', wc.workspaceId), [ctx.params.id]);
      if (!ok) return error('Kelompok Barang tidak ditemukan.', 404);
      return json({ deleted: true });
    },
  ],
  'POST /api/inventory/units': [
    requireAuth(),
    async ctx => {
      const wc = await workspaceContext(ctx.user!);
      if (!canManageMaster(wc.membership.role)) return error('Owner/Admin Pusat yang dapat menambah Satuan Barang.', 403);
      const body = objectBody(ctx.body);
      const table = dataTable('inventory_units', wc.workspaceId);
      const rows = (await db.list<InventoryUnitRecord>(table, { limit: 300 })).items;
      const name = text(body.name).slice(0, 80);
      const code = text(body.code).toUpperCase().slice(0, 20) || nextInventoryCode(rows, 'SAT');
      if (!name) return error('Nama satuan wajib diisi.', 400);
      if (rows.some(item => item.code.toUpperCase() === code || item.name.toLowerCase() === name.toLowerCase())) return error('Kode atau nama satuan sudah digunakan.', 409);
      const stamp = now();
      const actor = ctx.user!.email || ctx.user!.userId;
      const record: InventoryUnitRecord = { code, name, active: body.active !== false, createdBy: actor, updatedBy: actor, createdAt: stamp, updatedAt: stamp };
      const [id] = await db.add(table, [record]);
      if (!id) return error('Satuan Barang gagal disimpan.', 500);
      return json({ id, ...record }, 201);
    },
  ],
  'PUT /api/inventory/units/:id': [
    requireAuth(),
    async ctx => {
      const wc = await workspaceContext(ctx.user!);
      if (!canManageMaster(wc.membership.role)) return error('Owner/Admin Pusat yang dapat mengubah Satuan Barang.', 403);
      const table = dataTable('inventory_units', wc.workspaceId);
      const [existing] = await db.get<InventoryUnitRecord>(table, [ctx.params.id]);
      if (!existing) return error('Satuan tidak ditemukan.', 404);
      const body = objectBody(ctx.body);
      const rows = (await db.list<InventoryUnitRecord>(table, { limit: 300 })).items;
      const name = text(body.name).slice(0, 80);
      const code = text(body.code).toUpperCase().slice(0, 20) || existing.code;
      if (!name) return error('Nama satuan wajib diisi.', 400);
      if (rows.some(item => item.id !== ctx.params.id && (item.code.toUpperCase() === code || item.name.toLowerCase() === name.toLowerCase()))) return error('Kode atau nama satuan sudah digunakan.', 409);
      const record: InventoryUnitRecord = { ...existing, code, name, active: body.active !== false, updatedBy: ctx.user!.email || ctx.user!.userId, updatedAt: now() };
      const [ok] = await db.update(table, [{ id: ctx.params.id, record }]);
      if (!ok) return error('Satuan gagal diperbarui.', 500);
      return json({ id: ctx.params.id, ...record });
    },
  ],
  'DELETE /api/inventory/units/:id': [
    requireAuth(),
    async ctx => {
      const wc = await workspaceContext(ctx.user!);
      if (!canManageMaster(wc.membership.role)) return error('Owner/Admin Pusat yang dapat menghapus Satuan Barang.', 403);
      const items = (await db.list<InventoryItemRecord>(dataTable('inventory_items', wc.workspaceId), { limit: 500 })).items;
      if (items.some(item => item.unitId === ctx.params.id)) return error('Satuan masih dipakai Master Barang. Nonaktifkan bila tidak digunakan lagi.', 409);
      const [ok] = await db.delete(dataTable('inventory_units', wc.workspaceId), [ctx.params.id]);
      if (!ok) return error('Satuan tidak ditemukan.', 404);
      return json({ deleted: true });
    },
  ],
  'POST /api/inventory/items': [
    requireAuth(),
    async ctx => {
      const wc = await workspaceContext(ctx.user!);
      if (!canManageMaster(wc.membership.role)) return error('Owner/Admin Pusat yang dapat menambah Master Barang.', 403);
      const body = objectBody(ctx.body);
      const master = await loadInventoryMaster(wc.workspaceId);
      const name = text(body.name).slice(0, 160);
      const code = text(body.code).toUpperCase().slice(0, 40) || nextInventoryCode(master.items, 'BRG');
      const groupId = text(body.groupId);
      const unitId = text(body.unitId);
      const openingQuantity = Math.max(0, Number(body.openingQuantity) || 0);
      const openingAverageCost = money(body.openingAverageCost);
      if (!name || !groupId || !unitId) return error('Nama barang, kelompok, dan satuan wajib diisi.', 400);
      if (!Number.isFinite(openingQuantity)) return error('Saldo awal qty tidak valid.', 400);
      if (!master.groups.some(item => item.id === groupId) || !master.units.some(item => item.id === unitId)) return error('Kelompok atau satuan tidak ditemukan.', 404);
      if (master.items.some(item => item.code.toUpperCase() === code || item.name.toLowerCase() === name.toLowerCase())) return error('Kode atau nama barang sudah digunakan.', 409);
      const stamp = now();
      const actor = ctx.user!.email || ctx.user!.userId;
      const stockValue = Math.round(openingQuantity * openingAverageCost);
      let unitConversions: InventoryItemUnitConversionRecord[];
      try { unitConversions = normalizeInventoryItemUnitConversions(unitId, body.unitConversions, master.units); } catch (err) { return error(err instanceof Error ? err.message : 'Konversi satuan barang tidak valid.', 400); }
      const record: InventoryItemRecord = { code, name, groupId, unitId, unitConversions, openingQuantity: 0, openingAverageCost: 0, currentQuantity: 0, averageCost: 0, stockValue: 0, active: body.active !== false, createdBy: actor, updatedBy: actor, createdAt: stamp, updatedAt: stamp };
      const [id] = await db.add(dataTable('inventory_items', wc.workspaceId), [record]);
      if (!id) return error('Master Barang gagal disimpan.', 500);
      return json({ id, ...record }, 201);
    },
  ],
  'PUT /api/inventory/items/:id': [
    requireAuth(),
    async ctx => {
      const wc = await workspaceContext(ctx.user!);
      if (!canManageMaster(wc.membership.role)) return error('Owner/Admin Pusat yang dapat mengubah Master Barang.', 403);
      const table = dataTable('inventory_items', wc.workspaceId);
      const [existing] = await db.get<InventoryItemRecord>(table, [ctx.params.id]);
      if (!existing) return error('Master Barang tidak ditemukan.', 404);
      const body = objectBody(ctx.body);
      const master = await loadInventoryMaster(wc.workspaceId);
      const name = text(body.name).slice(0, 160);
      const code = text(body.code).toUpperCase().slice(0, 40) || existing.code;
      const groupId = text(body.groupId);
      const unitId = text(body.unitId);
      if (!name || !groupId || !unitId) return error('Nama barang, kelompok, dan satuan wajib diisi.', 400);
      if (!master.groups.some(item => item.id === groupId) || !master.units.some(item => item.id === unitId)) return error('Kelompok atau satuan tidak ditemukan.', 404);
      if (master.items.some(item => item.id !== ctx.params.id && (item.code.toUpperCase() === code || item.name.toLowerCase() === name.toLowerCase()))) return error('Kode atau nama barang sudah digunakan.', 409);
      if (existing.unitId !== unitId && (Math.abs(Number(existing.currentQuantity || 0)) > 0.000001 || Math.abs(Number(existing.stockValue || 0)) > 1)) return error('Satuan dasar tidak dapat diubah setelah barang memiliki stok. Kosongkan/koreksi stok terlebih dahulu.', 409);
      let unitConversions: InventoryItemUnitConversionRecord[];
      try { unitConversions = normalizeInventoryItemUnitConversions(unitId, body.unitConversions, master.units); } catch (err) { return error(err instanceof Error ? err.message : 'Konversi satuan barang tidak valid.', 400); }
      const record: InventoryItemRecord = { ...existing, code, name, groupId, unitId, unitConversions, active: body.active !== false, updatedBy: ctx.user!.email || ctx.user!.userId, updatedAt: now() };
      const [ok] = await db.update(table, [{ id: ctx.params.id, record }]);
      if (!ok) return error('Master Barang gagal diperbarui.', 500);
      return json({ id: ctx.params.id, ...record });
    },
  ],
  'DELETE /api/inventory/items/:id': [
    requireAuth(),
    async ctx => {
      const wc = await workspaceContext(ctx.user!);
      if (!canManageMaster(wc.membership.role)) return error('Owner/Admin Pusat yang dapat menghapus Master Barang.', 403);
      const table = dataTable('inventory_items', wc.workspaceId);
      const [existing] = await db.get<InventoryItemRecord>(table, [ctx.params.id]);
      if (!existing) return error('Master Barang tidak ditemukan.', 404);
      const [invoiceResult, usageResult] = await Promise.all([
        db.list<PurchaseInvoiceRecord>(dataTable('purchase_invoices', wc.workspaceId), { limit: 500 }),
        db.list<InventoryUsageRecord>(dataTable('inventory_usages', wc.workspaceId), { limit: 500 }),
      ]);
      if (invoiceResult.items.some(invoice => (invoice.lines || []).some(line => line.itemId === ctx.params.id)) || usageResult.items.some(usage => usage.lines.some(line => line.itemId === ctx.params.id)) || Math.abs(existing.currentQuantity || 0) > 0.000001 || Math.abs(existing.stockValue || 0) > 1) return error('Barang sudah memiliki stok/transaksi dan tidak dapat dihapus. Nonaktifkan bila tidak digunakan lagi.', 409);
      const [ok] = await db.delete(table, [ctx.params.id]);
      if (!ok) return error('Master Barang gagal dihapus.', 500);
      return json({ deleted: true });
    },
  ],
  'GET /api/purchase-invoices': [
    requireAuth(),
    async ctx => {
      const wc = await workspaceContext(ctx.user!);
      if (!canManagePayables(wc.membership.role)) return error('Role Anda tidak memiliki akses Invoice Pembelian.', 403);
      const rows = await db.list<PurchaseInvoiceRecord>(dataTable('purchase_invoices', wc.workspaceId), { limit: 500 });
      return json({ invoices: rows.items });
    },
  ],
  'POST /api/purchase-invoices': [
    requireAuth(),
    requireOpenAccountingDate('date'),
    async ctx => {
      const wc = await workspaceContext(ctx.user!);
      if (!canManagePayables(wc.membership.role)) return error('Role Anda tidak memiliki akses mencatat Invoice Pembelian.', 403);
      const body = objectBody(ctx.body);
      const date = text(body.date);
      const dueDate = text(body.dueDate);
      const supplierId = text(body.supplierId);
      const kebunId = text(body.kebunId);
      const invoiceNumber = text(body.invoiceNumber).slice(0, 120);
      const paymentType = purchasePaymentType(body.paymentType);
      const accountId = paymentType === 'CASH' ? text(body.accountId) : '';
      if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !supplierId || (paymentType === 'CASH' && !accountId) || (paymentType === 'CREDIT' && !/^\d{4}-\d{2}-\d{2}$/.test(dueDate))) return error('Tanggal, supplier, jatuh tempo untuk kredit, dan Kas/Bank untuk pembelian tunai wajib diisi.', 400);
      if (kebunId && !canAccessKebun(wc.membership, kebunId)) return error('Kebun ini di luar akses Anda.', 403);
      const accountingAccounts = await ensureAccountingAccounts(wc.workspaceId, ctx.user!.email || ctx.user!.userId);
      const inventoryMaster = await loadInventoryMaster(wc.workspaceId);
      let lines: PurchaseInvoiceLineRecord[];
      let totals: ReturnType<typeof purchaseTotals>;
      const warehouseId = text(body.warehouseId) || inventoryMaster.defaultWarehouseId;
      try {
        lines = parsePurchaseLines(body.lines, accountingAccounts, inventoryMaster, kebunId, warehouseId);
        totals = purchaseTotals(lines, purchaseDiscountType(body.discountType), body.discountValue, body.vatPercent);
      } catch (err) {
        return error(err instanceof Error ? err.message : 'Rincian Invoice Pembelian tidak valid.', 400);
      }
      const costCenterError = await validatePurchaseLineCostCenters(wc.workspaceId, wc.membership, lines);
      if (costCenterError) return error(costCenterError, costCenterError.includes('akses') ? 403 : 400);
      const trackedItemIds = purchaseInventoryItemIds(lines);
      if (trackedItemIds.length > 0 && await hasInventoryUsageAfterPoint(wc.workspaceId, trackedItemIds, date, now())) return error('Tidak dapat menambah pembelian dengan tanggal sebelum Pemakaian Barang yang sudah ada untuk barang tersebut.', 409);
      const recordKebunId = purchaseInvoiceKebunId(lines);
      const [supplier, cashAccount] = await Promise.all([
        db.get<SupplierRecord>(dataTable('suppliers', wc.workspaceId), [supplierId]).then(rows => rows[0]),
        accountId ? db.get<AccountRecord>(dataTable('accounts', wc.workspaceId), [accountId]).then(rows => rows[0]) : Promise.resolve(null),
      ]);
      if (!supplier) return error('Supplier tidak ditemukan.', 404);
      if (paymentType === 'CASH' && !cashAccount) return error('Kas/Bank pembayaran tidak ditemukan.', 404);
      const invoiceTable = dataTable('purchase_invoices', wc.workspaceId);
      const existing = (await db.list<PurchaseInvoiceRecord>(invoiceTable, { limit: 500 })).items;
      if (invoiceNumber && existing.some(item => item.supplierId === supplierId && item.invoiceNumber && item.invoiceNumber.toUpperCase() === invoiceNumber.toUpperCase())) return error('Nomor invoice supplier tersebut sudah pernah dicatat.', 409);
      const stamp = now();
      const actor = ctx.user!.email || ctx.user!.userId;
      const purchaseNumber = transactionNumber(date, 'PB');
      const discountType = purchaseDiscountType(body.discountType);
      const baseRecord: PurchaseInvoiceRecord = {
        purchaseNumber,
        date,
        dueDate: paymentType === 'CREDIT' ? dueDate : '',
        supplierId,
        kebunId: recordKebunId,
        warehouseId,
        invoiceNumber,
        debitAccountId: lines[0].debitAccountId,
        lines,
        subtotal: totals.subtotal,
        discountType,
        discountValue: totals.discountValue,
        discountAmount: totals.discountAmount,
        vatPercent: totals.vatPercent,
        vatAmount: totals.vatAmount,
        paymentType,
        accountId,
        description: purchaseDescription(lines),
        amount: totals.amount,
        note: text(body.note).slice(0, 500),
        supplierBillId: '',
        transactionId: '',
        createdBy: actor,
        updatedBy: actor,
        createdAt: stamp,
        updatedAt: stamp,
      };
      const [invoiceId] = await db.add(invoiceTable, [baseRecord]);
      if (!invoiceId) return error('Invoice Pembelian gagal disimpan.', 500);
      try {
        await adjustInventoryForInvoice(wc.workspaceId, null, baseRecord, actor);
      } catch (err) {
        await db.delete(invoiceTable, [invoiceId]);
        return error(err instanceof Error ? err.message : 'Saldo persediaan gagal disinkronkan.', 409);
      }
      let supplierBillId = '';
      let transactionId = '';
      if (paymentType === 'CREDIT') {
        const [id] = await db.add(dataTable('supplier_bills', wc.workspaceId), [purchaseBillRecord(invoiceId, baseRecord, actor)]);
        if (!id) {
          await adjustInventoryForInvoice(wc.workspaceId, baseRecord, null, actor);
          await db.delete(invoiceTable, [invoiceId]);
          return error('Hutang Supplier dari invoice gagal dibuat.', 500);
        }
        supplierBillId = id;
      } else {
        const [id] = await db.add(dataTable('transactions', wc.workspaceId), [purchaseCashRecord(invoiceId, baseRecord, actor)]);
        if (!id) {
          await adjustInventoryForInvoice(wc.workspaceId, baseRecord, null, actor);
          await db.delete(invoiceTable, [invoiceId]);
          return error('Mutasi Kas/Bank dari invoice gagal dibuat.', 500);
        }
        transactionId = id;
      }
      const record = { ...baseRecord, supplierBillId, transactionId };
      const [updated] = await db.update(invoiceTable, [{ id: invoiceId, record }]);
      if (!updated) return error('Invoice tersimpan tetapi referensi turunannya gagal disinkronkan.', 500);
      return json({ id: invoiceId, ...record }, 201);
    },
  ],
  'PUT /api/purchase-invoices/:id': [
    requireAuth(),
    requireOpenAccountingDate('date'),
    async ctx => {
      const wc = await workspaceContext(ctx.user!);
      if (!canManagePayables(wc.membership.role)) return error('Role Anda tidak memiliki akses mengubah Invoice Pembelian.', 403);
      const invoiceTable = dataTable('purchase_invoices', wc.workspaceId);
      const [existing] = await db.get<PurchaseInvoiceRecord>(invoiceTable, [ctx.params.id]);
      if (!existing) return error('Invoice Pembelian tidak ditemukan.', 404);
      const existingPeriodError = await accountingDateWriteError(wc.workspaceId, existing.date);
      if (existingPeriodError) return error(existingPeriodError, 409);
      const body = objectBody(ctx.body);
      const paymentType = purchasePaymentType(body.paymentType);
      if (paymentType !== existing.paymentType) return error('Metode Tunai/Kredit tidak diubah saat edit. Hapus invoice yang belum terbayar lalu input ulang bila metode salah.', 409);
      if (existing.supplierBillId) {
        const paid = paidAmountForSupplierBill(await loadSupplierPayments(wc.workspaceId), existing.supplierBillId);
        if (paid > 0) return error('Invoice sudah memiliki pembayaran Hutang Supplier dan tidak dapat diubah.', 409);
      }
      const date = text(body.date);
      const dueDate = text(body.dueDate);
      const supplierId = text(body.supplierId);
      const kebunId = text(body.kebunId);
      const invoiceNumber = text(body.invoiceNumber).slice(0, 120);
      const accountId = paymentType === 'CASH' ? text(body.accountId) : '';
      if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !supplierId || (paymentType === 'CASH' && !accountId) || (paymentType === 'CREDIT' && !/^\d{4}-\d{2}-\d{2}$/.test(dueDate))) return error('Lengkapi tanggal, supplier, jatuh tempo untuk kredit, dan Kas/Bank untuk tunai dengan benar.', 400);
      if (kebunId && !canAccessKebun(wc.membership, kebunId)) return error('Kebun ini di luar akses Anda.', 403);
      const accountingAccounts = await ensureAccountingAccounts(wc.workspaceId, ctx.user!.email || ctx.user!.userId);
      const inventoryMaster = await loadInventoryMaster(wc.workspaceId);
      let lines: PurchaseInvoiceLineRecord[];
      let totals: ReturnType<typeof purchaseTotals>;
      const warehouseId = text(body.warehouseId) || inventoryMaster.defaultWarehouseId;
      try {
        lines = parsePurchaseLines(body.lines, accountingAccounts, inventoryMaster, kebunId, warehouseId);
        totals = purchaseTotals(lines, purchaseDiscountType(body.discountType), body.discountValue, body.vatPercent);
      } catch (err) {
        return error(err instanceof Error ? err.message : 'Rincian Invoice Pembelian tidak valid.', 400);
      }
      const costCenterError = await validatePurchaseLineCostCenters(wc.workspaceId, wc.membership, lines);
      if (costCenterError) return error(costCenterError, costCenterError.includes('akses') ? 403 : 400);
      const existingTrackedItemIds = purchaseInventoryItemIds(existing.lines || []);
      if (existingTrackedItemIds.length > 0 && await hasInventoryUsageAfterPoint(wc.workspaceId, existingTrackedItemIds, existing.date, existing.createdAt)) return error('Invoice sudah menjadi dasar HPP Pemakaian Barang berikutnya dan tidak dapat diubah. Koreksi Pemakaian Barang terlebih dahulu.', 409);
      const newTrackedItemIds = purchaseInventoryItemIds(lines);
      if (newTrackedItemIds.length > 0 && await hasInventoryUsageAfterPoint(wc.workspaceId, newTrackedItemIds, date, now())) return error('Tanggal/mapping barang baru akan mengubah HPP Pemakaian Barang yang sudah ada.', 409);
      const recordKebunId = purchaseInvoiceKebunId(lines);
      const [supplier, cashAccount] = await Promise.all([
        db.get<SupplierRecord>(dataTable('suppliers', wc.workspaceId), [supplierId]).then(rows => rows[0]),
        accountId ? db.get<AccountRecord>(dataTable('accounts', wc.workspaceId), [accountId]).then(rows => rows[0]) : Promise.resolve(null),
      ]);
      if (!supplier) return error('Supplier tidak ditemukan.', 404);
      if (paymentType === 'CASH' && !cashAccount) return error('Kas/Bank pembayaran tidak ditemukan.', 404);
      const all = (await db.list<PurchaseInvoiceRecord>(invoiceTable, { limit: 500 })).items;
      if (invoiceNumber && all.some(item => item.id !== ctx.params.id && item.supplierId === supplierId && item.invoiceNumber && item.invoiceNumber.toUpperCase() === invoiceNumber.toUpperCase())) return error('Nomor invoice supplier tersebut sudah pernah dicatat.', 409);
      const actor = ctx.user!.email || ctx.user!.userId;
      const discountType = purchaseDiscountType(body.discountType);
      const record: PurchaseInvoiceRecord = {
        ...existing,
        purchaseNumber: existing.purchaseNumber || transactionNumber(existing.date || date, 'PB'),
        date,
        dueDate: paymentType === 'CREDIT' ? dueDate : '',
        supplierId,
        kebunId: recordKebunId,
        warehouseId,
        invoiceNumber,
        debitAccountId: lines[0].debitAccountId,
        lines,
        subtotal: totals.subtotal,
        discountType,
        discountValue: totals.discountValue,
        discountAmount: totals.discountAmount,
        vatPercent: totals.vatPercent,
        vatAmount: totals.vatAmount,
        accountId,
        description: purchaseDescription(lines),
        amount: totals.amount,
        note: text(body.note).slice(0, 500),
        updatedBy: actor,
        updatedAt: now(),
      };
      try {
        await adjustInventoryForInvoice(wc.workspaceId, existing, record, actor);
      } catch (err) {
        return error(err instanceof Error ? err.message : 'Saldo persediaan gagal disinkronkan.', 409);
      }
      if (paymentType === 'CREDIT') {
        if (!existing.supplierBillId) {
          await adjustInventoryForInvoice(wc.workspaceId, record, existing, actor);
          return error('Referensi Hutang Supplier invoice tidak ditemukan.', 409);
        }
        const billTable = dataTable('supplier_bills', wc.workspaceId);
        const [oldBill] = await db.get<SupplierBillRecord>(billTable, [existing.supplierBillId]);
        if (!oldBill) {
          await adjustInventoryForInvoice(wc.workspaceId, record, existing, actor);
          return error('Hutang Supplier invoice tidak ditemukan.', 409);
        }
        const [ok] = await db.update(billTable, [{ id: existing.supplierBillId, record: purchaseBillRecord(ctx.params.id, record, actor, oldBill) }]);
        if (!ok) {
          await adjustInventoryForInvoice(wc.workspaceId, record, existing, actor);
          return error('Hutang Supplier invoice gagal disinkronkan.', 500);
        }
      } else {
        if (!existing.transactionId) {
          await adjustInventoryForInvoice(wc.workspaceId, record, existing, actor);
          return error('Referensi Kas/Bank invoice tidak ditemukan.', 409);
        }
        const txTable = dataTable('transactions', wc.workspaceId);
        const [oldTx] = await db.get<TransactionRecord>(txTable, [existing.transactionId]);
        if (!oldTx) {
          await adjustInventoryForInvoice(wc.workspaceId, record, existing, actor);
          return error('Mutasi Kas/Bank invoice tidak ditemukan.', 409);
        }
        const [ok] = await db.update(txTable, [{ id: existing.transactionId, record: purchaseCashRecord(ctx.params.id, record, actor, oldTx) }]);
        if (!ok) {
          await adjustInventoryForInvoice(wc.workspaceId, record, existing, actor);
          return error('Mutasi Kas/Bank invoice gagal disinkronkan.', 500);
        }
      }
      const [ok] = await db.update(invoiceTable, [{ id: ctx.params.id, record }]);
      if (!ok) return error('Invoice Pembelian gagal diperbarui.', 500);
      return json({ id: ctx.params.id, ...record });
    },
  ],
  'DELETE /api/purchase-invoices/:id': [
    requireAuth(),
    async ctx => {
      const wc = await workspaceContext(ctx.user!);
      if (!canManagePayables(wc.membership.role)) return error('Role Anda tidak memiliki akses menghapus Invoice Pembelian.', 403);
      const invoiceTable = dataTable('purchase_invoices', wc.workspaceId);
      const [existing] = await db.get<PurchaseInvoiceRecord>(invoiceTable, [ctx.params.id]);
      if (!existing) return error('Invoice Pembelian tidak ditemukan.', 404);
      const periodError = await accountingDateWriteError(wc.workspaceId, existing.date);
      if (periodError) return error(periodError, 409);
      if (existing.supplierBillId) {
        const paid = paidAmountForSupplierBill(await loadSupplierPayments(wc.workspaceId), existing.supplierBillId);
        if (paid > 0) return error('Invoice sudah memiliki pembayaran dan tidak dapat dihapus.', 409);
      }
      const trackedItemIds = purchaseInventoryItemIds(existing.lines || []);
      if (trackedItemIds.length > 0 && await hasInventoryUsageAfterPoint(wc.workspaceId, trackedItemIds, existing.date, existing.createdAt)) return error('Invoice sudah menjadi dasar HPP Pemakaian Barang berikutnya dan tidak dapat dihapus. Koreksi Pemakaian Barang terlebih dahulu.', 409);
      const actor = ctx.user!.email || ctx.user!.userId;
      try {
        await adjustInventoryForInvoice(wc.workspaceId, existing, null, actor);
      } catch (err) {
        return error(err instanceof Error ? err.message : 'Saldo persediaan gagal dikoreksi.', 409);
      }
      if (existing.supplierBillId) await db.delete(dataTable('supplier_bills', wc.workspaceId), [existing.supplierBillId]);
      if (existing.transactionId) await db.delete(dataTable('transactions', wc.workspaceId), [existing.transactionId]);
      const [ok] = await db.delete(invoiceTable, [ctx.params.id]);
      if (!ok) return error('Invoice Pembelian gagal dihapus.', 500);
      return json({ deleted: true });
    },
  ],
  'GET /api/inventory-usages': [
    requireAuth(),
    async ctx => {
      const wc = await workspaceContext(ctx.user!);
      await ensureInventoryWarehouseLayer(wc.workspaceId, ctx.user!.email || ctx.user!.userId);
      const rows = await db.list<InventoryUsageRecord>(dataTable('inventory_usages', wc.workspaceId), { limit: 500 });
      const usages = wc.membership.role === 'ADMIN_KEBUN'
        ? rows.items.map(usage => { const lines = usage.lines.filter(line => wc.membership.assignedKebunIds.includes(line.kebunId)); return lines.length > 0 ? { ...usage, lines, totalAmount: lines.reduce((sum, line) => sum + line.amount, 0) } : null; }).filter((usage): usage is (typeof rows.items)[number] => Boolean(usage))
        : rows.items;
      return json({ usages });
    },
  ],
  'POST /api/inventory-usages': [
    requireAuth(),
    requireOpenAccountingDate('date'),
    async ctx => {
      const wc = await workspaceContext(ctx.user!);
      if (!canTransact(wc.membership.role)) return error('Role Viewer hanya dapat melihat Pemakaian Barang.', 403);
      const body = objectBody(ctx.body);
      const date = text(body.date);
      if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return error('Tanggal Pemakaian Barang wajib diisi.', 400);
      const actor = ctx.user!.email || ctx.user!.userId;
      let prepared: Awaited<ReturnType<typeof prepareInventoryUsage>>;
      try { prepared = await prepareInventoryUsage(wc.workspaceId, wc.membership, body.lines, date, actor, text(body.warehouseId)); }
      catch (err) { return error(err instanceof Error ? err.message : 'Rincian Pemakaian Barang tidak valid.', 400); }
      const stamp = now();
      const record: InventoryUsageRecord = { usageNumber: transactionNumber(date, 'PMK'), date, warehouseId: prepared.warehouseIds.length === 1 ? prepared.warehouseIds[0] : undefined, reference: text(body.reference).slice(0, 120), description: text(body.description).slice(0, 500) || 'Pemakaian Barang', lines: prepared.lines, totalAmount: prepared.totalAmount, createdBy: actor, createdAt: stamp };
      const usageTable = dataTable('inventory_usages', wc.workspaceId);
      const [usageId] = await db.add(usageTable, [record]);
      if (!usageId) return error('Pemakaian Barang gagal disimpan.', 500);
      const results = await db.update(dataTable('inventory_items', wc.workspaceId), prepared.updates);
      if (!results.every(Boolean)) { const rollback = prepared.originals.filter((_, index) => results[index]); if (rollback.length > 0) await db.update(dataTable('inventory_items', wc.workspaceId), rollback); await db.delete(usageTable, [usageId]); return error('Pemakaian tersimpan tetapi stok total gagal diperbarui lengkap.', 500); }
      const balanceResults = await db.update(dataTable('inventory_warehouse_balances', wc.workspaceId), prepared.balanceUpdates);
      if (!balanceResults.every(Boolean)) { await db.update(dataTable('inventory_items', wc.workspaceId), prepared.originals); const rollback = prepared.balanceOriginals.filter((_, index) => balanceResults[index]); if (rollback.length > 0) await db.update(dataTable('inventory_warehouse_balances', wc.workspaceId), rollback); await db.delete(usageTable, [usageId]); return error('Pemakaian tersimpan tetapi stok gudang gagal diperbarui lengkap.', 500); }
      return json({ id: usageId, ...record }, 201);
    },
  ],
  'DELETE /api/inventory-usages/:id': [
    requireAuth(),
    async ctx => {
      const wc = await workspaceContext(ctx.user!);
      if (!canTransact(wc.membership.role)) return error('Role Viewer hanya dapat melihat Pemakaian Barang.', 403);
      const usageTable = dataTable('inventory_usages', wc.workspaceId);
      const [existing] = await db.get<InventoryUsageRecord>(usageTable, [ctx.params.id]);
      if (!existing) return error('Pemakaian Barang tidak ditemukan.', 404);
      const periodError = await accountingDateWriteError(wc.workspaceId, existing.date);
      if (periodError) return error(periodError, 409);
      if (wc.membership.role === 'ADMIN_KEBUN' && existing.lines.some(line => !wc.membership.assignedKebunIds.includes(line.kebunId))) return error('Transaksi ini mencakup Cost Center di luar akses Anda dan tidak dapat dihapus.', 403);
      const itemIds = inventoryUsageItemIds(existing.lines);
      if (await hasInventoryUsageAfterPoint(wc.workspaceId, itemIds, existing.date, existing.createdAt, ctx.params.id)) return error('Sudah ada Pemakaian Barang berikutnya untuk salah satu item. Hapus transaksi yang lebih baru terlebih dahulu agar Moving Average tetap konsisten.', 409);
      const itemTable = dataTable('inventory_items', wc.workspaceId);
      const records = await db.get<InventoryItemRecord>(itemTable, itemIds);
      const restore = new Map<string, { quantity: number; value: number }>();
      existing.lines.forEach(line => { const current = restore.get(line.itemId) || { quantity: 0, value: 0 }; current.quantity += line.quantity; current.value += line.amount; restore.set(line.itemId, current); });
      const originals: Array<{ id: string; record: InventoryItemRecord }> = [];
      const updates: Array<{ id: string; record: InventoryItemRecord }> = [];
      for (let index = 0; index < itemIds.length; index += 1) {
        const id = itemIds[index]; const item = records[index]; if (!item) return error('Master Barang pada transaksi tidak ditemukan.', 409); const part = restore.get(id) || { quantity: 0, value: 0 }; const currentQuantity = Number(item.currentQuantity || 0); const currentValue = Number(item.stockValue || 0); const nextQuantity = currentQuantity + part.quantity; const nextValue = Math.round(currentValue + part.value); originals.push({ id, record: item }); updates.push({ id, record: { ...item, currentQuantity: nextQuantity, stockValue: nextValue, averageCost: nextQuantity > 0 ? Number((nextValue / nextQuantity).toFixed(6)) : 0, updatedBy: ctx.user!.email || ctx.user!.userId, updatedAt: now() } });
      }
      const results = await db.update(itemTable, updates);
      if (!results.every(Boolean)) { const rollback = originals.filter((_, index) => results[index]); if (rollback.length > 0) await db.update(itemTable, rollback); return error('Stok gagal dikembalikan lengkap.', 500); }
      const layer = await ensureInventoryWarehouseLayer(wc.workspaceId, ctx.user!.email || ctx.user!.userId);
      const balanceMap = new Map(layer.balances.map(item => [inventoryWarehousePairKey(item.warehouseId, item.itemId), item]));
      const restoreByPair = new Map<string, { warehouseId: string; itemId: string; quantity: number; value: number }>();
      existing.lines.forEach(line => { const warehouseId = line.warehouseId || existing.warehouseId || layer.defaultWarehouseId; const key = inventoryWarehousePairKey(warehouseId, line.itemId); const current = restoreByPair.get(key) || { warehouseId, itemId: line.itemId, quantity: 0, value: 0 }; current.quantity += line.quantity; current.value += line.amount; restoreByPair.set(key, current); });
      const balanceOriginals: Array<{ id: string; record: InventoryWarehouseBalanceRecord }> = [];
      const balanceUpdates: Array<{ id: string; record: InventoryWarehouseBalanceRecord }> = [];
      for (const [key, part] of restoreByPair) { const balance = balanceMap.get(key); if (!balance) { await db.update(itemTable, originals); return error('Saldo gudang historis tidak ditemukan untuk mengembalikan Pemakaian.', 409); } const { id, ...base } = balance; const quantity = Number(base.quantity || 0) + part.quantity; const stockValue = Math.round(Number(base.stockValue || 0) + part.value); balanceOriginals.push({ id, record: base }); balanceUpdates.push({ id, record: { ...base, quantity, stockValue, averageCost: quantity > 0 ? Number((stockValue / quantity).toFixed(6)) : 0, updatedBy: ctx.user!.email || ctx.user!.userId, updatedAt: now() } }); }
      const balanceResults = balanceUpdates.length ? await db.update(dataTable('inventory_warehouse_balances', wc.workspaceId), balanceUpdates) : [];
      if (balanceUpdates.length && !balanceResults.every(Boolean)) { await db.update(itemTable, originals); const rollback = balanceOriginals.filter((_, index) => balanceResults[index]); if (rollback.length) await db.update(dataTable('inventory_warehouse_balances', wc.workspaceId), rollback); return error('Stok gudang gagal dikembalikan lengkap.', 500); }
      const [deleted] = await db.delete(usageTable, [ctx.params.id]);
      if (!deleted) { await db.update(itemTable, originals); if (balanceOriginals.length) await db.update(dataTable('inventory_warehouse_balances', wc.workspaceId), balanceOriginals); return error('Stok sudah dikembalikan tetapi transaksi gagal dihapus.', 500); }
      return json({ deleted: true });
    },
  ],
  'GET /api/inventory-transfers': [
    requireAuth(),
    async ctx => { const wc = await workspaceContext(ctx.user!); const rows = await db.list<InventoryTransferRecord>(dataTable('inventory_transfers', wc.workspaceId), { limit: 500 }); return json({ transfers: rows.items }); },
  ],
  'POST /api/inventory-transfers': [
    requireAuth(),
    requireOpenAccountingDate('date'),
    async ctx => {
      const wc = await workspaceContext(ctx.user!); if (!canTransact(wc.membership.role)) return error('Role Viewer hanya dapat melihat Mutasi Antar Gudang.', 403); const body = objectBody(ctx.body); const date = text(body.date); const sourceWarehouseId = text(body.sourceWarehouseId); const destinationWarehouseId = text(body.destinationWarehouseId); if (!validIsoDate(date) || !sourceWarehouseId || !destinationWarehouseId || sourceWarehouseId === destinationWarehouseId) return error('Tanggal, gudang asal, dan gudang tujuan yang berbeda wajib dipilih.', 400); const actor = ctx.user!.email || ctx.user!.userId; const master = await loadInventoryMaster(wc.workspaceId); const source = master.warehouses.find(item => item.id === sourceWarehouseId && item.active !== false); const destination = master.warehouses.find(item => item.id === destinationWarehouseId && item.active !== false); if (!source || !destination) return error('Gudang asal/tujuan tidak ditemukan atau nonaktif.', 404); if (await inventoryWarehouseLocked(wc.workspaceId, sourceWarehouseId) || await inventoryWarehouseLocked(wc.workspaceId, destinationWarehouseId)) return error('Gudang asal/tujuan sedang dikunci oleh Stok Opname aktif.', 409);
      const rawLines = Array.isArray(body.lines) ? body.lines.slice(0, 100) : []; if (!rawLines.length) return error('Minimal satu barang wajib dimutasi.', 400); const itemMap = new Map(master.items.map(item => [item.id, item])); const requested = new Map<string, { quantity: number; inputQuantity: number; inputUnitId: string; inputUnit: string; conversionFactor: number }>(); for (const raw of rawLines) { const row = objectBody(raw); const itemId = text(row.itemId); const inputQuantity = Number(row.quantity); const item = itemMap.get(itemId); if (!item || !Number.isFinite(inputQuantity) || inputQuantity <= 0) return error('Barang dan jumlah mutasi wajib valid.', 400); if (requested.has(itemId)) return error('Barang yang sama cukup satu baris pada Mutasi Gudang.', 400); const choice = inventoryItemUnitChoice(item, master.units, text(row.unitId), 'USAGE'); requested.set(itemId, { quantity: Number((inputQuantity * choice.factor).toFixed(6)), inputQuantity, inputUnitId: choice.unitId, inputUnit: choice.label.slice(0, 40), conversionFactor: choice.factor }); }
      const unitMap = new Map(master.units.map(item => [item.id, item])); const balanceMap = new Map(master.balances.map(item => [inventoryWarehousePairKey(item.warehouseId, item.itemId), item])); const updates: Array<{ id: string; record: InventoryWarehouseBalanceRecord }> = []; const originals: Array<{ id: string; record: InventoryWarehouseBalanceRecord }> = []; const additions: InventoryWarehouseBalanceRecord[] = []; const lines: InventoryTransferLineRecord[] = [];
      for (const [itemId, request] of requested) { const quantity = request.quantity; const item = itemMap.get(itemId); if (!item || item.active === false) return error('Barang mutasi tidak ditemukan/aktif.', 404); const sourceBalance = balanceMap.get(inventoryWarehousePairKey(sourceWarehouseId, itemId)); const sourceQty = Number(sourceBalance?.quantity || 0); const sourceValue = Number(sourceBalance?.stockValue || 0); if (!sourceBalance || quantity - sourceQty > 0.000001) return error(`Stok ${item.name} di gudang asal tidak cukup. Tersedia ${sourceQty}.`, 409); const amount = Math.abs(quantity - sourceQty) <= 0.000001 ? Math.round(sourceValue) : Math.round(quantity * (sourceQty > 0 ? sourceValue / sourceQty : 0)); const unitCost = quantity > 0 ? amount / quantity : 0; const unit = unitMap.get(item.unitId); lines.push({ itemId, quantity, unit: unit?.code || unit?.name || '', inputQuantity: request.inputQuantity, inputUnitId: request.inputUnitId, inputUnit: request.inputUnit, conversionFactor: request.conversionFactor, unitCost: Number(unitCost.toFixed(6)), amount }); const { id: sourceId, ...sourceBase } = sourceBalance; originals.push({ id: sourceId, record: sourceBase }); const nextSourceQty = Math.max(0, sourceQty - quantity); const nextSourceValue = Math.max(0, Math.round(sourceValue - amount)); updates.push({ id: sourceId, record: { ...sourceBase, quantity: nextSourceQty, stockValue: nextSourceValue, averageCost: nextSourceQty > 0 ? Number((nextSourceValue / nextSourceQty).toFixed(6)) : 0, updatedBy: actor, updatedAt: now() } }); const destinationKey = inventoryWarehousePairKey(destinationWarehouseId, itemId); const destinationBalance = balanceMap.get(destinationKey); const destQty = Number(destinationBalance?.quantity || 0); const destValue = Number(destinationBalance?.stockValue || 0); const nextDestQty = destQty + quantity; const nextDestValue = Math.round(destValue + amount); const destinationRecord: InventoryWarehouseBalanceRecord = { warehouseId: destinationWarehouseId, itemId, quantity: nextDestQty, stockValue: nextDestValue, averageCost: nextDestQty > 0 ? Number((nextDestValue / nextDestQty).toFixed(6)) : 0, updatedBy: actor, updatedAt: now() }; if (destinationBalance) { const { id, ...destBase } = destinationBalance; originals.push({ id, record: destBase }); updates.push({ id, record: destinationRecord }); } else additions.push(destinationRecord); }
      const balanceTable = dataTable('inventory_warehouse_balances', wc.workspaceId); const updateResults = updates.length ? await db.update(balanceTable, updates) : []; if (updates.length && !updateResults.every(Boolean)) { const rollback = originals.filter((_, index) => updateResults[index]); if (rollback.length) await db.update(balanceTable, rollback); return error('Mutasi gudang gagal memperbarui stok lengkap.', 500); } const additionIds = additions.length ? await db.add(balanceTable, additions) : []; if (additions.length && (additionIds.length !== additions.length || additionIds.some(id => !id))) { if (originals.length) await db.update(balanceTable, originals); const created = additionIds.filter(Boolean); if (created.length) await db.delete(balanceTable, created); return error('Mutasi gudang gagal membuat saldo tujuan.', 500); }
      const stamp = now(); const record: InventoryTransferRecord = { transferNumber: transactionNumber(date, 'MTG'), date, sourceWarehouseId, destinationWarehouseId, reference: text(body.reference).slice(0, 120), description: text(body.description).slice(0, 300) || 'Mutasi Antar Gudang', lines, totalAmount: lines.reduce((sum, line) => sum + line.amount, 0), status: 'POSTED', createdBy: actor, createdAt: stamp }; const [id] = await db.add(dataTable('inventory_transfers', wc.workspaceId), [record]); if (!id) { if (originals.length) await db.update(balanceTable, originals); if (additionIds.length) await db.delete(balanceTable, additionIds.filter(Boolean)); return error('Stok sudah dipindahkan tetapi dokumen mutasi gagal dibuat.', 500); } return json({ id, ...record }, 201);
    },
  ],
  'POST /api/inventory-transfers/:id/reverse': [
    requireAuth(),
    async ctx => {
      const wc = await workspaceContext(ctx.user!); if (!canTransact(wc.membership.role)) return error('Role Viewer tidak dapat membatalkan Mutasi Gudang.', 403); const table = dataTable('inventory_transfers', wc.workspaceId); const [existing] = await db.get<InventoryTransferRecord>(table, [ctx.params.id]); if (!existing) return error('Mutasi Gudang tidak ditemukan.', 404); if (existing.status !== 'POSTED') return error('Mutasi Gudang ini sudah dibatalkan.', 409); const periodError = await accountingDateWriteError(wc.workspaceId, existing.date); if (periodError) return error(periodError, 409); if (await inventoryWarehouseLocked(wc.workspaceId, existing.sourceWarehouseId) || await inventoryWarehouseLocked(wc.workspaceId, existing.destinationWarehouseId)) return error('Gudang terkait sedang dikunci Stok Opname.', 409); const actor = ctx.user!.email || ctx.user!.userId; const master = await loadInventoryMaster(wc.workspaceId); const balanceMap = new Map(master.balances.map(item => [inventoryWarehousePairKey(item.warehouseId, item.itemId), item])); const updates: Array<{ id: string; record: InventoryWarehouseBalanceRecord }> = []; const originals: Array<{ id: string; record: InventoryWarehouseBalanceRecord }> = [];
      for (const line of existing.lines) { const sourceBalance = balanceMap.get(inventoryWarehousePairKey(existing.sourceWarehouseId, line.itemId)); const destinationBalance = balanceMap.get(inventoryWarehousePairKey(existing.destinationWarehouseId, line.itemId)); if (!sourceBalance || !destinationBalance || Number(destinationBalance.quantity || 0) + 0.000001 < line.quantity || Number(destinationBalance.stockValue || 0) + 1 < line.amount) return error('Mutasi tidak dapat dibatalkan karena stok gudang tujuan sudah berubah/dipakai.', 409); const { id: sourceId, ...sourceBase } = sourceBalance; const { id: destinationId, ...destinationBase } = destinationBalance; originals.push({ id: sourceId, record: sourceBase }, { id: destinationId, record: destinationBase }); const sourceQty = Number(sourceBase.quantity || 0) + line.quantity; const sourceValue = Math.round(Number(sourceBase.stockValue || 0) + line.amount); const destQty = Math.max(0, Number(destinationBase.quantity || 0) - line.quantity); const destValue = Math.max(0, Math.round(Number(destinationBase.stockValue || 0) - line.amount)); updates.push({ id: sourceId, record: { ...sourceBase, quantity: sourceQty, stockValue: sourceValue, averageCost: sourceQty > 0 ? Number((sourceValue / sourceQty).toFixed(6)) : 0, updatedBy: actor, updatedAt: now() } }, { id: destinationId, record: { ...destinationBase, quantity: destQty, stockValue: destValue, averageCost: destQty > 0 ? Number((destValue / destQty).toFixed(6)) : 0, updatedBy: actor, updatedAt: now() } }); }
      const results = await db.update(dataTable('inventory_warehouse_balances', wc.workspaceId), updates); if (!results.every(Boolean)) { const rollback = originals.filter((_, index) => results[index]); if (rollback.length) await db.update(dataTable('inventory_warehouse_balances', wc.workspaceId), rollback); return error('Pembatalan Mutasi Gudang gagal memperbarui stok.', 500); } const record: InventoryTransferRecord = { ...existing, status: 'REVERSED', reversedAt: now(), reversedBy: actor }; const [ok] = await db.update(table, [{ id: ctx.params.id, record }]); if (!ok) { await db.update(dataTable('inventory_warehouse_balances', wc.workspaceId), originals); return error('Stok sudah dikembalikan tetapi status mutasi gagal diperbarui.', 500); } return json({ id: ctx.params.id, ...record });
    },
  ],
  'GET /api/inventory-stocktakes': [
    requireAuth(),
    async ctx => { const wc = await workspaceContext(ctx.user!); const rows = await db.list<InventoryStocktakeRecord>(dataTable('inventory_stocktakes', wc.workspaceId), { limit: 300 }); return json({ stocktakes: rows.items }); },
  ],
  'POST /api/inventory-stocktakes': [
    requireAuth(),
    requireOpenAccountingDate('date'),
    async ctx => {
      const wc = await workspaceContext(ctx.user!); if (!canTransact(wc.membership.role)) return error('Role Viewer hanya dapat melihat Stok Opname.', 403); const body = objectBody(ctx.body); const date = text(body.date); const warehouseId = text(body.warehouseId); if (!validIsoDate(date) || !warehouseId) return error('Tanggal dan Gudang Stok Opname wajib dipilih.', 400); if (await inventoryWarehouseLocked(wc.workspaceId, warehouseId)) return error('Gudang sudah memiliki Stok Opname aktif.', 409); const actor = ctx.user!.email || ctx.user!.userId; const master = await loadInventoryMaster(wc.workspaceId); const warehouse = master.warehouses.find(item => item.id === warehouseId && item.active !== false); if (!warehouse) return error('Gudang Stok Opname tidak ditemukan/aktif.', 404); const groupMap = new Map(master.groups.map(item => [item.id, item])); const unitMap = new Map(master.units.map(item => [item.id, item])); const balanceMap = new Map(master.balances.map(item => [inventoryWarehousePairKey(item.warehouseId, item.itemId), item])); const lines: InventoryStocktakeLineRecord[] = master.items.filter(item => item.active !== false && groupMap.get(item.groupId)?.canStore).map(item => { const balance = balanceMap.get(inventoryWarehousePairKey(warehouseId, item.id)); const systemQuantity = Number(balance?.quantity || 0); const systemValue = Math.round(Number(balance?.stockValue || 0)); const unit = unitMap.get(item.unitId); return { itemId: item.id, unit: unit?.code || unit?.name || '', systemQuantity, systemValue, physicalQuantity: null, varianceQuantity: 0, unitCost: systemQuantity > 0 ? Number((systemValue / systemQuantity).toFixed(6)) : 0, varianceValue: 0, note: '' }; }); const stamp = now(); const record: InventoryStocktakeRecord = { stocktakeNumber: transactionNumber(date, 'SO'), date, warehouseId, pic: text(body.pic).slice(0, 120), note: text(body.note).slice(0, 500), status: 'COUNTING', lines, totalAbsVarianceValue: 0, createdBy: actor, updatedBy: actor, createdAt: stamp, updatedAt: stamp }; const [id] = await db.add(dataTable('inventory_stocktakes', wc.workspaceId), [record]); if (!id) return error('Stok Opname gagal dibuat.', 500); return json({ id, ...record }, 201);
    },
  ],
  'PUT /api/inventory-stocktakes/:id': [
    requireAuth(),
    requireOpenAccountingDate('date'),
    async ctx => {
      const wc = await workspaceContext(ctx.user!); if (!canTransact(wc.membership.role)) return error('Role Viewer tidak dapat mengisi Stok Opname.', 403); const table = dataTable('inventory_stocktakes', wc.workspaceId); const [existing] = await db.get<InventoryStocktakeRecord>(table, [ctx.params.id]); if (!existing) return error('Stok Opname tidak ditemukan.', 404); if (existing.status !== 'COUNTING' && existing.status !== 'REVIEW') return error('Stok Opname yang sudah diposting/dibatalkan tidak dapat diubah.', 409); const body = objectBody(ctx.body); if (text(body.date) && text(body.date) !== existing.date) return error('Tanggal snapshot Stok Opname tidak dapat diubah.', 409); const rawLines = Array.isArray(body.lines) ? body.lines : []; const inputMap = new Map(rawLines.map(raw => { const row = objectBody(raw); return [text(row.itemId), row] as const; })); let incomplete = false; const lines = existing.lines.map(line => { const input = inputMap.get(line.itemId); if (!input) return line; const rawPhysical = input.physicalQuantity; const physicalQuantity = rawPhysical === '' || rawPhysical == null ? null : Number(rawPhysical); if (physicalQuantity != null && (!Number.isFinite(physicalQuantity) || physicalQuantity < 0)) throw new Error('Qty fisik tidak boleh negatif.'); if (physicalQuantity == null) { incomplete = true; return { ...line, physicalQuantity: null, varianceQuantity: 0, varianceValue: 0, note: text(input.note).slice(0, 240) }; } const varianceQuantity = physicalQuantity - line.systemQuantity; let unitCost = line.unitCost; if (varianceQuantity > 0 && unitCost <= 0) unitCost = money(input.valuationCost); if (varianceQuantity > 0 && unitCost <= 0) throw new Error('Barang lebih dengan HPP sistem nol wajib memiliki Harga Penilaian.'); const varianceValue = Math.round(varianceQuantity * unitCost); return { ...line, physicalQuantity, varianceQuantity, unitCost, varianceValue, note: text(input.note).slice(0, 240) }; }); const submitReview = body.submitReview === true; if (submitReview && (incomplete || lines.some(line => line.physicalQuantity == null))) return error('Semua Qty Fisik wajib diisi sebelum masuk Review.', 400); const record: InventoryStocktakeRecord = { ...existing, pic: text(body.pic).slice(0, 120) || existing.pic, note: text(body.note).slice(0, 500), status: submitReview ? 'REVIEW' : existing.status, lines, totalAbsVarianceValue: lines.reduce((sum, line) => sum + Math.abs(line.varianceValue), 0), updatedBy: ctx.user!.email || ctx.user!.userId, updatedAt: now() }; const [ok] = await db.update(table, [{ id: ctx.params.id, record }]); if (!ok) return error('Stok Opname gagal disimpan.', 500); return json({ id: ctx.params.id, ...record });
    },
  ],
  'POST /api/inventory-stocktakes/:id/post': [
    requireAuth(),
    async ctx => {
      const wc = await workspaceContext(ctx.user!); if (!canManageAccounting(wc.membership.role)) return error('Hanya Owner/Admin Pusat/Finance yang dapat memposting Stok Opname.', 403); const table = dataTable('inventory_stocktakes', wc.workspaceId); const [existing] = await db.get<InventoryStocktakeRecord>(table, [ctx.params.id]); if (!existing) return error('Stok Opname tidak ditemukan.', 404); if (existing.status !== 'REVIEW') return error('Stok Opname harus berstatus Review sebelum diposting.', 409); const periodError = await accountingDateWriteError(wc.workspaceId, existing.date); if (periodError) return error(periodError, 409); const actor = ctx.user!.email || ctx.user!.userId; const master = await loadInventoryMaster(wc.workspaceId); const warehouse = master.warehouses.find(item => item.id === existing.warehouseId); if (!warehouse) return error('Gudang Stok Opname tidak ditemukan.', 404); const balanceMap = new Map(master.balances.map(item => [inventoryWarehousePairKey(item.warehouseId, item.itemId), item])); const itemMap = new Map(master.items.map(item => [item.id, item])); const groupMap = new Map(master.groups.map(item => [item.id, item])); for (const line of existing.lines) { const current = balanceMap.get(inventoryWarehousePairKey(existing.warehouseId, line.itemId)); if (Math.abs(Number(current?.quantity || 0) - line.systemQuantity) > 0.000001 || Math.abs(Number(current?.stockValue || 0) - line.systemValue) > 1) return error('Saldo gudang berubah setelah snapshot Stok Opname. Batalkan dokumen ini dan buat Stok Opname baru.', 409); }
      const balanceUpdates: Array<{ id: string; record: InventoryWarehouseBalanceRecord }> = []; const balanceOriginals: Array<{ id: string; record: InventoryWarehouseBalanceRecord }> = []; const balanceAdds: InventoryWarehouseBalanceRecord[] = []; const itemDeltas = new Map<string, { quantity: number; value: number }>();
      for (const line of existing.lines) { if (line.physicalQuantity == null) return error('Qty fisik Stok Opname belum lengkap.', 409); const key = inventoryWarehousePairKey(existing.warehouseId, line.itemId); const current = balanceMap.get(key); const physicalQuantity = line.physicalQuantity; const physicalValue = Math.max(0, Math.round(line.systemValue + line.varianceValue)); const record: InventoryWarehouseBalanceRecord = { warehouseId: existing.warehouseId, itemId: line.itemId, quantity: physicalQuantity, stockValue: physicalValue, averageCost: physicalQuantity > 0 ? Number((physicalValue / physicalQuantity).toFixed(6)) : 0, updatedBy: actor, updatedAt: now() }; if (current) { const { id, ...base } = current; balanceOriginals.push({ id, record: base }); balanceUpdates.push({ id, record }); } else if (physicalQuantity > 0 || physicalValue > 0) balanceAdds.push(record); if (Math.abs(line.varianceQuantity) > 0.000001 || Math.abs(line.varianceValue) > 1) itemDeltas.set(line.itemId, { quantity: line.varianceQuantity, value: line.varianceValue }); }
      const itemIds = [...itemDeltas.keys()]; const globalRecords = itemIds.length ? await db.get<InventoryItemRecord>(dataTable('inventory_items', wc.workspaceId), itemIds) : []; const itemUpdates: Array<{ id: string; record: InventoryItemRecord }> = []; const itemOriginals: Array<{ id: string; record: InventoryItemRecord }> = []; for (let index = 0; index < itemIds.length; index += 1) { const itemId = itemIds[index]; const item = globalRecords[index]; if (!item) return error('Master Barang Stok Opname tidak ditemukan.', 409); const delta = itemDeltas.get(itemId)!; const quantity = Number(item.currentQuantity || 0) + delta.quantity; const stockValue = Math.round(Number(item.stockValue || 0) + delta.value); if (quantity < -0.000001 || stockValue < -1) return error(`Penyesuaian Stok Opname membuat saldo ${item.name} negatif.`, 409); itemOriginals.push({ id: itemId, record: item }); itemUpdates.push({ id: itemId, record: { ...item, currentQuantity: Math.max(0, quantity), stockValue: Math.max(0, stockValue), averageCost: quantity > 0 ? Number((Math.max(0, stockValue) / quantity).toFixed(6)) : 0, updatedBy: actor, updatedAt: now() } }); }
      const balanceTable = dataTable('inventory_warehouse_balances', wc.workspaceId); const balanceResults = balanceUpdates.length ? await db.update(balanceTable, balanceUpdates) : []; if (balanceUpdates.length && !balanceResults.every(Boolean)) { const rollback = balanceOriginals.filter((_, index) => balanceResults[index]); if (rollback.length) await db.update(balanceTable, rollback); return error('Stok Opname gagal memperbarui saldo gudang.', 500); } const balanceAddIds = balanceAdds.length ? await db.add(balanceTable, balanceAdds) : []; if (balanceAdds.length && (balanceAddIds.length !== balanceAdds.length || balanceAddIds.some(id => !id))) { if (balanceOriginals.length) await db.update(balanceTable, balanceOriginals); const created = balanceAddIds.filter(Boolean); if (created.length) await db.delete(balanceTable, created); return error('Stok Opname gagal membuat saldo gudang baru.', 500); } const itemResults = itemUpdates.length ? await db.update(dataTable('inventory_items', wc.workspaceId), itemUpdates) : []; if (itemUpdates.length && !itemResults.every(Boolean)) { if (balanceOriginals.length) await db.update(balanceTable, balanceOriginals); if (balanceAddIds.length) await db.delete(balanceTable, balanceAddIds.filter(Boolean)); const rollback = itemOriginals.filter((_, index) => itemResults[index]); if (rollback.length) await db.update(dataTable('inventory_items', wc.workspaceId), rollback); return error('Stok Opname gagal memperbarui saldo total barang.', 500); }
      const accounts = await ensureAccountingAccounts(wc.workspaceId, actor); const shortageAccount = accounts.find(item => item.active && isPostingAccount(item) && item.group === 'EXPENSE' && item.code === '6090-00-001') || accounts.find(item => item.active && isPostingAccount(item) && item.group === 'EXPENSE'); const surplusAccount = accounts.find(item => item.active && isPostingAccount(item) && item.group === 'REVENUE' && item.code === '8010-00-001') || accounts.find(item => item.active && isPostingAccount(item) && item.group === 'REVENUE'); const journalLines: ManualJournalLineRecord[] = []; for (const line of existing.lines) { if (Math.abs(line.varianceValue) <= 1) continue; const item = itemMap.get(line.itemId); const group = item ? groupMap.get(item.groupId) : undefined; if (!group?.inventoryAccountId) continue; const memo = `Selisih Stok Opname ${item?.name || line.itemId}`; if (line.varianceValue < 0) { if (!shortageAccount) return error('Akun Beban penyesuaian stok belum tersedia.', 409); journalLines.push({ accountId: shortageAccount.id, kebunId: warehouse.kebunId || '', debit: Math.abs(line.varianceValue), credit: 0, memo }, { accountId: group.inventoryAccountId, kebunId: warehouse.kebunId || '', debit: 0, credit: Math.abs(line.varianceValue), memo }); } else { if (!surplusAccount) return error('Akun Pendapatan penyesuaian stok belum tersedia.', 409); journalLines.push({ accountId: group.inventoryAccountId, kebunId: warehouse.kebunId || '', debit: line.varianceValue, credit: 0, memo }, { accountId: surplusAccount.id, kebunId: warehouse.kebunId || '', debit: 0, credit: line.varianceValue, memo }); } }
      let journalId = ''; if (journalLines.length) { const stamp = now(); const journal: ManualJournalRecord = { journalNumber: transactionNumber(existing.date, 'SOJ'), date: existing.date, description: `Penyesuaian Stok Opname ${existing.stocktakeNumber}`, reference: existing.stocktakeNumber, sourceType: 'STOCKTAKE', sourceId: ctx.params.id, lines: journalLines, createdBy: actor, updatedBy: actor, createdAt: stamp, updatedAt: stamp }; const [id] = await db.add(dataTable('manual_journals', wc.workspaceId), [journal]); if (!id) { if (itemOriginals.length) await db.update(dataTable('inventory_items', wc.workspaceId), itemOriginals); if (balanceOriginals.length) await db.update(balanceTable, balanceOriginals); if (balanceAddIds.length) await db.delete(balanceTable, balanceAddIds.filter(Boolean)); return error('Saldo stok sudah dihitung tetapi jurnal Stok Opname gagal dibuat.', 500); } journalId = id; }
      const record: InventoryStocktakeRecord = { ...existing, status: 'POSTED', journalId, postedAt: now(), postedBy: actor, updatedBy: actor, updatedAt: now() }; const [ok] = await db.update(table, [{ id: ctx.params.id, record }]); if (!ok) return error('Stok dan jurnal sudah diposting tetapi status Stok Opname gagal diperbarui.', 500); return json({ id: ctx.params.id, ...record });
    },
  ],
  'POST /api/inventory-stocktakes/:id/reverse': [
    requireAuth(),
    async ctx => {
      const wc = await workspaceContext(ctx.user!); if (!canManageAccounting(wc.membership.role)) return error('Hanya Owner/Admin Pusat/Finance yang dapat membatalkan Stok Opname.', 403); const table = dataTable('inventory_stocktakes', wc.workspaceId); const [existing] = await db.get<InventoryStocktakeRecord>(table, [ctx.params.id]); if (!existing) return error('Stok Opname tidak ditemukan.', 404); if (existing.status !== 'POSTED') return error('Hanya Stok Opname Posted yang dapat dibatalkan.', 409); const periodError = await accountingDateWriteError(wc.workspaceId, existing.date); if (periodError) return error(periodError, 409); const actor = ctx.user!.email || ctx.user!.userId; const master = await loadInventoryMaster(wc.workspaceId); const balanceMap = new Map(master.balances.map(item => [inventoryWarehousePairKey(item.warehouseId, item.itemId), item])); const itemMap = new Map(master.items.map(item => [item.id, item])); for (const line of existing.lines) { const balance = balanceMap.get(inventoryWarehousePairKey(existing.warehouseId, line.itemId)); const expectedQty = line.physicalQuantity ?? line.systemQuantity; const expectedValue = Math.max(0, Math.round(line.systemValue + line.varianceValue)); if (Math.abs(Number(balance?.quantity || 0) - expectedQty) > 0.000001 || Math.abs(Number(balance?.stockValue || 0) - expectedValue) > 1) return error('Stok Opname tidak dapat dibatalkan karena sudah ada pergerakan stok sesudah posting.', 409); }
      const balanceUpdates: Array<{ id: string; record: InventoryWarehouseBalanceRecord }> = []; const balanceOriginals: Array<{ id: string; record: InventoryWarehouseBalanceRecord }> = []; const itemUpdates: Array<{ id: string; record: InventoryItemRecord }> = []; const itemOriginals: Array<{ id: string; record: InventoryItemRecord }> = []; const changedLines = existing.lines.filter(line => Math.abs(line.varianceQuantity) > 0.000001 || Math.abs(line.varianceValue) > 1); for (const line of existing.lines) { const balance = balanceMap.get(inventoryWarehousePairKey(existing.warehouseId, line.itemId)); if (!balance) continue; const { id, ...base } = balance; balanceOriginals.push({ id, record: base }); balanceUpdates.push({ id, record: { ...base, quantity: line.systemQuantity, stockValue: line.systemValue, averageCost: line.systemQuantity > 0 ? Number((line.systemValue / line.systemQuantity).toFixed(6)) : 0, updatedBy: actor, updatedAt: now() } }); }
      const changedIds = [...new Set(changedLines.map(line => line.itemId))]; const globalRecords = changedIds.length ? await db.get<InventoryItemRecord>(dataTable('inventory_items', wc.workspaceId), changedIds) : []; for (let index = 0; index < changedIds.length; index += 1) { const itemId = changedIds[index]; const item = globalRecords[index] || itemMap.get(itemId); if (!item) return error('Master Barang tidak ditemukan saat reversal Stok Opname.', 409); const lines = changedLines.filter(line => line.itemId === itemId); const quantityDelta = lines.reduce((sum, line) => sum + line.varianceQuantity, 0); const valueDelta = lines.reduce((sum, line) => sum + line.varianceValue, 0); const quantity = Number(item.currentQuantity || 0) - quantityDelta; const stockValue = Math.round(Number(item.stockValue || 0) - valueDelta); itemOriginals.push({ id: itemId, record: item }); itemUpdates.push({ id: itemId, record: { ...item, currentQuantity: Math.max(0, quantity), stockValue: Math.max(0, stockValue), averageCost: quantity > 0 ? Number((Math.max(0, stockValue) / quantity).toFixed(6)) : 0, updatedBy: actor, updatedAt: now() } }); }
      const balanceResults = balanceUpdates.length ? await db.update(dataTable('inventory_warehouse_balances', wc.workspaceId), balanceUpdates) : []; if (balanceUpdates.length && !balanceResults.every(Boolean)) { const rollback = balanceOriginals.filter((_, index) => balanceResults[index]); if (rollback.length) await db.update(dataTable('inventory_warehouse_balances', wc.workspaceId), rollback); return error('Reversal Stok Opname gagal mengembalikan stok gudang.', 500); } const itemResults = itemUpdates.length ? await db.update(dataTable('inventory_items', wc.workspaceId), itemUpdates) : []; if (itemUpdates.length && !itemResults.every(Boolean)) { if (balanceOriginals.length) await db.update(dataTable('inventory_warehouse_balances', wc.workspaceId), balanceOriginals); const rollback = itemOriginals.filter((_, index) => itemResults[index]); if (rollback.length) await db.update(dataTable('inventory_items', wc.workspaceId), rollback); return error('Reversal Stok Opname gagal mengembalikan stok total.', 500); } if (existing.journalId) await db.delete(dataTable('manual_journals', wc.workspaceId), [existing.journalId]); const record: InventoryStocktakeRecord = { ...existing, status: 'REVERSED', reversedAt: now(), reversedBy: actor, updatedBy: actor, updatedAt: now() }; const [ok] = await db.update(table, [{ id: ctx.params.id, record }]); if (!ok) { if (balanceOriginals.length) await db.update(dataTable('inventory_warehouse_balances', wc.workspaceId), balanceOriginals); if (itemOriginals.length) await db.update(dataTable('inventory_items', wc.workspaceId), itemOriginals); return error('Stok dikembalikan tetapi status reversal gagal diperbarui.', 500); } return json({ id: ctx.params.id, ...record });
    },
  ],
  'GET /api/bootstrap': [
    requireAuth(),
    async ctx => {
      const wc = await workspaceContext(ctx.user!);
      const [kebunResult, accounts, transactions, mills, harvesters, vehicles, ratesResult, tbsResult, tbsPaymentsResult, tbsCostPaymentsResult, suppliersResult, supplierBillsResult, supplierPaymentsResult, workTypesResult, workRatesResult, workEntriesResult, employeeReceivablesResult, payrollManualResult, payrollRunsResult] = await Promise.all([
        db.list<KebunRecord>(dataTable('kebun', wc.workspaceId), { limit: 100 }),
        db.list<AccountRecord>(dataTable('accounts', wc.workspaceId), { limit: 100 }),
        db.list<TransactionRecord>(dataTable('transactions', wc.workspaceId), { limit: 250 }),
        db.list<MillRecord>(dataTable('mills', wc.workspaceId), { limit: 100 }),
        db.list<HarvesterRecord>(dataTable('harvesters', wc.workspaceId), { limit: 200 }),
        db.list<VehicleRecord>(dataTable('vehicles', wc.workspaceId), { limit: 100 }),
        db.list<TbsRateRecord>(dataTable('rates', wc.workspaceId), { limit: 200 }),
        db.list<TbsRecord>(dataTable('tbs', wc.workspaceId), { limit: 500 }),
        db.list<TbsPaymentRecord>(dataTable('tbs_payments', wc.workspaceId), { limit: 500 }),
        db.list<TbsCostPaymentRecord>(dataTable('tbs_cost_payments', wc.workspaceId), { limit: 500 }),
        db.list<SupplierRecord>(dataTable('suppliers', wc.workspaceId), { limit: 300 }),
        db.list<SupplierBillRecord>(dataTable('supplier_bills', wc.workspaceId), { limit: 500 }),
        db.list<SupplierPaymentRecord>(dataTable('supplier_payments', wc.workspaceId), { limit: 500 }),
        db.list<WorkTypeRecord>(dataTable('work_types', wc.workspaceId), { limit: 300 }),
        db.list<WorkRateRecord>(dataTable('work_rates', wc.workspaceId), { limit: 500 }),
        db.list<WorkEntryRecord>(dataTable('work_entries', wc.workspaceId), { limit: 500 }),
        db.list<EmployeeReceivableRecord>(dataTable('employee_receivables', wc.workspaceId), { limit: 500 }),
        db.list<PayrollManualRecord>(dataTable('payroll_manual', wc.workspaceId), { limit: 500 }),
        db.list<PayrollRunRecord>(dataTable('payroll_runs', wc.workspaceId), { limit: 500 }),
      ]);
      const accountingSettings = await loadAccountingSettings(wc.workspaceId);
      const visibleKebunIds = wc.membership.role === 'ADMIN_KEBUN'
        ? new Set(wc.membership.assignedKebunIds)
        : null;
      const kebun = visibleKebunIds
        ? kebunResult.items.filter(item => visibleKebunIds.has(item.id))
        : kebunResult.items;
      const visibleTransactions = wc.membership.role === 'ADMIN_KEBUN'
        ? transactions.items.map(tx => projectTransactionForMembership(tx, wc.membership)).filter((tx): tx is (typeof transactions.items)[number] => Boolean(tx))
        : transactions.items;
      const visibleRates = visibleKebunIds
        ? ratesResult.items.filter(item => visibleKebunIds.has(item.kebunId))
        : ratesResult.items;
      const visibleTbs = visibleKebunIds
        ? tbsResult.items.filter(item => visibleKebunIds.has(item.kebunId))
        : tbsResult.items;
      const visiblePayments = visibleKebunIds
        ? tbsPaymentsResult.items
            .map(payment => {
              const allocations = (payment.allocations || []).filter(item => visibleKebunIds.has(item.kebunId));
              return {
                ...payment,
                allocations,
                amount: allocations.reduce((sum, item) => sum + item.amount, 0),
                transactionIds: [],
              };
            })
            .filter(payment => payment.allocations.length > 0)
        : tbsPaymentsResult.items;
      const visibleCostPayments = visibleKebunIds
        ? tbsCostPaymentsResult.items
            .map(payment => {
              const allocations = (payment.allocations || []).filter(item => visibleKebunIds.has(item.kebunId));
              return {
                ...payment,
                allocations,
                amount: allocations.reduce((sum, item) => sum + item.amount, 0),
                transactionIds: [],
              };
            })
            .filter(payment => payment.allocations.length > 0)
        : tbsCostPaymentsResult.items;
      const visibleSupplierBills = visibleKebunIds
        ? supplierBillsResult.items.filter(item => visibleKebunIds.has(item.kebunId))
        : supplierBillsResult.items;
      const visibleSupplierPayments = visibleKebunIds
        ? supplierPaymentsResult.items
            .map(payment => {
              const allocations = (payment.allocations || []).filter(item => visibleKebunIds.has(item.kebunId));
              return {
                ...payment,
                allocations,
                amount: allocations.reduce((sum, item) => sum + item.amount, 0),
                transactionIds: [],
              };
            })
            .filter(payment => payment.allocations.length > 0)
        : supplierPaymentsResult.items;
      const visibleWorkRates = visibleKebunIds
        ? workRatesResult.items.filter(item => visibleKebunIds.has(item.kebunId))
        : workRatesResult.items;
      const visibleWorkEntries = visibleKebunIds
        ? workEntriesResult.items.filter(item => visibleKebunIds.has(item.kebunId))
        : workEntriesResult.items;
      const visiblePayrollManual = visibleKebunIds
        ? payrollManualResult.items.filter(item => visibleKebunIds.has(item.kebunId))
        : payrollManualResult.items;
      const visiblePayrollRuns = visibleKebunIds
        ? payrollRunsResult.items
            .map(run => {
              const lines = (run.lines || []).filter(line => visibleKebunIds.has(line.kebunId));
              const totals = payrollTotals(lines);
              return { ...run, ...totals, lines, transactionIds: [] };
            })
            .filter(run => run.lines.length > 0)
        : payrollRunsResult.items;
      const workspaceSummaries = wc.memberships.map(item => ({
        id: item.workspaceId,
        name: item.workspaceName,
        role: item.role,
        assignedKebunIds: item.assignedKebunIds,
      }));
      let members: Array<MemberRecord & { id: string }> = [];
      let invites: Array<InviteRecord & { id: string; code: string }> = [];
      if (wc.membership.role === 'OWNER' || wc.membership.role === 'ADMIN_PUSAT') {
        members = (await db.list<MemberRecord>(membersTable(wc.workspaceId), { limit: 100 })).items;
      }
      if (wc.membership.role === 'OWNER') {
        const rows = (await db.list<InviteRecord>(invitesTable(wc.workspaceId), { limit: 50 })).items;
        invites = rows.map(item => ({ ...item, code: `${wc.workspaceId}:${item.id}` }));
      }
      return json({
        workspace: {
          id: wc.workspaceId,
          name: wc.workspaceName,
          role: wc.membership.role,
          assignedKebunIds: wc.membership.assignedKebunIds,
          restrictedBalances: wc.membership.role === 'ADMIN_KEBUN',
        },
        workspaces: workspaceSummaries,
        members,
        invites,
        kebun,
        accounts: accounts.items,
        transactions: visibleTransactions,
        transactionsNextToken: transactions.nextToken || '',
        accountingCutoffDate: accountingSettings?.openingPosted ? accountingSettings.conversionDate : '',
        accountingOpeningPosted: accountingSettings?.openingPosted === true,
        mills: mills.items,
        harvesters: harvesters.items,
        vehicles: vehicles.items,
        tbsRates: visibleRates,
        tbs: visibleTbs,
        tbsPayments: visiblePayments,
        tbsCostPayments: visibleCostPayments,
        suppliers: suppliersResult.items,
        supplierBills: visibleSupplierBills,
        supplierPayments: visibleSupplierPayments,
        workTypes: workTypesResult.items,
        workRates: visibleWorkRates,
        workEntries: visibleWorkEntries,
        employeeReceivables: canManagePayroll(wc.membership.role) ? employeeReceivablesResult.items : [],
        payrollManual: visiblePayrollManual,
        payrollRuns: visiblePayrollRuns,
      });
    },
  ],
  'GET /api/transactions-page': [
    requireAuth(),
    async ctx => {
      const wc = await workspaceContext(ctx.user!);
      const nextToken = text(ctx.query.nextToken);
      if (!nextToken) return json({ transactions: [], nextToken: '' });
      const page = await db.list<TransactionRecord>(dataTable('transactions', wc.workspaceId), { limit: 250, nextToken });
      const visibleKebunIds = wc.membership.role === 'ADMIN_KEBUN' ? new Set(wc.membership.assignedKebunIds) : null;
      const transactions = wc.membership.role === 'ADMIN_KEBUN'
        ? page.items.map(tx => projectTransactionForMembership(tx, wc.membership)).filter((tx): tx is (typeof page.items)[number] => Boolean(tx))
        : page.items;
      return json({ transactions, nextToken: page.nextToken || '' });
    },
  ],
  'GET /api/workspace/profile': [
    requireAuth(),
    async ctx => {
      const wc = await workspaceContext(ctx.user!);
      const rows = (await db.list<WorkspaceMeta>(metaTable(wc.workspaceId), { limit: 1 })).items;
      const meta = rows[0];
      return json({
        profile: {
          name: meta?.name || wc.membership.workspaceName,
          shortName: meta?.shortName || '',
          businessType: meta?.businessType || '',
          npwp: meta?.npwp || '',
          nib: meta?.nib || '',
          address: meta?.address || '',
          village: meta?.village || '',
          district: meta?.district || '',
          city: meta?.city || '',
          province: meta?.province || '',
          postalCode: meta?.postalCode || '',
          phone: meta?.phone || '',
          email: meta?.email || '',
          website: meta?.website || '',
          picName: meta?.picName || '',
          picPosition: meta?.picPosition || '',
          fiscalYearStartMonth: Number(meta?.fiscalYearStartMonth || 1),
          currency: meta?.currency || 'IDR',
          reportName: meta?.reportName || meta?.name || wc.membership.workspaceName,
          logoUrl: meta?.logoUrl || '',
        },
        canEdit: canManageMaster(wc.membership.role),
      });
    },
  ],
  'PUT /api/workspace/profile': [
    requireAuth(),
    async ctx => {
      const wc = await workspaceContext(ctx.user!);
      if (!canManageMaster(wc.membership.role)) return error('Hanya Owner/Admin Pusat yang dapat mengubah Profil Perusahaan.', 403);
      const body = objectBody(ctx.body);
      const name = text(body.name).trim().slice(0, 120);
      if (name.length < 2) return error('Nama perusahaan minimal 2 karakter.', 400);
      const month = Math.max(1, Math.min(12, Math.floor(decimal(body.fiscalYearStartMonth) || 1)));
      const table = metaTable(wc.workspaceId);
      const rows = (await db.list<WorkspaceMeta>(table, { limit: 1 })).items;
      const existing = rows[0];
      const stamp = now();
      const profile: WorkspaceMeta = {
        name,
        ownerUserId: existing?.ownerUserId || ctx.user!.userId,
        createdAt: existing?.createdAt || stamp,
        updatedAt: stamp,
        shortName: text(body.shortName).slice(0, 80),
        businessType: text(body.businessType).slice(0, 40),
        npwp: text(body.npwp).slice(0, 40),
        nib: text(body.nib).slice(0, 60),
        address: text(body.address).slice(0, 500),
        village: text(body.village).slice(0, 100),
        district: text(body.district).slice(0, 100),
        city: text(body.city).slice(0, 100),
        province: text(body.province).slice(0, 100),
        postalCode: text(body.postalCode).slice(0, 12),
        phone: text(body.phone).slice(0, 40),
        email: text(body.email).slice(0, 160),
        website: text(body.website).slice(0, 200),
        picName: text(body.picName).slice(0, 120),
        picPosition: text(body.picPosition).slice(0, 120),
        fiscalYearStartMonth: month,
        currency: text(body.currency).slice(0, 8) || 'IDR',
        reportName: text(body.reportName).slice(0, 160) || name,
        logoUrl: text(body.logoUrl).slice(0, 500),
      };

      if (existing?.id) {
        const [ok] = await db.update(table, [{ id: existing.id, record: profile }]);
        if (!ok) return error('Profil Perusahaan gagal diperbarui.', 500);
      } else {
        const [id] = await db.add(table, [profile]);
        if (!id) return error('Profil Perusahaan gagal disimpan.', 500);
      }

      const members = (await db.list<MemberRecord>(membersTable(wc.workspaceId), { limit: 100 })).items;
      for (const member of members) {
        const membershipTable = membershipsTable(member.userId);
        const memberships = (await db.list<MembershipRecord>(membershipTable, { limit: 100 })).items;
        const target = memberships.find(item => item.workspaceId === wc.workspaceId);
        if (!target?.id || target.workspaceName === name) continue;
        const { id, ...record } = target;
        await db.update(membershipTable, [{ id, record: { ...record, workspaceName: name } }]);
      }

      return json({ profile });
    },
  ],
  'POST /api/workspace/delete': [
    requireAuth(),
    async ctx => {
      const wc = await workspaceContext(ctx.user!);
      if (wc.membership.role !== 'OWNER') return error('Hanya Owner yang dapat menghapus perusahaan.', 403);
      if (wc.memberships.length <= 1) {
        return error('Perusahaan terakhir tidak dapat dihapus. Buat atau gabung ke perusahaan lain terlebih dahulu.', 409);
      }

      const metaRows = (await db.list<WorkspaceMeta>(metaTable(wc.workspaceId), { limit: 1 })).items;
      const companyName = (metaRows[0]?.name || wc.workspaceName).trim();
      const body = objectBody(ctx.body);
      const confirmationName = text(body.confirmationName);
      if (!confirmationName || confirmationName !== companyName) {
        return error('Nama perusahaan untuk konfirmasi belum sesuai.', 400);
      }

      const result = await backupAndDeleteWorkspace(wc.workspaceId, {
        workspaceName: companyName,
        deletedBy: ctx.user!.userId,
      });

      return json({
        deleted: true,
        workspaceId: wc.workspaceId,
        workspaceName: companyName,
        deletedCount: result.deletedCount,
      });
    },
  ],

/* v4.15 company deletion */

  'POST /api/workspace/create': [
    requireAuth(),
    async ctx => {
      const body = objectBody(ctx.body);
      const workspaceName = text(body.name).trim().slice(0, 120);
      if (workspaceName.length < 2) return error('Nama perusahaan minimal 2 karakter.', 400);

      const membershipKey = membershipsTable(ctx.user!.userId);
      const memberships = (await db.list<MembershipRecord>(membershipKey, { limit: 100 })).items;
      if (memberships.length >= 100) return error('Maksimal 100 perusahaan dapat diakses oleh satu akun.', 409);
      if (memberships.some(item => item.workspaceName.trim().toLowerCase() === workspaceName.toLowerCase())) {
        return error('Perusahaan dengan nama tersebut sudah ada pada akses Anda.', 409);
      }

      const workspaceId = 'ws-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 10);
      const stamp = now();
      const membership: MembershipRecord = {
        workspaceId,
        workspaceName,
        role: 'OWNER',
        assignedKebunIds: [],
        joinedAt: stamp,
      };

      const [membershipId] = await db.add(membershipKey, [membership]);
      if (!membershipId) return error('Perusahaan baru gagal dibuat.', 500);

      const [metaId] = await db.add(metaTable(workspaceId), [
        { name: workspaceName, ownerUserId: ctx.user!.userId, createdAt: stamp },
      ]);
      if (!metaId) {
        await db.delete(membershipKey, [membershipId]);
        return error('Identitas perusahaan baru gagal dibuat.', 500);
      }

      const [memberId] = await db.add(membersTable(workspaceId), [{
        userId: ctx.user!.userId,
        email: ctx.user!.email || '',
        name: ctx.user!.name || ctx.user!.email || 'Owner',
        role: 'OWNER',
        assignedKebunIds: [],
        joinedAt: stamp,
      }]);
      if (!memberId) {
        await db.delete(metaTable(workspaceId), [metaId]);
        await db.delete(membershipKey, [membershipId]);
        return error('Owner perusahaan baru gagal dibuat.', 500);
      }

      try {
        await setActiveWorkspace(ctx.user!.userId, workspaceId);
      } catch (err) {
        return error(err instanceof Error ? err.message : 'Perusahaan sudah dibuat tetapi belum dapat diaktifkan.', 500);
      }

      return json({
        workspace: { id: workspaceId, name: workspaceName, role: 'OWNER', assignedKebunIds: [] },
      }, 201);
    },
  ],
  'POST /api/workspace/switch': [
    requireAuth(),
    async ctx => {
      const body = objectBody(ctx.body);
      const workspaceId = text(body.workspaceId);
      const memberships = (await db.list<MembershipRecord>(membershipsTable(ctx.user!.userId), { limit: 100 })).items;
      if (!memberships.some(item => item.workspaceId === workspaceId)) {
        return error('Anda tidak memiliki akses ke workspace tersebut.', 403);
      }
      await setActiveWorkspace(ctx.user!.userId, workspaceId);
      return json({ switched: true });
    },
  ],
  'POST /api/workspace/invites': [
    requireAuth(),
    async ctx => {
      const wc = await workspaceContext(ctx.user!);
      if (!canInvite(wc.membership.role)) return error('Hanya Owner yang dapat membuat undangan.', 403);
      const body = objectBody(ctx.body);
      const inviteRole = role(body.role);
      if (inviteRole === 'OWNER') return error('Role Owner tidak dapat diberikan melalui undangan.', 400);
      const assignedKebunIds = assignedIds(body.assignedKebunIds);
      if (inviteRole === 'ADMIN_KEBUN' && assignedKebunIds.length === 0) {
        return error('Pilih minimal satu kebun untuk Admin Kebun.', 400);
      }
      const record: InviteRecord = {
        workspaceId: wc.workspaceId,
        workspaceName: wc.workspaceName,
        email: text(body.email).toLowerCase().slice(0, 160),
        role: inviteRole,
        assignedKebunIds,
        status: 'OPEN',
        createdAt: now(),
        createdBy: ctx.user!.email || ctx.user!.userId,
      };
      const [id] = await db.add(invitesTable(wc.workspaceId), [record]);
      if (!id) return error('Gagal membuat kode undangan.', 500);
      return json({ id, code: `${wc.workspaceId}:${id}`, ...record }, 201);
    },
  ],
  'POST /api/workspace/join': [
    requireAuth(),
    async ctx => {
      const body = objectBody(ctx.body);
      const code = text(body.code);
      const splitAt = code.indexOf(':');
      if (splitAt < 1) return error('Kode undangan tidak valid.', 400);
      const workspaceId = code.slice(0, splitAt);
      const inviteId = code.slice(splitAt + 1);
      if (!workspaceId || !inviteId) return error('Kode undangan tidak valid.', 400);
      const [invite] = await db.get<InviteRecord>(invitesTable(workspaceId), [inviteId]);
      if (!invite || invite.status !== 'OPEN') return error('Kode undangan sudah tidak aktif.', 404);
      const email = (ctx.user!.email || '').toLowerCase();
      if (invite.email && invite.email !== email) {
        return error('Undangan ini ditujukan untuk email yang berbeda.', 403);
      }
      const membershipKey = membershipsTable(ctx.user!.userId);
      const memberships = (await db.list<MembershipRecord>(membershipKey, { limit: 100 })).items;
      if (!memberships.some(item => item.workspaceId === workspaceId)) {
        const stamp = now();
        const membership: MembershipRecord = {
          workspaceId,
          workspaceName: invite.workspaceName,
          role: invite.role,
          assignedKebunIds: invite.assignedKebunIds,
          joinedAt: stamp,
        };
        const [membershipId] = await db.add(membershipKey, [membership]);
        if (!membershipId) return error('Gagal menambahkan akses workspace.', 500);
        await db.add(membersTable(workspaceId), [
          {
            userId: ctx.user!.userId,
            email: ctx.user!.email || '',
            name: ctx.user!.name || ctx.user!.email || 'Pengguna',
            role: invite.role,
            assignedKebunIds: invite.assignedKebunIds,
            joinedAt: stamp,
          },
        ]);
      }
      const updatedInvite: InviteRecord = {
        ...invite,
        status: 'USED',
        acceptedAt: now(),
        acceptedByUserId: ctx.user!.userId,
      };
      await db.update(invitesTable(workspaceId), [{ id: inviteId, record: updatedInvite }]);
      await setActiveWorkspace(ctx.user!.userId, workspaceId);
      return json({ joined: true, workspaceId, workspaceName: invite.workspaceName });
    },
  ],
  'POST /api/kebun': [
    requireAuth(),
    async ctx => {
      const wc = await workspaceContext(ctx.user!);
      if (!canManageMaster(wc.membership.role)) return error('Anda tidak memiliki akses mengubah master kebun.', 403);
      const body = objectBody(ctx.body);
      const code = text(body.code);
      const name = text(body.name);
      if (!code || !name) return error('Kode dan nama kebun wajib diisi.', 400);
      const stamp = now();
      const record: KebunRecord = {
        code: code.slice(0, 40),
        name: name.slice(0, 120),
        owner: text(body.owner).slice(0, 120),
        location: text(body.location).slice(0, 180),
        areaHa: decimal(body.areaHa),
        treeCount: Math.floor(decimal(body.treeCount)),
        status: body.status === 'NONAKTIF' ? 'NONAKTIF' : 'AKTIF',
        createdAt: stamp,
        updatedAt: stamp,
      };
      const [id] = await db.add(dataTable('kebun', wc.workspaceId), [record]);
      if (!id) return error('Gagal menambah kebun.', 500);
      return json({ id, ...record }, 201);
    },
  ],
  'PUT /api/kebun/:id': [
    requireAuth(),
    async ctx => {
      const wc = await workspaceContext(ctx.user!);
      if (!canManageMaster(wc.membership.role)) return error('Anda tidak memiliki akses mengubah master kebun.', 403);
      const body = objectBody(ctx.body);
      const code = text(body.code);
      const name = text(body.name);
      if (!code || !name) return error('Kode dan nama kebun wajib diisi.', 400);
      const key = dataTable('kebun', wc.workspaceId);
      const [existing] = await db.get<KebunRecord>(key, [ctx.params.id]);
      if (!existing) return error('Data kebun tidak ditemukan.', 404);
      const record: KebunRecord = {
        ...existing,
        code: code.slice(0, 40),
        name: name.slice(0, 120),
        owner: text(body.owner).slice(0, 120),
        location: text(body.location).slice(0, 180),
        areaHa: decimal(body.areaHa),
        treeCount: Math.floor(decimal(body.treeCount)),
        status: body.status === 'NONAKTIF' ? 'NONAKTIF' : 'AKTIF',
        updatedAt: now(),
      };
      const [ok] = await db.update(key, [{ id: ctx.params.id, record }]);
      if (!ok) return error('Gagal memperbarui kebun.', 500);
      return json({ id: ctx.params.id, ...record });
    },
  ],
  'DELETE /api/kebun/:id': [
    requireAuth(),
    async ctx => {
      const wc = await workspaceContext(ctx.user!);
      if (!canManageMaster(wc.membership.role)) return error('Anda tidak memiliki akses menghapus master kebun.', 403);
      const [txs, tbsRows, rates, supplierBills, workRates, workEntries] = await Promise.all([
        loadTransactions(wc.workspaceId),
        loadTbs(wc.workspaceId),
        db.list<TbsRateRecord>(dataTable('rates', wc.workspaceId), { limit: 200 }),
        db.list<SupplierBillRecord>(dataTable('supplier_bills', wc.workspaceId), { limit: 500 }),
        db.list<WorkRateRecord>(dataTable('work_rates', wc.workspaceId), { limit: 500 }),
        db.list<WorkEntryRecord>(dataTable('work_entries', wc.workspaceId), { limit: 500 }),
      ]);
      if (txs.some(tx => tx.kebunId === ctx.params.id)) {
        return error('Kebun masih memiliki transaksi. Hapus transaksi terkait terlebih dahulu.', 409);
      }
      if (tbsRows.some(row => row.kebunId === ctx.params.id) || rates.items.some(rate => rate.kebunId === ctx.params.id)) {
        return error('Kebun masih dipakai pada data TBS atau tarif kebun.', 409);
      }
      if (supplierBills.items.some(row => row.kebunId === ctx.params.id)) {
        return error('Kebun masih dipakai pada tagihan supplier.', 409);
      }
      if (workRates.items.some(row => row.kebunId === ctx.params.id) || workEntries.items.some(row => row.kebunId === ctx.params.id)) {
        return error('Kebun masih dipakai pada tarif atau transaksi Pekerjaan Kebun.', 409);
      }
      const [ok] = await db.delete(dataTable('kebun', wc.workspaceId), [ctx.params.id]);
      if (!ok) return error('Data kebun tidak ditemukan.', 404);
      return json({ deleted: true });
    },
  ],
  'POST /api/accounts': [
    requireAuth(),
    async ctx => {
      const wc = await workspaceContext(ctx.user!);
      if (!canManageMaster(wc.membership.role)) return error('Anda tidak memiliki akses mengubah master kas/bank.', 403);
      const body = objectBody(ctx.body);
      const name = text(body.name);
      if (!name) return error('Nama akun wajib diisi.', 400);
      const settings = await loadAccountingSettings(wc.workspaceId);
      const requestedOpening = money(body.openingBalance);
      if (settings?.openingPosted && requestedOpening > 0) return error('Saldo Awal sudah diposting. Akun Kas/Bank baru harus mulai dari Rp0 dan bergerak melalui transaksi setelah cut-off.', 409);
      const stamp = now();
      const record: AccountRecord = {
        name: name.slice(0, 120),
        type: body.type === 'BANK' ? 'BANK' : 'KAS',
        openingBalance: settings?.openingPosted ? 0 : requestedOpening,
        bankName: text(body.bankName).slice(0, 80),
        accountNumber: text(body.accountNumber).slice(0, 80),
        createdAt: stamp,
        updatedAt: stamp,
      };
      const [id] = await db.add(dataTable('accounts', wc.workspaceId), [record]);
      if (!id) return error('Gagal menambah akun.', 500);
      await ensureAccountingAccounts(wc.workspaceId, ctx.user!.email || ctx.user!.userId);
      return json({ id, ...record }, 201);
    },
  ],
  'PUT /api/accounts/:id': [
    requireAuth(),
    async ctx => {
      const wc = await workspaceContext(ctx.user!);
      if (!canManageMaster(wc.membership.role)) return error('Anda tidak memiliki akses mengubah master kas/bank.', 403);
      const body = objectBody(ctx.body);
      const name = text(body.name);
      if (!name) return error('Nama akun wajib diisi.', 400);
      const key = dataTable('accounts', wc.workspaceId);
      const [existing] = await db.get<AccountRecord>(key, [ctx.params.id]);
      if (!existing) return error('Akun tidak ditemukan.', 404);
      const settings = await loadAccountingSettings(wc.workspaceId);
      const requestedOpening = money(body.openingBalance);
      if (settings?.openingPosted && requestedOpening !== existing.openingBalance) return error('Saldo Awal Kas/Bank dikunci setelah Saldo Awal akuntansi diposting.', 409);
      const record: AccountRecord = {
        ...existing,
        name: name.slice(0, 120),
        type: body.type === 'BANK' ? 'BANK' : 'KAS',
        openingBalance: settings?.openingPosted ? existing.openingBalance : requestedOpening,
        bankName: text(body.bankName).slice(0, 80),
        accountNumber: text(body.accountNumber).slice(0, 80),
        updatedAt: now(),
      };
      const [ok] = await db.update(key, [{ id: ctx.params.id, record }]);
      if (!ok) return error('Gagal memperbarui akun.', 500);
      await ensureAccountingAccounts(wc.workspaceId, ctx.user!.email || ctx.user!.userId);
      return json({ id: ctx.params.id, ...record });
    },
  ],
  'DELETE /api/accounts/:id': [
    requireAuth(),
    async ctx => {
      const wc = await workspaceContext(ctx.user!);
      if (!canManageMaster(wc.membership.role)) return error('Anda tidak memiliki akses menghapus master kas/bank.', 403);
      const txs = await loadTransactions(wc.workspaceId);
      if (txs.some(tx => tx.accountId === ctx.params.id)) {
        return error('Akun masih memiliki transaksi. Hapus transaksi terkait terlebih dahulu.', 409);
      }
      const [ok] = await db.delete(dataTable('accounts', wc.workspaceId), [ctx.params.id]);
      if (!ok) return error('Akun tidak ditemukan.', 404);
      return json({ deleted: true });
    },
  ],
  'POST /api/transactions': [
    requireAuth(),
    requireOpenAccountingDate('date'),
    async ctx => {
      const wc = await workspaceContext(ctx.user!);
      if (!canTransact(wc.membership.role)) return error('Akses Anda hanya untuk melihat data.', 403);
      const body = objectBody(ctx.body);
      const date = text(body.date);
      const kebunId = text(body.kebunId);
      const accountId = text(body.accountId);
      const direction: 'IN' | 'OUT' = body.direction === 'IN' ? 'IN' : 'OUT';
      const rawAllocations = Array.isArray(body.allocations) ? body.allocations : [];
      if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !accountId) {
        return error('Tanggal dan Kas/Bank wajib diisi dengan benar.', 400);
      }
      if (rawAllocations.length > 50) return error('Maksimal 50 akun lawan dalam satu transaksi.', 400);
      const targetError = await validateTransactionTargets(wc.workspaceId, wc.membership, kebunId, accountId);
      if (targetError) return error(targetError, targetError.includes('akses') ? 403 : 404);
      const allocations = transactionAllocations(rawAllocations, kebunId);
      const allocationValidation = await validateTransactionAllocations(wc.workspaceId, wc.membership, allocations);
      if (allocationValidation.error) return error(allocationValidation.error, allocationValidation.error.includes('akses') ? 403 : 400);
      const amount = allocations.reduce((sum, item) => sum + item.amount, 0);
      const category = transactionAllocationCategory(allocations, allocationValidation.accounts);
      const transactionKebunId = transactionSummaryKebunId(allocations);
      const stamp = now();
      const txNumber = transactionNumber(date);
      let receipt = null;
      try {
        receipt = await writeReceipt(wc.workspaceId, txNumber, body);
      } catch (err) {
        return error(err instanceof Error ? err.message : 'Bukti transaksi gagal diunggah.', 400);
      }
      const record: TransactionRecord = {
        transactionNumber: txNumber,
        kind: 'NORMAL',
        date,
        kebunId: transactionKebunId,
        accountId,
        direction,
        category: category.slice(0, 120),
        description: text(body.description).slice(0, 500),
        amount,
        reference: text(body.reference).slice(0, 120),
        allocations,
        receiptPath: receipt?.path,
        receiptName: receipt?.name,
        receiptContentType: receipt?.contentType,
        createdBy: ctx.user!.email || ctx.user!.userId,
        updatedBy: ctx.user!.email || ctx.user!.userId,
        createdAt: stamp,
        updatedAt: stamp,
      };
      const [id] = await db.add(dataTable('transactions', wc.workspaceId), [record]);
      if (!id) {
        if (receipt?.path) await storage.delete([receipt.path]);
        return error('Gagal menyimpan transaksi.', 500);
      }
      return json({ id, ...record }, 201);
    },
  ],
  'PUT /api/transactions/:id': [
    requireAuth(),
    requireOpenAccountingDate('date'),
    async ctx => {
      const wc = await workspaceContext(ctx.user!);
      if (!canTransact(wc.membership.role)) return error('Akses Anda hanya untuk melihat data.', 403);
      const key = dataTable('transactions', wc.workspaceId);
      const [existing] = await db.get<TransactionRecord>(key, [ctx.params.id]);
      if (!existing) return error('Transaksi tidak ditemukan.', 404);
      const existingPeriodError = await accountingDateWriteError(wc.workspaceId, existing.date);
      if (existingPeriodError) return error(existingPeriodError, 409);
      if (existing.kind === 'TRANSFER') return error('Transfer antar akun tidak diedit dari form transaksi.', 409);
      if (existing.sourceType === 'TBS_PAYMENT') return error('Penerimaan PKS dikelola dari menu Piutang & Pembayaran TBS.', 409);
      if (existing.sourceType === 'TBS_COST_PAYMENT') return error('Pembayaran hutang operasional versi lama tidak dapat diedit dari Transaksi.', 409);
      if (existing.sourceType === 'SUPPLIER_PAYMENT') return error('Pembayaran supplier dikelola dari menu Pembelian > Pembayaran.', 409);
      if (existing.sourceType === 'PAYROLL_PAYMENT') return error('Pembayaran payroll dikelola dari menu Payroll Kebun.', 409);
      if (existing.sourceType === 'EMPLOYEE_RECEIVABLE_DISBURSEMENT') return error('Pencairan Piutang Karyawan dikelola dari menu Piutang Karyawan.', 409);
      if (existing.sourceType === 'PURCHASE_INVOICE') return error('Pembelian tunai dikelola dari menu Pembelian.', 409);
      if (!transactionAccessibleToMembership(existing, wc.membership)) return error('Transaksi ini di luar akses kebun Anda.', 403);
      const body = objectBody(ctx.body);
      const date = text(body.date);
      const kebunId = text(body.kebunId);
      const accountId = text(body.accountId);
      const direction: 'IN' | 'OUT' = body.direction === 'IN' ? 'IN' : 'OUT';
      const rawAllocations = Array.isArray(body.allocations) ? body.allocations : [];
      if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !accountId) {
        return error('Tanggal dan Kas/Bank wajib diisi dengan benar.', 400);
      }
      if (rawAllocations.length > 50) return error('Maksimal 50 akun lawan dalam satu transaksi.', 400);
      const targetError = await validateTransactionTargets(wc.workspaceId, wc.membership, kebunId, accountId);
      if (targetError) return error(targetError, targetError.includes('akses') ? 403 : 404);
      const allocations = transactionAllocations(rawAllocations, kebunId);
      const allocationValidation = await validateTransactionAllocations(wc.workspaceId, wc.membership, allocations);
      if (allocationValidation.error) return error(allocationValidation.error, allocationValidation.error.includes('akses') ? 403 : 400);
      const amount = allocations.reduce((sum, item) => sum + item.amount, 0);
      const category = transactionAllocationCategory(allocations, allocationValidation.accounts);
      const transactionKebunId = transactionSummaryKebunId(allocations);
      const txNumber = existing.transactionNumber || transactionNumber(date);
      let nextReceiptPath = existing.receiptPath;
      let nextReceiptName = existing.receiptName;
      let nextReceiptContentType = existing.receiptContentType;
      let newReceiptPath = '';
      try {
        const receipt = await writeReceipt(wc.workspaceId, txNumber, body);
        if (receipt) {
          nextReceiptPath = receipt.path;
          nextReceiptName = receipt.name;
          nextReceiptContentType = receipt.contentType;
          newReceiptPath = receipt.path;
        } else if (body.removeReceipt === true) {
          nextReceiptPath = undefined;
          nextReceiptName = undefined;
          nextReceiptContentType = undefined;
        }
      } catch (err) {
        return error(err instanceof Error ? err.message : 'Bukti transaksi gagal diunggah.', 400);
      }
      const record: TransactionRecord = {
        ...existing,
        transactionNumber: txNumber,
        kind: 'NORMAL',
        date,
        kebunId: transactionKebunId,
        accountId,
        direction,
        category: category.slice(0, 120),
        description: text(body.description).slice(0, 500),
        amount,
        reference: text(body.reference).slice(0, 120),
        allocations,
        receiptPath: nextReceiptPath,
        receiptName: nextReceiptName,
        receiptContentType: nextReceiptContentType,
        updatedBy: ctx.user!.email || ctx.user!.userId,
        updatedAt: now(),
      };
      const [ok] = await db.update(key, [{ id: ctx.params.id, record }]);
      if (!ok) {
        if (newReceiptPath) await storage.delete([newReceiptPath]);
        return error('Gagal memperbarui transaksi.', 500);
      }
      if (existing.receiptPath && existing.receiptPath !== nextReceiptPath) {
        await storage.delete([existing.receiptPath]);
      }
      return json({ id: ctx.params.id, ...record });
    },
  ],
  'DELETE /api/transactions/:id': [
    requireAuth(),
    async ctx => {
      const wc = await workspaceContext(ctx.user!);
      if (!canTransact(wc.membership.role)) return error('Akses Anda hanya untuk melihat data.', 403);
      const key = dataTable('transactions', wc.workspaceId);
      const [existing] = await db.get<TransactionRecord>(key, [ctx.params.id]);
      if (!existing) return error('Transaksi tidak ditemukan.', 404);
      const periodError = await accountingDateWriteError(wc.workspaceId, existing.date);
      if (periodError) return error(periodError, 409);
      if (existing.kind === 'TRANSFER') return error('Gunakan penghapusan transfer agar kedua sisi terhapus bersamaan.', 409);
      if (existing.sourceType === 'TBS_PAYMENT') return error('Penerimaan PKS harus dihapus dari menu Piutang & Pembayaran TBS.', 409);
      if (existing.sourceType === 'TBS_COST_PAYMENT') return error('Pembayaran hutang operasional versi lama tidak dapat dihapus dari Transaksi.', 409);
      if (existing.sourceType === 'SUPPLIER_PAYMENT') return error('Pembayaran supplier harus dihapus dari menu Pembelian > Pembayaran.', 409);
      if (existing.sourceType === 'PAYROLL_PAYMENT') return error('Pembayaran payroll harus dibatalkan dari menu Payroll Kebun.', 409);
      if (existing.sourceType === 'EMPLOYEE_RECEIVABLE_DISBURSEMENT') return error('Pencairan Piutang Karyawan harus dikelola dari menu Piutang Karyawan.', 409);
      if (existing.sourceType === 'PURCHASE_INVOICE') return error('Pembelian tunai harus dikelola dari menu Pembelian.', 409);
      if (!transactionAccessibleToMembership(existing, wc.membership)) return error('Transaksi ini di luar akses kebun Anda.', 403);
      const [ok] = await db.delete(key, [ctx.params.id]);
      if (!ok) return error('Transaksi tidak ditemukan.', 404);
      if (existing.receiptPath) await storage.delete([existing.receiptPath]);
      return json({ deleted: true });
    },
  ],
  'GET /api/transactions/:id/receipt': [
    requireAuth(),
    async ctx => {
      const wc = await workspaceContext(ctx.user!);
      const [existing] = await db.get<TransactionRecord>(dataTable('transactions', wc.workspaceId), [ctx.params.id]);
      if (!existing) return error('Transaksi tidak ditemukan.', 404);
      if (!transactionAccessibleToMembership(existing, wc.membership)) return error('Bukti transaksi di luar akses Anda.', 403);
      if (!existing.receiptPath) return error('Transaksi ini belum memiliki bukti.', 404);
      const [signed] = await storage.url([existing.receiptPath]);
      if (!signed?.url) return error('Bukti belum dapat dibuka.', 500);
      return json({ url: signed.url, name: existing.receiptName || 'Bukti transaksi' });
    },
  ],
  'POST /api/transfers': [
    requireAuth(),
    requireOpenAccountingDate('date'),
    async ctx => {
      const wc = await workspaceContext(ctx.user!);
      if (!canTransfer(wc.membership.role)) return error('Role Anda tidak memiliki akses transfer antar akun.', 403);
      const body = objectBody(ctx.body);
      const date = text(body.date);
      const fromAccountId = text(body.fromAccountId);
      const toAccountId = text(body.toAccountId);
      const amount = money(body.amount);
      if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !fromAccountId || !toAccountId || amount <= 0) {
        return error('Tanggal, akun asal, akun tujuan, dan nominal wajib diisi.', 400);
      }
      if (fromAccountId === toAccountId) return error('Akun asal dan tujuan harus berbeda.', 400);
      const key = dataTable('accounts', wc.workspaceId);
      const [fromAccount, toAccount] = await db.get<AccountRecord>(key, [fromAccountId, toAccountId]);
      if (!fromAccount || !toAccount) return error('Akun kas/bank tidak ditemukan.', 404);
      const stamp = now();
      const transferId = transactionNumber(date, 'TRF');
      const reference = text(body.reference).slice(0, 120);
      const note = text(body.description).slice(0, 500);
      const actor = ctx.user!.email || ctx.user!.userId;
      const outRecord: TransactionRecord = {
        transactionNumber: transferId,
        kind: 'TRANSFER',
        transferId,
        date,
        kebunId: '',
        accountId: fromAccountId,
        direction: 'OUT',
        category: 'Transfer Antar Akun',
        description: note || `Transfer ke ${toAccount.name}`,
        amount,
        reference,
        createdBy: actor,
        updatedBy: actor,
        createdAt: stamp,
        updatedAt: stamp,
      };
      const inRecord: TransactionRecord = {
        ...outRecord,
        accountId: toAccountId,
        direction: 'IN',
        description: note || `Transfer dari ${fromAccount.name}`,
      };
      const ids = await db.add(dataTable('transactions', wc.workspaceId), [outRecord, inRecord]);
      const successIds = ids.filter((id): id is string => Boolean(id));
      if (successIds.length !== 2) {
        if (successIds.length) await db.delete(dataTable('transactions', wc.workspaceId), successIds);
        return error('Transfer gagal disimpan dengan lengkap.', 500);
      }
      return json({ transferId, ids: successIds }, 201);
    },
  ],
  'DELETE /api/transfers/:id': [
    requireAuth(),
    async ctx => {
      const wc = await workspaceContext(ctx.user!);
      if (!canTransfer(wc.membership.role)) return error('Role Anda tidak memiliki akses menghapus transfer.', 403);
      const txs = await loadTransactions(wc.workspaceId);
      const transferRows = txs.filter(tx => tx.transferId === ctx.params.id);
      const ids = transferRows.map(tx => tx.id);
      if (ids.length === 0) return error('Transfer tidak ditemukan.', 404);
      const periodError = await accountingDateWriteError(wc.workspaceId, transferRows[0].date);
      if (periodError) return error(periodError, 409);
      const results = await db.delete(dataTable('transactions', wc.workspaceId), ids);
      if (!results.every(Boolean)) return error('Transfer belum terhapus sempurna.', 500);
      return json({ deleted: true });
    },
  ],
  'POST /api/tbs-master/:kind': [
    requireAuth(),
    async ctx => {
      const wc = await workspaceContext(ctx.user!);
      if (!canManageMaster(wc.membership.role)) return error('Anda tidak memiliki akses mengubah master TBS.', 403);
      const kind = masterKind(ctx.params.kind);
      if (!kind) return error('Jenis master TBS tidak valid.', 400);
      const body = objectBody(ctx.body);
      if (kind === 'rates') {
        const kebunId = text(body.kebunId);
        const [kebun] = await db.get<KebunRecord>(dataTable('kebun', wc.workspaceId), [kebunId]);
        if (!kebun) return error('Kebun untuk tarif tidak ditemukan.', 404);
      }
      if (kind === 'vehicles' && text(body.supplierId)) {
        const [supplier] = await db.get<SupplierRecord>(dataTable('suppliers', wc.workspaceId), [text(body.supplierId)]);
        if (!supplier) return error('Supplier/Vendor armada tidak ditemukan.', 404);
      }
      try {
        const record = buildTbsMasterRecord(kind, body);
        const [id] = await db.add(dataTable(kind, wc.workspaceId), [record]);
        if (!id) return error('Master TBS gagal disimpan.', 500);
        return json({ id, ...record }, 201);
      } catch (err) {
        return error(err instanceof Error ? err.message : 'Master TBS tidak valid.', 400);
      }
    },
  ],
  'PUT /api/tbs-master/:kind/:id': [
    requireAuth(),
    async ctx => {
      const wc = await workspaceContext(ctx.user!);
      if (!canManageMaster(wc.membership.role)) return error('Anda tidak memiliki akses mengubah master TBS.', 403);
      const kind = masterKind(ctx.params.kind);
      if (!kind) return error('Jenis master TBS tidak valid.', 400);
      const key = dataTable(kind, wc.workspaceId);
      const [existing] = await db.get<TbsMasterRecord>(key, [ctx.params.id]);
      if (!existing) return error('Master TBS tidak ditemukan.', 404);
      const body = objectBody(ctx.body);
      if (kind === 'rates') {
        const kebunId = text(body.kebunId);
        const [kebun] = await db.get<KebunRecord>(dataTable('kebun', wc.workspaceId), [kebunId]);
        if (!kebun) return error('Kebun untuk tarif tidak ditemukan.', 404);
      }
      if (kind === 'vehicles' && text(body.supplierId)) {
        const [supplier] = await db.get<SupplierRecord>(dataTable('suppliers', wc.workspaceId), [text(body.supplierId)]);
        if (!supplier) return error('Supplier/Vendor armada tidak ditemukan.', 404);
      }
      try {
        const record = buildTbsMasterRecord(kind, body, existing);
        if (kind === 'vehicles') {
          const oldVehicle = existing as VehicleRecord;
          const newVehicle = record as VehicleRecord;
          if ((oldVehicle.supplierId || '') !== (newVehicle.supplierId || '')) {
            const rows = (await loadTbs(wc.workspaceId)).filter(row => row.vehicleId === ctx.params.id && row.armadaSupplierBillId);
            const payments = await loadSupplierPayments(wc.workspaceId);
            if (rows.some(row => row.armadaSupplierBillId && paidAmountForSupplierBill(payments, row.armadaSupplierBillId) > 0)) {
              return error('Supplier/Vendor armada tidak dapat diubah karena sudah ada hutang sewa yang dibayar.', 409);
            }
          }
        }
        const [ok] = await db.update(key, [{ id: ctx.params.id, record }]);
        if (!ok) return error('Master TBS gagal diperbarui.', 500);
        if (kind === 'vehicles') {
          try {
            await syncVehicleArmadaBills(wc.workspaceId, ctx.params.id, record as VehicleRecord, ctx.user!.email || ctx.user!.userId);
          } catch (syncErr) {
            await db.update(key, [{ id: ctx.params.id, record: existing }]);
            return error(syncErr instanceof Error ? syncErr.message : 'Sinkronisasi hutang armada gagal.', 409);
          }
        }
        return json({ id: ctx.params.id, ...record });
      } catch (err) {
        return error(err instanceof Error ? err.message : 'Master TBS tidak valid.', 400);
      }
    },
  ],
  'DELETE /api/tbs-master/:kind/:id': [
    requireAuth(),
    async ctx => {
      const wc = await workspaceContext(ctx.user!);
      if (!canManageMaster(wc.membership.role)) return error('Anda tidak memiliki akses menghapus master TBS.', 403);
      const kind = masterKind(ctx.params.kind);
      if (!kind) return error('Jenis master TBS tidak valid.', 400);
      if (kind !== 'rates') {
        const rows = await loadTbs(wc.workspaceId);
        const used = rows.some(row =>
          kind === 'mills'
            ? row.millId === ctx.params.id
            : kind === 'harvesters'
              ? row.harvesterId === ctx.params.id || row.langsirWorkerId === ctx.params.id
              : row.vehicleId === ctx.params.id
        );
        if (used) return error('Master masih dipakai pada data TBS dan belum dapat dihapus.', 409);
        if (kind === 'harvesters') {
          const [manualRows, payrollRuns, workEntries, employeeReceivables] = await Promise.all([
            loadPayrollManual(wc.workspaceId),
            loadPayrollRuns(wc.workspaceId),
            loadWorkEntries(wc.workspaceId),
            loadEmployeeReceivables(wc.workspaceId),
          ]);
          if (manualRows.some(row => row.workerId === ctx.params.id) || payrollRuns.some(run => run.workerId === ctx.params.id) || workEntries.some(row => row.workerId === ctx.params.id) || employeeReceivables.some(row => row.workerId === ctx.params.id)) {
            return error('Tenaga kerja masih dipakai pada Payroll, Pekerjaan Kebun, atau Piutang Karyawan dan belum dapat dihapus.', 409);
          }
        }
      }
      const [ok] = await db.delete(dataTable(kind, wc.workspaceId), [ctx.params.id]);
      if (!ok) return error('Master TBS tidak ditemukan.', 404);
      return json({ deleted: true });
    },
  ],
  'POST /api/tbs/batch': [
    requireAuth(),
    requireOpenAccountingDate('date'),
    async ctx => {
      const wc = await workspaceContext(ctx.user!);
      if (!canTransact(wc.membership.role)) return error('Akses Anda hanya untuk melihat data.', 403);
      const body = objectBody(ctx.body);
      const date = text(body.date);
      const doNumber = text(body.doNumber).toUpperCase();
      const millId = text(body.millId);
      const vehicleId = text(body.vehicleId);
      const mode = transportMode(body.transportMode);
      const transportRate = money(body.transportRate);
      const note = text(body.note).slice(0, 500);
      const rawDetails = Array.isArray(body.details) ? body.details : [];
      if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !doNumber || !millId || !vehicleId || rawDetails.length === 0) {
        return error('Tanggal, nomor DO, pabrik, armada, dan minimal satu rincian kebun wajib diisi.', 400);
      }
      if (rawDetails.length > 20) return error('Maksimal 20 rincian timbang dalam satu pengiriman.', 400);
      const existingRows = await loadTbs(wc.workspaceId);
      const sameNumberRows = existingRows.filter(row => normalizedDoNumber(row.doNumber) === doNumber);
      if (sameNumberRows.some(row => row.millId !== millId)) return error('Nomor DO yang sama harus menuju Pabrik / PKS yang sama.', 409);
      if (sameNumberRows.some(row => row.factoryWeightKg > 0)) return error('DO ini sudah diproses timbangan pabrik dan tidak dapat ditambah.', 409);
      if (sameNumberRows.length > 0) return error('No. DO ini sudah memiliki Timbangan Lapangan. Koreksi dari daftar riwayat atau gunakan No. DO baru.', 409);
      const prepared: Array<{ detail: Record<string, unknown>; calculations: ReturnType<typeof tbsCalculations>; kebunId: string; harvesterId: string; langsirWorkerId: string }> = [];
      for (const raw of rawDetails) {
        const detail = objectBody(raw);
        const kebunId = text(detail.kebunId);
        const harvesterId = text(detail.harvesterId);
        const langsirWorkerId = text(detail.langsirWorkerId) || harvesterId;
        const calculations = tbsCalculations({ ...detail, transportMode: mode, transportRate, factoryWeightKg: 0, pricePerKg: 0, deductions: 0 });
        if (!kebunId || !harvesterId || calculations.fieldWeightKg <= 0) return error('Setiap rincian wajib memiliki kebun, pemanen, dan berat lapangan.', 400);
        const refError = await validateTbsReferences(wc.workspaceId, wc.membership, kebunId, millId, harvesterId, vehicleId);
        if (refError) return error(refError, refError.includes('akses') ? 403 : 404);
        if (langsirWorkerId !== harvesterId) {
          const [langsirWorker] = await db.get<HarvesterRecord>(dataTable('harvesters', wc.workspaceId), [langsirWorkerId]);
          if (!langsirWorker) return error('Pekerja langsir pada salah satu rincian tidak ditemukan.', 404);
        }
        prepared.push({ detail, calculations, kebunId, harvesterId, langsirWorkerId });
      }
      const weights = prepared.map(item => item.calculations.fieldWeightKg);
      const tripParts = mode === 'TRIP' ? allocateProportional(transportRate, weights) : weights.map(() => transportRate);
      const actor = ctx.user!.email || ctx.user!.userId;
      const stamp = now();
      const records: TbsRecord[] = prepared.map((item, index) => {
        const calculations = mode === 'TRIP'
          ? tbsCalculations({ ...item.detail, transportMode: mode, transportRate: tripParts[index], factoryWeightKg: 0, pricePerKg: 0, deductions: 0 })
          : item.calculations;
        return {
          date,
          factoryDate: '',
          doNumber: doNumber.slice(0, 80),
          kebunId: item.kebunId,
          millId,
          harvesterId: item.harvesterId,
          langsirWorkerId: item.langsirWorkerId,
          vehicleId,
          fieldWeightKg: calculations.fieldWeightKg,
          factoryWeightKg: 0,
          factoryTicketNumber: '',
          pricePerKg: 0,
          deductions: 0,
          harvestRatePerKg: calculations.harvestRatePerKg,
          harvestWeightBasis: calculations.harvestWeightBasis,
          weighingRatePerKg: calculations.weighingRatePerKg,
          weighingWeightBasis: calculations.weighingWeightBasis,
          weighingCost: calculations.weighingCost,
          langsirRatePerKg: calculations.langsirRatePerKg,
          langsirWeightBasis: calculations.langsirWeightBasis,
          transportMode: calculations.transportMode,
          transportRate: calculations.transportRate,
          harvestCost: calculations.harvestCost,
          langsirCost: calculations.langsirCost,
          transportCost: calculations.transportCost,
          grossRevenue: 0,
          netRevenue: 0,
          directCost: calculations.directCost,
          margin: -calculations.directCost,
          weightDifferenceKg: 0,
          weightDifferencePct: 0,
          status: 'LAPANGAN',
          note,
          createdBy: actor,
          updatedBy: actor,
          createdAt: stamp,
          updatedAt: stamp,
        };
      });
      const ids = await db.add(dataTable('tbs', wc.workspaceId), records);
      const createdIds = ids.filter((id): id is string => Boolean(id));
      if (createdIds.length !== records.length) {
        if (createdIds.length) await db.delete(dataTable('tbs', wc.workspaceId), createdIds);
        return error('Sebagian rincian Timbangan Lapangan gagal disimpan. Tidak ada data batch yang dipertahankan.', 500);
      }
      const linkedRows: Array<{ id: string; record: TbsRecord }> = [];
      const createdBillIds: string[] = [];
      try {
        for (let index = 0; index < createdIds.length; index += 1) {
          const id = createdIds[index];
          const record = records[index];
          const synced = await syncArmadaSupplierBill(wc.workspaceId, id, record, actor);
          if (synced.armadaSupplierBillId) createdBillIds.push(synced.armadaSupplierBillId);
          if (synced.armadaSupplierBillId !== record.armadaSupplierBillId) {
            const [linked] = await db.update(dataTable('tbs', wc.workspaceId), [{ id, record: synced }]);
            if (!linked) throw new Error('Tautan hutang armada gagal disimpan pada salah satu kebun.');
          }
          linkedRows.push({ id, record: synced });
        }
      } catch (syncErr) {
        if (createdBillIds.length) await db.delete(dataTable('supplier_bills', wc.workspaceId), createdBillIds);
        await db.delete(dataTable('tbs', wc.workspaceId), createdIds);
        return error(syncErr instanceof Error ? syncErr.message : 'Hutang supplier armada gagal dibuat.', 409);
      }
      return json({ created: linkedRows.length, rows: linkedRows.map(item => ({ id: item.id, ...item.record })) }, 201);
    },
  ],
  'POST /api/tbs': [
    requireAuth(),
    requireOpenAccountingDate('date'),
    async ctx => {
      const wc = await workspaceContext(ctx.user!);
      if (!canTransact(wc.membership.role)) return error('Akses Anda hanya untuk melihat data.', 403);
      const body = objectBody(ctx.body);
      const date = text(body.date);
      const doNumber = text(body.doNumber).toUpperCase();
      const kebunId = text(body.kebunId);
      const millId = text(body.millId);
      const harvesterId = text(body.harvesterId);
      const langsirWorkerId = text(body.langsirWorkerId) || harvesterId;
      const vehicleId = text(body.vehicleId);
      const calculations = tbsCalculations({ ...body, factoryWeightKg: 0, pricePerKg: 0, deductions: 0 });
      if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !doNumber || !kebunId || !millId || !harvesterId || !vehicleId || calculations.fieldWeightKg <= 0) {
        return error('Tanggal, nomor DO, kebun, pabrik, pemanen, armada, dan timbangan lapangan wajib diisi.', 400);
      }
      const refError = await validateTbsReferences(wc.workspaceId, wc.membership, kebunId, millId, harvesterId, vehicleId);
      if (refError) return error(refError, refError.includes('akses') ? 403 : 404);
      if (langsirWorkerId !== harvesterId) {
        const [langsirWorker] = await db.get<HarvesterRecord>(dataTable('harvesters', wc.workspaceId), [langsirWorkerId]);
        if (!langsirWorker) return error('Pekerja langsir tidak ditemukan.', 404);
      }
      const existingRows = await loadTbs(wc.workspaceId);
      const sameNumberRows = existingRows.filter(row => normalizedDoNumber(row.doNumber) === doNumber);
      if (sameNumberRows.some(row => row.millId !== millId)) return error('Nomor DO yang sama harus menuju Pabrik / PKS yang sama.', 409);
      if (sameNumberRows.some(row => row.factoryWeightKg > 0)) return error('DO ini sudah diproses timbangan pabrik. Timbangan lapangan baru tidak dapat ditambahkan.', 409);
      const stamp = now();
      const actor = ctx.user!.email || ctx.user!.userId;
      const record: TbsRecord = {
        date,
        factoryDate: '',
        doNumber: doNumber.slice(0, 80),
        kebunId,
        millId,
        harvesterId,
        langsirWorkerId,
        vehicleId,
        fieldWeightKg: calculations.fieldWeightKg,
        factoryWeightKg: 0,
        factoryTicketNumber: '',
        pricePerKg: 0,
        deductions: 0,
        harvestRatePerKg: calculations.harvestRatePerKg,
        harvestWeightBasis: calculations.harvestWeightBasis,
        weighingRatePerKg: calculations.weighingRatePerKg,
        weighingWeightBasis: calculations.weighingWeightBasis,
        weighingCost: calculations.weighingCost,
        langsirRatePerKg: calculations.langsirRatePerKg,
        langsirWeightBasis: calculations.langsirWeightBasis,
        transportMode: calculations.transportMode,
        transportRate: calculations.transportRate,
        harvestCost: calculations.harvestCost,
        langsirCost: calculations.langsirCost,
        transportCost: calculations.transportCost,
        grossRevenue: 0,
        netRevenue: 0,
        directCost: calculations.directCost,
        margin: -calculations.directCost,
        weightDifferenceKg: 0,
        weightDifferencePct: 0,
        status: 'LAPANGAN',
        note: text(body.note).slice(0, 500),
        createdBy: actor,
        updatedBy: actor,
        createdAt: stamp,
        updatedAt: stamp,
      };
      const [id] = await db.add(dataTable('tbs', wc.workspaceId), [record]);
      if (!id) return error('Data timbangan lapangan gagal disimpan.', 500);
      try {
        const synced = await syncArmadaSupplierBill(wc.workspaceId, id, record, actor);
        if (synced.armadaSupplierBillId !== record.armadaSupplierBillId) {
          const [linked] = await db.update(dataTable('tbs', wc.workspaceId), [{ id, record: synced }]);
          if (!linked) {
            if (synced.armadaSupplierBillId) await db.delete(dataTable('supplier_bills', wc.workspaceId), [synced.armadaSupplierBillId]);
            await db.delete(dataTable('tbs', wc.workspaceId), [id]);
            return error('DO tersimpan tetapi tautan hutang armada gagal dibuat.', 500);
          }
        }
        return json({ id, ...synced }, 201);
      } catch (syncErr) {
        await db.delete(dataTable('tbs', wc.workspaceId), [id]);
        return error(syncErr instanceof Error ? syncErr.message : 'Hutang supplier armada gagal dibuat.', 409);
      }
    },
  ],
  'PUT /api/tbs/:id': [
    requireAuth(),
    requireOpenAccountingDate('date'),
    async ctx => {
      const wc = await workspaceContext(ctx.user!);
      if (!canTransact(wc.membership.role)) return error('Akses Anda hanya untuk melihat data.', 403);
      const key = dataTable('tbs', wc.workspaceId);
      const [existing] = await db.get<TbsRecord>(key, [ctx.params.id]);
      if (!existing) return error('Data TBS tidak ditemukan.', 404);
      const existingPeriodError = await accountingDateWriteError(wc.workspaceId, existing.date);
      if (existingPeriodError) return error(existingPeriodError, 409);
      if (!canAccessKebun(wc.membership, existing.kebunId)) return error('Data TBS ini di luar akses kebun Anda.', 403);
      if (existing.factoryWeightKg > 0) return error('Timbangan lapangan pada DO yang sudah diproses pabrik dikunci. Koreksi hasil pabrik dilakukan dari menu Timbangan Pabrik.', 409);
      const body = objectBody(ctx.body);
      const date = text(body.date);
      const doNumber = text(body.doNumber).toUpperCase();
      const kebunId = text(body.kebunId);
      const millId = text(body.millId);
      const harvesterId = text(body.harvesterId);
      const langsirWorkerId = text(body.langsirWorkerId) || harvesterId;
      const vehicleId = text(body.vehicleId);
      const calculations = tbsCalculations({ ...body, factoryWeightKg: existing.factoryWeightKg, pricePerKg: existing.pricePerKg, deductions: existing.deductions });
      if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !doNumber || !kebunId || !millId || !harvesterId || !vehicleId || calculations.fieldWeightKg <= 0) {
        return error('Tanggal, nomor DO, kebun, pabrik, pemanen, armada, dan timbangan lapangan wajib diisi.', 400);
      }
      const refError = await validateTbsReferences(wc.workspaceId, wc.membership, kebunId, millId, harvesterId, vehicleId);
      if (refError) return error(refError, refError.includes('akses') ? 403 : 404);
      if (langsirWorkerId !== harvesterId) {
        const [langsirWorker] = await db.get<HarvesterRecord>(dataTable('harvesters', wc.workspaceId), [langsirWorkerId]);
        if (!langsirWorker) return error('Pekerja langsir tidak ditemukan.', 404);
      }
      const [existingRows, payments, costPayments, payrollRuns] = await Promise.all([loadTbs(wc.workspaceId), loadTbsPayments(wc.workspaceId), loadTbsCostPayments(wc.workspaceId), loadPayrollRuns(wc.workspaceId)]);
      if (payrollRunUsesTbs(payrollRuns, ctx.params.id)) return error('DO ini sudah masuk proses Payroll. Hapus payroll yang belum dibayar terlebih dahulu jika perlu koreksi data lapangan.', 409);
      const sameNumberRows = existingRows.filter(row => row.id !== ctx.params.id && normalizedDoNumber(row.doNumber) === doNumber);
      if (sameNumberRows.some(row => row.millId !== millId)) return error('Nomor DO yang sama harus menuju Pabrik / PKS yang sama.', 409);
      if (sameNumberRows.some(row => row.factoryWeightKg > 0)) return error('DO tujuan sudah diproses timbangan pabrik dan tidak dapat ditambahkan timbangan lapangan.', 409);
      const paidAmount = paidAmountForTbs(payments, ctx.params.id);
      if (paidAmount > 0 && millId !== existing.millId) return error('Pabrik tidak dapat diubah karena DO ini sudah memiliki pembayaran.', 409);
      if (calculations.netRevenue < paidAmount) return error('Nilai penjualan tidak boleh lebih kecil dari pembayaran yang sudah diterima.', 409);
      const harvestPaid = paidCostAmount(costPayments, ctx.params.id, 'PANEN');
      const langsirPaid = paidCostAmount(costPayments, ctx.params.id, 'LANGSIR');
      const armadaPaid = paidCostAmount(costPayments, ctx.params.id, 'ARMADA');
      if (harvestPaid > 0 && harvesterId !== existing.harvesterId) return error('Pemanen tidak dapat diubah karena DO ini sudah memiliki pembayaran upah panen.', 409);
      if (langsirPaid > 0 && langsirWorkerId !== (existing.langsirWorkerId || existing.harvesterId)) return error('Pekerja langsir tidak dapat diubah karena DO ini sudah memiliki pembayaran upah langsir.', 409);
      if (armadaPaid > 0 && vehicleId !== existing.vehicleId) return error('Armada tidak dapat diubah karena DO ini sudah memiliki pembayaran sewa.', 409);
      if (calculations.harvestCost < harvestPaid || calculations.langsirCost < langsirPaid || calculations.transportCost < armadaPaid) return error('Biaya DO tidak boleh lebih kecil dari pembayaran hutang yang sudah dilakukan.', 409);
      const record: TbsRecord = {
        ...existing,
        date,
        factoryDate: existing.factoryDate,
        doNumber: doNumber.slice(0, 80),
        kebunId,
        millId,
        harvesterId,
        langsirWorkerId,
        vehicleId,
        fieldWeightKg: calculations.fieldWeightKg,
        factoryWeightKg: existing.factoryWeightKg,
        factoryTicketNumber: existing.factoryTicketNumber,
        pricePerKg: existing.pricePerKg,
        deductions: existing.deductions,
        harvestRatePerKg: calculations.harvestRatePerKg,
        harvestWeightBasis: calculations.harvestWeightBasis,
        weighingRatePerKg: calculations.weighingRatePerKg,
        weighingWeightBasis: calculations.weighingWeightBasis,
        weighingCost: calculations.weighingCost,
        langsirRatePerKg: calculations.langsirRatePerKg,
        langsirWeightBasis: calculations.langsirWeightBasis,
        transportMode: calculations.transportMode,
        transportRate: calculations.transportRate,
        harvestCost: calculations.harvestCost,
        langsirCost: calculations.langsirCost,
        transportCost: calculations.transportCost,
        grossRevenue: calculations.grossRevenue,
        netRevenue: calculations.netRevenue,
        directCost: calculations.directCost,
        margin: calculations.margin,
        weightDifferenceKg: calculations.weightDifferenceKg,
        weightDifferencePct: calculations.weightDifferencePct,
        status: calculations.status,
        note: text(body.note).slice(0, 500),
        updatedBy: ctx.user!.email || ctx.user!.userId,
        updatedAt: now(),
      };
      await validateArmadaSupplierBillTarget(wc.workspaceId, record);
      const [ok] = await db.update(key, [{ id: ctx.params.id, record }]);
      if (!ok) return error('Data timbangan lapangan gagal diperbarui.', 500);
      try {
        const synced = await syncArmadaSupplierBill(wc.workspaceId, ctx.params.id, record, ctx.user!.email || ctx.user!.userId);
        if (synced.armadaSupplierBillId !== record.armadaSupplierBillId || synced.transportCost !== record.transportCost) {
          const [linked] = await db.update(key, [{ id: ctx.params.id, record: synced }]);
          if (!linked) throw new Error('Tautan hutang armada gagal diperbarui.');
        }
        return json({ id: ctx.params.id, ...synced });
      } catch (syncErr) {
        await db.update(key, [{ id: ctx.params.id, record: existing }]);
        return error(syncErr instanceof Error ? syncErr.message : 'Hutang supplier armada gagal diperbarui.', 409);
      }
    },
  ],
  'PUT /api/tbs/:id/factory': [
    requireAuth(),
    requireOpenAccountingDate('factoryDate'),
    async ctx => {
      const wc = await workspaceContext(ctx.user!);
      if (!canTransact(wc.membership.role)) return error('Akses Anda hanya untuk melihat data.', 403);
      const key = dataTable('tbs', wc.workspaceId);
      const [existing] = await db.get<TbsRecord>(key, [ctx.params.id]);
      if (!existing) return error('DO TBS tidak ditemukan.', 404);
      if (existing.factoryDate) {
        const existingPeriodError = await accountingDateWriteError(wc.workspaceId, existing.factoryDate);
        if (existingPeriodError) return error(existingPeriodError, 409);
      }
      if (!canAccessKebun(wc.membership, existing.kebunId)) return error('DO ini di luar akses kebun Anda.', 403);
      const body = objectBody(ctx.body);
      const factoryDate = text(body.factoryDate);
      const factoryBrutoWeightKg = decimal(body.factoryBrutoWeightKg ?? body.factoryGrossWeightKg ?? body.factoryWeightKg);
      const factoryTareWeightKg = decimal(body.factoryTareWeightKg);
      const factoryNet1WeightKg = Math.max(0, factoryBrutoWeightKg - factoryTareWeightKg);
      const factoryDeductionKg = decimal(body.factoryDeductionKg);
      const pricePerKg = money(body.pricePerKg);
      if (!/^\d{4}-\d{2}-\d{2}$/.test(factoryDate) || factoryBrutoWeightKg <= 0 || pricePerKg <= 0) {
        return error('Tanggal timbang pabrik, berat bruto, dan harga TBS/kg wajib diisi.', 400);
      }
      if (factoryTareWeightKg >= factoryBrutoWeightKg) {
        return error('Tara harus lebih kecil dari berat bruto.', 400);
      }
      if (factoryDeductionKg >= factoryNet1WeightKg) {
        return error('Potongan pabrik (kg) harus lebih kecil dari Netto 1.', 400);
      }
      const [allRows, payments] = await Promise.all([
        loadTbs(wc.workspaceId),
        loadTbsPayments(wc.workspaceId),
      ]);
      const groupRows = allRows.filter(row => sameDoGroup(row, existing.doNumber, existing.millId));
      if (groupRows.length === 0) return error('Kelompok DO tidak ditemukan.', 404);
      if (groupRows.some(row => !canAccessKebun(wc.membership, row.kebunId))) return error('DO ini mencakup kebun di luar akses Anda.', 403);
      const totalFieldWeight = groupRows.reduce((sum, row) => sum + row.fieldWeightKg, 0);
      if (totalFieldWeight <= 0) return error('Total timbangan lapangan DO harus lebih dari nol.', 400);

      const factoryNet2WeightKg = factoryNet1WeightKg - factoryDeductionKg;
      const factoryDeductionPct = factoryNet1WeightKg > 0
        ? (factoryDeductionKg / factoryNet1WeightKg) * 100
        : 0;
      const totalGross = Math.round(factoryNet1WeightKg * pricePerKg);
      const totalDeductionAmount = Math.round(factoryDeductionKg * pricePerKg);
      const totalNet = Math.round(factoryNet2WeightKg * pricePerKg);
      const weights = groupRows.map(row => row.fieldWeightKg);
      const brutoWeightParts = allocateProportional(factoryBrutoWeightKg, weights, 3);
      const tareWeightParts = allocateProportional(factoryTareWeightKg, weights, 3);
      const net1WeightParts = allocateProportional(factoryNet1WeightKg, weights, 3);
      const deductionKgParts = allocateProportional(factoryDeductionKg, weights, 3);
      const net2WeightParts = allocateProportional(factoryNet2WeightKg, weights, 3);
      const grossParts = allocateProportional(totalGross, weights);
      const deductionAmountParts = allocateProportional(totalDeductionAmount, weights);
      const netParts = allocateProportional(totalNet, weights);
      const actor = ctx.user!.email || ctx.user!.userId;
      const stamp = now();
      const ticket = text(body.factoryTicketNumber).slice(0, 100);
      const updates = groupRows.map((row, index) => {
        const paid = paidAmountForTbs(payments, row.id);
        if (netParts[index] < paid) {
          throw new Error(`Alokasi penjualan DO ${row.doNumber} pada salah satu kebun lebih kecil dari pembayaran yang sudah diterima.`);
        }
        const { id, ...stored } = row;
        const allocatedBrutoWeight = brutoWeightParts[index];
        const allocatedTareWeight = tareWeightParts[index];
        const allocatedNet1Weight = net1WeightParts[index];
        const allocatedDeductionKg = deductionKgParts[index];
        const allocatedNet2Weight = net2WeightParts[index];
        const grossRevenue = grossParts[index];
        const allocatedDeductionAmount = deductionAmountParts[index];
        const netRevenue = netParts[index];
        const transportCost = row.transportMode === 'TRIP'
          ? Math.round(row.transportRate)
          : row.transportMode === 'KG_LAPANGAN'
            ? Math.round(row.fieldWeightKg * row.transportRate)
            : Math.round(allocatedNet1Weight * row.transportRate);
        const harvestCost = Math.round((row.harvestWeightBasis === 'PABRIK' ? allocatedNet1Weight : row.fieldWeightKg) * row.harvestRatePerKg);
        const weighingCost = Math.round(((row.weighingWeightBasis || 'LAPANGAN') === 'PABRIK' ? allocatedNet1Weight : row.fieldWeightKg) * (row.weighingRatePerKg || 0));
        const langsirCost = Math.round((row.langsirWeightBasis === 'PABRIK' ? allocatedNet1Weight : row.fieldWeightKg) * row.langsirRatePerKg);
        const directCost = harvestCost + weighingCost + langsirCost + transportCost;
        const difference = row.fieldWeightKg - allocatedNet1Weight;
        const record: TbsRecord = {
          ...stored,
          factoryDate,
          factoryBrutoWeightKg: allocatedBrutoWeight,
          factoryTareWeightKg: allocatedTareWeight,
          factoryNet1WeightKg: allocatedNet1Weight,
          factoryGrossWeightKg: allocatedNet1Weight,
          factoryDeductionKg: allocatedDeductionKg,
          factoryDeductionPct,
          deductionAmount: allocatedDeductionAmount,
          factoryWeightKg: allocatedNet2Weight,
          factoryTicketNumber: ticket,
          pricePerKg,
          deductions: allocatedDeductionAmount,
          grossRevenue,
          netRevenue,
          harvestCost,
          weighingCost,
          langsirCost,
          transportCost,
          directCost,
          margin: netRevenue - directCost,
          weightDifferenceKg: difference,
          weightDifferencePct: row.fieldWeightKg > 0 ? (difference / row.fieldWeightKg) * 100 : 0,
          status: 'SELESAI',
          updatedBy: actor,
          updatedAt: stamp,
        };
        return { id, record };
      });
      try {
        for (const update of updates) await validateArmadaSupplierBillTarget(wc.workspaceId, update.record);
        const results = await db.update(key, updates);
        if (!results.every(Boolean)) return error('Timbangan pabrik belum tersimpan ke seluruh kebun dalam DO.', 500);
        for (const update of updates) {
          const synced = await syncArmadaSupplierBill(wc.workspaceId, update.id, update.record, actor);
          if (synced.armadaSupplierBillId !== update.record.armadaSupplierBillId || synced.transportCost !== update.record.transportCost) {
            const [linked] = await db.update(key, [{ id: update.id, record: synced }]);
            if (!linked) throw new Error('Tautan hutang supplier armada gagal disimpan.');
          }
        }
      } catch (err) {
        return error(err instanceof Error ? err.message : 'Timbangan pabrik gagal dialokasikan.', 409);
      }
      return json({
        doNumber: existing.doNumber,
        rowsUpdated: updates.length,
        fieldWeightKg: totalFieldWeight,
        factoryBrutoWeightKg,
        factoryTareWeightKg,
        factoryNet1WeightKg,
        factoryGrossWeightKg: factoryNet1WeightKg,
        factoryDeductionKg,
        factoryDeductionPct,
        factoryWeightKg: factoryNet2WeightKg,
        grossRevenue: totalGross,
        deductionAmount: totalDeductionAmount,
        deductions: totalDeductionAmount,
        netRevenue: totalNet,
      });
    },
  ],
  'DELETE /api/tbs/:id/factory': [
    requireAuth(),
    async ctx => {
      const wc = await workspaceContext(ctx.user!);
      if (!canTransact(wc.membership.role)) return error('Akses Anda hanya untuk melihat data.', 403);
      const key = dataTable('tbs', wc.workspaceId);
      const [existing] = await db.get<TbsRecord>(key, [ctx.params.id]);
      if (!existing) return error('DO TBS tidak ditemukan.', 404);
      if (existing.factoryDate) {
        const periodError = await accountingDateWriteError(wc.workspaceId, existing.factoryDate);
        if (periodError) return error(periodError, 409);
      }
      if (!canAccessKebun(wc.membership, existing.kebunId)) return error('DO ini di luar akses kebun Anda.', 403);
      const [allRows, payments, costPayments] = await Promise.all([
        loadTbs(wc.workspaceId),
        loadTbsPayments(wc.workspaceId),
        loadTbsCostPayments(wc.workspaceId),
      ]);
      const groupRows = allRows.filter(row => sameDoGroup(row, existing.doNumber, existing.millId));
      if (groupRows.length === 0) return error('Kelompok DO tidak ditemukan.', 404);
      if (groupRows.some(row => !canAccessKebun(wc.membership, row.kebunId))) return error('DO ini mencakup kebun di luar akses Anda.', 403);
      if (!groupRows.some(row => row.factoryWeightKg > 0 || (row.factoryNet1WeightKg ?? row.factoryGrossWeightKg ?? 0) > 0)) {
        return error('DO ini belum memiliki riwayat Timbangan Pabrik.', 409);
      }
      if (groupRows.some(row => paidAmountForTbs(payments, row.id) > 0)) {
        return error('Riwayat Timbangan Pabrik tidak dapat dihapus karena DO sudah memiliki penerimaan dari PKS.', 409);
      }
      const actor = ctx.user!.email || ctx.user!.userId;
      const stamp = now();
      const updates = groupRows.map(row => {
        const { id, ...stored } = row;
        const transportCost = row.transportMode === 'TRIP'
          ? Math.round(row.transportRate)
          : row.transportMode === 'KG_LAPANGAN'
            ? Math.round(row.fieldWeightKg * row.transportRate)
            : 0;
        const legacyArmadaPaid = paidCostAmount(costPayments, id, 'ARMADA');
        if (transportCost < legacyArmadaPaid) {
          throw new Error('Riwayat Timbangan Pabrik tidak dapat dihapus karena biaya armada berbasis pabrik sudah memiliki pembayaran.');
        }
        const harvestCost = row.harvestWeightBasis === 'PABRIK' ? 0 : Math.round(row.fieldWeightKg * row.harvestRatePerKg);
        const weighingCost = (row.weighingWeightBasis || 'LAPANGAN') === 'PABRIK' ? 0 : Math.round(row.fieldWeightKg * (row.weighingRatePerKg || 0));
        const langsirCost = row.langsirWeightBasis === 'PABRIK' ? 0 : Math.round(row.fieldWeightKg * row.langsirRatePerKg);
        const directCost = harvestCost + weighingCost + langsirCost + transportCost;
        const record: TbsRecord = {
          ...stored,
          factoryDate: '',
          factoryBrutoWeightKg: 0,
          factoryTareWeightKg: 0,
          factoryNet1WeightKg: 0,
          factoryGrossWeightKg: 0,
          factoryDeductionKg: 0,
          factoryDeductionPct: 0,
          deductionAmount: 0,
          factoryWeightKg: 0,
          factoryTicketNumber: '',
          pricePerKg: 0,
          deductions: 0,
          grossRevenue: 0,
          netRevenue: 0,
          harvestCost,
          weighingCost,
          langsirCost,
          transportCost,
          directCost,
          margin: -directCost,
          weightDifferenceKg: 0,
          weightDifferencePct: 0,
          status: 'LAPANGAN',
          updatedBy: actor,
          updatedAt: stamp,
        };
        return { id, record };
      });
      try {
        for (const update of updates) await validateArmadaSupplierBillTarget(wc.workspaceId, update.record);
        const results = await db.update(key, updates);
        if (!results.every(Boolean)) return error('Riwayat Timbangan Pabrik belum berhasil dihapus dari seluruh kebun dalam DO.', 500);
        for (const update of updates) {
          const synced = await syncArmadaSupplierBill(wc.workspaceId, update.id, update.record, actor);
          if (synced.armadaSupplierBillId !== update.record.armadaSupplierBillId || synced.transportCost !== update.record.transportCost) {
            const [linked] = await db.update(key, [{ id: update.id, record: synced }]);
            if (!linked) throw new Error('Hutang supplier armada belum tersinkron setelah hasil pabrik dihapus.');
          }
        }
      } catch (err) {
        return error(err instanceof Error ? err.message : 'Riwayat Timbangan Pabrik gagal dihapus.', 409);
      }
      return json({ deleted: true, doNumber: existing.doNumber, rowsUpdated: updates.length });
    },
  ],
  'DELETE /api/tbs/:id': [
    requireAuth(),
    async ctx => {
      const wc = await workspaceContext(ctx.user!);
      if (!canTransact(wc.membership.role)) return error('Akses Anda hanya untuk melihat data.', 403);
      const key = dataTable('tbs', wc.workspaceId);
      const [existing] = await db.get<TbsRecord>(key, [ctx.params.id]);
      if (!existing) return error('Data TBS tidak ditemukan.', 404);
      const periodError = await accountingDateWriteError(wc.workspaceId, existing.date);
      if (periodError) return error(periodError, 409);
      if (!canAccessKebun(wc.membership, existing.kebunId)) return error('Data TBS ini di luar akses kebun Anda.', 403);
      if (existing.factoryWeightKg > 0) return error('Timbangan lapangan yang sudah masuk proses pabrik tidak dapat dihapus.', 409);
      const [payments, costPayments, payrollRuns, supplierPayments] = await Promise.all([loadTbsPayments(wc.workspaceId), loadTbsCostPayments(wc.workspaceId), loadPayrollRuns(wc.workspaceId), loadSupplierPayments(wc.workspaceId)]);
      if (payrollRunUsesTbs(payrollRuns, ctx.params.id)) return error('DO sudah masuk proses Payroll dan belum dapat dihapus.', 409);
      if (existing.armadaSupplierBillId && paidAmountForSupplierBill(supplierPayments, existing.armadaSupplierBillId) > 0) return error('DO memiliki hutang sewa armada yang sudah dibayar dan belum dapat dihapus.', 409);
      if (paidAmountForTbs(payments, ctx.params.id) > 0) return error('DO sudah memiliki pembayaran PKS dan belum dapat dihapus.', 409);
      if (['PANEN', 'LANGSIR', 'ARMADA'].some(component => paidCostAmount(costPayments, ctx.params.id, component as TbsCostComponent) > 0)) return error('DO sudah memiliki pembayaran hutang operasional dan belum dapat dihapus.', 409);
      if (existing.armadaSupplierBillId) {
        const [billDeleted] = await db.delete(dataTable('supplier_bills', wc.workspaceId), [existing.armadaSupplierBillId]);
        if (!billDeleted) return error('Tagihan otomatis armada gagal dihapus.', 500);
      }
      const [ok] = await db.delete(key, [ctx.params.id]);
      if (!ok) return error('Data TBS gagal dihapus.', 500);
      return json({ deleted: true });
    },
  ],
  'POST /api/tbs-payments': [
    requireAuth(),
    requireOpenAccountingDate('date'),
    async ctx => {
      const wc = await workspaceContext(ctx.user!);
      if (!canManageReceivables(wc.membership.role)) return error('Role Anda tidak memiliki akses mencatat penerimaan PKS.', 403);
      const body = objectBody(ctx.body);
      const date = text(body.date);
      const millId = text(body.millId);
      const accountId = text(body.accountId);
      const amount = money(body.amount);
      const rawAllocations = Array.isArray(body.allocations) ? body.allocations.slice(0, 100) : [];
      if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !millId || !accountId || amount <= 0 || rawAllocations.length === 0) {
        return error('Tanggal, pabrik, akun penerimaan, nominal, dan alokasi DO wajib diisi.', 400);
      }
      const [millRows, accountRows, tbsRows, existingPayments] = await Promise.all([
        db.get<MillRecord>(dataTable('mills', wc.workspaceId), [millId]),
        db.get<AccountRecord>(dataTable('accounts', wc.workspaceId), [accountId]),
        loadTbs(wc.workspaceId),
        loadTbsPayments(wc.workspaceId),
      ]);
      const mill = millRows[0];
      const account = accountRows[0];
      if (!mill) return error('Pabrik tidak ditemukan.', 404);
      if (!account) return error('Akun kas/bank tidak ditemukan.', 404);
      const requestedIds = new Map<string, number>();
      const requestedDos = new Map<string, number>();
      for (const raw of rawAllocations) {
        const item = objectBody(raw);
        const tbsId = text(item.tbsId);
        const doNumber = normalizedDoNumber(text(item.doNumber));
        const allocationAmount = money(item.amount);
        if (allocationAmount <= 0) continue;
        if (doNumber) requestedDos.set(doNumber, (requestedDos.get(doNumber) || 0) + allocationAmount);
        else if (tbsId) requestedIds.set(tbsId, (requestedIds.get(tbsId) || 0) + allocationAmount);
      }
      if (requestedIds.size === 0 && requestedDos.size === 0) return error('Minimal satu alokasi DO harus memiliki nominal.', 400);
      const allocations: TbsPaymentAllocation[] = [];
      for (const [tbsId, allocationAmount] of requestedIds.entries()) {
        const tbs = tbsRows.find(item => item.id === tbsId);
        if (!tbs || tbs.millId !== millId || tbs.netRevenue <= 0) return error('DO tidak valid untuk pabrik yang dipilih.', 400);
        const outstanding = Math.max(0, tbs.netRevenue - paidAmountForTbs(existingPayments, tbsId));
        if (allocationAmount > outstanding) return error(`Alokasi DO ${tbs.doNumber} melebihi sisa piutang.`, 409);
        allocations.push({ tbsId, kebunId: tbs.kebunId, doNumber: tbs.doNumber, amount: allocationAmount });
      }
      for (const [doNumber, allocationAmount] of requestedDos.entries()) {
        const groupRows = tbsRows.filter(item => item.millId === millId && normalizedDoNumber(item.doNumber) === doNumber && item.netRevenue > 0);
        if (groupRows.length === 0) return error(`DO ${doNumber} tidak valid untuk pabrik yang dipilih.`, 400);
        const outstandingRows = groupRows.map(row => Math.max(0, row.netRevenue - paidAmountForTbs(existingPayments, row.id)));
        const totalOutstanding = outstandingRows.reduce((sum, value) => sum + value, 0);
        if (allocationAmount > totalOutstanding) return error(`Alokasi DO ${doNumber} melebihi sisa piutang.`, 409);
        const parts = allocateProportional(allocationAmount, outstandingRows);
        groupRows.forEach((row, index) => {
          if (parts[index] > 0) allocations.push({ tbsId: row.id, kebunId: row.kebunId, doNumber: row.doNumber, amount: parts[index] });
        });
      }
      const allocationTotal = allocations.reduce((sum, item) => sum + item.amount, 0);
      if (allocationTotal !== amount) return error('Total alokasi DO harus sama dengan nominal yang diterima.', 400);
      const stamp = now();
      const actor = ctx.user!.email || ctx.user!.userId;
      const paymentNumber = transactionNumber(date, 'PAY');
      const paymentRecord: TbsPaymentRecord = {
        paymentNumber,
        date,
        millId,
        accountId,
        amount,
        reference: text(body.reference).slice(0, 120),
        note: text(body.note).slice(0, 500),
        allocations,
        transactionIds: [],
        createdBy: actor,
        createdAt: stamp,
      };
      const paymentTable = dataTable('tbs_payments', wc.workspaceId);
      const [paymentId] = await db.add(paymentTable, [paymentRecord]);
      if (!paymentId) return error('Pembayaran PKS gagal disimpan.', 500);
      const grouped = new Map<string, { amount: number; doNumbers: string[] }>();
      for (const allocation of allocations) {
        const current = grouped.get(allocation.kebunId) || { amount: 0, doNumbers: [] };
        current.amount += allocation.amount;
        current.doNumbers.push(allocation.doNumber);
        grouped.set(allocation.kebunId, current);
      }
      const cashRows: TransactionRecord[] = Array.from(grouped.entries()).map(([kebunId, group], index) => ({
        transactionNumber: `${paymentNumber}-${index + 1}`,
        kind: 'NORMAL',
        sourceType: 'TBS_PAYMENT',
        sourceId: paymentId,
        date,
        kebunId,
        accountId,
        direction: 'IN',
        category: 'Penerimaan Piutang TBS',
        description: `Pembayaran ${mill.name} · DO ${Array.from(new Set(group.doNumbers)).join(', ')}`.slice(0, 500),
        amount: group.amount,
        reference: paymentRecord.reference,
        createdBy: actor,
        updatedBy: actor,
        createdAt: stamp,
        updatedAt: stamp,
      }));
      const txIds = await db.add(dataTable('transactions', wc.workspaceId), cashRows);
      const successTxIds = txIds.filter((id): id is string => Boolean(id));
      if (successTxIds.length !== cashRows.length) {
        if (successTxIds.length) await db.delete(dataTable('transactions', wc.workspaceId), successTxIds);
        await db.delete(paymentTable, [paymentId]);
        return error('Mutasi Kas/Bank pembayaran belum tersimpan dengan lengkap.', 500);
      }
      const completedPayment = { ...paymentRecord, transactionIds: successTxIds };
      const [updated] = await db.update(paymentTable, [{ id: paymentId, record: completedPayment }]);
      if (!updated) {
        await db.delete(dataTable('transactions', wc.workspaceId), successTxIds);
        await db.delete(paymentTable, [paymentId]);
        return error('Pembayaran PKS belum dapat diselesaikan.', 500);
      }
      return json({ id: paymentId, ...completedPayment }, 201);
    },
  ],
  'PUT /api/tbs-payments/:id': [
    requireAuth(),
    requireOpenAccountingDate('date'),
    async ctx => {
      const wc = await workspaceContext(ctx.user!);
      if (!canManageReceivables(wc.membership.role)) return error('Role Anda tidak memiliki akses mengubah penerimaan PKS.', 403);
      const paymentTable = dataTable('tbs_payments', wc.workspaceId);
      const [existing] = await db.get<TbsPaymentRecord>(paymentTable, [ctx.params.id]);
      if (!existing) return error('Penerimaan PKS tidak ditemukan.', 404);
      const existingPeriodError = await accountingDateWriteError(wc.workspaceId, existing.date);
      if (existingPeriodError) return error(existingPeriodError, 409);
      const body = objectBody(ctx.body);
      const date = text(body.date);
      const millId = text(body.millId);
      const accountId = text(body.accountId);
      const amount = money(body.amount);
      const rawAllocations = Array.isArray(body.allocations) ? body.allocations.slice(0, 100) : [];
      if (!/^\\d{4}-\\d{2}-\\d{2}$/.test(date) || !millId || !accountId || amount <= 0 || rawAllocations.length === 0) {
        return error('Tanggal, pabrik, akun penerimaan, nominal, dan alokasi DO wajib diisi.', 400);
      }
      const [millRows, accountRows, tbsRows, allPayments] = await Promise.all([
        db.get<MillRecord>(dataTable('mills', wc.workspaceId), [millId]),
        db.get<AccountRecord>(dataTable('accounts', wc.workspaceId), [accountId]),
        loadTbs(wc.workspaceId),
        loadTbsPayments(wc.workspaceId),
      ]);
      const mill = millRows[0];
      const account = accountRows[0];
      if (!mill) return error('Pabrik tidak ditemukan.', 404);
      if (!account) return error('Akun kas/bank tidak ditemukan.', 404);
      const otherPayments = allPayments.filter(payment => payment.id !== ctx.params.id);
      const requestedIds = new Map<string, number>();
      const requestedDos = new Map<string, number>();
      for (const raw of rawAllocations) {
        const item = objectBody(raw);
        const tbsId = text(item.tbsId);
        const doNumber = normalizedDoNumber(text(item.doNumber));
        const allocationAmount = money(item.amount);
        if (allocationAmount <= 0) continue;
        if (doNumber) requestedDos.set(doNumber, (requestedDos.get(doNumber) || 0) + allocationAmount);
        else if (tbsId) requestedIds.set(tbsId, (requestedIds.get(tbsId) || 0) + allocationAmount);
      }
      if (requestedIds.size === 0 && requestedDos.size === 0) return error('Minimal satu alokasi DO harus memiliki nominal.', 400);
      const allocations: TbsPaymentAllocation[] = [];
      for (const [tbsId, allocationAmount] of requestedIds.entries()) {
        const tbs = tbsRows.find(item => item.id === tbsId);
        if (!tbs || tbs.millId !== millId || tbs.netRevenue <= 0) return error('DO tidak valid untuk pabrik yang dipilih.', 400);
        const outstanding = Math.max(0, tbs.netRevenue - paidAmountForTbs(otherPayments, tbsId));
        if (allocationAmount > outstanding) return error(`Alokasi DO ${tbs.doNumber} melebihi sisa piutang.`, 409);
        allocations.push({ tbsId, kebunId: tbs.kebunId, doNumber: tbs.doNumber, amount: allocationAmount });
      }
      for (const [doNumber, allocationAmount] of requestedDos.entries()) {
        const groupRows = tbsRows.filter(item => item.millId === millId && normalizedDoNumber(item.doNumber) === doNumber && item.netRevenue > 0);
        if (groupRows.length === 0) return error(`DO ${doNumber} tidak valid untuk pabrik yang dipilih.`, 400);
        const outstandingRows = groupRows.map(row => Math.max(0, row.netRevenue - paidAmountForTbs(otherPayments, row.id)));
        const totalOutstanding = outstandingRows.reduce((sum, value) => sum + value, 0);
        if (allocationAmount > totalOutstanding) return error(`Alokasi DO ${doNumber} melebihi sisa piutang.`, 409);
        const parts = allocateProportional(allocationAmount, outstandingRows);
        groupRows.forEach((row, index) => {
          if (parts[index] > 0) allocations.push({ tbsId: row.id, kebunId: row.kebunId, doNumber: row.doNumber, amount: parts[index] });
        });
      }
      const allocationTotal = allocations.reduce((sum, item) => sum + item.amount, 0);
      if (allocationTotal !== amount) return error('Total alokasi DO harus sama dengan nominal yang diterima.', 400);
      const actor = ctx.user!.email || ctx.user!.userId;
      const stamp = now();
      const paymentNumber = existing.paymentNumber || transactionNumber(existing.date || date, 'PAY');
      const updatedPayment: TbsPaymentRecord = {
        ...existing,
        paymentNumber,
        date,
        millId,
        accountId,
        amount,
        reference: text(body.reference).slice(0, 120),
        note: text(body.note).slice(0, 500),
        allocations,
        transactionIds: [],
      };
      const grouped = new Map<string, { amount: number; doNumbers: string[] }>();
      for (const allocation of allocations) {
        const current = grouped.get(allocation.kebunId) || { amount: 0, doNumbers: [] };
        current.amount += allocation.amount;
        current.doNumbers.push(allocation.doNumber);
        grouped.set(allocation.kebunId, current);
      }
      const cashRows: TransactionRecord[] = Array.from(grouped.entries()).map(([kebunId, group], index) => ({
        transactionNumber: `${paymentNumber}-${index + 1}`,
        kind: 'NORMAL',
        sourceType: 'TBS_PAYMENT',
        sourceId: ctx.params.id,
        date,
        kebunId,
        accountId,
        direction: 'IN',
        category: 'Penerimaan Piutang TBS',
        description: `Pembayaran ${mill.name} · DO ${Array.from(new Set(group.doNumbers)).join(', ')}`.slice(0, 500),
        amount: group.amount,
        reference: updatedPayment.reference,
        createdBy: actor,
        updatedBy: actor,
        createdAt: stamp,
        updatedAt: stamp,
      }));
      const transactionTable = dataTable('transactions', wc.workspaceId);
      const linkedIds = existing.transactionIds || [];
      const oldRecords = linkedIds.length > 0 ? await db.get<TransactionRecord>(transactionTable, linkedIds) : [];
      const oldCashRows = oldRecords.filter((row): row is TransactionRecord => Boolean(row));
      const oldCashIds = linkedIds.filter((_, index) => Boolean(oldRecords[index]));
      if (oldCashIds.length > 0) {
        const deletedOld = await db.delete(transactionTable, oldCashIds);
        if (!deletedOld.every(Boolean)) return error('Mutasi Kas/Bank lama belum dapat diganti dengan aman.', 500);
      }
      const restoreOld = async () => {
        if (oldCashRows.length === 0) return [] as string[];
        const restored = await db.add(transactionTable, oldCashRows);
        return restored.filter((id): id is string => Boolean(id));
      };
      const txIds = await db.add(transactionTable, cashRows);
      const successTxIds = txIds.filter((id): id is string => Boolean(id));
      if (successTxIds.length !== cashRows.length) {
        if (successTxIds.length > 0) await db.delete(transactionTable, successTxIds);
        const restoredIds = await restoreOld();
        if (restoredIds.length === oldCashRows.length) await db.update(paymentTable, [{ id: ctx.params.id, record: { ...existing, transactionIds: restoredIds } }]);
        return error('Mutasi Kas/Bank hasil koreksi belum tersimpan dengan lengkap.', 500);
      }
      const completedPayment = { ...updatedPayment, transactionIds: successTxIds };
      const [updated] = await db.update(paymentTable, [{ id: ctx.params.id, record: completedPayment }]);
      if (!updated) {
        await db.delete(transactionTable, successTxIds);
        const restoredIds = await restoreOld();
        if (restoredIds.length === oldCashRows.length) await db.update(paymentTable, [{ id: ctx.params.id, record: { ...existing, transactionIds: restoredIds } }]);
        return error('Penerimaan PKS belum dapat diperbarui.', 500);
      }
      return json({ id: ctx.params.id, ...completedPayment });
    },
  ],
  'DELETE /api/tbs-payments/:id': [
    requireAuth(),
    async ctx => {
      const wc = await workspaceContext(ctx.user!);
      if (!canManageReceivables(wc.membership.role)) return error('Role Anda tidak memiliki akses menghapus penerimaan PKS.', 403);
      const paymentTable = dataTable('tbs_payments', wc.workspaceId);
      const [payment] = await db.get<TbsPaymentRecord>(paymentTable, [ctx.params.id]);
      if (!payment) return error('Pembayaran PKS tidak ditemukan.', 404);
      const periodError = await accountingDateWriteError(wc.workspaceId, payment.date);
      if (periodError) return error(periodError, 409);
      const linkedIds = payment.transactionIds || [];
      if (linkedIds.length > 0) {
        const existingTx = await db.get<TransactionRecord>(dataTable('transactions', wc.workspaceId), linkedIds);
        const idsToDelete = linkedIds.filter((_, index) => Boolean(existingTx[index]));
        if (idsToDelete.length > 0) {
          const deletedTx = await db.delete(dataTable('transactions', wc.workspaceId), idsToDelete);
          if (!deletedTx.every(Boolean)) return error('Mutasi Kas/Bank pembayaran belum terhapus sempurna.', 500);
        }
      }
      const [deleted] = await db.delete(paymentTable, [ctx.params.id]);
      if (!deleted) return error('Pembayaran PKS gagal dihapus.', 500);
      return json({ deleted: true });
    },
  ],
  'POST /api/suppliers': [
    requireAuth(),
    async ctx => {
      const wc = await workspaceContext(ctx.user!);
      if (!canManagePayables(wc.membership.role)) return error('Anda tidak memiliki akses menambah supplier.', 403);
      const body = objectBody(ctx.body);
      const name = text(body.name);
      if (!name) return error('Nama supplier wajib diisi.', 400);
      const supplierTable = dataTable('suppliers', wc.workspaceId);
      const existing = (await db.list<SupplierRecord>(supplierTable, { limit: 500 })).items;
      const requestedCode = text(body.code).toUpperCase().slice(0, 40);
      const code = requestedCode || nextSupplierCode(existing);
      if (existing.some(item => item.code && item.code.toUpperCase() === code.toUpperCase())) return error('Kode supplier sudah digunakan.', 409);
      const stamp = now();
      const record: SupplierRecord = {
        code,
        name: name.slice(0, 140),
        contact: text(body.contact).slice(0, 120),
        phone: text(body.phone).slice(0, 40),
        address: text(body.address).slice(0, 240),
        active: body.active !== false,
        createdAt: stamp,
        updatedAt: stamp,
      };
      const [id] = await db.add(supplierTable, [record]);
      if (!id) return error('Supplier gagal disimpan.', 500);
      return json({ id, ...record }, 201);
    },
  ],
  'PUT /api/suppliers/:id': [
    requireAuth(),
    async ctx => {
      const wc = await workspaceContext(ctx.user!);
      if (!canManageMaster(wc.membership.role)) return error('Anda tidak memiliki akses mengubah master supplier.', 403);
      const key = dataTable('suppliers', wc.workspaceId);
      const [existing] = await db.get<SupplierRecord>(key, [ctx.params.id]);
      if (!existing) return error('Supplier tidak ditemukan.', 404);
      const body = objectBody(ctx.body);
      const name = text(body.name);
      if (!name) return error('Nama supplier wajib diisi.', 400);
      const record: SupplierRecord = {
        ...existing,
        code: text(body.code, existing.code).toUpperCase().slice(0, 40),
        name: name.slice(0, 140),
        contact: text(body.contact).slice(0, 120),
        phone: text(body.phone).slice(0, 40),
        address: text(body.address).slice(0, 240),
        active: body.active !== false,
        updatedAt: now(),
      };
      const [ok] = await db.update(key, [{ id: ctx.params.id, record }]);
      if (!ok) return error('Supplier gagal diperbarui.', 500);
      return json({ id: ctx.params.id, ...record });
    },
  ],
  'DELETE /api/suppliers/:id': [
    requireAuth(),
    async ctx => {
      const wc = await workspaceContext(ctx.user!);
      if (!canManageMaster(wc.membership.role)) return error('Anda tidak memiliki akses menghapus master supplier.', 403);
      const [bills, vehicles] = await Promise.all([
        db.list<SupplierBillRecord>(dataTable('supplier_bills', wc.workspaceId), { limit: 500 }),
        db.list<VehicleRecord>(dataTable('vehicles', wc.workspaceId), { limit: 100 }),
      ]);
      if (bills.items.some(item => item.supplierId === ctx.params.id)) return error('Supplier masih dipakai pada tagihan dan belum dapat dihapus.', 409);
      if (vehicles.items.some(item => item.supplierId === ctx.params.id)) return error('Supplier masih terhubung pada Master Armada.', 409);
      const [ok] = await db.delete(dataTable('suppliers', wc.workspaceId), [ctx.params.id]);
      if (!ok) return error('Supplier tidak ditemukan.', 404);
      return json({ deleted: true });
    },
  ],
  'POST /api/supplier-bills': [
    requireAuth(),
    requireOpenAccountingDate('date'),
    async ctx => {
      const wc = await workspaceContext(ctx.user!);
      if (!canManagePayables(wc.membership.role)) return error('Role Anda tidak memiliki akses mencatat tagihan supplier.', 403);
      const body = objectBody(ctx.body);
      const date = text(body.date);
      const dueDate = text(body.dueDate);
      const supplierId = text(body.supplierId);
      const kebunId = text(body.kebunId);
      const category = text(body.category);
      const amount = money(body.amount);
      if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !supplierId || !kebunId || !category || amount <= 0) return error('Tanggal, supplier, kebun, kategori, dan nominal tagihan wajib diisi.', 400);
      if (dueDate && !/^\d{4}-\d{2}-\d{2}$/.test(dueDate)) return error('Tanggal jatuh tempo tidak valid.', 400);
      if (!canAccessKebun(wc.membership, kebunId)) return error('Kebun ini tidak termasuk akses Anda.', 403);
      const [supplier, kebun] = await Promise.all([
        db.get<SupplierRecord>(dataTable('suppliers', wc.workspaceId), [supplierId]),
        db.get<KebunRecord>(dataTable('kebun', wc.workspaceId), [kebunId]),
      ]);
      if (!supplier[0]) return error('Supplier tidak ditemukan.', 404);
      if (!kebun[0]) return error('Kebun tidak ditemukan.', 404);
      const stamp = now();
      const actor = ctx.user!.email || ctx.user!.userId;
      const record: SupplierBillRecord = {
        date,
        dueDate,
        supplierId,
        kebunId,
        invoiceNumber: text(body.invoiceNumber).slice(0, 100),
        category: category.slice(0, 120),
        description: text(body.description).slice(0, 500),
        amount,
        createdBy: actor,
        updatedBy: actor,
        createdAt: stamp,
        updatedAt: stamp,
      };
      const [id] = await db.add(dataTable('supplier_bills', wc.workspaceId), [record]);
      if (!id) return error('Tagihan supplier gagal disimpan.', 500);
      return json({ id, ...record }, 201);
    },
  ],
  'PUT /api/supplier-bills/:id': [
    requireAuth(),
    requireOpenAccountingDate('date'),
    async ctx => {
      const wc = await workspaceContext(ctx.user!);
      if (!canManagePayables(wc.membership.role)) return error('Role Anda tidak memiliki akses mengubah tagihan supplier.', 403);
      const key = dataTable('supplier_bills', wc.workspaceId);
      const [existing] = await db.get<SupplierBillRecord>(key, [ctx.params.id]);
      if (!existing) return error('Tagihan supplier tidak ditemukan.', 404);
      const existingPeriodError = await accountingDateWriteError(wc.workspaceId, existing.date);
      if (existingPeriodError) return error(existingPeriodError, 409);
      if (existing.sourceType === 'TBS_ARMADA') return error('Tagihan sewa armada otomatis harus dikoreksi dari Panen & TBS, bukan dari Hutang Supplier.', 409);
      if (existing.sourceType === 'PURCHASE_INVOICE') return error('Tagihan dari Invoice Pembelian harus dikoreksi dari menu Pembelian.', 409);
      const body = objectBody(ctx.body);
      const date = text(body.date);
      const dueDate = text(body.dueDate);
      const supplierId = text(body.supplierId);
      const kebunId = text(body.kebunId);
      const category = text(body.category);
      const amount = money(body.amount);
      if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !supplierId || !kebunId || !category || amount <= 0) return error('Tanggal, supplier, kebun, kategori, dan nominal tagihan wajib diisi.', 400);
      if (dueDate && !/^\d{4}-\d{2}-\d{2}$/.test(dueDate)) return error('Tanggal jatuh tempo tidak valid.', 400);
      if (!canAccessKebun(wc.membership, existing.kebunId) || !canAccessKebun(wc.membership, kebunId)) return error('Tagihan ini di luar akses kebun Anda.', 403);
      const [supplier, kebun, payments] = await Promise.all([
        db.get<SupplierRecord>(dataTable('suppliers', wc.workspaceId), [supplierId]),
        db.get<KebunRecord>(dataTable('kebun', wc.workspaceId), [kebunId]),
        loadSupplierPayments(wc.workspaceId),
      ]);
      if (!supplier[0]) return error('Supplier tidak ditemukan.', 404);
      if (!kebun[0]) return error('Kebun tidak ditemukan.', 404);
      const paid = paidAmountForSupplierBill(payments, ctx.params.id);
      if (paid > 0 && supplierId !== existing.supplierId) return error('Supplier tidak dapat diubah karena tagihan sudah memiliki pembayaran.', 409);
      if (paid > 0 && kebunId !== existing.kebunId) return error('Kebun tidak dapat diubah karena tagihan sudah memiliki pembayaran.', 409);
      if (amount < paid) return error('Nominal tagihan tidak boleh lebih kecil dari pembayaran yang sudah dilakukan.', 409);
      const record: SupplierBillRecord = {
        ...existing,
        date,
        dueDate,
        supplierId,
        kebunId,
        invoiceNumber: text(body.invoiceNumber).slice(0, 100),
        category: category.slice(0, 120),
        description: text(body.description).slice(0, 500),
        amount,
        updatedBy: ctx.user!.email || ctx.user!.userId,
        updatedAt: now(),
      };
      const [ok] = await db.update(key, [{ id: ctx.params.id, record }]);
      if (!ok) return error('Tagihan supplier gagal diperbarui.', 500);
      return json({ id: ctx.params.id, ...record });
    },
  ],
  'DELETE /api/supplier-bills/:id': [
    requireAuth(),
    async ctx => {
      const wc = await workspaceContext(ctx.user!);
      if (!canManagePayables(wc.membership.role)) return error('Role Anda tidak memiliki akses menghapus tagihan supplier.', 403);
      const key = dataTable('supplier_bills', wc.workspaceId);
      const [existing] = await db.get<SupplierBillRecord>(key, [ctx.params.id]);
      if (!existing) return error('Tagihan supplier tidak ditemukan.', 404);
      const periodError = await accountingDateWriteError(wc.workspaceId, existing.date);
      if (periodError) return error(periodError, 409);
      if (existing.sourceType === 'TBS_ARMADA') return error('Tagihan sewa armada otomatis dihapus bersama DO sumbernya dari Panen & TBS.', 409);
      if (existing.sourceType === 'PURCHASE_INVOICE') return error('Tagihan dari Invoice Pembelian harus dihapus dari menu Pembelian.', 409);
      if (!canAccessKebun(wc.membership, existing.kebunId)) return error('Tagihan ini di luar akses kebun Anda.', 403);
      const payments = await loadSupplierPayments(wc.workspaceId);
      if (paidAmountForSupplierBill(payments, ctx.params.id) > 0) return error('Tagihan sudah memiliki pembayaran dan belum dapat dihapus.', 409);
      const [ok] = await db.delete(key, [ctx.params.id]);
      if (!ok) return error('Tagihan supplier gagal dihapus.', 500);
      return json({ deleted: true });
    },
  ],
  'POST /api/supplier-payments': [
    requireAuth(),
    requireOpenAccountingDate('date'),
    async ctx => {
      const wc = await workspaceContext(ctx.user!);
      if (!canManagePayables(wc.membership.role)) return error('Role Anda tidak memiliki akses mencatat pembayaran supplier.', 403);
      const body = objectBody(ctx.body);
      const date = text(body.date);
      const supplierId = text(body.supplierId);
      const accountId = text(body.accountId);
      const amount = money(body.amount);
      const rawAllocations = Array.isArray(body.allocations) ? body.allocations.slice(0, 100) : [];
      if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !supplierId || !accountId || amount <= 0 || rawAllocations.length === 0) return error('Tanggal, supplier, akun pembayaran, nominal, dan alokasi tagihan wajib diisi.', 400);
      const [supplierRows, accountRows, bills, existingPayments] = await Promise.all([
        db.get<SupplierRecord>(dataTable('suppliers', wc.workspaceId), [supplierId]),
        db.get<AccountRecord>(dataTable('accounts', wc.workspaceId), [accountId]),
        db.list<SupplierBillRecord>(dataTable('supplier_bills', wc.workspaceId), { limit: 500 }),
        loadSupplierPayments(wc.workspaceId),
      ]);
      const supplier = supplierRows[0];
      const account = accountRows[0];
      if (!supplier) return error('Supplier tidak ditemukan.', 404);
      if (!account) return error('Akun Kas/Bank tidak ditemukan.', 404);
      const requested = new Map<string, number>();
      for (const raw of rawAllocations) {
        const item = objectBody(raw);
        const billId = text(item.billId);
        const allocationAmount = money(item.amount);
        if (billId && allocationAmount > 0) requested.set(billId, (requested.get(billId) || 0) + allocationAmount);
      }
      if (requested.size === 0) return error('Minimal satu alokasi tagihan harus memiliki nominal.', 400);
      const allocations: SupplierPaymentAllocation[] = [];
      for (const [billId, allocationAmount] of requested.entries()) {
        const bill = bills.items.find(item => item.id === billId);
        if (!bill || bill.supplierId !== supplierId) return error('Tagihan tidak valid untuk supplier yang dipilih.', 400);
        if (!canAccessKebun(wc.membership, bill.kebunId)) return error('Tagihan berada di luar akses kebun Anda.', 403);
        const outstanding = Math.max(0, bill.amount - paidAmountForSupplierBill(existingPayments, billId));
        if (allocationAmount > outstanding) return error(`Alokasi tagihan ${bill.invoiceNumber || billId.slice(0, 8)} melebihi sisa hutang.`, 409);
        allocations.push({ billId, kebunId: bill.kebunId, invoiceNumber: bill.invoiceNumber || `TAG-${billId.slice(0, 8).toUpperCase()}`, amount: allocationAmount });
      }
      const allocationTotal = allocations.reduce((sum, item) => sum + item.amount, 0);
      if (allocationTotal !== amount) return error('Total alokasi tagihan harus sama dengan nominal pembayaran.', 400);
      const stamp = now();
      const actor = ctx.user!.email || ctx.user!.userId;
      const paymentNumber = transactionNumber(date, 'SUP');
      const paymentRecord: SupplierPaymentRecord = {
        paymentNumber,
        date,
        supplierId,
        accountId,
        amount,
        reference: text(body.reference).slice(0, 120),
        note: text(body.note).slice(0, 500),
        allocations,
        transactionIds: [],
        createdBy: actor,
        createdAt: stamp,
      };
      const paymentTable = dataTable('supplier_payments', wc.workspaceId);
      const [paymentId] = await db.add(paymentTable, [paymentRecord]);
      if (!paymentId) return error('Pembayaran supplier gagal disimpan.', 500);
      const grouped = new Map<string, { amount: number; invoices: string[] }>();
      for (const allocation of allocations) {
        const current = grouped.get(allocation.kebunId) || { amount: 0, invoices: [] };
        current.amount += allocation.amount;
        current.invoices.push(allocation.invoiceNumber);
        grouped.set(allocation.kebunId, current);
      }
      const cashRows: TransactionRecord[] = Array.from(grouped.entries()).map(([kebunId, group], index) => ({
        transactionNumber: `${paymentNumber}-${index + 1}`,
        kind: 'NORMAL',
        sourceType: 'SUPPLIER_PAYMENT',
        sourceId: paymentId,
        date,
        kebunId,
        accountId,
        direction: 'OUT',
        category: 'Pembayaran Hutang Supplier',
        description: `Pembayaran ${supplier.name} · ${group.invoices.join(', ')}`.slice(0, 500),
        amount: group.amount,
        reference: paymentRecord.reference,
        createdBy: actor,
        updatedBy: actor,
        createdAt: stamp,
        updatedAt: stamp,
      }));
      const txIds = await db.add(dataTable('transactions', wc.workspaceId), cashRows);
      const successTxIds = txIds.filter((id): id is string => Boolean(id));
      if (successTxIds.length !== cashRows.length) {
        if (successTxIds.length) await db.delete(dataTable('transactions', wc.workspaceId), successTxIds);
        await db.delete(paymentTable, [paymentId]);
        return error('Mutasi Kas/Bank pembayaran supplier belum tersimpan lengkap.', 500);
      }
      const completedPayment = { ...paymentRecord, transactionIds: successTxIds };
      const [updated] = await db.update(paymentTable, [{ id: paymentId, record: completedPayment }]);
      if (!updated) {
        await db.delete(dataTable('transactions', wc.workspaceId), successTxIds);
        await db.delete(paymentTable, [paymentId]);
        return error('Pembayaran supplier belum dapat diselesaikan.', 500);
      }
      return json({ id: paymentId, ...completedPayment }, 201);
    },
  ],
  'PUT /api/supplier-payments/:id': [
    requireAuth(),
    requireOpenAccountingDate('date'),
    async ctx => {
      const wc = await workspaceContext(ctx.user!);
      if (!canManagePayables(wc.membership.role)) return error('Role Anda tidak memiliki akses mengubah pembayaran supplier.', 403);
      const paymentTable = dataTable('supplier_payments', wc.workspaceId);
      const [existing] = await db.get<SupplierPaymentRecord>(paymentTable, [ctx.params.id]);
      if (!existing) return error('Pembayaran supplier tidak ditemukan.', 404);
      const existingPeriodError = await accountingDateWriteError(wc.workspaceId, existing.date);
      if (existingPeriodError) return error(existingPeriodError, 409);
      const body = objectBody(ctx.body);
      const date = text(body.date);
      const supplierId = text(body.supplierId);
      const accountId = text(body.accountId);
      const amount = money(body.amount);
      const rawAllocations = Array.isArray(body.allocations) ? body.allocations.slice(0, 100) : [];
      if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !supplierId || !accountId || amount <= 0 || rawAllocations.length === 0) return error('Tanggal, supplier, akun pembayaran, nominal, dan alokasi tagihan wajib diisi.', 400);
      const [supplierRows, accountRows, bills, allPayments] = await Promise.all([
        db.get<SupplierRecord>(dataTable('suppliers', wc.workspaceId), [supplierId]),
        db.get<AccountRecord>(dataTable('accounts', wc.workspaceId), [accountId]),
        db.list<SupplierBillRecord>(dataTable('supplier_bills', wc.workspaceId), { limit: 500 }),
        loadSupplierPayments(wc.workspaceId),
      ]);
      const supplier = supplierRows[0];
      const account = accountRows[0];
      if (!supplier) return error('Supplier tidak ditemukan.', 404);
      if (!account) return error('Akun Kas/Bank tidak ditemukan.', 404);
      const otherPayments = allPayments.filter(payment => payment.id !== ctx.params.id);
      const requested = new Map<string, number>();
      for (const raw of rawAllocations) {
        const item = objectBody(raw);
        const billId = text(item.billId);
        const allocationAmount = money(item.amount);
        if (billId && allocationAmount > 0) requested.set(billId, (requested.get(billId) || 0) + allocationAmount);
      }
      if (requested.size === 0) return error('Minimal satu alokasi tagihan harus memiliki nominal.', 400);
      const allocations: SupplierPaymentAllocation[] = [];
      for (const [billId, allocationAmount] of requested.entries()) {
        const bill = bills.items.find(item => item.id === billId);
        if (!bill || bill.supplierId !== supplierId) return error('Tagihan tidak valid untuk supplier yang dipilih.', 400);
        if (!canAccessKebun(wc.membership, bill.kebunId)) return error('Tagihan berada di luar akses kebun Anda.', 403);
        const outstanding = Math.max(0, bill.amount - paidAmountForSupplierBill(otherPayments, billId));
        if (allocationAmount > outstanding) return error(`Alokasi tagihan ${bill.invoiceNumber || billId.slice(0, 8)} melebihi sisa hutang.`, 409);
        allocations.push({ billId, kebunId: bill.kebunId, invoiceNumber: bill.invoiceNumber || `TAG-${billId.slice(0, 8).toUpperCase()}`, amount: allocationAmount });
      }
      const allocationTotal = allocations.reduce((sum, item) => sum + item.amount, 0);
      if (allocationTotal !== amount) return error('Total alokasi tagihan harus sama dengan nominal pembayaran.', 400);
      const actor = ctx.user!.email || ctx.user!.userId;
      const stamp = now();
      const paymentNumber = existing.paymentNumber || transactionNumber(existing.date || date, 'SUP');
      const updatedPayment: SupplierPaymentRecord = {
        ...existing,
        paymentNumber,
        date,
        supplierId,
        accountId,
        amount,
        reference: text(body.reference).slice(0, 120),
        note: text(body.note).slice(0, 500),
        allocations,
        transactionIds: [],
      };
      const grouped = new Map<string, { amount: number; invoices: string[] }>();
      for (const allocation of allocations) {
        const current = grouped.get(allocation.kebunId) || { amount: 0, invoices: [] };
        current.amount += allocation.amount;
        current.invoices.push(allocation.invoiceNumber);
        grouped.set(allocation.kebunId, current);
      }
      const cashRows: TransactionRecord[] = Array.from(grouped.entries()).map(([kebunId, group], index) => ({
        transactionNumber: `${paymentNumber}-${index + 1}`,
        kind: 'NORMAL',
        sourceType: 'SUPPLIER_PAYMENT',
        sourceId: ctx.params.id,
        date,
        kebunId,
        accountId,
        direction: 'OUT',
        category: 'Pembayaran Hutang Supplier',
        description: `Pembayaran ${supplier.name} · ${Array.from(new Set(group.invoices)).join(', ')}`.slice(0, 500),
        amount: group.amount,
        reference: updatedPayment.reference,
        createdBy: actor,
        updatedBy: actor,
        createdAt: stamp,
        updatedAt: stamp,
      }));
      const transactionTable = dataTable('transactions', wc.workspaceId);
      const linkedIds = existing.transactionIds || [];
      const oldRecords = linkedIds.length > 0 ? await db.get<TransactionRecord>(transactionTable, linkedIds) : [];
      const oldCashRows = oldRecords.filter((row): row is TransactionRecord => Boolean(row));
      const oldCashIds = linkedIds.filter((_, index) => Boolean(oldRecords[index]));
      if (oldCashIds.length > 0) {
        const deletedOld = await db.delete(transactionTable, oldCashIds);
        if (!deletedOld.every(Boolean)) return error('Mutasi Kas/Bank lama belum dapat diganti dengan aman.', 500);
      }
      const restoreOld = async () => {
        if (oldCashRows.length === 0) return [] as string[];
        const restored = await db.add(transactionTable, oldCashRows);
        return restored.filter((id): id is string => Boolean(id));
      };
      const txIds = await db.add(transactionTable, cashRows);
      const successTxIds = txIds.filter((id): id is string => Boolean(id));
      if (successTxIds.length !== cashRows.length) {
        if (successTxIds.length > 0) await db.delete(transactionTable, successTxIds);
        const restoredIds = await restoreOld();
        if (restoredIds.length === oldCashRows.length) await db.update(paymentTable, [{ id: ctx.params.id, record: { ...existing, transactionIds: restoredIds } }]);
        return error('Mutasi Kas/Bank hasil koreksi pembayaran supplier belum tersimpan lengkap.', 500);
      }
      const completedPayment = { ...updatedPayment, transactionIds: successTxIds };
      const [updated] = await db.update(paymentTable, [{ id: ctx.params.id, record: completedPayment }]);
      if (!updated) {
        await db.delete(transactionTable, successTxIds);
        const restoredIds = await restoreOld();
        if (restoredIds.length === oldCashRows.length) await db.update(paymentTable, [{ id: ctx.params.id, record: { ...existing, transactionIds: restoredIds } }]);
        return error('Pembayaran supplier belum dapat diperbarui.', 500);
      }
      return json({ id: ctx.params.id, ...completedPayment });
    },
  ],
  'DELETE /api/supplier-payments/:id': [
    requireAuth(),
    async ctx => {
      const wc = await workspaceContext(ctx.user!);
      if (!canManagePayables(wc.membership.role)) return error('Role Anda tidak memiliki akses menghapus pembayaran supplier.', 403);
      const paymentTable = dataTable('supplier_payments', wc.workspaceId);
      const [payment] = await db.get<SupplierPaymentRecord>(paymentTable, [ctx.params.id]);
      if (!payment) return error('Pembayaran supplier tidak ditemukan.', 404);
      const periodError = await accountingDateWriteError(wc.workspaceId, payment.date);
      if (periodError) return error(periodError, 409);
      const linkedIds = payment.transactionIds || [];
      if (linkedIds.length > 0) {
        const existingTx = await db.get<TransactionRecord>(dataTable('transactions', wc.workspaceId), linkedIds);
        const idsToDelete = linkedIds.filter((_, index) => Boolean(existingTx[index]));
        if (idsToDelete.length > 0) {
          const deletedTx = await db.delete(dataTable('transactions', wc.workspaceId), idsToDelete);
          if (!deletedTx.every(Boolean)) return error('Mutasi Kas/Bank pembayaran supplier belum terhapus sempurna.', 500);
        }
      }
      const [deleted] = await db.delete(paymentTable, [ctx.params.id]);
      if (!deleted) return error('Pembayaran supplier gagal dihapus.', 500);
      return json({ deleted: true });
    },
  ],
  'POST /api/work-types': [
    requireAuth(),
    async ctx => {
      const wc = await workspaceContext(ctx.user!);
      if (!canManageMaster(wc.membership.role)) return error('Owner/Admin Pusat yang dapat mengubah Master Pekerjaan.', 403);
      const body = objectBody(ctx.body);
      const name = text(body.name).trim();
      const unit = text(body.unit).trim();
      if (!name || !unit) return error('Nama pekerjaan dan satuan wajib diisi.', 400);
      const existing = await loadWorkTypes(wc.workspaceId);
      if (existing.some(row => row.name.trim().toLowerCase() === name.toLowerCase())) return error('Nama pekerjaan sudah terdaftar.', 409);
      const stamp = now();
      const actor = ctx.user!.email || ctx.user!.userId;
      const record: WorkTypeRecord = { name: name.slice(0, 100), unit: unit.slice(0, 40), active: body.active !== false, createdBy: actor, updatedBy: actor, createdAt: stamp, updatedAt: stamp };
      const [id] = await db.add(dataTable('work_types', wc.workspaceId), [record]);
      if (!id) return error('Master pekerjaan gagal disimpan.', 500);
      return json({ id, ...record }, 201);
    },
  ],
  'PUT /api/work-types/:id': [
    requireAuth(),
    async ctx => {
      const wc = await workspaceContext(ctx.user!);
      if (!canManageMaster(wc.membership.role)) return error('Owner/Admin Pusat yang dapat mengubah Master Pekerjaan.', 403);
      const table = dataTable('work_types', wc.workspaceId);
      const [existing] = await db.get<WorkTypeRecord>(table, [ctx.params.id]);
      if (!existing) return error('Master pekerjaan tidak ditemukan.', 404);
      const body = objectBody(ctx.body);
      const name = text(body.name).trim();
      const unit = text(body.unit).trim();
      if (!name || !unit) return error('Nama pekerjaan dan satuan wajib diisi.', 400);
      const rows = await loadWorkTypes(wc.workspaceId);
      if (rows.some(row => row.id !== ctx.params.id && row.name.trim().toLowerCase() === name.toLowerCase())) return error('Nama pekerjaan sudah terdaftar.', 409);
      const record: WorkTypeRecord = { ...existing, name: name.slice(0, 100), unit: unit.slice(0, 40), active: body.active !== false, updatedBy: ctx.user!.email || ctx.user!.userId, updatedAt: now() };
      const [ok] = await db.update(table, [{ id: ctx.params.id, record }]);
      if (!ok) return error('Master pekerjaan gagal diperbarui.', 500);
      return json({ id: ctx.params.id, ...record });
    },
  ],
  'DELETE /api/work-types/:id': [
    requireAuth(),
    async ctx => {
      const wc = await workspaceContext(ctx.user!);
      if (!canManageMaster(wc.membership.role)) return error('Owner/Admin Pusat yang dapat menghapus Master Pekerjaan.', 403);
      const [rates, entries] = await Promise.all([loadWorkRates(wc.workspaceId), loadWorkEntries(wc.workspaceId)]);
      if (rates.some(row => row.workTypeId === ctx.params.id) || entries.some(row => row.workTypeId === ctx.params.id)) return error('Pekerjaan masih memiliki tarif atau transaksi. Nonaktifkan jika tidak dipakai lagi.', 409);
      const [ok] = await db.delete(dataTable('work_types', wc.workspaceId), [ctx.params.id]);
      if (!ok) return error('Master pekerjaan tidak ditemukan.', 404);
      return json({ deleted: true });
    },
  ],
  'POST /api/work-rates': [
    requireAuth(),
    async ctx => {
      const wc = await workspaceContext(ctx.user!);
      if (!canManageMaster(wc.membership.role)) return error('Owner/Admin Pusat yang dapat mengubah Tarif Pekerjaan.', 403);
      const body = objectBody(ctx.body);
      const workTypeId = text(body.workTypeId);
      const kebunId = text(body.kebunId);
      const effectiveDate = text(body.effectiveDate);
      const rate = money(body.rate);
      if (!workTypeId || !kebunId || !/^\d{4}-\d{2}-\d{2}$/.test(effectiveDate) || rate <= 0) return error('Pekerjaan, kebun, tanggal berlaku, dan tarif wajib diisi.', 400);
      const [workType, kebun] = await Promise.all([db.get<WorkTypeRecord>(dataTable('work_types', wc.workspaceId), [workTypeId]), db.get<KebunRecord>(dataTable('kebun', wc.workspaceId), [kebunId])]);
      if (!workType[0]) return error('Master pekerjaan tidak ditemukan.', 404);
      if (!kebun[0]) return error('Kebun tidak ditemukan.', 404);
      const existing = await loadWorkRates(wc.workspaceId);
      if (existing.some(row => row.workTypeId === workTypeId && row.kebunId === kebunId && row.effectiveDate === effectiveDate)) return error('Tarif pekerjaan untuk kebun dan tanggal berlaku tersebut sudah ada.', 409);
      const stamp = now();
      const actor = ctx.user!.email || ctx.user!.userId;
      const record: WorkRateRecord = { workTypeId, kebunId, effectiveDate, rate, createdBy: actor, updatedBy: actor, createdAt: stamp, updatedAt: stamp };
      const [id] = await db.add(dataTable('work_rates', wc.workspaceId), [record]);
      if (!id) return error('Tarif pekerjaan gagal disimpan.', 500);
      return json({ id, ...record }, 201);
    },
  ],
  'PUT /api/work-rates/:id': [
    requireAuth(),
    async ctx => {
      const wc = await workspaceContext(ctx.user!);
      if (!canManageMaster(wc.membership.role)) return error('Owner/Admin Pusat yang dapat mengubah Tarif Pekerjaan.', 403);
      const table = dataTable('work_rates', wc.workspaceId);
      const [existing] = await db.get<WorkRateRecord>(table, [ctx.params.id]);
      if (!existing) return error('Tarif pekerjaan tidak ditemukan.', 404);
      const body = objectBody(ctx.body);
      const workTypeId = text(body.workTypeId);
      const kebunId = text(body.kebunId);
      const effectiveDate = text(body.effectiveDate);
      const rate = money(body.rate);
      if (!workTypeId || !kebunId || !/^\d{4}-\d{2}-\d{2}$/.test(effectiveDate) || rate <= 0) return error('Pekerjaan, kebun, tanggal berlaku, dan tarif wajib diisi.', 400);
      const [workType, kebun, rows] = await Promise.all([db.get<WorkTypeRecord>(dataTable('work_types', wc.workspaceId), [workTypeId]), db.get<KebunRecord>(dataTable('kebun', wc.workspaceId), [kebunId]), loadWorkRates(wc.workspaceId)]);
      if (!workType[0]) return error('Master pekerjaan tidak ditemukan.', 404);
      if (!kebun[0]) return error('Kebun tidak ditemukan.', 404);
      if (rows.some(row => row.id !== ctx.params.id && row.workTypeId === workTypeId && row.kebunId === kebunId && row.effectiveDate === effectiveDate)) return error('Tarif pekerjaan untuk kebun dan tanggal berlaku tersebut sudah ada.', 409);
      const record: WorkRateRecord = { ...existing, workTypeId, kebunId, effectiveDate, rate, updatedBy: ctx.user!.email || ctx.user!.userId, updatedAt: now() };
      const [ok] = await db.update(table, [{ id: ctx.params.id, record }]);
      if (!ok) return error('Tarif pekerjaan gagal diperbarui.', 500);
      return json({ id: ctx.params.id, ...record });
    },
  ],
  'DELETE /api/work-rates/:id': [
    requireAuth(),
    async ctx => {
      const wc = await workspaceContext(ctx.user!);
      if (!canManageMaster(wc.membership.role)) return error('Owner/Admin Pusat yang dapat menghapus Tarif Pekerjaan.', 403);
      const [ok] = await db.delete(dataTable('work_rates', wc.workspaceId), [ctx.params.id]);
      if (!ok) return error('Tarif pekerjaan tidak ditemukan.', 404);
      return json({ deleted: true });
    },
  ],
  'POST /api/work-entries': [
    requireAuth(),
    requireOpenAccountingDate('date'),
    async ctx => {
      const wc = await workspaceContext(ctx.user!);
      if (!canTransact(wc.membership.role)) return error('Role Viewer hanya dapat melihat Pekerjaan Kebun.', 403);
      const body = objectBody(ctx.body);
      const date = text(body.date);
      const kebunId = text(body.kebunId);
      const workerId = text(body.workerId);
      const workTypeId = text(body.workTypeId);
      const quantity = decimal(body.quantity);
      if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !kebunId || !workerId || !workTypeId || quantity <= 0) return error('Tanggal, kebun, pekerja, pekerjaan, dan volume wajib diisi.', 400);
      if (!canAccessKebun(wc.membership, kebunId)) return error('Kebun ini di luar akses Anda.', 403);
      const [worker, kebun, workType, rates] = await Promise.all([db.get<HarvesterRecord>(dataTable('harvesters', wc.workspaceId), [workerId]), db.get<KebunRecord>(dataTable('kebun', wc.workspaceId), [kebunId]), db.get<WorkTypeRecord>(dataTable('work_types', wc.workspaceId), [workTypeId]), loadWorkRates(wc.workspaceId)]);
      if (!worker[0]) return error('Pekerja tidak ditemukan.', 404);
      if (!kebun[0]) return error('Kebun tidak ditemukan.', 404);
      if (!workType[0] || !workType[0].active) return error('Master pekerjaan tidak aktif atau tidak ditemukan.', 404);
      const rateRow = applicableWorkRate(rates, workTypeId, kebunId, date);
      if (!rateRow) return error('Tarif pekerjaan untuk kebun dan tanggal ini belum tersedia.', 409);
      const stamp = now();
      const actor = ctx.user!.email || ctx.user!.userId;
      const record: WorkEntryRecord = { date, kebunId, workerId, workTypeId, workName: workType[0].name, unit: workType[0].unit, quantity, rate: rateRow.rate, amount: Math.round(quantity * rateRow.rate), note: text(body.note).slice(0, 500), createdBy: actor, updatedBy: actor, createdAt: stamp, updatedAt: stamp };
      const [id] = await db.add(dataTable('work_entries', wc.workspaceId), [record]);
      if (!id) return error('Pekerjaan kebun gagal disimpan.', 500);
      return json({ id, ...record }, 201);
    },
  ],
  'PUT /api/work-entries/:id': [
    requireAuth(),
    requireOpenAccountingDate('date'),
    async ctx => {
      const wc = await workspaceContext(ctx.user!);
      if (!canTransact(wc.membership.role)) return error('Role Viewer hanya dapat melihat Pekerjaan Kebun.', 403);
      const table = dataTable('work_entries', wc.workspaceId);
      const [existing] = await db.get<WorkEntryRecord>(table, [ctx.params.id]);
      if (!existing) return error('Pekerjaan kebun tidak ditemukan.', 404);
      const existingPeriodError = await accountingDateWriteError(wc.workspaceId, existing.date);
      if (existingPeriodError) return error(existingPeriodError, 409);
      const runs = await loadPayrollRuns(wc.workspaceId);
      if (payrollRunUsesWork(runs, ctx.params.id)) return error('Pekerjaan sudah masuk proses Payroll dan tidak dapat diubah.', 409);
      const body = objectBody(ctx.body);
      const date = text(body.date);
      const kebunId = text(body.kebunId);
      const workerId = text(body.workerId);
      const workTypeId = text(body.workTypeId);
      const quantity = decimal(body.quantity);
      if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !kebunId || !workerId || !workTypeId || quantity <= 0) return error('Tanggal, kebun, pekerja, pekerjaan, dan volume wajib diisi.', 400);
      if (!canAccessKebun(wc.membership, kebunId)) return error('Kebun ini di luar akses Anda.', 403);
      const [worker, kebun, workType, rates] = await Promise.all([db.get<HarvesterRecord>(dataTable('harvesters', wc.workspaceId), [workerId]), db.get<KebunRecord>(dataTable('kebun', wc.workspaceId), [kebunId]), db.get<WorkTypeRecord>(dataTable('work_types', wc.workspaceId), [workTypeId]), loadWorkRates(wc.workspaceId)]);
      if (!worker[0] || !kebun[0] || !workType[0]) return error('Referensi pekerja, kebun, atau pekerjaan tidak ditemukan.', 404);
      const rateRow = applicableWorkRate(rates, workTypeId, kebunId, date);
      if (!rateRow) return error('Tarif pekerjaan untuk kebun dan tanggal ini belum tersedia.', 409);
      const record: WorkEntryRecord = { ...existing, date, kebunId, workerId, workTypeId, workName: workType[0].name, unit: workType[0].unit, quantity, rate: rateRow.rate, amount: Math.round(quantity * rateRow.rate), note: text(body.note).slice(0, 500), updatedBy: ctx.user!.email || ctx.user!.userId, updatedAt: now() };
      const [ok] = await db.update(table, [{ id: ctx.params.id, record }]);
      if (!ok) return error('Pekerjaan kebun gagal diperbarui.', 500);
      return json({ id: ctx.params.id, ...record });
    },
  ],
  'DELETE /api/work-entries/:id': [
    requireAuth(),
    async ctx => {
      const wc = await workspaceContext(ctx.user!);
      if (!canTransact(wc.membership.role)) return error('Role Viewer hanya dapat melihat Pekerjaan Kebun.', 403);
      const table = dataTable('work_entries', wc.workspaceId);
      const [existing] = await db.get<WorkEntryRecord>(table, [ctx.params.id]);
      if (!existing) return error('Pekerjaan kebun tidak ditemukan.', 404);
      const periodError = await accountingDateWriteError(wc.workspaceId, existing.date);
      if (periodError) return error(periodError, 409);
      if (!canAccessKebun(wc.membership, existing.kebunId)) return error('Pekerjaan ini di luar akses kebun Anda.', 403);
      const runs = await loadPayrollRuns(wc.workspaceId);
      if (payrollRunUsesWork(runs, ctx.params.id)) return error('Pekerjaan sudah masuk proses Payroll dan tidak dapat dihapus.', 409);
      const [ok] = await db.delete(table, [ctx.params.id]);
      if (!ok) return error('Pekerjaan kebun gagal dihapus.', 500);
      return json({ deleted: true });
    },
  ],
  'POST /api/employee-receivables': [
    requireAuth(),
    requireOpenAccountingDate('date'),
    async ctx => {
      const wc = await workspaceContext(ctx.user!);
      if (!canManagePayroll(wc.membership.role)) return error('Role Anda tidak memiliki akses mengelola Piutang Karyawan.', 403);
      const body = objectBody(ctx.body);
      const date = text(body.date);
      const workerId = text(body.workerId);
      const accountId = text(body.accountId);
      const description = text(body.description);
      const totalAmount = money(body.totalAmount);
      const installmentCount = Math.min(60, Math.max(1, Math.floor(Number(body.installmentCount) || 0)));
      if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !workerId || !accountId || !description || totalAmount <= 0 || Number(body.installmentCount) < 1) return error('Tanggal, pekerja, Kas/Bank sumber dana, keterangan piutang, total piutang, dan jumlah kali potong wajib diisi.', 400);
      const [worker, account] = await Promise.all([
        db.get<HarvesterRecord>(dataTable('harvesters', wc.workspaceId), [workerId]).then(rows => rows[0]),
        db.get<AccountRecord>(dataTable('accounts', wc.workspaceId), [accountId]).then(rows => rows[0]),
      ]);
      if (!worker) return error('Pekerja tidak ditemukan.', 404);
      if (!account) return error('Kas/Bank sumber dana tidak ditemukan.', 404);
      const stamp = now();
      const actor = ctx.user!.email || ctx.user!.userId;
      const record: EmployeeReceivableRecord = { date, workerId, accountId, transactionId: '', description: description.slice(0, 160), totalAmount, installmentCount, note: text(body.note).slice(0, 500), createdBy: actor, updatedBy: actor, createdAt: stamp, updatedAt: stamp };
      const table = dataTable('employee_receivables', wc.workspaceId);
      const txTable = dataTable('transactions', wc.workspaceId);
      const [id] = await db.add(table, [record]);
      if (!id) return error('Piutang Karyawan gagal disimpan.', 500);
      const cashRecord = employeeReceivableCashRecord(id, record, worker.name, actor);
      const [transactionId] = await db.add(txTable, [cashRecord]);
      if (!transactionId) {
        await db.delete(table, [id]);
        return error('Piutang belum disimpan karena mutasi Kas/Bank pencairan gagal dibuat.', 500);
      }
      const completedRecord: EmployeeReceivableRecord = { ...record, transactionId };
      const [updated] = await db.update(table, [{ id, record: completedRecord }]);
      if (!updated) {
        await db.delete(txTable, [transactionId]);
        await db.delete(table, [id]);
        return error('Piutang belum tersimpan lengkap bersama mutasi Kas/Bank.', 500);
      }
      return json({ id, ...completedRecord }, 201);
    },
  ],
  'PUT /api/employee-receivables/:id': [
    requireAuth(),
    requireOpenAccountingDate('date'),
    async ctx => {
      const wc = await workspaceContext(ctx.user!);
      if (!canManagePayroll(wc.membership.role)) return error('Role Anda tidak memiliki akses mengubah Piutang Karyawan.', 403);
      const table = dataTable('employee_receivables', wc.workspaceId);
      const txTable = dataTable('transactions', wc.workspaceId);
      const [existing] = await db.get<EmployeeReceivableRecord>(table, [ctx.params.id]);
      if (!existing) return error('Piutang Karyawan tidak ditemukan.', 404);
      const existingPeriodError = await accountingDateWriteError(wc.workspaceId, existing.date);
      if (existingPeriodError) return error(existingPeriodError, 409);
      const runs = await loadPayrollRuns(wc.workspaceId);
      if (payrollRunUsesEmployeeReceivable(runs, ctx.params.id)) return error('Piutang sudah pernah dipotong pada Payroll dan tidak dapat diubah. Batalkan proses Payroll terkait terlebih dahulu.', 409);
      const body = objectBody(ctx.body);
      const date = text(body.date);
      const workerId = text(body.workerId);
      const accountId = text(body.accountId);
      const description = text(body.description);
      const totalAmount = money(body.totalAmount);
      const installmentCount = Math.min(60, Math.max(1, Math.floor(Number(body.installmentCount) || 0)));
      if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !workerId || !accountId || !description || totalAmount <= 0 || Number(body.installmentCount) < 1) return error('Tanggal, pekerja, Kas/Bank sumber dana, keterangan piutang, total piutang, dan jumlah kali potong wajib diisi.', 400);
      const [worker, account] = await Promise.all([
        db.get<HarvesterRecord>(dataTable('harvesters', wc.workspaceId), [workerId]).then(rows => rows[0]),
        db.get<AccountRecord>(dataTable('accounts', wc.workspaceId), [accountId]).then(rows => rows[0]),
      ]);
      if (!worker) return error('Pekerja tidak ditemukan.', 404);
      if (!account) return error('Kas/Bank sumber dana tidak ditemukan.', 404);
      const actor = ctx.user!.email || ctx.user!.userId;
      const baseRecord: EmployeeReceivableRecord = { ...existing, date, workerId, accountId, description: description.slice(0, 160), totalAmount, installmentCount, note: text(body.note).slice(0, 500), updatedBy: actor, updatedAt: now() };
      let transactionId = existing.transactionId || '';
      let previousTransaction: TransactionRecord | null = null;
      let createdTransactionId = '';
      if (transactionId) {
        [previousTransaction] = await db.get<TransactionRecord>(txTable, [transactionId]);
      }
      if (previousTransaction) {
        const nextCash = employeeReceivableCashRecord(ctx.params.id, baseRecord, worker.name, actor, previousTransaction);
        const [txUpdated] = await db.update(txTable, [{ id: transactionId, record: nextCash }]);
        if (!txUpdated) return error('Mutasi Kas/Bank pencairan Piutang Karyawan gagal diperbarui.', 500);
      } else {
        const nextCash = employeeReceivableCashRecord(ctx.params.id, baseRecord, worker.name, actor);
        const [newTransactionId] = await db.add(txTable, [nextCash]);
        if (!newTransactionId) return error('Mutasi Kas/Bank pencairan Piutang Karyawan gagal dibuat.', 500);
        transactionId = newTransactionId;
        createdTransactionId = newTransactionId;
      }
      const record: EmployeeReceivableRecord = { ...baseRecord, transactionId };
      const [ok] = await db.update(table, [{ id: ctx.params.id, record }]);
      if (!ok) {
        if (previousTransaction) await db.update(txTable, [{ id: transactionId, record: previousTransaction }]);
        if (createdTransactionId) await db.delete(txTable, [createdTransactionId]);
        return error('Piutang Karyawan gagal diperbarui.', 500);
      }
      return json({ id: ctx.params.id, ...record });
    },
  ],
  'DELETE /api/employee-receivables/:id': [
    requireAuth(),
    async ctx => {
      const wc = await workspaceContext(ctx.user!);
      if (!canManagePayroll(wc.membership.role)) return error('Role Anda tidak memiliki akses menghapus Piutang Karyawan.', 403);
      const table = dataTable('employee_receivables', wc.workspaceId);
      const txTable = dataTable('transactions', wc.workspaceId);
      const [existing] = await db.get<EmployeeReceivableRecord>(table, [ctx.params.id]);
      if (!existing) return error('Piutang Karyawan tidak ditemukan.', 404);
      const existingPeriodError = await accountingDateWriteError(wc.workspaceId, existing.date);
      if (existingPeriodError) return error(existingPeriodError, 409);
      const runs = await loadPayrollRuns(wc.workspaceId);
      if (payrollRunUsesEmployeeReceivable(runs, ctx.params.id)) return error('Piutang sudah pernah dipotong pada Payroll dan tidak dapat dihapus. Batalkan proses Payroll terkait terlebih dahulu.', 409);
      let previousTransaction: TransactionRecord | null = null;
      if (existing.transactionId) {
        [previousTransaction] = await db.get<TransactionRecord>(txTable, [existing.transactionId]);
        if (previousTransaction) {
          const [txDeleted] = await db.delete(txTable, [existing.transactionId]);
          if (!txDeleted) return error('Mutasi Kas/Bank pencairan Piutang Karyawan gagal dihapus.', 500);
        }
      }
      const [ok] = await db.delete(table, [ctx.params.id]);
      if (!ok) {
        if (previousTransaction) {
          const [restoredTransactionId] = await db.add(txTable, [previousTransaction]);
          if (restoredTransactionId) await db.update(table, [{ id: ctx.params.id, record: { ...existing, transactionId: restoredTransactionId } }]);
        }
        return error('Piutang Karyawan gagal dihapus.', 500);
      }
      return json({ deleted: true });
    },
  ],
  'POST /api/payroll-manual': [
    requireAuth(),
    requireOpenAccountingDate('date'),
    async ctx => {
      const wc = await workspaceContext(ctx.user!);
      if (!canManagePayroll(wc.membership.role)) return error('Role Anda tidak memiliki akses mencatat komponen Payroll.', 403);
      const body = objectBody(ctx.body);
      const date = text(body.date);
      const workerId = text(body.workerId);
      const kebunId = text(body.kebunId);
      const kind: PayrollManualKind = text(body.kind) === 'DEDUCTION' ? 'DEDUCTION' : 'EARNING';
      const category = text(body.category);
      const amount = money(body.amount);
      if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !workerId || !kebunId || !category || amount <= 0) return error('Tanggal, tenaga kerja, kebun, kategori, dan nominal wajib diisi.', 400);
      if (!canAccessKebun(wc.membership, kebunId)) return error('Kebun ini di luar akses Anda.', 403);
      const [workerRows, kebunRows] = await Promise.all([
        db.get<HarvesterRecord>(dataTable('harvesters', wc.workspaceId), [workerId]),
        db.get<KebunRecord>(dataTable('kebun', wc.workspaceId), [kebunId]),
      ]);
      if (!workerRows[0]) return error('Tenaga kerja tidak ditemukan.', 404);
      if (!kebunRows[0]) return error('Kebun tidak ditemukan.', 404);
      const stamp = now();
      const actor = ctx.user!.email || ctx.user!.userId;
      const record: PayrollManualRecord = {
        date,
        workerId,
        kebunId,
        kind,
        category: category.slice(0, 120),
        amount,
        note: text(body.note).slice(0, 500),
        createdBy: actor,
        updatedBy: actor,
        createdAt: stamp,
        updatedAt: stamp,
      };
      const [id] = await db.add(dataTable('payroll_manual', wc.workspaceId), [record]);
      if (!id) return error('Komponen Payroll gagal disimpan.', 500);
      return json({ id, ...record }, 201);
    },
  ],
  'PUT /api/payroll-manual/:id': [
    requireAuth(),
    requireOpenAccountingDate('date'),
    async ctx => {
      const wc = await workspaceContext(ctx.user!);
      if (!canManagePayroll(wc.membership.role)) return error('Role Anda tidak memiliki akses mengubah komponen Payroll.', 403);
      const key = dataTable('payroll_manual', wc.workspaceId);
      const [existing] = await db.get<PayrollManualRecord>(key, [ctx.params.id]);
      if (!existing) return error('Komponen Payroll tidak ditemukan.', 404);
      const existingPeriodError = await accountingDateWriteError(wc.workspaceId, existing.date);
      if (existingPeriodError) return error(existingPeriodError, 409);
      const runs = await loadPayrollRuns(wc.workspaceId);
      if (payrollRunUsesManual(runs, ctx.params.id)) return error('Komponen sudah masuk proses Payroll dan tidak dapat diubah.', 409);
      const body = objectBody(ctx.body);
      const date = text(body.date);
      const workerId = text(body.workerId);
      const kebunId = text(body.kebunId);
      const kind: PayrollManualKind = text(body.kind) === 'DEDUCTION' ? 'DEDUCTION' : 'EARNING';
      const category = text(body.category);
      const amount = money(body.amount);
      if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !workerId || !kebunId || !category || amount <= 0) return error('Tanggal, tenaga kerja, kebun, kategori, dan nominal wajib diisi.', 400);
      if (!canAccessKebun(wc.membership, kebunId)) return error('Kebun ini di luar akses Anda.', 403);
      const [workerRows, kebunRows] = await Promise.all([
        db.get<HarvesterRecord>(dataTable('harvesters', wc.workspaceId), [workerId]),
        db.get<KebunRecord>(dataTable('kebun', wc.workspaceId), [kebunId]),
      ]);
      if (!workerRows[0]) return error('Tenaga kerja tidak ditemukan.', 404);
      if (!kebunRows[0]) return error('Kebun tidak ditemukan.', 404);
      const record: PayrollManualRecord = {
        ...existing,
        date,
        workerId,
        kebunId,
        kind,
        category: category.slice(0, 120),
        amount,
        note: text(body.note).slice(0, 500),
        updatedBy: ctx.user!.email || ctx.user!.userId,
        updatedAt: now(),
      };
      const [ok] = await db.update(key, [{ id: ctx.params.id, record }]);
      if (!ok) return error('Komponen Payroll gagal diperbarui.', 500);
      return json({ id: ctx.params.id, ...record });
    },
  ],
  'DELETE /api/payroll-manual/:id': [
    requireAuth(),
    async ctx => {
      const wc = await workspaceContext(ctx.user!);
      if (!canManagePayroll(wc.membership.role)) return error('Role Anda tidak memiliki akses menghapus komponen Payroll.', 403);
      const [existing] = await db.get<PayrollManualRecord>(dataTable('payroll_manual', wc.workspaceId), [ctx.params.id]);
      if (!existing) return error('Komponen Payroll tidak ditemukan.', 404);
      const periodError = await accountingDateWriteError(wc.workspaceId, existing.date);
      if (periodError) return error(periodError, 409);
      const runs = await loadPayrollRuns(wc.workspaceId);
      if (payrollRunUsesManual(runs, ctx.params.id)) return error('Komponen sudah masuk proses Payroll dan tidak dapat dihapus.', 409);
      const [ok] = await db.delete(dataTable('payroll_manual', wc.workspaceId), [ctx.params.id]);
      if (!ok) return error('Komponen Payroll tidak ditemukan.', 404);
      return json({ deleted: true });
    },
  ],
  'POST /api/payroll-preview': [
    requireAuth(),
    async ctx => {
      const wc = await workspaceContext(ctx.user!);
      if (!canManagePayroll(wc.membership.role)) return error('Role Anda tidak memiliki akses mereview Payroll.', 403);
      const body = objectBody(ctx.body);
      const periodStart = text(body.periodStart);
      const periodEnd = text(body.periodEnd);
      if (!/^\d{4}-\d{2}-\d{2}$/.test(periodStart) || !/^\d{4}-\d{2}-\d{2}$/.test(periodEnd) || periodStart > periodEnd) return error('Periode Payroll tidak valid.', 400);
      const candidates = await buildPayrollCandidates(wc.workspaceId, wc.membership, periodStart, periodEnd);
      return json({ periodStart, periodEnd, candidates });
    },
  ],
  'POST /api/payroll-runs': [
    requireAuth(),
    requireOpenAccountingDate('periodStart'),
    requireOpenAccountingDate('periodEnd'),
    async ctx => {
      const wc = await workspaceContext(ctx.user!);
      if (!canManagePayroll(wc.membership.role)) return error('Role Anda tidak memiliki akses memproses Payroll.', 403);
      const body = objectBody(ctx.body);
      const periodStart = text(body.periodStart);
      const periodEnd = text(body.periodEnd);
      if (!/^\d{4}-\d{2}-\d{2}$/.test(periodStart) || !/^\d{4}-\d{2}-\d{2}$/.test(periodEnd) || periodStart > periodEnd) return error('Periode Payroll tidak valid.', 400);
      const workerIds = Array.from(new Set((Array.isArray(body.workerIds) ? body.workerIds : []).map(value => text(value)).filter(Boolean))).slice(0, 200);
      if (workerIds.length === 0) return error('Centang minimal satu pekerja untuk diproses Payroll.', 400);
      const requestedDeductions = (Array.isArray(body.receivableDeductions) ? body.receivableDeductions : []).map(value => {
        const row = objectBody(value);
        return { workerId: text(row.workerId), receivableId: text(row.receivableId), amount: money(row.amount) };
      });
      const deductionKeys = new Set<string>();
      for (const item of requestedDeductions) {
        const key = `${item.workerId}:${item.receivableId}`;
        if (!item.workerId || !item.receivableId || item.amount <= 0) return error('Nominal potongan Piutang Karyawan harus lebih dari nol.', 400);
        if (deductionKeys.has(key)) return error('Piutang Karyawan yang sama tidak boleh dipilih dua kali dalam satu proses Payroll.', 400);
        deductionKeys.add(key);
      }
      const candidates = await buildPayrollCandidates(wc.workspaceId, wc.membership, periodStart, periodEnd);
      const selectedCandidates = workerIds
        .map(workerId => candidates.find(candidate => candidate.workerId === workerId))
        .filter((candidate): candidate is PayrollCandidate => Boolean(candidate));
      if (selectedCandidates.length !== workerIds.length) return error('Sebagian pekerja yang dipilih tidak lagi memiliki komponen Payroll terbuka. Tampilkan ulang daftar pekerja.', 409);
      for (const item of requestedDeductions) {
        if (!workerIds.includes(item.workerId)) return error('Potongan Piutang Karyawan hanya dapat dipilih untuk pekerja yang dicentang.', 400);
        const candidate = selectedCandidates.find(row => row.workerId === item.workerId);
        const option = candidate?.receivableOptions.find(row => row.receivableId === item.receivableId);
        if (!option) return error('Piutang Karyawan yang dipilih sudah lunas atau tidak lagi tersedia. Tampilkan ulang daftar pekerja.', 409);
        if (item.amount > option.outstandingAmount) return error(`Potongan piutang ${candidate?.workerName || 'pekerja'} melebihi sisa piutang.`, 409);
      }

      const actor = ctx.user!.email || ctx.user!.userId;
      const stamp = now();
      const records: PayrollRunRecord[] = [];
      let debtLineIndex = 0;
      for (const candidate of selectedCandidates) {
        const lines = [...candidate.lines];
        const fallbackKebunId = candidate.lines.find(line => line.kind === 'EARNING')?.kebunId || candidate.lines[0]?.kebunId || '';
        for (const item of requestedDeductions.filter(row => row.workerId === candidate.workerId)) {
          const option = candidate.receivableOptions.find(row => row.receivableId === item.receivableId)!;
          lines.push({
            sourceKey: `EMPLOYEE_RECEIVABLE:${item.receivableId}:${stamp}:${debtLineIndex++}`,
            sourceType: 'EMPLOYEE_RECEIVABLE',
            sourceId: item.receivableId,
            kebunId: fallbackKebunId,
            date: periodEnd,
            kind: 'DEDUCTION',
            label: `Piutang Karyawan · ${option.description}`,
            amount: item.amount,
          });
        }
        const totals = payrollTotals(lines);
        if (totals.deductions > totals.grossEarnings) return error(`Total potongan Payroll ${candidate.workerName} melebihi penghasilan periode.`, 409);
        records.push({
          payrollNumber: transactionNumber(periodEnd, 'PAY'),
          periodStart,
          periodEnd,
          workerId: candidate.workerId,
          workerName: candidate.workerName,
          lines,
          ...totals,
          status: 'OPEN',
          paymentDate: '',
          accountId: '',
          reference: '',
          note: '',
          transactionIds: [],
          createdBy: actor,
          createdAt: stamp,
          updatedAt: stamp,
        });
      }
      const table = dataTable('payroll_runs', wc.workspaceId);
      const ids = await db.add(table, records.map(record => ({ ...record })));
      const successIds = ids.filter((id): id is string => Boolean(id));
      if (successIds.length !== records.length) {
        if (successIds.length > 0) await db.delete(table, successIds);
        return error('Payroll belum tersimpan lengkap.', 500);
      }
      return json({ created: records.map((record, index) => ({ id: successIds[index], ...record })) }, 201);
    },
  ],
  'DELETE /api/payroll-runs/:id': [
    requireAuth(),
    async ctx => {
      const wc = await workspaceContext(ctx.user!);
      if (!canManagePayroll(wc.membership.role)) return error('Role Anda tidak memiliki akses membatalkan Payroll.', 403);
      const table = dataTable('payroll_runs', wc.workspaceId);
      const [run] = await db.get<PayrollRunRecord>(table, [ctx.params.id]);
      if (!run) return error('Payroll tidak ditemukan.', 404);
      const periodError = await accountingDateWriteError(wc.workspaceId, run.periodEnd);
      if (periodError) return error(periodError, 409);
      if (run.status === 'PAID') return error('Payroll yang sudah dibayar harus dibatalkan pembayarannya terlebih dahulu.', 409);
      const [ok] = await db.delete(table, [ctx.params.id]);
      if (!ok) return error('Payroll gagal dibatalkan.', 500);
      return json({ deleted: true });
    },
  ],
  'POST /api/payroll-runs/:id/pay': [
    requireAuth(),
    requireOpenAccountingDate('date'),
    async ctx => {
      const wc = await workspaceContext(ctx.user!);
      if (!canManagePayroll(wc.membership.role)) return error('Role Anda tidak memiliki akses membayar Payroll.', 403);
      const table = dataTable('payroll_runs', wc.workspaceId);
      const [run] = await db.get<PayrollRunRecord>(table, [ctx.params.id]);
      if (!run) return error('Payroll tidak ditemukan.', 404);
      if (run.status === 'PAID') return error('Payroll ini sudah dibayar.', 409);
      if (run.netPay <= 0) return error('Payroll dengan netto nol tidak memerlukan pembayaran Kas/Bank.', 409);
      const body = objectBody(ctx.body);
      const date = text(body.date);
      const accountId = text(body.accountId);
      if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !accountId) return error('Tanggal dan akun pembayaran wajib diisi.', 400);
      const [account] = await db.get<AccountRecord>(dataTable('accounts', wc.workspaceId), [accountId]);
      if (!account) return error('Akun Kas/Bank tidak ditemukan.', 404);
      const grossByKebun = new Map<string, number>();
      (run.lines || []).filter(line => line.kind === 'EARNING').forEach(line => {
        grossByKebun.set(line.kebunId, (grossByKebun.get(line.kebunId) || 0) + line.amount);
      });
      const kebunIds = Array.from(grossByKebun.keys());
      const weights = kebunIds.map(id => grossByKebun.get(id) || 0);
      const parts = allocateProportional(run.netPay, weights);
      const actor = ctx.user!.email || ctx.user!.userId;
      const stamp = now();
      const reference = text(body.reference).slice(0, 120);
      const note = text(body.note).slice(0, 500);
      const cashRows: TransactionRecord[] = kebunIds.map((kebunId, index) => ({
        transactionNumber: `${run.payrollNumber}-${index + 1}`,
        kind: 'NORMAL',
        sourceType: 'PAYROLL_PAYMENT',
        sourceId: ctx.params.id,
        date,
        kebunId,
        accountId,
        direction: 'OUT',
        category: 'Pembayaran Payroll',
        description: `Payroll ${run.workerName} · ${run.periodStart} s.d. ${run.periodEnd}`.slice(0, 500),
        amount: parts[index],
        reference,
        createdBy: actor,
        updatedBy: actor,
        createdAt: stamp,
        updatedAt: stamp,
      })).filter(row => row.amount > 0);
      const txIds = await db.add(dataTable('transactions', wc.workspaceId), cashRows);
      const successTxIds = txIds.filter((id): id is string => Boolean(id));
      if (successTxIds.length !== cashRows.length) {
        if (successTxIds.length > 0) await db.delete(dataTable('transactions', wc.workspaceId), successTxIds);
        return error('Mutasi Kas/Bank Payroll belum tersimpan lengkap.', 500);
      }
      const updatedRun: PayrollRunRecord = {
        ...run,
        status: 'PAID',
        paymentDate: date,
        accountId,
        reference,
        note,
        transactionIds: successTxIds,
        updatedAt: stamp,
      };
      const [updated] = await db.update(table, [{ id: ctx.params.id, record: updatedRun }]);
      if (!updated) {
        if (successTxIds.length > 0) await db.delete(dataTable('transactions', wc.workspaceId), successTxIds);
        return error('Status pembayaran Payroll belum dapat disimpan.', 500);
      }
      return json({ id: ctx.params.id, ...updatedRun });
    },
  ],
  'DELETE /api/payroll-runs/:id/payment': [
    requireAuth(),
    async ctx => {
      const wc = await workspaceContext(ctx.user!);
      if (!canManagePayroll(wc.membership.role)) return error('Role Anda tidak memiliki akses membatalkan pembayaran Payroll.', 403);
      const table = dataTable('payroll_runs', wc.workspaceId);
      const [run] = await db.get<PayrollRunRecord>(table, [ctx.params.id]);
      if (!run) return error('Payroll tidak ditemukan.', 404);
      const periodError = await accountingDateWriteError(wc.workspaceId, run.paymentDate);
      if (periodError) return error(periodError, 409);
      if (run.status !== 'PAID') return error('Payroll ini belum memiliki pembayaran.', 409);
      const linkedIds = run.transactionIds || [];
      if (linkedIds.length > 0) {
        const existingTx = await db.get<TransactionRecord>(dataTable('transactions', wc.workspaceId), linkedIds);
        const idsToDelete = linkedIds.filter((_, index) => Boolean(existingTx[index]));
        if (idsToDelete.length > 0) {
          const deletedTx = await db.delete(dataTable('transactions', wc.workspaceId), idsToDelete);
          if (!deletedTx.every(Boolean)) return error('Mutasi Kas/Bank Payroll belum terhapus sempurna.', 500);
        }
      }
      const reopened: PayrollRunRecord = {
        ...run,
        status: 'OPEN',
        paymentDate: '',
        accountId: '',
        reference: '',
        note: '',
        transactionIds: [],
        updatedAt: now(),
      };
      const [updated] = await db.update(table, [{ id: ctx.params.id, record: reopened }]);
      if (!updated) return error('Pembayaran Payroll belum dapat dibatalkan.', 500);
      return json({ id: ctx.params.id, ...reopened });
    },
  ],
  'POST /api/tbs-cost-payments': [
    requireAuth(),
    requireOpenAccountingDate('date'),
    async ctx => {
      const wc = await workspaceContext(ctx.user!);
      if (!canManagePayables(wc.membership.role)) return error('Role Anda tidak memiliki akses mencatat pembayaran hutang TBS.', 403);
      const body = objectBody(ctx.body);
      const date = text(body.date);
      const component = costComponent(body.component);
      const creditorKey = text(body.creditorKey);
      const accountId = text(body.accountId);
      const amount = money(body.amount);
      const rawAllocations = Array.isArray(body.allocations) ? body.allocations.slice(0, 100) : [];
      if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !component || !creditorKey || !accountId || amount <= 0 || rawAllocations.length === 0) {
        return error('Tanggal, jenis hutang, penerima, akun pembayaran, nominal, dan alokasi DO wajib diisi.', 400);
      }
      const [accountRows, tbsRows, existingPayments, harvesterRows, vehicleRows] = await Promise.all([
        db.get<AccountRecord>(dataTable('accounts', wc.workspaceId), [accountId]),
        loadTbs(wc.workspaceId),
        loadTbsCostPayments(wc.workspaceId),
        db.list<HarvesterRecord>(dataTable('harvesters', wc.workspaceId), { limit: 200 }),
        db.list<VehicleRecord>(dataTable('vehicles', wc.workspaceId), { limit: 100 }),
      ]);
      const account = accountRows[0];
      if (!account) return error('Akun kas/bank tidak ditemukan.', 404);
      const requested = new Map<string, number>();
      for (const raw of rawAllocations) {
        const item = objectBody(raw);
        const tbsId = text(item.tbsId);
        const allocationAmount = money(item.amount);
        if (tbsId && allocationAmount > 0) requested.set(tbsId, (requested.get(tbsId) || 0) + allocationAmount);
      }
      if (requested.size === 0) return error('Minimal satu alokasi DO harus memiliki nominal.', 400);
      const allocations: TbsCostPaymentAllocation[] = [];
      let creditorName = '';
      for (const [tbsId, allocationAmount] of requested.entries()) {
        const tbs = tbsRows.find(item => item.id === tbsId);
        if (!tbs) return error('DO untuk pembayaran hutang tidak ditemukan.', 404);
        const incurred = costAmountForTbs(tbs, component);
        if (incurred <= 0) return error(`DO ${tbs.doNumber} tidak memiliki ${costLabel(component).toLowerCase()}.`, 400);
        const creditor = costCreditor(component, tbs, harvesterRows.items, vehicleRows.items);
        if (creditor.key !== creditorKey) return error('Semua alokasi harus untuk penerima yang sama.', 400);
        creditorName = creditor.name;
        const outstanding = Math.max(0, incurred - paidCostAmount(existingPayments, tbsId, component));
        if (allocationAmount > outstanding) return error(`Alokasi DO ${tbs.doNumber} melebihi sisa hutang.`, 409);
        allocations.push({ tbsId, kebunId: tbs.kebunId, doNumber: tbs.doNumber, component, creditorKey, creditorName, amount: allocationAmount });
      }
      const allocationTotal = allocations.reduce((sum, item) => sum + item.amount, 0);
      if (allocationTotal !== amount) return error('Total alokasi DO harus sama dengan nominal pembayaran.', 400);
      const stamp = now();
      const actor = ctx.user!.email || ctx.user!.userId;
      const paymentNumber = transactionNumber(date, 'CST');
      const paymentRecord: TbsCostPaymentRecord = {
        paymentNumber,
        date,
        component,
        creditorKey,
        creditorName,
        accountId,
        amount,
        reference: text(body.reference).slice(0, 120),
        note: text(body.note).slice(0, 500),
        allocations,
        transactionIds: [],
        createdBy: actor,
        createdAt: stamp,
      };
      const paymentTable = dataTable('tbs_cost_payments', wc.workspaceId);
      const [paymentId] = await db.add(paymentTable, [paymentRecord]);
      if (!paymentId) return error('Pembayaran hutang TBS gagal disimpan.', 500);
      const grouped = new Map<string, { amount: number; doNumbers: string[] }>();
      for (const allocation of allocations) {
        const current = grouped.get(allocation.kebunId) || { amount: 0, doNumbers: [] };
        current.amount += allocation.amount;
        current.doNumbers.push(allocation.doNumber);
        grouped.set(allocation.kebunId, current);
      }
      const cashRows: TransactionRecord[] = Array.from(grouped.entries()).map(([kebunId, group], index) => ({
        transactionNumber: `${paymentNumber}-${index + 1}`,
        kind: 'NORMAL',
        sourceType: 'TBS_COST_PAYMENT',
        sourceId: paymentId,
        date,
        kebunId,
        accountId,
        direction: 'OUT',
        category: `Pembayaran Hutang ${costLabel(component)}`,
        description: `${costLabel(component)} · ${creditorName} · DO ${group.doNumbers.join(', ')}`.slice(0, 500),
        amount: group.amount,
        reference: paymentRecord.reference,
        createdBy: actor,
        updatedBy: actor,
        createdAt: stamp,
        updatedAt: stamp,
      }));
      const txIds = await db.add(dataTable('transactions', wc.workspaceId), cashRows);
      const successTxIds = txIds.filter((id): id is string => Boolean(id));
      if (successTxIds.length !== cashRows.length) {
        if (successTxIds.length) await db.delete(dataTable('transactions', wc.workspaceId), successTxIds);
        await db.delete(paymentTable, [paymentId]);
        return error('Mutasi Kas/Bank pembayaran hutang belum tersimpan lengkap.', 500);
      }
      const completedPayment = { ...paymentRecord, transactionIds: successTxIds };
      const [updated] = await db.update(paymentTable, [{ id: paymentId, record: completedPayment }]);
      if (!updated) {
        await db.delete(dataTable('transactions', wc.workspaceId), successTxIds);
        await db.delete(paymentTable, [paymentId]);
        return error('Pembayaran hutang TBS belum dapat diselesaikan.', 500);
      }
      return json({ id: paymentId, ...completedPayment }, 201);
    },
  ],
  'DELETE /api/tbs-cost-payments/:id': [
    requireAuth(),
    async ctx => {
      const wc = await workspaceContext(ctx.user!);
      if (!canManagePayables(wc.membership.role)) return error('Role Anda tidak memiliki akses menghapus pembayaran hutang TBS.', 403);
      const paymentTable = dataTable('tbs_cost_payments', wc.workspaceId);
      const [payment] = await db.get<TbsCostPaymentRecord>(paymentTable, [ctx.params.id]);
      if (!payment) return error('Pembayaran hutang TBS tidak ditemukan.', 404);
      const periodError = await accountingDateWriteError(wc.workspaceId, payment.date);
      if (periodError) return error(periodError, 409);
      const linkedIds = payment.transactionIds || [];
      if (linkedIds.length > 0) {
        const existingTx = await db.get<TransactionRecord>(dataTable('transactions', wc.workspaceId), linkedIds);
        const idsToDelete = linkedIds.filter((_, index) => Boolean(existingTx[index]));
        if (idsToDelete.length > 0) {
          const deletedTx = await db.delete(dataTable('transactions', wc.workspaceId), idsToDelete);
          if (!deletedTx.every(Boolean)) return error('Mutasi Kas/Bank pembayaran hutang belum terhapus sempurna.', 500);
        }
      }
      const [deleted] = await db.delete(paymentTable, [ctx.params.id]);
      if (!deleted) return error('Pembayaran hutang TBS gagal dihapus.', 500);
      return json({ deleted: true });
    },
  ],
});


/* v4.13 multi-unit backend */
