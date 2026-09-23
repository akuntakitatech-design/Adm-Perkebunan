import { useEffect, useMemo, useState } from 'react';
import { api } from './lib/client';
import { ChevronRight, CreditCard, Pencil, Plus, ReceiptText, Save, Trash2, UsersRound, WandSparkles } from 'lucide-react';
import { readStoredChoice, storeChoice } from './navigationState';
import { formatMoneyInput } from './moneyInput';

type Role = 'OWNER' | 'ADMIN_PUSAT' | 'FINANCE' | 'ADMIN_KEBUN' | 'VIEWER';
type AccountingAccount = {
  id: string;
  code: string;
  name: string;
  group: 'ASSET' | 'LIABILITY' | 'EQUITY' | 'REVENUE' | 'EXPENSE';
  systemKey: string;
  level?: number;
  posting?: boolean;
  active: boolean;
};
type Kebun = { id: string; code: string; name: string };
type OperationalAccount = { id: string; name: string; type: 'KAS' | 'BANK' };
type Supplier = {
  id: string;
  code: string;
  name: string;
  contact: string;
  phone: string;
  address: string;
  active: boolean;
};
type SupplierBill = {
  id: string;
  sourceType?: 'TBS_ARMADA' | 'PURCHASE_INVOICE';
  sourceId?: string;
  date: string;
  dueDate: string;
  supplierId: string;
  kebunId: string;
  invoiceNumber: string;
  category: string;
  description: string;
  amount: number;
  createdAt: string;
};
type SupplierPayment = {
  id: string;
  paymentNumber: string;
  date: string;
  supplierId: string;
  accountId: string;
  amount: number;
  reference: string;
  note: string;
  allocations: Array<{ billId: string; kebunId: string; invoiceNumber: string; amount: number }>;
  transactionIds: string[];
  createdAt: string;
};
type InventoryGroup = { id: string; code: string; name: string; canPurchase: boolean; canStore: boolean; canSell: boolean; purchaseAccountId: string; inventoryAccountId: string; active: boolean };
type InventoryUnit = { id: string; code: string; name: string; active: boolean };
type InventoryItemUnitConversion = { unitId: string; factor: number; defaultPurchase?: boolean; defaultUsage?: boolean };
type InventoryItem = { id: string; code: string; name: string; groupId: string; unitId: string; unitConversions?: InventoryItemUnitConversion[]; currentQuantity: number; averageCost: number; active: boolean };
type InventoryWarehouse = { id: string; code: string; name: string; kebunId: string; active: boolean; isDefault: boolean };
type PurchaseInvoiceLine = {
  kind: 'SERVICE' | 'INVENTORY';
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
  discountType?: 'AMOUNT' | 'PERCENT';
  discountValue?: number;
  discountAmount?: number;
  lineTotal: number;
  netTotal?: number;
};
type PurchaseInvoice = {
  id: string;
  purchaseNumber?: string;
  date: string;
  dueDate: string;
  supplierId: string;
  kebunId: string;
  warehouseId?: string;
  invoiceNumber: string;
  debitAccountId: string;
  lines?: PurchaseInvoiceLine[];
  subtotal?: number;
  discountType?: 'AMOUNT' | 'PERCENT';
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
  createdAt: string;
};
type Data = {
  workspace: { id: string; role: Role };
  kebun: Kebun[];
  accounts: OperationalAccount[];
  suppliers: Supplier[];
  supplierBills: SupplierBill[];
  supplierPayments: SupplierPayment[];
};
type Props = {
  data: Data;
  reload: () => Promise<void>;
  flash: (text: string) => void;
  showError: (text: string) => void;
};
type BillView = SupplierBill & { paid: number; outstanding: number };

type PurchaseMode = 'hub' | 'invoices' | 'payments' | 'suppliers';

const idr = new Intl.NumberFormat('id-ID', {
  style: 'currency',
  currency: 'IDR',
  maximumFractionDigits: 0,
});

function today() {
  return new Date().toISOString().slice(0, 10);
}
function formatDate(value: string) {
  if (!value) return '-';
  return new Intl.DateTimeFormat('id-ID', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  }).format(new Date(`${value}T00:00:00`));
}
function apiError(err: unknown, fallback: string) {
  const response = (err as { response?: { data?: { error?: string; message?: string } } })?.response?.data;
  return response?.error || response?.message || fallback;
}
function blankPurchaseLine(kebunId = '') {
  return {
    kind: 'INVENTORY' as 'SERVICE' | 'INVENTORY',
    itemId: '',
    kebunId,
    description: '',
    quantity: '1',
    unit: '',
    unitId: '',
    unitPrice: '',
    debitAccountId: '',
    discountType: 'PERCENT' as 'AMOUNT' | 'PERCENT',
    discountValue: '',
    search: '',
  };
}
function blankInvoice() {
  return {
    id: '',
    date: today(),
    dueDate: '',
    supplierId: '',
    kebunId: '',
    warehouseId: '',
    invoiceNumber: '',
    paymentType: 'CREDIT' as 'CASH' | 'CREDIT',
    accountId: '',
    lines: [blankPurchaseLine()],
    discountType: 'PERCENT' as 'AMOUNT' | 'PERCENT',
    discountValue: '',
    vatPercent: '',
    note: '',
  };
}
function blankSupplier() {
  return {
    id: '',
    code: '',
    name: '',
    contact: '',
    phone: '',
    address: '',
    active: true,
  };
}
function canEditSupplierMaster(role: Role) {
  return role === 'OWNER' || role === 'ADMIN_PUSAT';
}
function nextSupplierCodePreview(suppliers: Supplier[]) {
  let max = 0;
  for (const supplier of suppliers) {
    const match = /^SUP-(\d+)$/i.exec(supplier.code || '');
    if (match) max = Math.max(max, Number(match[1]));
  }
  return `SUP-${String(max + 1).padStart(3, '0')}`;
}
function purchaseNumber(item: PurchaseInvoice) {
  return item.purchaseNumber || `PB-LEGACY-${item.id.slice(0, 8).toUpperCase()}`;
}
function billSource(item: SupplierBill) {
  if (item.sourceType === 'PURCHASE_INVOICE') return 'Invoice Pembelian';
  if (item.sourceType === 'TBS_ARMADA') return 'Armada TBS';
  return 'Tagihan lama';
}
function lineDiscountAmount(quantity: string | number, unitPrice: string | number, discountType: 'AMOUNT' | 'PERCENT', discountValue: string | number) {
  const gross = Math.round((Number(quantity) || 0) * (Number(unitPrice) || 0));
  const value = Math.max(0, Number(discountValue) || 0);
  return discountType === 'PERCENT' ? Math.min(gross, Math.round(gross * Math.min(100, value) / 100)) : Math.min(gross, value);
}
function itemUnitChoices(item: InventoryItem | undefined, units: InventoryUnit[]) {
  if (!item) return [] as Array<{ unitId: string; label: string; factor: number; defaultPurchase: boolean; defaultUsage: boolean }>;
  const unitMap = new Map(units.map(unit => [unit.id, unit]));
  const base = unitMap.get(item.unitId);
  const rows = [{ unitId: item.unitId, label: base?.code || base?.name || '-', factor: 1, defaultPurchase: false, defaultUsage: false }];
  for (const conversion of item.unitConversions || []) {
    const unit = unitMap.get(conversion.unitId);
    if (!unit || unit.active === false || !(conversion.factor > 0)) continue;
    rows.push({ unitId: conversion.unitId, label: unit.code || unit.name, factor: conversion.factor, defaultPurchase: conversion.defaultPurchase === true, defaultUsage: conversion.defaultUsage === true });
  }
  return rows;
}
function preferredPurchaseUnitId(item: InventoryItem | undefined, units: InventoryUnit[]) {
  const rows = itemUnitChoices(item, units);
  return rows.find(row => row.defaultPurchase)?.unitId || item?.unitId || '';
}

export default function PurchaseInvoices({ data, reload, flash, showError }: Props) {
  const storageKey = 'perkebunan.navigation.purchases.hub';
  const purchaseModes = ['hub', 'invoices', 'payments', 'suppliers'] as const;
  const [mode, setMode] = useState<PurchaseMode>(() => readStoredChoice(storageKey, purchaseModes, 'hub'));
  const [accountingAccounts, setAccountingAccounts] = useState<AccountingAccount[]>([]);
  const [inventoryGroups, setInventoryGroups] = useState<InventoryGroup[]>([]);
  const [inventoryUnits, setInventoryUnits] = useState<InventoryUnit[]>([]);
  const [inventoryItems, setInventoryItems] = useState<InventoryItem[]>([]);
  const [inventoryWarehouses, setInventoryWarehouses] = useState<InventoryWarehouse[]>([]);
  const [invoices, setInvoices] = useState<PurchaseInvoice[]>([]);
  const [invoiceForm, setInvoiceForm] = useState(blankInvoice());
  const [supplierForm, setSupplierForm] = useState(blankSupplier());
  const [quickSupplier, setQuickSupplier] = useState(blankSupplier());
  const [showQuickSupplier, setShowQuickSupplier] = useState(false);
  const [paymentForm, setPaymentForm] = useState({
    date: today(),
    supplierId: '',
    accountId: '',
    amount: '',
    reference: '',
    note: '',
  });
  const [allocations, setAllocations] = useState<Record<string, string>>({});
  const [paymentEditId, setPaymentEditId] = useState('');
  const [filterSupplier, setFilterSupplier] = useState('');
  const [filterType, setFilterType] = useState<'ALL' | 'CASH' | 'CREDIT'>('ALL');
  const [saving, setSaving] = useState(false);
  const [activePurchasePicker, setActivePurchasePicker] = useState<number | null>(null);

  const masterEditAllowed = canEditSupplierMaster(data.workspace.role);
  const changeMode = (next: PurchaseMode) => {
    setMode(next);
    storeChoice(storageKey, next);
  };

  const loadPurchaseData = async () => {
    try {
      const [accountRes, invoiceRes, inventoryRes] = await Promise.all([
        api.get('/api/accounting/accounts'),
        api.get('/api/purchase-invoices'),
        api.get('/api/inventory/master'),
      ]);
      setAccountingAccounts(
        (accountRes.data as { accounts: AccountingAccount[] }).accounts || []
      );
      setInvoices((invoiceRes.data as { invoices: PurchaseInvoice[] }).invoices || []);
      const inventory = inventoryRes.data as { groups: InventoryGroup[]; units: InventoryUnit[]; items: InventoryItem[]; warehouses?: InventoryWarehouse[]; defaultWarehouseId?: string };
      setInventoryGroups(inventory.groups || []);
      setInventoryUnits(inventory.units || []);
      setInventoryItems(inventory.items || []);
      setInventoryWarehouses(inventory.warehouses || []);
      const defaultWarehouseId = inventory.defaultWarehouseId || inventory.warehouses?.find(item => item.isDefault)?.id || '';
      setInvoiceForm(current => current.warehouseId ? current : { ...current, warehouseId: defaultWarehouseId });
    } catch (err) {
      showError(apiError(err, 'Data Pembelian gagal dimuat.'));
    }
  };

  useEffect(() => {
    void loadPurchaseData();
  }, [data.workspace.id]);

  const serviceDebitAccounts = accountingAccounts.filter(item => item.active && (item.level ?? 4) === 4 && item.posting !== false && item.group === 'EXPENSE').sort((a, b) => a.code.localeCompare(b.code));
  const inventoryItemOptions = inventoryItems.filter(item => {
    const group = inventoryGroups.find(row => row.id === item.groupId);
    const unit = inventoryUnits.find(row => row.id === item.unitId);
    return item.active !== false && group?.active !== false && group?.canPurchase && unit?.active !== false;
  });

  const paidByBill = useMemo(() => {
    const result = new Map<string, number>();
    for (const payment of data.supplierPayments) {
      for (const allocation of payment.allocations || []) {
        result.set(
          allocation.billId,
          (result.get(allocation.billId) || 0) + allocation.amount
        );
      }
    }
    return result;
  }, [data.supplierPayments]);

  const bills = useMemo<BillView[]>(() =>
    data.supplierBills
      .map(item => {
        const paid = paidByBill.get(item.id) || 0;
        return {
          ...item,
          paid,
          outstanding: Math.max(0, item.amount - paid),
        };
      })
      .sort((a, b) => `${a.date}${a.invoiceNumber}`.localeCompare(`${b.date}${b.invoiceNumber}`)),
  [data.supplierBills, paidByBill]);

  const editingPayment = data.supplierPayments.find(item => item.id === paymentEditId);
  const editingAllocatedByBill = useMemo(() => {
    const result = new Map<string, number>();
    if (!editingPayment) return result;
    for (const allocation of editingPayment.allocations || []) {
      result.set(
        allocation.billId,
        (result.get(allocation.billId) || 0) + allocation.amount
      );
    }
    return result;
  }, [editingPayment]);

  const availableBills = bills
    .filter(item => item.supplierId === paymentForm.supplierId)
    .map(item => ({
      ...item,
      outstanding: item.outstanding +
        (editingPayment?.supplierId === item.supplierId
          ? editingAllocatedByBill.get(item.id) || 0
          : 0),
    }))
    .filter(item => item.outstanding > 0);

  const paymentAmount = Number(paymentForm.amount || 0);
  const allocationTotal = Object.values(allocations)
    .reduce((sum, value) => sum + Number(value || 0), 0);

  const filteredInvoices = invoices
    .filter(item =>
      (!filterSupplier || item.supplierId === filterSupplier) &&
      (filterType === 'ALL' || item.paymentType === filterType)
    )
    .sort((a, b) => `${b.date}${b.createdAt}`.localeCompare(`${a.date}${a.createdAt}`));

  const totalInvoices = invoices.reduce((sum, item) => sum + item.amount, 0);
  const totalCash = invoices
    .filter(item => item.paymentType === 'CASH')
    .reduce((sum, item) => sum + item.amount, 0);
  const creditOutstanding = invoices
    .filter(item => item.paymentType === 'CREDIT')
    .reduce(
      (sum, item) => sum + Math.max(0, item.amount - (paidByBill.get(item.supplierBillId) || 0)),
      0
    );
  const totalBills = bills.reduce((sum, item) => sum + item.amount, 0);
  const totalPaid = bills.reduce((sum, item) => sum + item.paid, 0);
  const totalOutstanding = bills.reduce((sum, item) => sum + item.outstanding, 0);

  const editingInvoice = invoices.find(item => item.id === invoiceForm.id);
  const supplierCodePreview = nextSupplierCodePreview(data.suppliers);
  const formSubtotal = invoiceForm.lines.reduce((sum, line) => sum + Math.round((Number(line.quantity) || 0) * (Number(line.unitPrice) || 0)), 0);
  const formDiscountAmount = invoiceForm.lines.reduce((sum, line) => sum + lineDiscountAmount(line.quantity, line.unitPrice, line.discountType, line.discountValue), 0);
  const formTaxableBase = Math.max(0, formSubtotal - formDiscountAmount);
  const formVatPercent = Math.min(100, Math.max(0, Number(invoiceForm.vatPercent || 0)));
  const formVatAmount = Math.round(formTaxableBase * formVatPercent / 100);
  const formTotal = formTaxableBase + formVatAmount;

  const selectInventoryItem = (index: number, itemId: string) => {
    const item = inventoryItems.find(row => row.id === itemId);
    const group = item ? inventoryGroups.find(row => row.id === item.groupId) : undefined;
    const unitId = preferredPurchaseUnitId(item, inventoryUnits);
    const choice = itemUnitChoices(item, inventoryUnits).find(row => row.unitId === unitId);
    const debitAccountId = group ? (group.canStore ? group.inventoryAccountId : group.purchaseAccountId) : '';
    setInvoiceLine(index, { itemId, description: item?.name || '', unitId, unit: choice?.label || '', debitAccountId, search: item ? `${item.code} · ${item.name}` : '' });
    setActivePurchasePicker(null);
  };
  const selectInventoryUnit = (index: number, item: InventoryItem | undefined, unitId: string) => {
    const choice = itemUnitChoices(item, inventoryUnits).find(row => row.unitId === unitId);
    setInvoiceLine(index, { unitId, unit: choice?.label || '' });
  };
  const selectServiceAccount = (index: number, accountId: string) => {
    const account = serviceDebitAccounts.find(row => row.id === accountId);
    setInvoiceLine(index, { itemId: '', debitAccountId: accountId, description: account?.name || '', unit: 'jasa', search: account ? `${account.code} · ${account.name}` : '' });
    setActivePurchasePicker(null);
  };

  const setInvoiceLine = (index: number, patch: Partial<(typeof invoiceForm.lines)[number]>) => {
    setInvoiceForm(current => ({
      ...current,
      lines: current.lines.map((line, rowIndex) => rowIndex === index ? { ...line, ...patch } : line),
    }));
  };
  const addInvoiceLine = () => setInvoiceForm(current => ({ ...current, lines: [...current.lines, blankPurchaseLine(current.kebunId)] }));
  const removeInvoiceLine = (index: number) => setInvoiceForm(current => ({ ...current, lines: current.lines.length === 1 ? current.lines : current.lines.filter((_, rowIndex) => rowIndex !== index) }));

  const saveInvoice = async (event: React.FormEvent) => {
    event.preventDefault();
    const lines = invoiceForm.lines.map(line => ({
      kind: line.kind,
      itemId: line.itemId || '',
      kebunId: line.kebunId || '',
      warehouseId: line.kind === 'INVENTORY' ? invoiceForm.warehouseId : '',
      description: line.description.trim(),
      quantity: Number(line.quantity || 0),
      unit: line.unit.trim(),
      unitId: line.kind === 'INVENTORY' ? line.unitId || '' : '',
      unitPrice: Number(line.unitPrice || 0),
      debitAccountId: line.debitAccountId,
      discountType: line.discountType,
      discountValue: Number(line.discountValue || 0),
    }));
    const invalidLine = lines.some(line => line.quantity <= 0 || line.unitPrice <= 0 || (line.kind === 'SERVICE' ? (!line.description || !line.unit || !line.debitAccountId) : !line.itemId));
    const needsWarehouse = lines.some(line => line.kind === 'INVENTORY' && inventoryGroups.find(group => group.id === inventoryItems.find(item => item.id === line.itemId)?.groupId)?.canStore);
    if (!invoiceForm.date || !invoiceForm.supplierId || invalidLine || (needsWarehouse && !invoiceForm.warehouseId) || formSubtotal <= 0 || formDiscountAmount >= formSubtotal || (invoiceForm.paymentType === 'CREDIT' && !invoiceForm.dueDate) || (invoiceForm.paymentType === 'CASH' && !invoiceForm.accountId)) {
      showError('Lengkapi tanggal, supplier, gudang penerimaan untuk barang stok, seluruh rincian pembelian, jatuh tempo bila kredit, dan Kas/Bank bila tunai. Total setelah diskon harus lebih dari nol.');
      return;
    }
    try {
      setSaving(true);
      const payload = {
        date: invoiceForm.date,
        dueDate: invoiceForm.dueDate,
        supplierId: invoiceForm.supplierId,
        kebunId: invoiceForm.kebunId,
        warehouseId: invoiceForm.warehouseId,
        invoiceNumber: invoiceForm.invoiceNumber,
        paymentType: invoiceForm.paymentType,
        accountId: invoiceForm.accountId,
        lines,
        discountType: 'AMOUNT' as const,
        discountValue: 0,
        vatPercent: formVatPercent,
        note: invoiceForm.note,
      };
      const wasEdit = Boolean(invoiceForm.id);
      const paymentType = invoiceForm.paymentType;
      if (invoiceForm.id) {
        await api.put(`/api/purchase-invoices/${invoiceForm.id}`, payload);
      } else {
        await api.post('/api/purchase-invoices', payload);
      }
      setInvoiceForm(blankInvoice());
      await reload();
      await loadPurchaseData();
      flash(
        wasEdit
          ? 'Invoice Pembelian diperbarui.'
          : paymentType === 'CASH'
            ? 'Invoice tunai disimpan dan Kas/Bank berkurang.'
            : 'Invoice kredit disimpan dan masuk daftar hutang Pembelian.'
      );
    } catch (err) {
      showError(apiError(err, 'Invoice Pembelian gagal disimpan.'));
    } finally {
      setSaving(false);
    }
  };

  const editInvoice = (item: PurchaseInvoice) => {
    const legacyAccount = accountingAccounts.find(account => account.id === item.debitAccountId);
    const legacySubtotal = item.subtotal || Math.max(0, item.amount - (item.vatAmount || 0) + (item.discountAmount || 0));
    const sourceLines = item.lines?.length ? item.lines : [{
      kind: legacyAccount?.group === 'ASSET' ? 'INVENTORY' as const : 'SERVICE' as const,
      kebunId: item.kebunId,
      description: item.description || 'Pembelian',
      quantity: 1,
      unit: 'unit',
      unitPrice: legacySubtotal,
      debitAccountId: item.debitAccountId,
      lineTotal: legacySubtotal,
    }];
    const hasLineDiscount = sourceLines.some(line => (line.discountAmount || 0) > 0);
    const legacyDiscount = hasLineDiscount ? 0 : (item.discountAmount || 0);
    const legacyGross = sourceLines.reduce((sum, line) => sum + line.lineTotal, 0);
    let legacyAllocated = 0;
    setInvoiceForm({
      id: item.id,
      date: item.date,
      dueDate: item.dueDate || '',
      supplierId: item.supplierId,
      kebunId: item.kebunId || '',
      warehouseId: item.warehouseId || sourceLines.find(line => line.warehouseId)?.warehouseId || inventoryWarehouses.find(row => row.isDefault)?.id || '',
      invoiceNumber: item.invoiceNumber || '',
      paymentType: item.paymentType,
      accountId: item.accountId || '',
      lines: sourceLines.map((line, index) => {
        const inheritedDiscount = hasLineDiscount ? (line.discountAmount || 0) : index === sourceLines.length - 1 ? legacyDiscount - legacyAllocated : Math.round(legacyDiscount * line.lineTotal / Math.max(1, legacyGross));
        legacyAllocated += inheritedDiscount;
        const selectedItem = line.itemId ? inventoryItems.find(row => row.id === line.itemId) : undefined;
        const selectedAccount = accountingAccounts.find(row => row.id === line.debitAccountId);
        return {
          kind: line.kind,
          itemId: line.itemId || '',
          kebunId: line.kebunId || item.kebunId || '',
          description: line.description,
          quantity: String(line.quantity),
          unit: line.unit,
          unitId: line.kind === 'INVENTORY' ? (line.unitId || selectedItem?.unitId || '') : '',
          unitPrice: String(line.unitPrice),
          debitAccountId: line.debitAccountId,
          discountType: line.discountType || 'AMOUNT' as 'AMOUNT' | 'PERCENT',
          discountValue: String((line.discountValue ?? inheritedDiscount) || ''),
          search: line.kind === 'INVENTORY' && selectedItem ? `${selectedItem.code} · ${selectedItem.name}` : selectedAccount ? `${selectedAccount.code} · ${selectedAccount.name}` : line.description,
        };
      }),
      discountType: 'AMOUNT',
      discountValue: '',
      vatPercent: String(item.vatPercent || ''),
      note: item.note || '',
    });
    changeMode('invoices');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const deleteInvoice = async (item: PurchaseInvoice) => {
    if (!window.confirm(`Hapus ${purchaseNumber(item)}? Mutasi/Hutang terkait ikut dihapus.`)) return;
    try {
      await api.delete(`/api/purchase-invoices/${item.id}`);
      if (invoiceForm.id === item.id) setInvoiceForm(blankInvoice());
      await reload();
      await loadPurchaseData();
      flash('Invoice Pembelian dihapus beserta catatan turunannya.');
    } catch (err) {
      showError(apiError(err, 'Invoice Pembelian gagal dihapus.'));
    }
  };

  const saveQuickSupplier = async () => {
    if (!quickSupplier.name.trim()) {
      showError('Nama supplier wajib diisi.');
      return;
    }
    try {
      setSaving(true);
      const response = await api.post('/api/suppliers', {
        name: quickSupplier.name,
        contact: quickSupplier.contact,
        phone: quickSupplier.phone,
        address: quickSupplier.address,
        active: true,
      });
      const created = response.data as Supplier;
      setInvoiceForm(current => ({ ...current, supplierId: created.id }));
      setQuickSupplier(blankSupplier());
      setShowQuickSupplier(false);
      await reload();
      flash(`Supplier ${created.code} - ${created.name} ditambahkan dan langsung dipilih.`);
    } catch (err) {
      showError(apiError(err, 'Supplier baru gagal ditambahkan.'));
    } finally {
      setSaving(false);
    }
  };

  const resetPayment = () => {
    setPaymentEditId('');
    setPaymentForm({
      date: today(),
      supplierId: '',
      accountId: '',
      amount: '',
      reference: '',
      note: '',
    });
    setAllocations({});
  };

  const changePaymentSupplier = (supplierId: string) => {
    setPaymentForm(current => ({ ...current, supplierId }));
    setAllocations({});
  };

  const autoAllocate = () => {
    if (!paymentForm.supplierId) {
      showError('Pilih supplier terlebih dahulu.');
      return;
    }
    if (paymentAmount <= 0) {
      showError('Isi nominal pembayaran terlebih dahulu.');
      return;
    }
    let remaining = paymentAmount;
    const next: Record<string, string> = {};
    for (const item of availableBills) {
      if (remaining <= 0) break;
      const amount = Math.min(item.outstanding, remaining);
      if (amount > 0) next[item.id] = String(amount);
      remaining -= amount;
    }
    setAllocations(next);
    if (remaining > 0) {
      showError(`Masih ada ${idr.format(remaining)} yang belum dapat dialokasikan.`);
    }
  };

  const savePayment = async (event: React.FormEvent) => {
    event.preventDefault();
    const rows = availableBills
      .map(item => ({ billId: item.id, amount: Number(allocations[item.id] || 0) }))
      .filter(item => item.amount > 0);
    if (
      !paymentForm.date ||
      !paymentForm.supplierId ||
      !paymentForm.accountId ||
      paymentAmount <= 0 ||
      rows.length === 0
    ) {
      showError('Lengkapi tanggal, supplier, Kas/Bank, nominal pembayaran, dan alokasi hutang.');
      return;
    }
    if (allocationTotal !== paymentAmount) {
      showError('Total alokasi harus sama persis dengan nominal pembayaran.');
      return;
    }
    try {
      setSaving(true);
      const wasEdit = Boolean(paymentEditId);
      const payload = { ...paymentForm, amount: paymentAmount, allocations: rows };
      if (paymentEditId) {
        await api.put(`/api/supplier-payments/${paymentEditId}`, payload);
      } else {
        await api.post('/api/supplier-payments', payload);
      }
      resetPayment();
      await reload();
      flash(
        wasEdit
          ? 'Pembayaran supplier diperbarui dan Kas/Bank disesuaikan.'
          : 'Pembayaran supplier disimpan dan Kas/Bank berkurang.'
      );
    } catch (err) {
      showError(apiError(err, 'Pembayaran supplier gagal disimpan.'));
    } finally {
      setSaving(false);
    }
  };

  const startEditPayment = (payment: SupplierPayment) => {
    const next: Record<string, string> = {};
    for (const allocation of payment.allocations || []) {
      next[allocation.billId] = String(
        Number(next[allocation.billId] || 0) + allocation.amount
      );
    }
    setPaymentEditId(payment.id);
    setPaymentForm({
      date: payment.date,
      supplierId: payment.supplierId,
      accountId: payment.accountId,
      amount: String(payment.amount),
      reference: payment.reference || '',
      note: payment.note || '',
    });
    setAllocations(next);
    changeMode('payments');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const deletePayment = async (payment: SupplierPayment) => {
    if (!window.confirm(`Hapus pembayaran ${payment.paymentNumber}? Mutasi Kas/Bank ikut dihapus.`)) return;
    try {
      await api.delete(`/api/supplier-payments/${payment.id}`);
      if (paymentEditId === payment.id) resetPayment();
      await reload();
      flash('Pembayaran supplier dan mutasi Kas/Bank terkait dihapus.');
    } catch (err) {
      showError(apiError(err, 'Pembayaran supplier gagal dihapus.'));
    }
  };

  const saveSupplier = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!supplierForm.name.trim()) {
      showError('Nama supplier wajib diisi.');
      return;
    }
    try {
      setSaving(true);
      if (supplierForm.id) {
        await api.put(`/api/suppliers/${supplierForm.id}`, supplierForm);
      } else {
        await api.post('/api/suppliers', {
          name: supplierForm.name,
          contact: supplierForm.contact,
          phone: supplierForm.phone,
          address: supplierForm.address,
          active: supplierForm.active,
        });
      }
      const wasEdit = Boolean(supplierForm.id);
      setSupplierForm(blankSupplier());
      await reload();
      flash(wasEdit ? 'Supplier diperbarui.' : 'Supplier baru ditambahkan dengan kode otomatis.');
    } catch (err) {
      showError(apiError(err, 'Supplier gagal disimpan.'));
    } finally {
      setSaving(false);
    }
  };

  const editSupplier = (supplier: Supplier) => {
    if (!masterEditAllowed) return;
    setSupplierForm({
      id: supplier.id,
      code: supplier.code || '',
      name: supplier.name,
      contact: supplier.contact || '',
      phone: supplier.phone || '',
      address: supplier.address || '',
      active: supplier.active !== false,
    });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const deleteSupplier = async (supplier: Supplier) => {
    if (!masterEditAllowed) return;
    if (!window.confirm(`Hapus supplier ${supplier.name}?`)) return;
    try {
      await api.delete(`/api/suppliers/${supplier.id}`);
      if (supplierForm.id === supplier.id) setSupplierForm(blankSupplier());
      await reload();
      flash('Supplier dihapus.');
    } catch (err) {
      showError(apiError(err, 'Supplier masih digunakan atau gagal dihapus.'));
    }
  };

  return (
    <div className="stack">
      {mode === 'hub' ? <>
        <section className="panel tbs-header"><div><span className="eyebrow dark">Pembelian & Hutang Supplier</span><h2>Pembelian</h2><p>Pilih proses pembelian yang ingin dibuka. Invoice, pembayaran dan master supplier tetap berada dalam satu modul.</p></div></section>
        <div className="master-hub"><section className="master-hub-group"><div className="master-hub-group-head"><div><strong>Pembelian</strong><span>Kelola invoice, pelunasan hutang dan supplier dari satu pusat.</span></div></div><div className="master-hub-grid">
          <button type="button" className="master-hub-card" onClick={() => changeMode('invoices')}><span className="master-hub-card-icon"><ReceiptText size={24} /></span><span className="master-hub-card-copy"><strong>Invoice Pembelian</strong><small>Input pembelian Inventory/Jasa, diskon, PPN dan cost center per baris.</small></span><ChevronRight size={18} /></button>
          <button type="button" className="master-hub-card" onClick={() => changeMode('payments')}><span className="master-hub-card-icon"><CreditCard size={24} /></span><span className="master-hub-card-copy"><strong>Pembayaran Supplier</strong><small>Bayar satu atau beberapa invoice supplier dari Kas/Bank.</small></span><ChevronRight size={18} /></button>
          <button type="button" className="master-hub-card" onClick={() => changeMode('suppliers')}><span className="master-hub-card-icon"><UsersRound size={24} /></span><span className="master-hub-card-copy"><strong>Master Supplier</strong><small>Kelola kode, kontak, alamat dan status supplier/vendor.</small></span><ChevronRight size={18} /></button>
        </div></section></div>
      </> : <section className="master-detail-nav"><div><span>Pembelian</span><ChevronRight size={14} /><strong>{mode === 'invoices' ? 'Invoice Pembelian' : mode === 'payments' ? 'Pembayaran Supplier' : 'Master Supplier'}</strong></div><button type="button" className="secondary small-btn" onClick={() => changeMode('hub')}>← Kembali ke Pembelian</button></section>}

      {mode === 'invoices' && (
        <>
          <section className="receivable-summary">
            <Summary label="Total Invoice" value={idr.format(totalInvoices)} note={`${invoices.length} transaksi pembelian`} />
            <Summary label="Pembelian Tunai" value={idr.format(totalCash)} note="Langsung Kas/Bank OUT" />
            <Summary label="Sisa Hutang Pembelian" value={idr.format(creditOutstanding)} note="Invoice kredit belum lunas" />
          </section>
          <div className="grid-form-list">
            <section className="panel form-panel">
              <div className="panel-head">
                <div>
                  <h3>{invoiceForm.id ? 'Edit Invoice Pembelian' : 'Tambah Invoice Pembelian'}</h3>
                  <p>No. transaksi pembelian dibuat otomatis. No. invoice supplier hanya referensi eksternal.</p>
                </div>
                {invoiceForm.id && (
                  <button type="button" className="text-btn" onClick={() => setInvoiceForm(blankInvoice())}>
                    Batal edit
                  </button>
                )}
              </div>
              <form className="form" onSubmit={saveInvoice}>
                <div className="row-2">
                  <Field label="Tanggal Pembelian">
                    <input
                      type="date"
                      value={invoiceForm.date}
                      onChange={event => setInvoiceForm(value => ({ ...value, date: event.target.value }))}
                    />
                  </Field>
                  <Field label="No. Transaksi Pembelian">
                    <input
                      disabled
                      value={editingInvoice ? purchaseNumber(editingInvoice) : 'Otomatis saat disimpan'}
                    />
                  </Field>
                </div>
                <div className="row-2">
                  <Field label="Supplier">
                    <select
                      value={invoiceForm.supplierId}
                      onChange={event => setInvoiceForm(value => ({ ...value, supplierId: event.target.value }))}
                    >
                      <option value="">Pilih supplier</option>
                      {data.suppliers
                        .filter(item => item.active !== false)
                        .map(item => (
                          <option key={item.id} value={item.id}>
                            {item.code ? `${item.code} - ` : ''}{item.name}
                          </option>
                        ))}
                    </select>
                  </Field>
                  <Field label="Supplier belum ada?">
                    <button
                      type="button"
                      className="secondary wide"
                      onClick={() => setShowQuickSupplier(value => !value)}
                    >
                      <Plus size={16} /> {showQuickSupplier ? 'Tutup Supplier Baru' : 'Supplier Baru'}
                    </button>
                  </Field>
                </div>
                {showQuickSupplier && (
                  <div className="notice">
                    <div className="row-2">
                      <Field label="Kode Otomatis">
                        <input disabled value={supplierCodePreview} />
                      </Field>
                      <Field label="Nama Supplier">
                        <input
                          value={quickSupplier.name}
                          onChange={event => setQuickSupplier(value => ({ ...value, name: event.target.value }))}
                          placeholder="Nama supplier"
                        />
                      </Field>
                    </div>
                    <div className="row-2">
                      <Field label="Contact Person">
                        <input
                          value={quickSupplier.contact}
                          onChange={event => setQuickSupplier(value => ({ ...value, contact: event.target.value }))}
                        />
                      </Field>
                      <Field label="No. HP">
                        <input
                          value={quickSupplier.phone}
                          onChange={event => setQuickSupplier(value => ({ ...value, phone: event.target.value }))}
                        />
                      </Field>
                    </div>
                    <Field label="Alamat">
                      <textarea
                        rows={2}
                        value={quickSupplier.address}
                        onChange={event => setQuickSupplier(value => ({ ...value, address: event.target.value }))}
                      />
                    </Field>
                    <button type="button" className="primary wide" disabled={saving} onClick={saveQuickSupplier}>
                      <Save size={16} /> Simpan & Pilih Supplier
                    </button>
                  </div>
                )}
                <div className="row-2">
                  <Field label="No. Invoice Supplier (opsional)">
                    <input
                      value={invoiceForm.invoiceNumber}
                      onChange={event => setInvoiceForm(value => ({ ...value, invoiceNumber: event.target.value }))}
                      placeholder="Nomor dari nota/invoice supplier"
                    />
                  </Field>
                  <Field label="Gudang Penerimaan">
                    <select value={invoiceForm.warehouseId} onChange={event => setInvoiceForm(value => ({ ...value, warehouseId: event.target.value }))}>
                      <option value="">Pilih gudang</option>
                      {inventoryWarehouses.filter(item => item.active || item.id === invoiceForm.warehouseId).map(item => <option key={item.id} value={item.id}>{item.code} - {item.name}{item.isDefault ? ' (Utama)' : ''}</option>)}
                    </select>
                  </Field>
                </div>
                <Field label="Default Cost Center"><select value={invoiceForm.kebunId} onChange={event => { const kebunId = event.target.value; setInvoiceForm(value => ({ ...value, kebunId, lines: value.lines.map(line => line.kebunId ? line : { ...line, kebunId }) })); }}><option value="">Pusat / Umum</option>{data.kebun.map(item => <option key={item.id} value={item.id}>{item.code} - {item.name}</option>)}</select></Field>
                <div className="segmented">
                  <button
                    type="button"
                    className={invoiceForm.paymentType === 'CREDIT' ? 'selected out' : ''}
                    disabled={Boolean(invoiceForm.id)}
                    onClick={() => setInvoiceForm(value => ({ ...value, paymentType: 'CREDIT', accountId: '' }))}
                  >
                    Kredit / Hutang
                  </button>
                  <button
                    type="button"
                    className={invoiceForm.paymentType === 'CASH' ? 'selected in' : ''}
                    disabled={Boolean(invoiceForm.id)}
                    onClick={() => setInvoiceForm(value => ({ ...value, paymentType: 'CASH', dueDate: '' }))}
                  >
                    Tunai
                  </button>
                </div>
                {invoiceForm.id && (
                  <div className="notice">Metode Tunai/Kredit dikunci saat edit. Bila salah metode, hapus transaksi yang belum dibayar lalu input ulang.</div>
                )}
                <div className="purchase-section-head">
                  <div><strong>Rincian Pembelian</strong><span>Satu invoice dapat memiliki beberapa Jasa/Inventory dan akun debit.</span></div>
                  <button type="button" className="secondary small-btn" onClick={addInvoiceLine}><Plus size={14} /> Tambah Baris</button>
                </div>
                <div className="purchase-lines">
                  {invoiceForm.lines.map((line, index) => {
                    const lineGross = Math.round((Number(line.quantity) || 0) * (Number(line.unitPrice) || 0));
                    const discountAmount = lineDiscountAmount(line.quantity, line.unitPrice, line.discountType, line.discountValue);
                    const lineTotal = Math.max(0, lineGross - discountAmount);
                    const selectedItem = line.itemId ? inventoryItems.find(row => row.id === line.itemId) : undefined;
                    const selectedAccount = line.debitAccountId ? accountingAccounts.find(row => row.id === line.debitAccountId) : undefined;
                    const selectedLabel = line.kind === 'INVENTORY' && selectedItem ? `${selectedItem.code} · ${selectedItem.name}` : line.kind === 'SERVICE' && selectedAccount ? `${selectedAccount.code} · ${selectedAccount.name}` : '';
                    const query = (line.search || '').trim().toLowerCase();
                    const matches = line.kind === 'INVENTORY'
                      ? inventoryItemOptions.filter(item => !query || item.id === line.itemId || `${item.code} ${item.name}`.toLowerCase().includes(query)).slice(0, 30)
                      : serviceDebitAccounts.filter(account => !query || account.id === line.debitAccountId || `${account.code} ${account.name}`.toLowerCase().includes(query)).slice(0, 30);
                    return (
                      <div className="purchase-line" key={index}>
                        <div className="purchase-line-grid">
                          <Field label="Jenis">
                            <select value={line.kind} onChange={event => setInvoiceLine(index, { kind: event.target.value as 'SERVICE' | 'INVENTORY', itemId: '', description: '', unit: event.target.value === 'SERVICE' ? 'jasa' : '', unitId: '', debitAccountId: '', search: '' })}>
                              <option value="SERVICE">Jasa</option>
                              <option value="INVENTORY">Inventory</option>
                            </select>
                          </Field>
                          <Field label="Barang / Jasa">
                            <div className="cash-account-picker">
                              <input type="text" autoComplete="off" value={line.search || selectedLabel} placeholder={line.kind === 'INVENTORY' ? 'Ketik kode / nama barang...' : 'Ketik kode / nama akun beban...'} onFocus={event => { setActivePurchasePicker(index); event.currentTarget.select(); }} onBlur={() => window.setTimeout(() => setActivePurchasePicker(current => current === index ? null : current), 120)} onChange={event => { const search = event.target.value; setInvoiceLine(index, { search, itemId: '', debitAccountId: '', description: '' }); setActivePurchasePicker(index); }} onKeyDown={event => { if (event.key === 'Escape') setActivePurchasePicker(null); if (event.key === 'Enter' && activePurchasePicker === index && matches[0]) { event.preventDefault(); if (line.kind === 'INVENTORY') selectInventoryItem(index, matches[0].id); else selectServiceAccount(index, matches[0].id); } }} />
                              {activePurchasePicker === index && <div className="cash-account-options">{matches.length === 0 ? <div className="cash-account-empty">Data tidak ditemukan.</div> : matches.map(option => line.kind === 'INVENTORY' ? <button type="button" key={option.id} onMouseDown={event => event.preventDefault()} onClick={() => selectInventoryItem(index, option.id)}><strong>{option.code}</strong><span>{option.name} · Stok {option.currentQuantity}</span></button> : <button type="button" key={option.id} onMouseDown={event => event.preventDefault()} onClick={() => selectServiceAccount(index, option.id)}><strong>{option.code}</strong><span>{option.name}</span></button>)}</div>}
                            </div>
                          </Field>
                          <Field label="Qty"><input inputMode="decimal" value={line.quantity} onChange={event => setInvoiceLine(index, { quantity: event.target.value.replace(',', '.').replace(/[^0-9.]/g, '') })} /></Field>
                          <Field label="Satuan">{line.kind === 'INVENTORY' && selectedItem ? <select value={line.unitId || selectedItem.unitId} onChange={event => selectInventoryUnit(index, selectedItem, event.target.value)}>{itemUnitChoices(selectedItem, inventoryUnits).map(choice => <option key={choice.unitId} value={choice.unitId}>{choice.label}{choice.factor !== 1 ? ' · 1 ' + choice.label + ' = ' + choice.factor + ' ' + (inventoryUnits.find(unit => unit.id === selectedItem.unitId)?.code || inventoryUnits.find(unit => unit.id === selectedItem.unitId)?.name || 'dasar') : ' · Satuan Dasar'}</option>)}</select> : <input value={line.unit} onChange={event => setInvoiceLine(index, { unit: event.target.value })} placeholder="unit" />}</Field>
                          <Field label="Harga Satuan"><input inputMode="numeric" value={formatMoneyInput(line.unitPrice)} onChange={event => setInvoiceLine(index, { unitPrice: event.target.value.replace(/[^0-9]/g, '') })} placeholder="0" /></Field>
                          <Field label="Diskon"><div className="purchase-inline-input"><select value={line.discountType} onChange={event => setInvoiceLine(index, { discountType: event.target.value as 'AMOUNT' | 'PERCENT', discountValue: '' })}><option value="PERCENT">%</option><option value="AMOUNT">Rp</option></select><input inputMode={line.discountType === 'PERCENT' ? 'decimal' : 'numeric'} value={line.discountType === 'AMOUNT' ? formatMoneyInput(line.discountValue) : line.discountValue} onChange={event => setInvoiceLine(index, { discountValue: line.discountType === 'PERCENT' ? event.target.value.replace(',', '.').replace(/[^0-9.]/g, '') : event.target.value.replace(/[^0-9]/g, '') })} placeholder="0" /></div></Field>
                          <Field label="Kebun / Cost Center"><select value={line.kebunId} onChange={event => setInvoiceLine(index, { kebunId: event.target.value })}><option value="">Pusat / Umum</option>{data.kebun.map(item => <option key={item.id} value={item.id}>{item.code} - {item.name}</option>)}</select></Field>
                          <div className="purchase-line-total"><span>Total</span><strong>{idr.format(lineTotal)}</strong><small>{discountAmount > 0 ? `Diskon ${idr.format(discountAmount)}` : ''}</small></div>
                          <button type="button" className="icon-btn danger purchase-line-delete" onClick={() => removeInvoiceLine(index)} disabled={invoiceForm.lines.length === 1} title="Hapus baris"><Trash2 size={15} /></button>
                        </div>
                      </div>
                    );
                  })}
                </div>
                <div className="purchase-totals-row">
                  <div className="purchase-total-cell"><span>Subtotal</span><strong>{idr.format(formSubtotal)}</strong></div>
                  <div className="purchase-total-cell"><span>Diskon Baris</span><strong>- {idr.format(formDiscountAmount)}</strong></div>
                  <div className="purchase-total-cell"><span>DPP</span><strong>{idr.format(formTaxableBase)}</strong></div>
                  <div className="purchase-total-cell"><span>PPN (%)</span><input className="purchase-percent-input" inputMode="decimal" value={invoiceForm.vatPercent} onChange={event => setInvoiceForm(value => ({ ...value, vatPercent: event.target.value.replace(',', '.').replace(/[^0-9.]/g, '') }))} placeholder="0" /><small>+ {idr.format(formVatAmount)}</small></div>
                  <div className="purchase-total-cell grand"><span>Total Invoice</span><strong>{idr.format(formTotal)}</strong></div>
                </div>
                <div className="row-2 purchase-footer-fields">
                  {invoiceForm.paymentType === 'CREDIT' ? <Field label="Jatuh Tempo"><input type="date" value={invoiceForm.dueDate} onChange={event => setInvoiceForm(value => ({ ...value, dueDate: event.target.value }))} /></Field> : <Field label="Bayar dari Kas / Bank"><select value={invoiceForm.accountId} onChange={event => setInvoiceForm(value => ({ ...value, accountId: event.target.value }))}><option value="">Pilih Kas / Bank</option>{data.accounts.map(item => <option key={item.id} value={item.id}>{item.name} · {item.type}</option>)}</select></Field>}
                  <Field label="Catatan"><textarea rows={2} value={invoiceForm.note} onChange={event => setInvoiceForm(value => ({ ...value, note: event.target.value }))} /></Field>
                </div>
                <button className="primary wide" disabled={saving}>
                  <Save size={18} /> {saving ? 'Menyimpan...' : 'Simpan Invoice Pembelian'}
                </button>
              </form>
            </section>
            <section className="panel list-panel">
              <div className="panel-head wrap">
                <div>
                  <h3>Daftar Invoice Pembelian</h3>
                  <p>Invoice kredit otomatis menjadi hutang dan dibayar dari tab Pembayaran.</p>
                </div>
                <div className="filters">
                  <select value={filterSupplier} onChange={event => setFilterSupplier(event.target.value)}>
                    <option value="">Semua supplier</option>
                    {data.suppliers.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}
                  </select>
                  <select
                    value={filterType}
                    onChange={event => setFilterType(event.target.value as typeof filterType)}
                  >
                    <option value="ALL">Tunai & Kredit</option>
                    <option value="CASH">Tunai</option>
                    <option value="CREDIT">Kredit</option>
                  </select>
                </div>
              </div>
              {filteredInvoices.length === 0 ? (
                <div className="empty"><span>Belum ada Invoice Pembelian.</span></div>
              ) : (
                <div className="table-wrap">
                  <table>
                    <thead>
                      <tr>
                        <th>No. Transaksi</th>
                        <th>Invoice Supplier</th>
                        <th>Supplier</th>
                        <th>Gudang</th>
                        <th>Kebun</th>
                        <th>Akun Debit</th>
                        <th>Metode</th>
                        <th className="right">Nominal</th>
                        <th className="right">Sisa Hutang</th>
                        <th></th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredInvoices.map(item => {
                        const supplier = data.suppliers.find(row => row.id === item.supplierId);
                        const lineKebunIds = [...new Set((item.lines || []).map(line => line.kebunId || item.kebunId || '').filter(Boolean))];
                        const kebun = lineKebunIds.length === 1 ? data.kebun.find(row => row.id === lineKebunIds[0]) : undefined;
                        const kebunLabel = lineKebunIds.length > 1 ? `Multi Cost Center (${lineKebunIds.length})` : kebun?.name || 'Pusat / Umum';
                        const debitAccountIds = item.lines?.length ? [...new Set(item.lines.map(line => line.debitAccountId))] : [item.debitAccountId];
                        const debitNames = debitAccountIds.map(id => accountingAccounts.find(row => row.id === id)).filter(Boolean).map(account => `${account!.code} - ${account!.name}`);
                        const paid = item.supplierBillId ? paidByBill.get(item.supplierBillId) || 0 : item.amount;
                        const outstanding = item.paymentType === 'CREDIT' ? Math.max(0, item.amount - paid) : 0;
                        const locked = item.paymentType === 'CREDIT' && paid > 0;
                        return (
                          <tr key={item.id}>
                            <td><strong>{purchaseNumber(item)}</strong><small className="table-note">{formatDate(item.date)}</small></td>
                            <td>{item.invoiceNumber || '-'}</td>
                            <td>{supplier?.name || '-'}</td>
                            <td>{inventoryWarehouses.find(row => row.id === (item.warehouseId || item.lines?.find(line => line.warehouseId)?.warehouseId))?.name || '-'}</td>
                            <td>{kebunLabel}</td>
                            <td>{debitNames.length ? debitNames.join(', ') : '-'}</td>
                            <td>
                              <span className={`pill ${item.paymentType === 'CASH' ? 'in' : 'out'}`}>
                                {item.paymentType === 'CASH'
                                  ? 'TUNAI'
                                  : outstanding === 0
                                    ? 'KREDIT · LUNAS'
                                    : paid > 0
                                      ? 'KREDIT · SEBAGIAN'
                                      : 'KREDIT'}
                              </span>
                            </td>
                            <td className="right">{idr.format(item.amount)}</td>
                            <td className="right">{item.paymentType === 'CREDIT' ? idr.format(outstanding) : '-'}</td>
                            <td>
                              {locked ? (
                                <span className="muted">Sudah dibayar</span>
                              ) : (
                                <div className="action-group">
                                  <button className="icon-btn" type="button" onClick={() => editInvoice(item)} title="Edit invoice">
                                    <Pencil size={15} />
                                  </button>
                                  <button className="icon-btn danger" type="button" onClick={() => deleteInvoice(item)} title="Hapus invoice">
                                    <Trash2 size={15} />
                                  </button>
                                </div>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </section>
          </div>
        </>
      )}

      {mode === 'payments' && (
        <>
          <section className="receivable-summary">
            <Summary label="Total Kewajiban" value={idr.format(totalBills)} note={`${bills.length} sumber hutang`} />
            <Summary label="Sudah Dibayar" value={idr.format(totalPaid)} note={`${data.supplierPayments.length} pembayaran`} />
            <Summary label="Sisa Hutang" value={idr.format(totalOutstanding)} note={`${bills.filter(item => item.outstanding > 0).length} hutang terbuka`} />
          </section>
          <div className="receivable-layout">
            <section className="panel receivable-form-panel">
              <div className="panel-head">
                <div>
                  <h3>{paymentEditId ? 'Edit Pembayaran Supplier' : 'Pembayaran Supplier'}</h3>
                  <p>Satu pembayaran dapat dialokasikan ke beberapa invoice/hutang dari supplier yang sama.</p>
                </div>
                {paymentEditId && <button type="button" className="text-btn" onClick={resetPayment}>Batal edit</button>}
              </div>
              <form className="form" onSubmit={savePayment}>
                <div className="row-2">
                  <Field label="Tanggal Bayar">
                    <input
                      type="date"
                      value={paymentForm.date}
                      onChange={event => setPaymentForm(value => ({ ...value, date: event.target.value }))}
                    />
                  </Field>
                  <Field label="Supplier">
                    <select
                      value={paymentForm.supplierId}
                      onChange={event => changePaymentSupplier(event.target.value)}
                    >
                      <option value="">Pilih supplier</option>
                      {data.suppliers.filter(item => item.active !== false).map(item => (
                        <option key={item.id} value={item.id}>{item.code ? `${item.code} - ` : ''}{item.name}</option>
                      ))}
                    </select>
                  </Field>
                </div>
                <Field label="Bayar dari Kas / Bank">
                  <select
                    value={paymentForm.accountId}
                    onChange={event => setPaymentForm(value => ({ ...value, accountId: event.target.value }))}
                  >
                    <option value="">Pilih akun pembayaran</option>
                    {data.accounts.map(item => (
                      <option key={item.id} value={item.id}>{item.name} · {item.type}</option>
                    ))}
                  </select>
                </Field>
                <Field label="Nominal Dibayar">
                  <input
                    inputMode="numeric"
                    value={formatMoneyInput(paymentForm.amount)}
                    onChange={event => setPaymentForm(value => ({
                      ...value,
                      amount: event.target.value.replace(/[^0-9]/g, ''),
                    }))}
                    placeholder="0"
                  />
                </Field>
                <div className="allocation-head">
                  <div><strong>Alokasi Hutang</strong><span>Invoice Pembelian, Armada TBS, dan hutang lama tetap dapat dibayar.</span></div>
                  <button type="button" className="secondary small-btn" onClick={autoAllocate}>
                    <WandSparkles size={14} /> Alokasikan Otomatis
                  </button>
                </div>
                {!paymentForm.supplierId ? (
                  <div className="notice">Pilih supplier untuk menampilkan hutang terbuka.</div>
                ) : availableBills.length === 0 ? (
                  <div className="notice">Tidak ada hutang terbuka untuk supplier ini.</div>
                ) : (
                  <div className="allocation-list">
                    {availableBills.map(item => {
                      const kebun = data.kebun.find(row => row.id === item.kebunId);
                      return (
                        <div className="allocation-row" key={item.id}>
                          <div>
                            <strong>{item.invoiceNumber || `Hutang ${item.id.slice(0, 8)}`}</strong>
                            <span>{billSource(item)} · {kebun?.name || 'Pusat / Umum'} · Sisa {idr.format(item.outstanding)}</span>
                          </div>
                          <input
                            aria-label={`Alokasi ${item.invoiceNumber || item.id}`}
                            inputMode="numeric"
                            value={formatMoneyInput(allocations[item.id] || '')}
                            placeholder="0"
                            onChange={event => {
                              const clean = event.target.value.replace(/[^0-9]/g, '');
                              const capped = Math.min(Number(clean || 0), item.outstanding);
                              setAllocations(current => ({
                                ...current,
                                [item.id]: capped ? String(capped) : '',
                              }));
                            }}
                          />
                        </div>
                      );
                    })}
                  </div>
                )}
                <div className={`allocation-total ${allocationTotal === paymentAmount && paymentAmount > 0 ? 'balanced' : ''}`}>
                  <span>Total Alokasi</span>
                  <strong>{idr.format(allocationTotal)}</strong>
                  <small>Selisih {idr.format(paymentAmount - allocationTotal)}</small>
                </div>
                <Field label="No. Referensi">
                  <input
                    value={paymentForm.reference}
                    onChange={event => setPaymentForm(value => ({ ...value, reference: event.target.value }))}
                    placeholder="Mutasi bank / bukti bayar"
                  />
                </Field>
                <Field label="Catatan">
                  <textarea
                    rows={2}
                    value={paymentForm.note}
                    onChange={event => setPaymentForm(value => ({ ...value, note: event.target.value }))}
                  />
                </Field>
                <button className="primary wide" disabled={saving}>
                  <Save size={18} /> {saving ? 'Menyimpan...' : paymentEditId ? 'Simpan Perubahan Pembayaran' : 'Simpan Pembayaran'}
                </button>
              </form>
            </section>
            <section className="panel list-panel">
              <div className="panel-head">
                <div><h3>Riwayat Pembayaran</h3><p>Pembayaran mengurangi hutang dan Kas/Bank tanpa mencatat biaya kedua kali.</p></div>
              </div>
              {data.supplierPayments.length === 0 ? (
                <div className="empty"><span>Belum ada pembayaran supplier.</span></div>
              ) : (
                <div className="table-wrap">
                  <table className="payment-table">
                    <thead>
                      <tr>
                        <th>No. Bayar</th><th>Tanggal</th><th>Supplier</th><th>Kas / Bank</th><th>Alokasi</th><th>Referensi</th><th className="right">Nominal</th><th></th>
                      </tr>
                    </thead>
                    <tbody>
                      {[...data.supplierPayments]
                        .sort((a, b) => `${b.date}${b.createdAt}`.localeCompare(`${a.date}${a.createdAt}`))
                        .map(payment => {
                          const supplier = data.suppliers.find(item => item.id === payment.supplierId);
                          const account = data.accounts.find(item => item.id === payment.accountId);
                          return (
                            <tr key={payment.id}>
                              <td><strong>{payment.paymentNumber}</strong></td>
                              <td>{formatDate(payment.date)}</td>
                              <td>{supplier?.name || '-'}</td>
                              <td>{account?.name || '-'}</td>
                              <td>{payment.allocations.map(item => item.invoiceNumber).join(', ') || '-'}</td>
                              <td>{payment.reference || '-'}</td>
                              <td className="right money out">{idr.format(payment.amount)}</td>
                              <td>
                                <div className="action-group">
                                  <button className="icon-btn" type="button" onClick={() => startEditPayment(payment)} title="Edit pembayaran">
                                    <Pencil size={15} />
                                  </button>
                                  <button className="icon-btn danger" type="button" onClick={() => deletePayment(payment)} title="Hapus pembayaran">
                                    <Trash2 size={15} />
                                  </button>
                                </div>
                              </td>
                            </tr>
                          );
                        })}
                    </tbody>
                  </table>
                </div>
              )}
            </section>
          </div>
        </>
      )}

      {mode === 'suppliers' && (
        <div className="grid-form-list">
          <section className="panel form-panel">
            <div className="panel-head">
              <div>
                <h3>{supplierForm.id ? 'Edit Supplier' : 'Tambah Supplier'}</h3>
                <p>Kode supplier baru dibuat otomatis mengikuti nomor terakhir.</p>
              </div>
              {supplierForm.id && (
                <button type="button" className="text-btn" onClick={() => setSupplierForm(blankSupplier())}>Batal edit</button>
              )}
            </div>
            {supplierForm.id && !masterEditAllowed ? (
              <div className="notice">Edit master supplier hanya dapat dilakukan Owner/Admin Pusat.</div>
            ) : (
              <form className="form" onSubmit={saveSupplier}>
                <div className="row-2">
                  <Field label="Kode Supplier">
                    <input disabled value={supplierForm.id ? supplierForm.code : supplierCodePreview} />
                  </Field>
                  <Field label="Nama Supplier">
                    <input
                      value={supplierForm.name}
                      onChange={event => setSupplierForm(value => ({ ...value, name: event.target.value }))}
                    />
                  </Field>
                </div>
                <div className="row-2">
                  <Field label="Contact Person">
                    <input
                      value={supplierForm.contact}
                      onChange={event => setSupplierForm(value => ({ ...value, contact: event.target.value }))}
                    />
                  </Field>
                  <Field label="No. HP">
                    <input
                      value={supplierForm.phone}
                      onChange={event => setSupplierForm(value => ({ ...value, phone: event.target.value }))}
                    />
                  </Field>
                </div>
                <Field label="Alamat">
                  <textarea
                    rows={3}
                    value={supplierForm.address}
                    onChange={event => setSupplierForm(value => ({ ...value, address: event.target.value }))}
                  />
                </Field>
                <label className="check-row">
                  <input
                    type="checkbox"
                    checked={supplierForm.active}
                    onChange={event => setSupplierForm(value => ({ ...value, active: event.target.checked }))}
                  />
                  <span>Supplier aktif</span>
                </label>
                <button className="primary wide" disabled={saving}>
                  <Save size={17} /> {supplierForm.id ? 'Simpan Perubahan' : 'Tambah Supplier'}
                </button>
              </form>
            )}
          </section>
          <section className="panel list-panel">
            <div className="panel-head">
              <div><h3>Daftar Supplier</h3><p>{data.suppliers.length} supplier tersimpan.</p></div>
            </div>
            {data.suppliers.length === 0 ? (
              <div className="empty"><span>Belum ada supplier.</span></div>
            ) : (
              <div className="master-list">
                {data.suppliers.map(item => (
                  <div className="master-row" key={item.id}>
                    <div>
                      <strong>{item.code || '-'} · {item.name}</strong>
                      <span>{item.contact || item.phone || 'Kontak belum diisi'} · {item.active ? 'Aktif' : 'Nonaktif'}</span>
                    </div>
                    {masterEditAllowed && (
                      <>
                        <button className="icon-btn" type="button" onClick={() => editSupplier(item)} title="Edit supplier">
                          <Pencil size={15} />
                        </button>
                        <button className="icon-btn danger" type="button" onClick={() => deleteSupplier(item)} title="Hapus supplier">
                          <Trash2 size={15} />
                        </button>
                      </>
                    )}
                  </div>
                ))}
              </div>
            )}
          </section>
        </div>
      )}
    </div>
  );
}

function Summary({ label, value, note }: { label: string; value: string; note: string }) {
  return <div><span>{label}</span><strong>{value}</strong><small>{note}</small></div>;
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <label className="field"><span>{label}</span>{children}</label>;
}


/* v4.13 multi-unit purchase */


/* v4.13.2 default purchase inventory */
