import { useEffect, useMemo, useState } from 'react';
import { api } from './lib/client';
import { ArrowLeftRight, Boxes, ChevronRight, ClipboardCheck, PackageOpen, Plus, Save, Trash2 } from 'lucide-react';
import AccountSearchPicker from './AccountSearchPicker';
import { readStoredChoice, storeChoice } from './navigationState';

type Role = 'OWNER' | 'ADMIN_PUSAT' | 'FINANCE' | 'ADMIN_KEBUN' | 'VIEWER';
type Kebun = { id: string; code: string; name: string };
type AccountingGroup = 'ASSET' | 'LIABILITY' | 'EQUITY' | 'REVENUE' | 'EXPENSE';
type AccountingAccount = { id: string; code: string; name: string; group: AccountingGroup; active: boolean; systemKey: string; level?: number; posting?: boolean };
type InventoryGroup = { id: string; code: string; name: string; canStore: boolean; inventoryAccountId: string; active: boolean };
type InventoryUnit = { id: string; code: string; name: string; active: boolean };
type InventoryItemUnitConversion = { unitId: string; factor: number; defaultPurchase?: boolean; defaultUsage?: boolean };
type InventoryItem = { id: string; code: string; name: string; groupId: string; unitId: string; unitConversions?: InventoryItemUnitConversion[]; currentQuantity: number; averageCost: number; stockValue: number; active: boolean };
type Warehouse = { id: string; code: string; name: string; kebunId: string; manager: string; active: boolean; isDefault: boolean };
type WarehouseBalance = { id: string; warehouseId: string; itemId: string; quantity: number; stockValue: number; averageCost: number };
type UsageLine = { itemId: string; warehouseId?: string; kebunId: string; debitAccountId: string; inventoryAccountId: string; quantity: number; unit: string; inputQuantity?: number; inputUnitId?: string; inputUnit?: string; conversionFactor?: number; unitCost: number; amount: number; memo: string };
type Usage = { id: string; usageNumber: string; date: string; warehouseId?: string; reference: string; description: string; lines: UsageLine[]; totalAmount: number; createdAt: string };
type TransferLine = { itemId: string; quantity: number; unit: string; inputQuantity?: number; inputUnitId?: string; inputUnit?: string; conversionFactor?: number; unitCost: number; amount: number };
type Transfer = { id: string; transferNumber: string; date: string; sourceWarehouseId: string; destinationWarehouseId: string; reference: string; description: string; lines: TransferLine[]; totalAmount: number; status: 'POSTED' | 'REVERSED'; createdAt: string };
type StocktakeLine = { itemId: string; unit: string; systemQuantity: number; systemValue: number; physicalQuantity: number | null; varianceQuantity: number; unitCost: number; varianceValue: number; note: string };
type Stocktake = { id: string; stocktakeNumber: string; date: string; warehouseId: string; pic: string; note: string; status: 'COUNTING' | 'REVIEW' | 'POSTED' | 'REVERSED'; lines: StocktakeLine[]; totalAbsVarianceValue: number; createdAt: string };
type LineForm = { itemId: string; search: string; debitAccountId: string; kebunId: string; quantity: string; unitId: string };
type InventoryMode = 'hub' | 'usage' | 'stock' | 'transfer' | 'stocktake';
type Props = { workspaceId: string; role: Role; kebun: Kebun[]; flash: (text: string) => void; showError: (text: string) => void };

const idr = new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 });
const qtyFormat = new Intl.NumberFormat('id-ID', { maximumFractionDigits: 4 });
function today() { return new Date().toISOString().slice(0, 10); }
function formatDate(value: string) { return new Intl.DateTimeFormat('id-ID', { day: '2-digit', month: 'short', year: 'numeric' }).format(new Date(`${value}T00:00:00`)); }
function apiError(err: unknown, fallback: string) { const response = (err as { response?: { data?: { error?: string; message?: string } } })?.response?.data; return response?.error || response?.message || fallback; }
function blankLine(defaultKebunId = ''): LineForm { return { itemId: '', search: '', debitAccountId: '', kebunId: defaultKebunId, quantity: '', unitId: '' }; }
function itemUnitChoices(item: InventoryItem | undefined, units: InventoryUnit[]) {
  if (!item) return [] as Array<{ unitId: string; label: string; factor: number; defaultUsage: boolean }>;
  const unitMap = new Map(units.map(unit => [unit.id, unit]));
  const base = unitMap.get(item.unitId);
  const rows = [{ unitId: item.unitId, label: base?.code || base?.name || '-', factor: 1, defaultUsage: false }];
  for (const conversion of item.unitConversions || []) {
    const unit = unitMap.get(conversion.unitId);
    if (!unit || unit.active === false || !(conversion.factor > 0)) continue;
    rows.push({ unitId: conversion.unitId, label: unit.code || unit.name, factor: conversion.factor, defaultUsage: conversion.defaultUsage === true });
  }
  return rows;
}
function preferredUsageUnitId(item: InventoryItem | undefined, units: InventoryUnit[]) {
  const rows = itemUnitChoices(item, units);
  return rows.find(row => row.defaultUsage)?.unitId || item?.unitId || '';
}
function unitChoice(item: InventoryItem | undefined, units: InventoryUnit[], unitId: string) { return itemUnitChoices(item, units).find(row => row.unitId === unitId) || itemUnitChoices(item, units)[0]; }

export default function InventoryUsage({ workspaceId, role, kebun, flash, showError }: Props) {
  const defaultKebunId = role === 'ADMIN_KEBUN' && kebun.length === 1 ? kebun[0].id : '';
  const [groups, setGroups] = useState<InventoryGroup[]>([]);
  const [units, setUnits] = useState<InventoryUnit[]>([]);
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [balances, setBalances] = useState<WarehouseBalance[]>([]);
  const [warehouseId, setWarehouseId] = useState('');
  const [accounts, setAccounts] = useState<AccountingAccount[]>([]);
  const [usages, setUsages] = useState<Usage[]>([]);
  const inventoryStorageKey = 'perkebunan.navigation.inventory';
  const inventoryModes: InventoryMode[] = ['hub', 'usage', 'stock', 'transfer', 'stocktake'];
  const [mode, setMode] = useState<InventoryMode>(() => readStoredChoice(inventoryStorageKey, inventoryModes, 'hub'));
  const [date, setDate] = useState(today());
  const [reference, setReference] = useState('');
  const [description, setDescription] = useState('Pemakaian Barang');
  const [lines, setLines] = useState<LineForm[]>([blankLine(defaultKebunId)]);
  const [activePicker, setActivePicker] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);
  const canEdit = role !== 'VIEWER';
  const changeMode = (next: InventoryMode) => { setMode(next); storeChoice(inventoryStorageKey, next); };
  const inventoryModeLabel = mode === 'usage' ? 'Pemakaian Barang' : mode === 'stock' ? 'Stok per Gudang' : mode === 'transfer' ? 'Mutasi Antar Gudang' : mode === 'stocktake' ? 'Stok Opname' : 'Persediaan';

  const load = async () => {
    try {
      const [masterRes, accountRes, usageRes] = await Promise.all([
        api.get('/api/inventory/master'),
        api.get('/api/accounting/accounts'),
        api.get('/api/inventory-usages'),
      ]);
      const master = masterRes.data as { groups?: InventoryGroup[]; units?: InventoryUnit[]; items?: InventoryItem[]; warehouses?: Warehouse[]; balances?: WarehouseBalance[]; defaultWarehouseId?: string };
      setGroups(master.groups || []);
      setUnits(master.units || []);
      setItems(master.items || []);
      setWarehouses(master.warehouses || []);
      setBalances(master.balances || []);
      const defaultWarehouseId = master.defaultWarehouseId || master.warehouses?.find(item => item.isDefault)?.id || '';
      setWarehouseId(current => current || defaultWarehouseId);
      setAccounts((accountRes.data as { accounts?: AccountingAccount[] }).accounts || []);
      setUsages((usageRes.data as { usages?: Usage[] }).usages || []);
    } catch (err) {
      showError(apiError(err, 'Data Pemakaian Barang gagal dimuat.'));
    }
  };
  useEffect(() => { void load(); }, [workspaceId]);

  const groupMap = useMemo(() => new Map(groups.map(item => [item.id, item])), [groups]);
  const unitMap = useMemo(() => new Map(units.map(item => [item.id, item])), [units]);
  const itemMap = useMemo(() => new Map(items.map(item => [item.id, item])), [items]);
  const accountMap = useMemo(() => new Map(accounts.map(item => [item.id, item])), [accounts]);
  const debitAccounts = useMemo(() => accounts.filter(item => item.active && (item.level ?? 4) === 4 && item.posting !== false && (item.group === 'ASSET' || item.group === 'EXPENSE') && !item.systemKey.startsWith('CASH:') && !item.systemKey.startsWith('AR_') && item.systemKey !== 'VAT_INPUT'), [accounts]);
  const itemOptions = useMemo(() => items.filter(item => item.active && groupMap.get(item.groupId)?.active !== false && groupMap.get(item.groupId)?.canStore), [items, groupMap]);
  const balanceMap = useMemo(() => new Map(balances.map(item => [`${item.warehouseId}|${item.itemId}`, item])), [balances]);
  const selectedWarehouse = warehouses.find(item => item.id === warehouseId);
  const balanceFor = (itemId: string, sourceWarehouseId = warehouseId) => balanceMap.get(`${sourceWarehouseId}|${itemId}`);
  const setLine = (index: number, patch: Partial<LineForm>) => setLines(current => current.map((line, lineIndex) => lineIndex === index ? { ...line, ...patch } : line));
  const selectItem = (index: number, itemId: string) => {
    const item = itemMap.get(itemId);
    setLine(index, { itemId, unitId: preferredUsageUnitId(item, units), search: item ? `${item.code} · ${item.name}` : '' });
    setActivePicker(null);
  };
  const linePreview = (line: LineForm) => {
    const item = itemMap.get(line.itemId);
    const balance = balanceFor(line.itemId);
    const inputQuantity = Math.max(0, Number(line.quantity || 0));
    const choice = unitChoice(item, units, line.unitId || item?.unitId || '');
    const quantity = inputQuantity * (choice?.factor || 1);
    if (!item || !balance || quantity <= 0) return 0;
    if (Math.abs(quantity - Number(balance.quantity || 0)) <= 0.000001) return Math.max(0, Math.round(balance.stockValue || 0));
    return Math.max(0, Math.round(quantity * Number(balance.averageCost || 0)));
  };
  const totalPreview = lines.reduce((sum, line) => sum + linePreview(line), 0);
  const reset = () => {
    setDate(today());
    setReference('');
    setDescription('Pemakaian Barang');
    setLines([blankLine(defaultKebunId)]);
    setActivePicker(null);
  };
  const save = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!date || !warehouseId || lines.length === 0 || lines.some(line => !line.itemId || !line.debitAccountId || Number(line.quantity || 0) <= 0 || (role === 'ADMIN_KEBUN' && !line.kebunId))) return showError('Tanggal, Gudang Sumber, barang, akun pemakaian, qty, dan Cost Center wajib dilengkapi.');
    try {
      setSaving(true);
      await api.post('/api/inventory-usages', {
        date,
        warehouseId,
        reference,
        description,
        lines: lines.map(line => ({ itemId: line.itemId, warehouseId, debitAccountId: line.debitAccountId, kebunId: line.kebunId, quantity: Number(line.quantity || 0), unitId: line.unitId })),
      });
      reset();
      await load();
      flash('Pemakaian Barang berhasil disimpan dan stok diperbarui.');
    } catch (err) {
      showError(apiError(err, 'Pemakaian Barang gagal disimpan.'));
    } finally {
      setSaving(false);
    }
  };
  const remove = async (usage: Usage) => {
    if (!window.confirm(`Hapus ${usage.usageNumber}? Stok akan dikembalikan menggunakan HPP historis transaksi ini.`)) return;
    try {
      await api.delete(`/api/inventory-usages/${usage.id}`);
      await load();
      flash('Pemakaian Barang dihapus dan stok dikembalikan.');
    } catch (err) {
      showError(apiError(err, 'Pemakaian Barang tidak dapat dihapus.'));
    }
  };
  const sortedUsages = useMemo(() => [...usages].sort((a, b) => `${b.date}${b.createdAt}`.localeCompare(`${a.date}${a.createdAt}`)), [usages]);

  return <div className="stack">
    {mode === 'hub' ? <>
      <section className="panel tbs-header"><div><span className="eyebrow dark">Persediaan Barang</span><h2>Kontrol Persediaan per Gudang</h2><p>Pilih proses persediaan yang ingin dibuka. Gudang menentukan lokasi fisik stok, sedangkan Kebun/Cost Center menentukan tujuan pembebanan biaya.</p></div></section>
      <div className="master-hub"><section className="master-hub-group"><div className="master-hub-group-head"><div><strong>Persediaan</strong><span>Kontrol barang masuk, keluar, perpindahan lokasi dan hasil hitung fisik.</span></div></div><div className="master-hub-grid">
        <button type="button" className="master-hub-card" onClick={() => changeMode('usage')}><span className="master-hub-card-icon"><PackageOpen size={24} /></span><span className="master-hub-card-copy"><strong>Pemakaian Barang</strong><small>Barang keluar dari gudang dengan HPP Moving Average dan Cost Center tujuan.</small></span><ChevronRight size={18} /></button>
        <button type="button" className="master-hub-card" onClick={() => changeMode('stock')}><span className="master-hub-card-icon"><Boxes size={24} /></span><span className="master-hub-card-copy"><strong>Stok per Gudang</strong><small>Lihat Qty, HPP Average, dan nilai persediaan untuk setiap lokasi gudang.</small></span><ChevronRight size={18} /></button>
        <button type="button" className="master-hub-card" onClick={() => changeMode('transfer')}><span className="master-hub-card-icon"><ArrowLeftRight size={24} /></span><span className="master-hub-card-copy"><strong>Mutasi Antar Gudang</strong><small>Pindahkan stok antar gudang tanpa membentuk beban dan tanpa mengubah total persediaan.</small></span><ChevronRight size={18} /></button>
        <button type="button" className="master-hub-card" onClick={() => changeMode('stocktake')}><span className="master-hub-card-icon"><ClipboardCheck size={24} /></span><span className="master-hub-card-copy"><strong>Stok Opname</strong><small>Hitung fisik, review selisih, posting penyesuaian, dan reversal bila diperlukan.</small></span><ChevronRight size={18} /></button>
      </div></section></div>
    </> : <section className="master-detail-nav"><div><span>Persediaan</span><ChevronRight size={14} /><strong>{inventoryModeLabel}</strong></div><button type="button" className="secondary small-btn" onClick={() => changeMode('hub')}>← Kembali ke Persediaan</button></section>}
    {mode === 'usage' && <>
    {canEdit && <section className="panel">
      <div className="panel-head"><div><h3>Tambah Pemakaian Barang</h3><p>HPP Average hanya ditampilkan sebagai preview. Nilai final dihitung ulang oleh sistem saat transaksi disimpan.</p></div></div>
      <form className="form" onSubmit={save}>
        <div className="row-2"><Field label="Tanggal"><input type="date" value={date} onChange={event => setDate(event.target.value)} /></Field><Field label="Gudang Sumber"><select value={warehouseId} onChange={event => setWarehouseId(event.target.value)}><option value="">Pilih gudang</option>{warehouses.filter(item => item.active || item.id === warehouseId).map(item => <option key={item.id} value={item.id}>{item.code} - {item.name}{item.isDefault ? ' (Utama)' : ''}</option>)}</select></Field></div>
        <Field label="No. Referensi (Opsional)"><input value={reference} onChange={event => setReference(event.target.value)} placeholder="Bon / permintaan barang / dokumen" /></Field>
        <Field label="Deskripsi"><input value={description} onChange={event => setDescription(event.target.value)} placeholder="Contoh: Pemakaian pupuk blok A" /></Field>
        <div className="purchase-section-head"><div><strong>Rincian Pemakaian</strong><span>Satu transaksi dapat menggunakan banyak barang, akun, dan Kebun/Cost Center.</span></div><button type="button" className="secondary small-btn" onClick={() => setLines(current => [...current, blankLine(defaultKebunId)])}><Plus size={14} /> Tambah Baris</button></div>
        <div className="purchase-lines">{lines.map((line, index) => {
          const selectedItem = itemMap.get(line.itemId);
          const selectedGroup = selectedItem ? groupMap.get(selectedItem.groupId) : undefined;
          const selectedUnit = selectedItem ? unitMap.get(selectedItem.unitId) : undefined;
          const selectedUnitChoice = unitChoice(selectedItem, units, line.unitId || selectedItem?.unitId || '');
          const selectedLabel = selectedItem ? `${selectedItem.code} · ${selectedItem.name}` : '';
          const query = (line.search || '').trim().toLowerCase();
          const matches = itemOptions.filter(item => !query || item.id === line.itemId || `${item.code} ${item.name}`.toLowerCase().includes(query)).slice(0, 30);
          const accountOptions = debitAccounts.filter(account => account.id !== selectedGroup?.inventoryAccountId);
          return <div className="purchase-line" key={index}>
            <div className="inventory-usage-line-grid">
              <Field label="Produk"><div className="cash-account-picker"><input type="text" autoComplete="off" value={line.search || selectedLabel} placeholder="Ketik kode / nama barang..." onFocus={event => { setActivePicker(index); event.currentTarget.select(); }} onBlur={() => window.setTimeout(() => setActivePicker(current => current === index ? null : current), 120)} onChange={event => { setLine(index, { search: event.target.value, itemId: '', unitId: '' }); setActivePicker(index); }} onKeyDown={event => { if (event.key === 'Escape') setActivePicker(null); if (event.key === 'Enter' && activePicker === index && matches[0]) { event.preventDefault(); selectItem(index, matches[0].id); } }} />{activePicker === index && <div className="cash-account-options">{matches.length === 0 ? <div className="cash-account-empty">Barang tidak ditemukan.</div> : matches.map(item => { const stock = balanceFor(item.id); return <button type="button" key={item.id} onMouseDown={event => event.preventDefault()} onClick={() => selectItem(index, item.id)}><strong>{item.code}</strong><span>{item.name} · Stok {qtyFormat.format(stock?.quantity || 0)} · Avg {idr.format(stock?.averageCost || 0)}</span></button>; })}</div>}</div></Field>
              <Field label="Akun Pemakaian"><AccountSearchPicker accounts={accountOptions} value={line.debitAccountId} onChange={accountId => setLine(index, { debitAccountId: accountId })} placeholder="Ketik kode atau nama akun..." ariaLabel={`Cari akun pemakaian baris ${index + 1}`} /></Field>
              <Field label="Jumlah"><input inputMode="decimal" value={line.quantity} onChange={event => setLine(index, { quantity: event.target.value.replace(',', '.').replace(/[^0-9.]/g, '') })} placeholder="0" /></Field>
              <Field label="Satuan">{selectedItem ? <select value={line.unitId || selectedItem.unitId} onChange={event => setLine(index, { unitId: event.target.value })}>{itemUnitChoices(selectedItem, units).map(choice => <option key={choice.unitId} value={choice.unitId}>{choice.label}{choice.factor !== 1 ? ' · 1 ' + choice.label + ' = ' + choice.factor + ' ' + (selectedUnit?.code || selectedUnit?.name || 'dasar') : ' · Satuan Dasar'}</option>)}</select> : <input disabled value="" placeholder="-" />}</Field>
              <Field label="HPP Average / Satuan"><input className="cash-entry-money" value={selectedItem ? idr.format((balanceFor(selectedItem.id)?.averageCost || 0) * (selectedUnitChoice?.factor || 1)) : ''} disabled placeholder="Rp 0" /></Field>
              <Field label="Kebun / Cost Center"><select value={line.kebunId} onChange={event => setLine(index, { kebunId: event.target.value })}>{role !== 'ADMIN_KEBUN' && <option value="">Pusat / Umum</option>}{role === 'ADMIN_KEBUN' && <option value="">Pilih kebun</option>}{kebun.map(item => <option key={item.id} value={item.id}>{item.code} - {item.name}</option>)}</select></Field>
              <div className="purchase-line-total"><span>Total</span><strong>{idr.format(linePreview(line))}</strong><small>{selectedItem ? 'Stok ' + (selectedWarehouse?.name || 'gudang') + ' ' + qtyFormat.format((balanceFor(selectedItem.id)?.quantity || 0) / (selectedUnitChoice?.factor || 1)) + ' ' + (selectedUnitChoice?.label || '') : ''}</small></div>
              <button type="button" className="icon-btn danger purchase-line-delete" disabled={lines.length === 1} onClick={() => setLines(current => current.filter((_, lineIndex) => lineIndex !== index))}><Trash2 size={15} /></button>
            </div>
          </div>;
        })}</div>
        <div className="purchase-totals-row"><div className="purchase-total-cell"><span>Total Baris</span><strong>{lines.length}</strong></div><div className="purchase-total-cell emphasis"><span>Total HPP Pemakaian</span><strong>{idr.format(totalPreview)}</strong></div></div>
        <div className="notice">Untuk menjaga histori Moving Average, transaksi Pemakaian Barang tidak diedit. Koreksi dilakukan dengan menghapus transaksi selama periodenya masih OPEN, lalu input ulang.</div>
        <button className="primary wide" disabled={saving}><Save size={16} /> Simpan Pemakaian Barang</button>
      </form>
    </section>}
    <section className="panel">
      <div className="panel-head"><div><h3>Riwayat Pemakaian Barang</h3><p>{sortedUsages.length} transaksi. HPP yang tersimpan adalah HPP historis pada saat barang dipakai.</p></div></div>
      {sortedUsages.length === 0 ? <div className="empty"><span>Belum ada Pemakaian Barang.</span></div> : <div className="journal-list">{sortedUsages.map(usage => <article className="journal-card" key={usage.id}><div className="journal-head"><div><strong>{usage.usageNumber}</strong><span>{formatDate(usage.date)} · {warehouses.find(item => item.id === (usage.warehouseId || usage.lines[0]?.warehouseId))?.name || 'Gudang Utama'} · {usage.reference || 'Tanpa referensi'}</span></div><div><b>{usage.description || 'Pemakaian Barang'}</b><span>{usage.lines.length} baris · {idr.format(usage.totalAmount || 0)}</span></div>{canEdit && <button type="button" className="icon-btn danger" onClick={() => remove(usage)}><Trash2 size={15} /></button>}</div><div className="table-wrap"><table><thead><tr><th>Barang</th><th>Akun</th><th>Kebun / Cost Center</th><th className="right">Qty</th><th>Satuan</th><th className="right">HPP Average</th><th className="right">Total</th></tr></thead><tbody>{usage.lines.map((line, index) => <tr key={`${usage.id}-${index}`}><td>{itemMap.get(line.itemId)?.code || '-'} · {itemMap.get(line.itemId)?.name || 'Barang'}</td><td>{accountMap.get(line.debitAccountId)?.code || '-'} · {accountMap.get(line.debitAccountId)?.name || 'Akun'}</td><td>{line.kebunId ? kebun.find(item => item.id === line.kebunId)?.name || '-' : 'Pusat / Umum'}</td><td className="right">{qtyFormat.format(line.inputQuantity ?? line.quantity)}</td><td>{line.inputUnit || line.unit}</td><td className="right">{idr.format(line.unitCost * (line.conversionFactor || 1))}</td><td className="right"><strong>{idr.format(line.amount)}</strong></td></tr>)}</tbody></table></div></article>)}</div>}
    </section>
    </>}
    {mode === 'stock' && <WarehouseStockPanel warehouses={warehouses} balances={balances} items={items} units={units} groups={groups} />}
    {mode === 'transfer' && <TransferPanel canEdit={canEdit} warehouses={warehouses} balances={balances} items={itemOptions} units={units} flash={flash} showError={showError} reload={load} />}
    {mode === 'stocktake' && <StocktakePanel role={role} canEdit={canEdit} warehouses={warehouses} items={items} units={units} flash={flash} showError={showError} reload={load} />}
  </div>;
}

function WarehouseStockPanel({ warehouses, balances, items, units, groups }: { warehouses: Warehouse[]; balances: WarehouseBalance[]; items: InventoryItem[]; units: InventoryUnit[]; groups: InventoryGroup[] }) {
  const defaultId = warehouses.find(item => item.isDefault)?.id || warehouses[0]?.id || '';
  const [warehouseId, setWarehouseId] = useState(defaultId);
  useEffect(() => { if (!warehouseId && defaultId) setWarehouseId(defaultId); }, [defaultId, warehouseId]);
  const itemMap = new Map(items.map(item => [item.id, item])); const unitMap = new Map(units.map(item => [item.id, item])); const groupMap = new Map(groups.map(item => [item.id, item])); const rows = balances.filter(item => item.warehouseId === warehouseId && (item.quantity > 0.000001 || item.stockValue > 1)).sort((a, b) => (itemMap.get(a.itemId)?.name || '').localeCompare(itemMap.get(b.itemId)?.name || ''));
  return <section className="panel"><div className="panel-head"><div><h3>Stok per Gudang</h3><p>Saldo lokasi stok. Total seluruh gudang tetap terhubung ke nilai persediaan akuntansi.</p></div><select value={warehouseId} onChange={event => setWarehouseId(event.target.value)}>{warehouses.filter(item => item.active || item.id === warehouseId).map(item => <option key={item.id} value={item.id}>{item.code} - {item.name}</option>)}</select></div>{rows.length === 0 ? <div className="empty"><span>Belum ada stok di gudang ini.</span></div> : <div className="table-wrap"><table><thead><tr><th>Barang</th><th>Kelompok</th><th>Satuan</th><th className="right">Qty</th><th className="right">HPP Average</th><th className="right">Nilai Stok</th></tr></thead><tbody>{rows.map(row => { const item = itemMap.get(row.itemId); return <tr key={row.id}><td><strong>{item?.code || '-'}</strong><small className="table-note">{item?.name || 'Barang'}</small></td><td>{item ? groupMap.get(item.groupId)?.name || '-' : '-'}</td><td>{item ? unitMap.get(item.unitId)?.code || unitMap.get(item.unitId)?.name || '-' : '-'}</td><td className="right">{qtyFormat.format(row.quantity)}</td><td className="right">{idr.format(row.averageCost)}</td><td className="right"><strong>{idr.format(row.stockValue)}</strong></td></tr>; })}</tbody></table></div>}</section>;
}

function TransferPanel({ canEdit, warehouses, balances, items, units, flash, showError, reload }: { canEdit: boolean; warehouses: Warehouse[]; balances: WarehouseBalance[]; items: InventoryItem[]; units: InventoryUnit[]; flash: (text: string) => void; showError: (text: string) => void; reload: () => Promise<void> }) {
  const active = warehouses.filter(item => item.active); const defaultId = active.find(item => item.isDefault)?.id || active[0]?.id || ''; const [transfers, setTransfers] = useState<Transfer[]>([]); const [date, setDate] = useState(today()); const [sourceId, setSourceId] = useState(defaultId); const [destinationId, setDestinationId] = useState(''); const [reference, setReference] = useState(''); const [description, setDescription] = useState('Mutasi Antar Gudang'); const [lines, setLines] = useState<Array<{ itemId: string; quantity: string; unitId: string }>>([{ itemId: '', quantity: '', unitId: '' }]); const [saving, setSaving] = useState(false);
  useEffect(() => { if (!sourceId && defaultId) setSourceId(defaultId); }, [defaultId, sourceId]);
  const loadTransfers = async () => { try { const response = await api.get('/api/inventory-transfers'); setTransfers((response.data as { transfers?: Transfer[] }).transfers || []); } catch (err) { showError(apiError(err, 'Mutasi Gudang gagal dimuat.')); } };
  useEffect(() => { void loadTransfers(); }, []);
  const unitMap = new Map(units.map(item => [item.id, item])); const balanceMap = new Map(balances.map(item => [`${item.warehouseId}|${item.itemId}`, item]));
  const save = async (event: React.FormEvent) => { event.preventDefault(); if (!date || !sourceId || !destinationId || sourceId === destinationId || lines.some(line => !line.itemId || Number(line.quantity) <= 0)) return showError('Tanggal, gudang asal/tujuan yang berbeda, barang, dan qty wajib diisi.'); try { setSaving(true); await api.post('/api/inventory-transfers', { date, sourceWarehouseId: sourceId, destinationWarehouseId: destinationId, reference, description, lines: lines.map(line => ({ itemId: line.itemId, quantity: Number(line.quantity), unitId: line.unitId })) }); setLines([{ itemId: '', quantity: '', unitId: '' }]); setReference(''); await Promise.all([reload(), loadTransfers()]); flash('Mutasi Antar Gudang berhasil diposting.'); } catch (err) { showError(apiError(err, 'Mutasi Antar Gudang gagal disimpan.')); } finally { setSaving(false); } };
  const reverse = async (item: Transfer) => { if (!window.confirm(`Batalkan ${item.transferNumber}? Stok akan dikembalikan ke gudang asal.`)) return; try { await api.post(`/api/inventory-transfers/${item.id}/reverse`, {}); await Promise.all([reload(), loadTransfers()]); flash('Mutasi Gudang berhasil dibatalkan.'); } catch (err) { showError(apiError(err, 'Mutasi Gudang tidak dapat dibatalkan.')); } };
  return <div className="stack">{canEdit && <section className="panel"><div className="panel-head"><div><h3>Mutasi Antar Gudang</h3><p>Pemindahan lokasi tidak membentuk beban. Nilai HPP historis ikut berpindah ke gudang tujuan.</p></div></div><form className="form" onSubmit={save}><div className="row-2"><Field label="Tanggal"><input type="date" value={date} onChange={event => setDate(event.target.value)} /></Field><Field label="Referensi"><input value={reference} onChange={event => setReference(event.target.value)} placeholder="Surat jalan / bon gudang" /></Field></div><div className="row-2"><Field label="Gudang Asal"><select value={sourceId} onChange={event => setSourceId(event.target.value)}><option value="">Pilih gudang</option>{active.map(item => <option key={item.id} value={item.id}>{item.code} - {item.name}</option>)}</select></Field><Field label="Gudang Tujuan"><select value={destinationId} onChange={event => setDestinationId(event.target.value)}><option value="">Pilih gudang</option>{active.filter(item => item.id !== sourceId).map(item => <option key={item.id} value={item.id}>{item.code} - {item.name}</option>)}</select></Field></div><Field label="Deskripsi"><input value={description} onChange={event => setDescription(event.target.value)} /></Field><div className="purchase-section-head"><div><strong>Barang Dipindahkan</strong><span>Stok tersedia mengikuti Gudang Asal.</span></div><button type="button" className="secondary small-btn" onClick={() => setLines(current => [...current, { itemId: '', quantity: '', unitId: '' }])}><Plus size={14} /> Tambah Baris</button></div><div className="purchase-lines">{lines.map((line, index) => { const selected = items.find(item => item.id === line.itemId); const stock = selected ? balanceMap.get(`${sourceId}|${selected.id}`) : undefined; return <div className="purchase-line" key={index}><div className="inventory-transfer-line-grid"><Field label="Barang"><select value={line.itemId} onChange={event => { const itemId = event.target.value; const nextItem = items.find(item => item.id === itemId); setLines(current => current.map((row, rowIndex) => rowIndex === index ? { ...row, itemId, unitId: preferredUsageUnitId(nextItem, units) } : row)); }}><option value="">Pilih barang</option>{items.map(item => <option key={item.id} value={item.id}>{item.code} - {item.name}</option>)}</select></Field><Field label="Satuan">{selected ? <select value={line.unitId || selected.unitId} onChange={event => setLines(current => current.map((row, rowIndex) => rowIndex === index ? { ...row, unitId: event.target.value } : row))}>{itemUnitChoices(selected, units).map(choice => <option key={choice.unitId} value={choice.unitId}>{choice.label}{choice.factor !== 1 ? ' · x' + choice.factor + ' ' + (unitMap.get(selected.unitId)?.code || unitMap.get(selected.unitId)?.name || 'dasar') : ' · Dasar'}</option>)}</select> : <select disabled><option>-</option></select>}</Field><Field label={'Qty · Tersedia ' + qtyFormat.format((stock?.quantity || 0) / (unitChoice(selected, units, line.unitId || selected?.unitId || '')?.factor || 1)) + ' ' + (unitChoice(selected, units, line.unitId || selected?.unitId || '')?.label || '')}><input inputMode="decimal" value={line.quantity} onChange={event => setLines(current => current.map((row, rowIndex) => rowIndex === index ? { ...row, quantity: event.target.value.replace(',', '.').replace(/[^0-9.]/g, '') } : row))} /></Field></div>{lines.length > 1 && <button type="button" className="text-btn" onClick={() => setLines(current => current.filter((_, rowIndex) => rowIndex !== index))}>Hapus baris</button>}</div>; })}</div><button className="primary wide" disabled={saving}><Save size={16} /> Posting Mutasi Gudang</button></form></section>}<section className="panel"><div className="panel-head"><div><h3>Riwayat Mutasi Gudang</h3><p>{transfers.length} dokumen mutasi.</p></div></div>{transfers.length === 0 ? <div className="empty"><span>Belum ada Mutasi Antar Gudang.</span></div> : <div className="table-wrap"><table><thead><tr><th>No.</th><th>Tanggal</th><th>Gudang Asal</th><th>Gudang Tujuan</th><th className="right">Nilai</th><th>Status</th><th></th></tr></thead><tbody>{[...transfers].sort((a,b) => `${b.date}${b.createdAt}`.localeCompare(`${a.date}${a.createdAt}`)).map(item => <tr key={item.id}><td><strong>{item.transferNumber}</strong><small className="table-note">{item.reference || item.description}</small></td><td>{formatDate(item.date)}</td><td>{warehouses.find(row => row.id === item.sourceWarehouseId)?.name || '-'}</td><td>{warehouses.find(row => row.id === item.destinationWarehouseId)?.name || '-'}</td><td className="right">{idr.format(item.totalAmount)}</td><td><span className={`status ${item.status === 'POSTED' ? 'active' : ''}`}>{item.status}</span></td><td>{canEdit && item.status === 'POSTED' && <button type="button" className="text-btn danger" onClick={() => reverse(item)}>Batalkan</button>}</td></tr>)}</tbody></table></div>}</section></div>;
}

function StocktakePanel({ role, canEdit, warehouses, items, units, flash, showError, reload }: { role: Role; canEdit: boolean; warehouses: Warehouse[]; items: InventoryItem[]; units: InventoryUnit[]; flash: (text: string) => void; showError: (text: string) => void; reload: () => Promise<void> }) {
  const activeWarehouses = warehouses.filter(item => item.active); const defaultId = activeWarehouses.find(item => item.isDefault)?.id || activeWarehouses[0]?.id || ''; const [stocktakes, setStocktakes] = useState<Stocktake[]>([]); const [selectedId, setSelectedId] = useState(''); const [date, setDate] = useState(today()); const [warehouseId, setWarehouseId] = useState(defaultId); const [pic, setPic] = useState(''); const [note, setNote] = useState(''); const [draft, setDraft] = useState<Record<string, { physicalQuantity: string; physicalUnitId: string; valuationCost: string; note: string }>>({}); const [saving, setSaving] = useState(false); const canPost = role === 'OWNER' || role === 'ADMIN_PUSAT' || role === 'FINANCE';
  useEffect(() => { if (!warehouseId && defaultId) setWarehouseId(defaultId); }, [defaultId, warehouseId]); const itemMap = new Map(items.map(item => [item.id, item]));
  const loadStocktakes = async () => { try { const response = await api.get('/api/inventory-stocktakes'); setStocktakes((response.data as { stocktakes?: Stocktake[] }).stocktakes || []); } catch (err) { showError(apiError(err, 'Stok Opname gagal dimuat.')); } };
  useEffect(() => { void loadStocktakes(); }, []);
  const selected = stocktakes.find(item => item.id === selectedId);
  const open = (item: Stocktake) => { setSelectedId(item.id); setPic(item.pic || ''); setNote(item.note || ''); const next: Record<string, { physicalQuantity: string; physicalUnitId: string; valuationCost: string; note: string }> = {}; item.lines.forEach(line => { const masterItem = itemMap.get(line.itemId); next[line.itemId] = { physicalQuantity: line.physicalQuantity == null ? '' : String(line.physicalQuantity), physicalUnitId: masterItem?.unitId || '', valuationCost: line.unitCost > 0 ? String(line.unitCost) : '', note: line.note || '' }; }); setDraft(next); };
  const create = async (event: React.FormEvent) => { event.preventDefault(); if (!date || !warehouseId) return showError('Tanggal dan Gudang Stok Opname wajib dipilih.'); try { setSaving(true); const response = await api.post('/api/inventory-stocktakes', { date, warehouseId, pic, note }); const created = response.data as Stocktake; await loadStocktakes(); await reload(); open(created); flash('Stok Opname dibuat. Gudang dikunci sementara sampai opname selesai.'); } catch (err) { showError(apiError(err, 'Stok Opname gagal dibuat.')); } finally { setSaving(false); } };
  const saveCount = async (submitReview: boolean) => { if (!selected) return; try { setSaving(true); await api.put(`/api/inventory-stocktakes/${selected.id}`, { date: selected.date, pic, note, submitReview, lines: selected.lines.map(line => { const masterItem = itemMap.get(line.itemId); const choice = unitChoice(masterItem, units, draft[line.itemId]?.physicalUnitId || masterItem?.unitId || ''); const factor = choice?.factor || 1; const inputQty = draft[line.itemId]?.physicalQuantity ?? ''; return { itemId: line.itemId, physicalQuantity: inputQty === '' ? '' : Number(inputQty) * factor, valuationCost: Number(draft[line.itemId]?.valuationCost || 0) / factor, note: draft[line.itemId]?.note || '' }; }) }); await loadStocktakes(); await reload(); flash(submitReview ? 'Stok Opname masuk tahap Review.' : 'Hitungan fisik Stok Opname disimpan.'); } catch (err) { showError(apiError(err, 'Stok Opname gagal disimpan.')); } finally { setSaving(false); } };
  const post = async (item: Stocktake) => { if (!window.confirm(`Posting ${item.stocktakeNumber}? Stok dan jurnal penyesuaian akan diperbarui.`)) return; try { await api.post(`/api/inventory-stocktakes/${item.id}/post`, {}); setSelectedId(''); await Promise.all([loadStocktakes(), reload()]); flash('Stok Opname berhasil diposting dan selisih dijurnal otomatis.'); } catch (err) { showError(apiError(err, 'Stok Opname gagal diposting.')); } };
  const reverse = async (item: Stocktake) => { if (!window.confirm(`Reversal ${item.stocktakeNumber}? Saldo sebelum opname dan jurnal akan dikembalikan.`)) return; try { await api.post(`/api/inventory-stocktakes/${item.id}/reverse`, {}); setSelectedId(''); await Promise.all([loadStocktakes(), reload()]); flash('Stok Opname berhasil direversal.'); } catch (err) { showError(apiError(err, 'Stok Opname tidak dapat direversal.')); } };
  return <div className="stack">{canEdit && <section className="panel"><div className="panel-head"><div><h3>Buat Stok Opname</h3><p>Saat dokumen dibuat, sistem mengambil snapshot dan mengunci pergerakan stok gudang sampai Review/Posting selesai.</p></div></div><form className="form" onSubmit={create}><div className="row-2"><Field label="Tanggal"><input type="date" value={date} onChange={event => setDate(event.target.value)} /></Field><Field label="Gudang"><select value={warehouseId} onChange={event => setWarehouseId(event.target.value)}><option value="">Pilih gudang</option>{activeWarehouses.map(item => <option key={item.id} value={item.id}>{item.code} - {item.name}</option>)}</select></Field></div><div className="row-2"><Field label="PIC"><input value={pic} onChange={event => setPic(event.target.value)} placeholder="Petugas stok opname" /></Field><Field label="Catatan"><input value={note} onChange={event => setNote(event.target.value)} placeholder="Area/rak yang dihitung" /></Field></div><button className="primary wide" disabled={saving}><Plus size={16} /> Buat & Mulai Hitung</button></form></section>}<section className="panel"><div className="panel-head"><div><h3>Dokumen Stok Opname</h3><p>Status: Counting → Review → Posted. Posted dapat direversal selama belum ada pergerakan stok berikutnya.</p></div></div>{stocktakes.length === 0 ? <div className="empty"><span>Belum ada Stok Opname.</span></div> : <div className="table-wrap"><table><thead><tr><th>No.</th><th>Tanggal</th><th>Gudang</th><th>PIC</th><th>Status</th><th className="right">Nilai Selisih</th><th></th></tr></thead><tbody>{[...stocktakes].sort((a,b) => `${b.date}${b.createdAt}`.localeCompare(`${a.date}${a.createdAt}`)).map(item => <tr key={item.id}><td><strong>{item.stocktakeNumber}</strong></td><td>{formatDate(item.date)}</td><td>{warehouses.find(row => row.id === item.warehouseId)?.name || '-'}</td><td>{item.pic || '-'}</td><td><span className={`status ${item.status === 'POSTED' ? 'active' : ''}`}>{item.status}</span></td><td className="right">{idr.format(item.totalAbsVarianceValue || 0)}</td><td><div className="action-group">{(item.status === 'COUNTING' || item.status === 'REVIEW') && canEdit && <button type="button" className="text-btn" onClick={() => open(item)}>Buka</button>}{item.status === 'REVIEW' && canPost && <button type="button" className="text-btn" onClick={() => post(item)}>Posting</button>}{item.status === 'POSTED' && canPost && <button type="button" className="text-btn danger" onClick={() => reverse(item)}>Reversal</button>}</div></td></tr>)}</tbody></table></div>}</section>{selected && (selected.status === 'COUNTING' || selected.status === 'REVIEW') && <section className="panel"><div className="panel-head"><div><h3>{selected.stocktakeNumber} · Hitung Fisik</h3><p>{warehouses.find(item => item.id === selected.warehouseId)?.name} · snapshot {formatDate(selected.date)}. Qty sistem tidak berubah selama dokumen aktif.</p></div><button type="button" className="secondary" onClick={() => setSelectedId('')}>Tutup</button></div><div className="table-wrap"><table><thead><tr><th>Barang</th><th className="right">Stok Sistem</th><th className="right">Qty Fisik</th><th>Satuan Hitung</th><th className="right">Selisih Dasar</th><th className="right">HPP / Satuan</th><th className="right">Nilai Selisih</th><th>Keterangan</th></tr></thead><tbody>{selected.lines.map(line => { const masterItem = itemMap.get(line.itemId); const choice = unitChoice(masterItem, units, draft[line.itemId]?.physicalUnitId || masterItem?.unitId || ''); const factor = choice?.factor || 1; const physicalInput = draft[line.itemId]?.physicalQuantity === '' || draft[line.itemId]?.physicalQuantity == null ? null : Number(draft[line.itemId]?.physicalQuantity); const physical = physicalInput == null ? null : physicalInput * factor; const variance = physical == null ? 0 : physical - line.systemQuantity; const cost = line.unitCost > 0 ? line.unitCost : Number(draft[line.itemId]?.valuationCost || 0) / factor; return <tr key={line.itemId}><td><strong>{itemMap.get(line.itemId)?.code || '-'}</strong><small className="table-note">{itemMap.get(line.itemId)?.name || 'Barang'} · {line.unit}</small></td><td className="right">{qtyFormat.format(line.systemQuantity)}</td><td className="right"><input inputMode="decimal" value={draft[line.itemId]?.physicalQuantity || ''} onChange={event => setDraft(current => ({ ...current, [line.itemId]: { ...(current[line.itemId] || { physicalUnitId: masterItem?.unitId || '', valuationCost: '', note: '' }), physicalQuantity: event.target.value.replace(',', '.').replace(/[^0-9.]/g, '') } }))} style={{maxWidth:100}} /></td><td><select value={draft[line.itemId]?.physicalUnitId || masterItem?.unitId || ''} onChange={event => setDraft(current => ({ ...current, [line.itemId]: { ...(current[line.itemId] || { physicalQuantity: '', valuationCost: '', note: '' }), physicalUnitId: event.target.value } }))}>{itemUnitChoices(masterItem, units).map(option => <option key={option.unitId} value={option.unitId}>{option.label}{option.factor !== 1 ? ' · x' + option.factor : ' · Dasar'}</option>)}</select></td><td className="right">{physical == null ? '-' : qtyFormat.format(variance)} {line.unit}</td><td className="right">{line.unitCost > 0 ? idr.format(line.unitCost * factor) : variance > 0 ? <input inputMode="numeric" value={draft[line.itemId]?.valuationCost || ''} onChange={event => setDraft(current => ({ ...current, [line.itemId]: { ...(current[line.itemId] || { physicalQuantity: '', physicalUnitId: masterItem?.unitId || '', note: '' }), valuationCost: event.target.value.replace(/[^0-9]/g, '') } }))} placeholder={'Harga / ' + (choice?.label || '')} style={{maxWidth:120}} /> : idr.format(0)}</td><td className="right"><strong>{physical == null ? '-' : idr.format(Math.round(variance * cost))}</strong></td><td><input value={draft[line.itemId]?.note || ''} onChange={event => setDraft(current => ({ ...current, [line.itemId]: { ...(current[line.itemId] || { physicalQuantity: '', physicalUnitId: masterItem?.unitId || '', valuationCost: '' }), note: event.target.value } }))} placeholder="Rusak / kurang / lebih" /></td></tr>; })}</tbody></table></div><div className="form-actions"><button type="button" className="secondary" disabled={saving} onClick={() => saveCount(false)}><Save size={15} /> Simpan Hitungan</button><button type="button" className="primary" disabled={saving} onClick={() => saveCount(true)}>Selesai Hitung & Review</button></div></section>}</div>;
}

function Field({ label, children }: { label: string; children: React.ReactNode }) { return <label className="field"><span>{label}</span>{children}</label>; }


/* v4.13 multi-unit usage-transfer */


/* v4.13 multi-unit stocktake */
