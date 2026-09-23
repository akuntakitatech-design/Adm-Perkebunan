import { useEffect, useMemo, useState } from 'react';
import { api } from './lib/client';
import { BookOpen, ChevronRight, FilePenLine, Landmark, Link2, ListTree, Pencil, Plus, Save, Scale, Trash2 } from 'lucide-react';
import { readStoredChoice, storeChoice } from './navigationState';
import AccountingFoundation from './AccountingFoundation';
import AccountSearchPicker from './AccountSearchPicker';
import SystemAccounts from './SystemAccounts';
import { formatMoneyInput } from './moneyInput';

type Role = 'OWNER' | 'ADMIN_PUSAT' | 'FINANCE' | 'ADMIN_KEBUN' | 'VIEWER';
export type AccountingGroup = 'ASSET' | 'LIABILITY' | 'EQUITY' | 'REVENUE' | 'EXPENSE';
export type NormalBalance = 'DEBIT' | 'CREDIT';
export type CashFlowClass = 'OPERATING' | 'INVESTING' | 'FINANCING' | 'NON_CASH';
export type AccountingAccount = { id: string; code: string; name: string; group: AccountingGroup; normalBalance: NormalBalance; systemKey: string; level?: 1 | 2 | 3 | 4; parentId?: string; posting?: boolean; templateKey?: string; cashFlowClass?: CashFlowClass; active: boolean; locked: boolean };
export type JournalLine = { accountId: string; kebunId: string; debit: number; credit: number; memo: string };
export type JournalEntry = { id: string; journalNumber: string; date: string; description: string; reference: string; source: string; auto: boolean; lines: JournalLine[]; createdAt?: string };
export type ManualJournal = { id: string; journalNumber: string; date: string; description: string; reference: string; sourceType?: 'STOCKTAKE'; sourceId?: string; lines: JournalLine[]; createdAt: string };
type PurchaseInvoiceLine = { kind: 'SERVICE' | 'INVENTORY'; itemId?: string; tracksStock?: boolean; kebunId?: string; description: string; quantity: number; unit: string; unitPrice: number; debitAccountId: string; discountType?: 'AMOUNT' | 'PERCENT'; discountValue?: number; discountAmount?: number; lineTotal: number; netTotal?: number };
export type PurchaseInvoice = { id: string; purchaseNumber?: string; date: string; dueDate: string; supplierId: string; kebunId: string; invoiceNumber: string; debitAccountId: string; lines?: PurchaseInvoiceLine[]; subtotal?: number; discountType?: 'AMOUNT' | 'PERCENT'; discountValue?: number; discountAmount?: number; vatPercent?: number; vatAmount?: number; paymentType: 'CASH' | 'CREDIT'; accountId: string; description: string; amount: number; supplierBillId: string; transactionId: string; createdAt: string };
export type InventoryUsage = { id: string; usageNumber: string; date: string; reference: string; description: string; lines: Array<{ itemId: string; kebunId: string; debitAccountId: string; inventoryAccountId: string; quantity: number; unit: string; unitCost: number; amount: number; memo: string }>; totalAmount: number; createdAt: string };
type Transaction = { id: string; transactionNumber?: string; kind?: 'NORMAL' | 'TRANSFER'; transferId?: string; sourceType?: 'TBS_PAYMENT' | 'TBS_COST_PAYMENT' | 'SUPPLIER_PAYMENT' | 'PAYROLL_PAYMENT' | 'EMPLOYEE_RECEIVABLE_DISBURSEMENT' | 'PURCHASE_INVOICE'; sourceId?: string; date: string; kebunId: string; accountId: string; direction: 'IN' | 'OUT'; category: string; description: string; amount: number; reference: string; allocations?: Array<{ accountId: string; kebunId?: string; amount: number; memo: string }>; createdAt: string };
type Data = {
  workspace: { id: string; role: Role };
  kebun: Array<{ id: string; code: string; name: string }>;
  accounts: Array<{ id: string; name: string; type: 'KAS' | 'BANK' }>;
  transactions: Transaction[];
  tbs: Array<{ id: string; date: string; factoryDate: string; doNumber: string; kebunId: string; harvestCost: number; weighingCost?: number; langsirCost: number; harvestWeightBasis: 'LAPANGAN' | 'PABRIK'; weighingWeightBasis?: 'LAPANGAN' | 'PABRIK'; langsirWeightBasis: 'LAPANGAN' | 'PABRIK'; netRevenue: number }>;
  suppliers: Array<{ id: string; code: string; name: string; active: boolean }>;
  mills: Array<{ id: string; name: string }>;
  harvesters: Array<{ id: string; name: string }>;
  supplierBills: Array<{ id: string; sourceType?: 'TBS_ARMADA' | 'PURCHASE_INVOICE'; accountingDebitAccountId?: string; date: string; supplierId: string; kebunId: string; invoiceNumber: string; category: string; description: string; amount: number }>;
  workEntries: Array<{ id: string; date: string; kebunId: string; workName: string; amount: number }>;
  payrollRuns: Array<{ id: string; payrollNumber: string; workerName: string; lines: Array<{ sourceType: 'TBS_PANEN' | 'TBS_TIMBANG' | 'TBS_LANGSIR' | 'KEBUN_WORK' | 'MANUAL' | 'EMPLOYEE_RECEIVABLE'; sourceId: string; kebunId: string; date: string; kind: 'EARNING' | 'DEDUCTION'; label: string; amount: number }>; createdAt: string }>;
};
export type AccountingData = Data;
type Props = { data: Data; flash: (text: string) => void; showError: (text: string) => void };

const idr = new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 });
const groups: AccountingGroup[] = ['ASSET', 'LIABILITY', 'EQUITY', 'REVENUE', 'EXPENSE'];
const groupLabels: Record<AccountingGroup, string> = { ASSET: 'Aset', LIABILITY: 'Liabilitas', EQUITY: 'Ekuitas', REVENUE: 'Pendapatan', EXPENSE: 'Beban' };
function today() { return new Date().toISOString().slice(0, 10); }
function formatDate(value: string) { return new Intl.DateTimeFormat('id-ID', { day: '2-digit', month: 'short', year: 'numeric' }).format(new Date(`${value}T00:00:00`)); }
function apiError(err: unknown, fallback: string) { const response = (err as { response?: { data?: { error?: string; message?: string } } })?.response?.data; return response?.error || response?.message || fallback; }
function blankManual() { return { id: '', date: today(), description: '', reference: '', kebunId: '', lines: [{ accountId: '', debit: '', credit: '', memo: '' }, { accountId: '', debit: '', credit: '', memo: '' }] }; }
function expenseKey(category: string) { const value = category.toLowerCase(); if (value.includes('pupuk')) return 'EXP_FERTILIZER'; if (value.includes('racun') || value.includes('herbisida')) return 'EXP_HERBICIDE'; if (value.includes('bbm')) return 'EXP_FUEL'; if (value.includes('peralatan') || value.includes('suku cadang')) return 'EXP_TOOLS'; if (value.includes('perawatan')) return 'EXP_MAINTENANCE'; if (value.includes('armada') || value.includes('transport')) return 'EXP_TRANSPORT'; if (value.includes('administrasi')) return 'EXP_ADMIN'; if (value.includes('panen')) return 'EXP_HARVEST'; return 'EXP_OTHER'; }
function purchaseNetDebits(invoice: PurchaseInvoice) {
  const lines = invoice.lines?.length ? invoice.lines : [{ kind: 'SERVICE' as const, kebunId: invoice.kebunId, description: invoice.description, quantity: 1, unit: 'unit', unitPrice: invoice.subtotal || invoice.amount, debitAccountId: invoice.debitAccountId, lineTotal: invoice.subtotal || Math.max(0, invoice.amount - (invoice.vatAmount || 0) + (invoice.discountAmount || 0)) }];
  const lineDiscountTotal = lines.reduce((sum, line) => sum + Math.max(0, line.discountAmount || 0), 0);
  const lineNet = lines.map(line => Math.max(0, line.netTotal ?? (line.lineTotal - (line.discountAmount || 0))));
  const lineNetTotal = lineNet.reduce((sum, amount) => sum + amount, 0);
  const additionalDiscount = Math.max(0, (invoice.discountAmount || 0) - lineDiscountTotal);
  const targetNet = Math.max(0, lineNetTotal - additionalDiscount);
  let allocated = 0;
  return lines.map((line, index) => {
    const amount = additionalDiscount <= 0 ? lineNet[index] : index === lines.length - 1 ? targetNet - allocated : Math.round(targetNet * lineNet[index] / Math.max(1, lineNetTotal));
    allocated += amount;
    return { accountId: line.debitAccountId, kebunId: line.kebunId || invoice.kebunId, amount, memo: line.description };
  });
}
export function buildAutomaticJournals(data: Data, accounts: AccountingAccount[], invoices: PurchaseInvoice[], systemAccountIds: Record<string, string> = {}, inventoryUsages: InventoryUsage[] = []): JournalEntry[] {
  const byKey = new Map(accounts.map(item => [item.systemKey, item]));
  const byId = new Map(accounts.map(item => [item.id, item]));
  const rows: JournalEntry[] = [];
  const push = (id: string, journalNumber: string, date: string, description: string, reference: string, source: string, debitAccountId: string | undefined, creditAccountId: string | undefined, amount: number, kebunId = '') => { if (!debitAccountId || !creditAccountId || amount <= 0 || debitAccountId === creditAccountId) return; rows.push({ id, journalNumber, date, description, reference, source, auto: true, lines: [{ accountId: debitAccountId, kebunId, debit: amount, credit: 0, memo: description }, { accountId: creditAccountId, kebunId, debit: 0, credit: amount, memo: description }] }); };
  const keyId = (key: string) => systemAccountIds[key] || byKey.get(key)?.id;
  const cashId = (operationalAccountId: string) => keyId(`CASH:${operationalAccountId}`);
  for (const invoice of invoices) {
    const creditAccountId = invoice.paymentType === 'CREDIT' ? keyId('AP_SUPPLIER') : cashId(invoice.accountId);
    if (!creditAccountId || invoice.amount <= 0) continue;
    const netDebits = purchaseNetDebits(invoice).filter(item => item.accountId && item.amount > 0);
    const lines: JournalLine[] = netDebits.map(item => ({ accountId: item.accountId, kebunId: item.kebunId || '', debit: item.amount, credit: 0, memo: item.memo }));
    const vatAccountId = keyId('VAT_INPUT');
    const netBase = netDebits.reduce((sum, item) => sum + item.amount, 0);
    let allocatedVat = 0;
    if ((invoice.vatAmount || 0) > 0 && vatAccountId && netBase > 0) {
      netDebits.forEach((item, index) => {
        const vat = index === netDebits.length - 1 ? (invoice.vatAmount || 0) - allocatedVat : Math.round((invoice.vatAmount || 0) * item.amount / netBase);
        allocatedVat += vat;
        if (vat > 0) lines.push({ accountId: vatAccountId, kebunId: item.kebunId || '', debit: vat, credit: 0, memo: 'PPN Masukan' });
      });
    }
    const debitTotal = lines.reduce((sum, line) => sum + line.debit, 0);
    if (debitTotal !== invoice.amount) continue;
    const creditByKebun = new Map<string, number>();
    lines.forEach(line => creditByKebun.set(line.kebunId || '', (creditByKebun.get(line.kebunId || '') || 0) + line.debit));
    for (const [kebunId, amount] of creditByKebun) lines.push({ accountId: creditAccountId, kebunId, debit: 0, credit: amount, memo: invoice.description });
    const creditTotal = lines.reduce((sum, line) => sum + line.credit, 0);
    if (creditTotal !== invoice.amount) continue;
    rows.push({ id: `PURCHASE-${invoice.id}`, journalNumber: invoice.purchaseNumber || `AUTO-PB-${invoice.id.slice(0, 8)}`, date: invoice.date, description: `Invoice Pembelian · ${invoice.description}`, reference: invoice.invoiceNumber, source: invoice.paymentType === 'CREDIT' ? 'PURCHASE_CREDIT' : 'PURCHASE_CASH', auto: true, lines });
  }
  for (const usage of inventoryUsages) {
    const lines: JournalLine[] = usage.lines.flatMap(line => line.amount > 0 ? [
      { accountId: line.debitAccountId, kebunId: line.kebunId || '', debit: line.amount, credit: 0, memo: line.memo || usage.description || 'Pemakaian Barang' },
      { accountId: line.inventoryAccountId, kebunId: line.kebunId || '', debit: 0, credit: line.amount, memo: line.memo || usage.description || 'Pemakaian Barang' },
    ] : []);
    const debit = lines.reduce((sum, line) => sum + line.debit, 0);
    const credit = lines.reduce((sum, line) => sum + line.credit, 0);
    if (lines.length > 0 && debit > 0 && debit === credit) rows.push({ id: `INV-USE-${usage.id}`, journalNumber: usage.usageNumber, date: usage.date, description: usage.description || 'Pemakaian Barang', reference: usage.reference, source: 'INVENTORY_USAGE', auto: true, lines, createdAt: usage.createdAt });
  }
  for (const item of data.tbs) {
    if (item.netRevenue > 0) push(`TBS-REV-${item.id}`, `AUTO-TBS-${item.id.slice(0, 8)}`, item.factoryDate || item.date, `Penjualan TBS · DO ${item.doNumber}`, item.doNumber, 'TBS', keyId('AR_PKS'), keyId('REVENUE_TBS'), item.netRevenue, item.kebunId);
    if (item.harvestCost > 0) push(`TBS-PANEN-${item.id}`, `AUTO-PAN-${item.id.slice(0, 8)}`, item.harvestWeightBasis === 'PABRIK' ? (item.factoryDate || item.date) : item.date, `Upah Panen · DO ${item.doNumber}`, item.doNumber, 'TBS_PANEN', keyId('EXP_HARVEST'), keyId('PAYROLL_PAYABLE'), item.harvestCost, item.kebunId);
    if ((item.weighingCost || 0) > 0) push(`TBS-TIMBANG-${item.id}`, `AUTO-TIM-${item.id.slice(0, 8)}`, item.weighingWeightBasis === 'PABRIK' ? (item.factoryDate || item.date) : item.date, `Upah Timbang · DO ${item.doNumber}`, item.doNumber, 'TBS_TIMBANG', keyId('EXP_WEIGH'), keyId('PAYROLL_PAYABLE'), item.weighingCost || 0, item.kebunId);
    if (item.langsirCost > 0) push(`TBS-LANGSIR-${item.id}`, `AUTO-LAN-${item.id.slice(0, 8)}`, item.langsirWeightBasis === 'PABRIK' ? (item.factoryDate || item.date) : item.date, `Upah Langsir · DO ${item.doNumber}`, item.doNumber, 'TBS_LANGSIR', keyId('EXP_LANGSIR'), keyId('PAYROLL_PAYABLE'), item.langsirCost, item.kebunId);
  }
  for (const bill of data.supplierBills) { if (bill.sourceType === 'PURCHASE_INVOICE') continue; const debit = bill.accountingDebitAccountId && byId.has(bill.accountingDebitAccountId) ? bill.accountingDebitAccountId : keyId(expenseKey(bill.category)); push(`SUP-BILL-${bill.id}`, `AUTO-HUT-${bill.id.slice(0, 8)}`, bill.date, bill.description || bill.category, bill.invoiceNumber, 'SUPPLIER_BILL', debit, keyId('AP_SUPPLIER'), bill.amount, bill.kebunId); }
  for (const work of data.workEntries) push(`WORK-${work.id}`, `AUTO-KER-${work.id.slice(0, 8)}`, work.date, `Pekerjaan Kebun · ${work.workName}`, '', 'KEBUN_WORK', keyId('EXP_WORK'), keyId('PAYROLL_PAYABLE'), work.amount, work.kebunId);
  for (const run of data.payrollRuns) for (const line of run.lines || []) { if (line.sourceType === 'MANUAL' && line.kind === 'EARNING') push(`PAY-MAN-E-${run.id}-${line.sourceId}`, `AUTO-PAY-${run.id.slice(0, 8)}`, line.date, `${line.label} · ${run.workerName}`, run.payrollNumber, 'PAYROLL_MANUAL', keyId('EXP_OTHER'), keyId('PAYROLL_PAYABLE'), line.amount, line.kebunId); if (line.sourceType === 'MANUAL' && line.kind === 'DEDUCTION') push(`PAY-MAN-D-${run.id}-${line.sourceId}`, `AUTO-POT-${run.id.slice(0, 8)}`, line.date, `${line.label} · ${run.workerName}`, run.payrollNumber, 'PAYROLL_DEDUCTION', keyId('PAYROLL_PAYABLE'), keyId('PAYROLL_DEDUCTION'), line.amount, line.kebunId); if (line.sourceType === 'EMPLOYEE_RECEIVABLE') push(`PAY-PIU-${run.id}-${line.sourceId}`, `AUTO-PIU-${run.id.slice(0, 8)}`, line.date, `Potongan Piutang Karyawan · ${run.workerName}`, run.payrollNumber, 'EMPLOYEE_RECEIVABLE_DEDUCTION', keyId('PAYROLL_PAYABLE'), keyId('AR_EMPLOYEE'), line.amount, line.kebunId); }
  const handledTransfers = new Set<string>();
  for (const tx of data.transactions) {
    if (tx.kind === 'TRANSFER' && tx.transferId) { if (handledTransfers.has(tx.transferId)) continue; handledTransfers.add(tx.transferId); const pair = data.transactions.filter(item => item.kind === 'TRANSFER' && item.transferId === tx.transferId); const out = pair.find(item => item.direction === 'OUT'); const incoming = pair.find(item => item.direction === 'IN'); if (out && incoming) push(`TRF-${tx.transferId}`, `AUTO-TRF-${tx.transferId.slice(0, 8)}`, tx.date, tx.description || 'Transfer Antar Akun', tx.reference, 'TRANSFER', cashId(incoming.accountId), cashId(out.accountId), out.amount); continue; }
    if (tx.kind === 'TRANSFER') continue;
    const cash = cashId(tx.accountId); if (!cash) continue;
    if (tx.sourceType === 'TBS_PAYMENT') push(`TX-${tx.id}`, tx.transactionNumber || `AUTO-${tx.id.slice(0, 8)}`, tx.date, tx.description, tx.reference, 'TBS_PAYMENT', cash, keyId('AR_PKS'), tx.amount, tx.kebunId);
    else if (tx.sourceType === 'SUPPLIER_PAYMENT') push(`TX-${tx.id}`, tx.transactionNumber || `AUTO-${tx.id.slice(0, 8)}`, tx.date, tx.description, tx.reference, 'SUPPLIER_PAYMENT', keyId('AP_SUPPLIER'), cash, tx.amount, tx.kebunId);
    else if (tx.sourceType === 'PAYROLL_PAYMENT') push(`TX-${tx.id}`, tx.transactionNumber || `AUTO-${tx.id.slice(0, 8)}`, tx.date, tx.description, tx.reference, 'PAYROLL_PAYMENT', keyId('PAYROLL_PAYABLE'), cash, tx.amount, tx.kebunId);
    else if (tx.sourceType === 'EMPLOYEE_RECEIVABLE_DISBURSEMENT') push(`TX-${tx.id}`, tx.transactionNumber || `AUTO-${tx.id.slice(0, 8)}`, tx.date, tx.description, tx.reference, 'EMPLOYEE_RECEIVABLE', keyId('AR_EMPLOYEE'), cash, tx.amount, tx.kebunId);
    else if (tx.sourceType === 'PURCHASE_INVOICE') continue;
    else if (tx.sourceType === 'TBS_COST_PAYMENT') { const debit = tx.category.toLowerCase().includes('armada') ? keyId('AP_SUPPLIER') : keyId('PAYROLL_PAYABLE'); push(`TX-${tx.id}`, tx.transactionNumber || `AUTO-${tx.id.slice(0, 8)}`, tx.date, tx.description, tx.reference, 'LEGACY_COST_PAYMENT', debit, cash, tx.amount, tx.kebunId); }
    else if (!tx.sourceType && tx.allocations?.length) {
      const allocations = tx.allocations.filter(item => item.amount > 0 && byId.has(item.accountId));
      const allocatedTotal = allocations.reduce((sum, item) => sum + item.amount, 0);
      if (allocatedTotal !== tx.amount || allocations.length !== tx.allocations.length) continue;
      const description = tx.description || tx.category || 'Transaksi Kas/Bank';
      const allocationKebunId = (item: NonNullable<Transaction['allocations']>[number]) => item.kebunId === undefined ? tx.kebunId : item.kebunId;
      const allocationLines: JournalLine[] = allocations.map(item => ({
        accountId: item.accountId,
        kebunId: allocationKebunId(item),
        debit: tx.direction === 'OUT' ? item.amount : 0,
        credit: tx.direction === 'IN' ? item.amount : 0,
        memo: item.memo || description,
      }));
      const cashLines: JournalLine[] = allocations.map(item => ({
        accountId: cash,
        kebunId: allocationKebunId(item),
        debit: tx.direction === 'IN' ? item.amount : 0,
        credit: tx.direction === 'OUT' ? item.amount : 0,
        memo: item.memo || description,
      }));
      rows.push({
        id: `TX-${tx.id}`,
        journalNumber: tx.transactionNumber || `AUTO-${tx.id.slice(0, 8)}`,
        date: tx.date,
        description,
        reference: tx.reference,
        source: 'CASH_MANUAL',
        auto: true,
        lines: tx.direction === 'IN' ? [...cashLines, ...allocationLines] : [...allocationLines, ...cashLines],
      });
    }
    else if (!tx.sourceType) {
      if (tx.direction === 'IN') {
        const credit = tx.category === 'Setoran Modal' ? keyId('CAPITAL') : tx.category === 'Penerimaan Piutang' ? keyId('AR_PKS') : tx.category === 'Penjualan TBS' ? keyId('REVENUE_TBS') : keyId('REVENUE_OTHER');
        push(`TX-${tx.id}`, tx.transactionNumber || `AUTO-${tx.id.slice(0, 8)}`, tx.date, tx.description || tx.category, tx.reference, 'CASH_MANUAL_LEGACY', cash, credit, tx.amount, tx.kebunId);
      } else {
        const debit = tx.category === 'Pembayaran Hutang' ? keyId('AP_SUPPLIER') : keyId(expenseKey(tx.category));
        push(`TX-${tx.id}`, tx.transactionNumber || `AUTO-${tx.id.slice(0, 8)}`, tx.date, tx.description || tx.category, tx.reference, 'CASH_MANUAL_LEGACY', debit, cash, tx.amount, tx.kebunId);
      }
    }
  }
  return rows.sort((a, b) => `${a.date}${a.journalNumber}`.localeCompare(`${b.date}${b.journalNumber}`));
}

export default function AccountingModule({ data, flash, showError }: Props) {
  const storageKey = 'perkebunan.navigation.accounting.hub';
  const accountingModes = ['hub', 'journal', 'manual', 'coa', 'system', 'opening', 'periods', 'ledger', 'trial'] as const;
  type AccountingMode = (typeof accountingModes)[number];
  // v88-move-accounting-reports
  const [mode, setMode] = useState<AccountingMode>(() => { const stored = readStoredChoice(storageKey, accountingModes, 'hub'); return stored === 'journal' || stored === 'ledger' || stored === 'trial' ? 'hub' : stored; });
  const [accounts, setAccounts] = useState<AccountingAccount[]>([]);
  const [systemAccountIds, setSystemAccountIds] = useState<Record<string, string>>({});
  const [manualJournals, setManualJournals] = useState<ManualJournal[]>([]);
  const [purchaseInvoices, setPurchaseInvoices] = useState<PurchaseInvoice[]>([]);
  const [inventoryUsages, setInventoryUsages] = useState<InventoryUsage[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [month, setMonth] = useState(today().slice(0, 7));
  const [sourceFilter, setSourceFilter] = useState<'ALL' | 'AUTO' | 'MANUAL'>('ALL');
  const [manualForm, setManualForm] = useState(blankManual());
  const [openingBalance, setOpeningBalance] = useState<{ cutoffDate: string; status: 'DRAFT' | 'POSTED'; postedLines?: JournalLine[] } | null>(null);
  const [ledgerAccountId, setLedgerAccountId] = useState('');
  const changeMode = (next: AccountingMode) => { setMode(next); storeChoice(storageKey, next); };
  const accountingModeLabel = mode === 'journal' ? 'Jurnal Umum' : mode === 'manual' ? 'Jurnal Umum / Penyesuaian' : mode === 'coa' ? 'Chart of Accounts' : mode === 'system' ? 'Akun Penting' : mode === 'opening' ? 'Saldo Awal' : mode === 'periods' ? 'Periode Akuntansi' : mode === 'ledger' ? 'Buku Besar' : mode === 'trial' ? 'Neraca Saldo' : 'Akuntansi';
  const load = async () => { try { setLoading(true); const [accountRes, journalRes, invoiceRes, usageRes, foundationRes] = await Promise.all([api.get('/api/accounting/accounts'), api.get('/api/accounting/manual-journals'), api.get('/api/purchase-invoices'), api.get('/api/inventory-usages'), api.get('/api/accounting/foundation')]); const accountPayload = accountRes.data as { accounts: AccountingAccount[]; systemMappings?: Record<string, string> }; const nextAccounts = accountPayload.accounts || []; setAccounts(nextAccounts); setSystemAccountIds(accountPayload.systemMappings || {}); setManualJournals((journalRes.data as { journals: ManualJournal[] }).journals || []); setPurchaseInvoices((invoiceRes.data as { invoices: PurchaseInvoice[] }).invoices || []); setInventoryUsages((usageRes.data as { usages: InventoryUsage[] }).usages || []); setOpeningBalance((foundationRes.data as { opening?: { cutoffDate: string; status: 'DRAFT' | 'POSTED'; postedLines?: JournalLine[] } | null }).opening || null); const firstPosting = nextAccounts.find(item => (item.level ?? 4) === 4 && item.posting !== false); setLedgerAccountId(current => current || firstPosting?.id || ''); } catch (err) { showError(apiError(err, 'Data akuntansi gagal dimuat.')); } finally { setLoading(false); } };
  useEffect(() => { void load(); }, [data.workspace.id]);
  const migrationCutoff = openingBalance?.status === 'POSTED' ? openingBalance.cutoffDate : '';
  const automatic = useMemo(() => buildAutomaticJournals(data, accounts, purchaseInvoices, systemAccountIds, inventoryUsages).filter(item => !migrationCutoff || item.date > migrationCutoff), [data, accounts, purchaseInvoices, systemAccountIds, inventoryUsages, migrationCutoff]);
  const openingJournal = useMemo<JournalEntry[]>(() => openingBalance?.status === 'POSTED' && openingBalance.postedLines?.length ? [{ id: 'OPENING-BALANCE', journalNumber: `OPENING-${openingBalance.cutoffDate}`, date: openingBalance.cutoffDate, description: 'Saldo Awal / Opening Balance', reference: 'MIGRASI', source: 'OPENING', auto: true, lines: openingBalance.postedLines.map(line => ({ ...line, kebunId: line.kebunId || '', memo: line.memo || 'Saldo Awal' })) }] : [], [openingBalance]);
  const postCutoffManualJournals = useMemo(() => manualJournals.filter(item => !migrationCutoff || item.date > migrationCutoff), [manualJournals, migrationCutoff]);
  const editableManualJournals = useMemo(() => manualJournals.filter(item => !item.sourceType), [manualJournals]);
  const journals = useMemo<JournalEntry[]>(() => [...openingJournal, ...automatic, ...postCutoffManualJournals.map(item => ({ ...item, source: item.sourceType === 'STOCKTAKE' ? 'STOCK OPNAME' : 'MANUAL', auto: item.sourceType === 'STOCKTAKE' }))].sort((a, b) => `${a.date}${a.journalNumber}`.localeCompare(`${b.date}${b.journalNumber}`)), [openingJournal, automatic, postCutoffManualJournals]);
  const monthRows = journals.filter(item => (!month || item.date.startsWith(month)) && (sourceFilter === 'ALL' || (sourceFilter === 'AUTO' ? item.auto : !item.auto)));
  const accountMap = new Map(accounts.map(item => [item.id, item]));
  const kebunName = (id: string) => data.kebun.find(item => item.id === id)?.name || (id ? '-' : 'Pusat / Umum');
  const totalJournalDebit = monthRows.flatMap(item => item.lines).reduce((sum, item) => sum + item.debit, 0);
  const setManualLine = (index: number, patch: Partial<(typeof manualForm.lines)[number]>) => setManualForm(current => ({ ...current, lines: current.lines.map((line, i) => i === index ? { ...line, ...patch } : line) }));
  const saveManual = async (event: React.FormEvent) => { event.preventDefault(); const lines = manualForm.lines.map(item => ({ accountId: item.accountId, kebunId: manualForm.kebunId, debit: Number(item.debit || 0), credit: Number(item.credit || 0), memo: item.memo })); const debit = lines.reduce((sum, item) => sum + item.debit, 0); const credit = lines.reduce((sum, item) => sum + item.credit, 0); if (!manualForm.date || !manualForm.description.trim() || debit <= 0 || debit !== credit) return showError('Tanggal, keterangan, dan jurnal seimbang Debit = Kredit wajib diisi.'); try { setSaving(true); const payload = { date: manualForm.date, description: manualForm.description, reference: manualForm.reference, lines }; if (manualForm.id) await api.put(`/api/accounting/manual-journals/${manualForm.id}`, payload); else await api.post('/api/accounting/manual-journals', payload); setManualForm(blankManual()); await load(); flash(manualForm.id ? 'Jurnal manual diperbarui.' : 'Jurnal manual disimpan.'); } catch (err) { showError(apiError(err, 'Jurnal manual gagal disimpan.')); } finally { setSaving(false); } };
  const editManual = (journal: ManualJournal) => setManualForm({ id: journal.id, date: journal.date, description: journal.description, reference: journal.reference || '', kebunId: journal.lines.find(line => line.kebunId)?.kebunId || '', lines: journal.lines.map(line => ({ accountId: line.accountId, debit: line.debit ? String(line.debit) : '', credit: line.credit ? String(line.credit) : '', memo: line.memo || '' })) });
  const deleteManual = async (journal: ManualJournal) => { if (!window.confirm(`Hapus jurnal ${journal.journalNumber}?`)) return; try { await api.delete(`/api/accounting/manual-journals/${journal.id}`); await load(); flash('Jurnal manual dihapus.'); } catch (err) { showError(apiError(err, 'Jurnal manual gagal dihapus.')); } };
  const ledgerAccount = accounts.find(item => item.id === ledgerAccountId);
  const ledgerStart = `${month}-01`;
  const accountDelta = (line: JournalLine, account: AccountingAccount) => account.normalBalance === 'DEBIT' ? line.debit - line.credit : line.credit - line.debit;
  const allLedgerLines = journals.flatMap(journal => journal.lines.filter(line => line.accountId === ledgerAccountId).map(line => ({ journal, line }))).sort((a, b) => `${a.journal.date}${a.journal.journalNumber}`.localeCompare(`${b.journal.date}${b.journal.journalNumber}`));
  let ledgerRunning = ledgerAccount ? allLedgerLines.filter(row => row.journal.date < ledgerStart).reduce((sum, row) => sum + accountDelta(row.line, ledgerAccount), 0) : 0;
  const ledgerOpening = ledgerRunning;
  const ledgerRows = ledgerAccount ? allLedgerLines.filter(row => row.journal.date.startsWith(month)).map(row => { ledgerRunning += accountDelta(row.line, ledgerAccount); return { ...row, balance: ledgerRunning }; }) : [];
  const cutoff = `${month}-31`;
  const trial = accounts.filter(item => item.active !== false && (item.level ?? 4) === 4 && item.posting !== false).map(account => { const lines = journals.filter(journal => journal.date <= cutoff).flatMap(journal => journal.lines.filter(line => line.accountId === account.id)); const movementDebit = lines.reduce((sum, line) => sum + line.debit, 0); const movementCredit = lines.reduce((sum, line) => sum + line.credit, 0); const signed = account.normalBalance === 'DEBIT' ? movementDebit - movementCredit : movementCredit - movementDebit; const debitBalance = account.normalBalance === 'DEBIT' ? Math.max(0, signed) : Math.max(0, -signed); const creditBalance = account.normalBalance === 'CREDIT' ? Math.max(0, signed) : Math.max(0, -signed); return { account, movementDebit, movementCredit, debitBalance, creditBalance }; }).filter(item => item.movementDebit > 0 || item.movementCredit > 0);
  const trialDebit = trial.reduce((sum, item) => sum + item.debitBalance, 0);
  const trialCredit = trial.reduce((sum, item) => sum + item.creditBalance, 0);
  if (loading && accounts.length === 0) return <section className="panel"><div className="empty"><span>Menyiapkan Chart of Accounts dan jurnal...</span></div></section>;
  return <div className="stack">
    {mode === 'hub' ? <>
      <section className="panel tbs-header"><div><span className="eyebrow dark">Double Entry Accounting</span><h2>Akuntansi</h2><p>Pilih area akuntansi yang ingin dibuka. Semua laporan dan jurnal tetap berasal dari engine double-entry yang sama.</p></div></section>
      <div className="master-hub"><section className="master-hub-group"><div className="master-hub-group-head"><div><strong>Akuntansi</strong><span>Setup akun, jurnal penyesuaian, akun penting, saldo awal, dan periode.</span></div></div><div className="master-hub-grid">
        <button type="button" className="master-hub-card" onClick={() => changeMode('manual')}><span className="master-hub-card-icon"><FilePenLine size={24} /></span><span className="master-hub-card-copy"><strong>Jurnal Umum / Penyesuaian</strong><small>Input jurnal umum dan penyesuaian yang tidak berasal dari modul operasional.</small></span><ChevronRight size={18} /></button>
        <button type="button" className="master-hub-card" onClick={() => changeMode('coa')}><span className="master-hub-card-icon"><ListTree size={24} /></span><span className="master-hub-card-copy"><strong>Chart of Accounts</strong><small>Kelola hierarki COA 4 level, klasifikasi dan arus kas.</small></span><ChevronRight size={18} /></button>
        <button type="button" className="master-hub-card" onClick={() => changeMode('system')}><span className="master-hub-card-icon"><Link2 size={24} /></span><span className="master-hub-card-copy"><strong>Akun Penting</strong><small>Setup akun penghubung yang dipakai jurnal otomatis antar modul.</small></span><ChevronRight size={18} /></button>
        <button type="button" className="master-hub-card" onClick={() => changeMode('opening')}><span className="master-hub-card-icon"><Scale size={24} /></span><span className="master-hub-card-copy"><strong>Saldo Awal</strong><small>Input dan posting saldo awal GL serta subledger pada tanggal cut-off.</small></span><ChevronRight size={18} /></button>
        <button type="button" className="master-hub-card" onClick={() => changeMode('periods')}><span className="master-hub-card-icon"><BookOpen size={24} /></span><span className="master-hub-card-copy"><strong>Periode Akuntansi</strong><small>Atur tahun buku, cut-off dan status OPEN/CLOSED/LOCKED.</small></span><ChevronRight size={18} /></button>
              </div></section></div>
    </> : <section className="master-detail-nav"><div><span>Akuntansi</span><ChevronRight size={14} /><strong>{accountingModeLabel}</strong></div><button type="button" className="secondary small-btn" onClick={() => changeMode('hub')}>← Kembali ke Akuntansi</button></section>}
    {mode === 'journal' && <section className="panel"><div className="panel-head wrap"><div><h3>Jurnal Umum</h3><p>Jurnal otomatis dari modul operasional dan jurnal penyesuaian manual.</p></div><div className="filters"><input type="month" value={month} onChange={e => setMonth(e.target.value)} /><select value={sourceFilter} onChange={e => setSourceFilter(e.target.value as typeof sourceFilter)}><option value="ALL">Semua jurnal</option><option value="AUTO">Otomatis</option><option value="MANUAL">Manual</option></select></div></div><div className="report-summary"><div><span>Jumlah Jurnal</span><strong>{monthRows.length}</strong></div><div><span>Total Debit</span><strong>{idr.format(totalJournalDebit)}</strong></div><div><span>Total Kredit</span><strong>{idr.format(totalJournalDebit)}</strong></div></div>{monthRows.length === 0 ? <div className="empty"><span>Belum ada jurnal pada periode ini.</span></div> : <div className="journal-list">{monthRows.map(journal => <article className="journal-card" key={journal.id}><div className="journal-head"><div><strong>{journal.journalNumber}</strong><span>{formatDate(journal.date)} · {journal.source} · {journal.auto ? 'OTOMATIS' : 'MANUAL'}</span></div><div><b>{journal.description}</b><span>{journal.reference || '-'}</span></div></div><div className="table-wrap"><table><thead><tr><th>Akun</th><th>Kebun</th><th className="right">Debit</th><th className="right">Kredit</th></tr></thead><tbody>{journal.lines.map((line, index) => { const account = accountMap.get(line.accountId); return <tr key={`${journal.id}-${index}`}><td><strong>{account?.code || '-'}</strong> · {account?.name || 'Akun tidak ditemukan'}</td><td>{kebunName(line.kebunId)}</td><td className="right">{line.debit ? idr.format(line.debit) : '-'}</td><td className="right">{line.credit ? idr.format(line.credit) : '-'}</td></tr>; })}</tbody></table></div></article>)}</div>}</section>}
    {mode === 'coa' && <AccountingFoundation data={data} accounts={accounts} systemAccountIds={systemAccountIds} reloadAccounts={load} flash={flash} showError={showError} section="coa" />}
    {mode === 'system' && <SystemAccounts accounts={accounts} mappingIds={systemAccountIds} role={data.workspace.role} flash={flash} showError={showError} onSaved={load} />}
    {mode === 'opening' && <AccountingFoundation data={data} accounts={accounts} systemAccountIds={systemAccountIds} reloadAccounts={load} flash={flash} showError={showError} section="opening" />}
    {mode === 'periods' && <AccountingFoundation data={data} accounts={accounts} systemAccountIds={systemAccountIds} reloadAccounts={load} flash={flash} showError={showError} section="periods" />}
    {mode === 'manual' && <div className="grid-form-list"><section className="panel form-panel"><div className="panel-head"><div><h3>{manualForm.id ? 'Edit Jurnal Umum / Penyesuaian' : 'Jurnal Umum / Penyesuaian'}</h3><p>Gunakan untuk penyesuaian akuntansi. Total Debit wajib sama dengan Kredit.</p></div></div><form className="form" onSubmit={saveManual}><div className="row-2"><Field label="Tanggal"><input type="date" value={manualForm.date} onChange={e => setManualForm(v => ({ ...v, date: e.target.value }))} /></Field><Field label="Kebun / Cost Center"><select value={manualForm.kebunId} onChange={e => setManualForm(v => ({ ...v, kebunId: e.target.value }))}><option value="">Pusat / Umum</option>{data.kebun.map(item => <option key={item.id} value={item.id}>{item.code} - {item.name}</option>)}</select></Field></div><Field label="Keterangan"><input value={manualForm.description} onChange={e => setManualForm(v => ({ ...v, description: e.target.value }))} /></Field><Field label="Referensi"><input value={manualForm.reference} onChange={e => setManualForm(v => ({ ...v, reference: e.target.value }))} /></Field><div className="journal-editor"><div className="allocation-head"><div><strong>Baris Jurnal</strong><span>Isi salah satu Debit atau Kredit per baris.</span></div><button type="button" className="secondary small-btn" onClick={() => setManualForm(v => ({ ...v, lines: [...v.lines, { accountId: '', debit: '', credit: '', memo: '' }] }))}><Plus size={14} /> Baris</button></div>{manualForm.lines.map((line, index) => <div className="journal-edit-row" key={index}><select value={line.accountId} onChange={e => setManualLine(index, { accountId: e.target.value })}><option value="">Pilih akun</option>{accounts.filter(item => item.active && (item.level ?? 4) === 4 && item.posting !== false).map(item => <option key={item.id} value={item.id}>{item.code} - {item.name}</option>)}</select><input inputMode="numeric" placeholder="Debit" value={formatMoneyInput(line.debit)} onChange={e => setManualLine(index, { debit: e.target.value.replace(/[^0-9]/g, ''), credit: e.target.value ? '' : line.credit })} /><input inputMode="numeric" placeholder="Kredit" value={formatMoneyInput(line.credit)} onChange={e => setManualLine(index, { credit: e.target.value.replace(/[^0-9]/g, ''), debit: e.target.value ? '' : line.debit })} /><input placeholder="Memo" value={line.memo} onChange={e => setManualLine(index, { memo: e.target.value })} />{manualForm.lines.length > 2 && <button type="button" className="icon-btn danger" onClick={() => setManualForm(v => ({ ...v, lines: v.lines.filter((_, i) => i !== index) }))}><Trash2 size={14} /></button>}</div>)}</div><div className="allocation-total"><span>Total Debit / Kredit</span><strong>{idr.format(manualForm.lines.reduce((sum, item) => sum + Number(item.debit || 0), 0))} / {idr.format(manualForm.lines.reduce((sum, item) => sum + Number(item.credit || 0), 0))}</strong></div><div className="form-actions">{manualForm.id && <button type="button" className="secondary" onClick={() => setManualForm(blankManual())}>Batal</button>}<button className="primary" disabled={saving}><Save size={16} /> Simpan Jurnal</button></div></form></section><section className="panel list-panel"><div className="panel-head"><div><h3>Riwayat Jurnal Umum / Penyesuaian</h3><p>{editableManualJournals.length} jurnal penyesuaian manual. Jurnal Stok Opname tampil sebagai jurnal otomatis di Jurnal Umum.</p></div></div>{editableManualJournals.length === 0 ? <div className="empty"><span>Belum ada jurnal manual.</span></div> : <div className="master-list">{[...editableManualJournals].sort((a, b) => b.date.localeCompare(a.date)).map(item => <div className="master-row" key={item.id}><div><strong>{item.journalNumber} · {item.description}</strong><span>{formatDate(item.date)} · {idr.format(item.lines.reduce((sum, line) => sum + line.debit, 0))}</span></div><button className="icon-btn" onClick={() => editManual(item)}><Pencil size={15} /></button><button className="icon-btn danger" onClick={() => deleteManual(item)}><Trash2 size={15} /></button></div>)}</div>}</section></div>}
    {mode === 'ledger' && <section className="panel"><div className="panel-head wrap"><div><h3>Buku Besar Umum</h3><p>Mutasi Debit/Kredit dan saldo berjalan untuk satu akun akuntansi.</p></div><div className="filters"><input type="month" value={month} onChange={e => setMonth(e.target.value)} /><AccountSearchPicker className="ledger-account-search" accounts={accounts.filter(item => (item.level ?? 4) === 4 && item.posting !== false)} value={ledgerAccountId} onChange={setLedgerAccountId} placeholder="Ketik kode atau nama akun..." ariaLabel="Cari akun Buku Besar" /></div></div>{!ledgerAccount ? <div className="empty"><span>Pilih akun terlebih dahulu.</span></div> : <><div className="report-summary"><div><span>Saldo Awal</span><strong>{idr.format(ledgerOpening)}</strong></div><div><span>Saldo Akhir</span><strong>{idr.format(ledgerRows.length ? ledgerRows[ledgerRows.length - 1].balance : ledgerOpening)}</strong></div></div><div className="table-wrap"><table><thead><tr><th>Tanggal</th><th>No. Jurnal</th><th>Keterangan</th><th>Kebun</th><th className="right">Debit</th><th className="right">Kredit</th><th className="right">Saldo</th></tr></thead><tbody><tr><td>{`${month}-01`}</td><td>-</td><td><strong>Saldo Awal</strong></td><td>-</td><td className="right">-</td><td className="right">-</td><td className="right"><strong>{idr.format(ledgerOpening)}</strong></td></tr>{ledgerRows.map(({ journal, line, balance }) => <tr key={`${journal.id}-${line.accountId}-${journal.description}`}><td>{formatDate(journal.date)}</td><td>{journal.journalNumber}</td><td>{journal.description}</td><td>{kebunName(line.kebunId)}</td><td className="right">{line.debit ? idr.format(line.debit) : '-'}</td><td className="right">{line.credit ? idr.format(line.credit) : '-'}</td><td className="right"><strong>{idr.format(balance)}</strong></td></tr>)}</tbody></table></div></>}</section>}
    {mode === 'trial' && <section className="panel"><div className="panel-head wrap"><div><h3>Neraca Saldo</h3><p>Saldo akhir seluruh akun sampai akhir periode yang dipilih.</p></div><div className="filters"><input type="month" value={month} onChange={e => setMonth(e.target.value)} /></div></div><div className={`allocation-total ${trialDebit === trialCredit ? 'balanced' : ''}`}><span>Total Neraca Saldo</span><strong>Debit {idr.format(trialDebit)} · Kredit {idr.format(trialCredit)}</strong><small>{trialDebit === trialCredit ? 'SEIMBANG' : `Selisih ${idr.format(trialDebit - trialCredit)}`}</small></div><div className="table-wrap"><table><thead><tr><th>Kode</th><th>Akun</th><th>Kelompok</th><th className="right">Debit</th><th className="right">Kredit</th></tr></thead><tbody>{trial.map(item => <tr key={item.account.id}><td><strong>{item.account.code}</strong></td><td>{item.account.name}</td><td>{groupLabels[item.account.group]}</td><td className="right">{item.debitBalance ? idr.format(item.debitBalance) : '-'}</td><td className="right">{item.creditBalance ? idr.format(item.creditBalance) : '-'}</td></tr>)}</tbody><tfoot><tr><th colSpan={3}>TOTAL</th><th className="right">{idr.format(trialDebit)}</th><th className="right">{idr.format(trialCredit)}</th></tr></tfoot></table></div></section>}
  </div>;
}
function Field({ label, children }: { label: string; children: React.ReactNode }) { return <label className="field"><span>{label}</span>{children}</label>; }
