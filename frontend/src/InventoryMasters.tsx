import { useEffect, useMemo, useState } from 'react';
import { api } from './lib/client';
import { Pencil, Save, Trash2 } from 'lucide-react';
import AccountSearchPicker from './AccountSearchPicker';

type AccountingGroup = 'ASSET' | 'LIABILITY' | 'EQUITY' | 'REVENUE' | 'EXPENSE';
type AccountingAccount = { id: string; code: string; name: string; group: AccountingGroup; active: boolean; systemKey: string; level?: number; posting?: boolean };
type InventoryGroup = { id: string; code: string; name: string; canPurchase: boolean; canStore: boolean; canSell: boolean; purchaseAccountId: string; inventoryAccountId: string; salesAccountId: string; cogsAccountId: string; active: boolean };
type InventoryUnit = { id: string; code: string; name: string; active: boolean };
type InventoryItemUnitConversion = { unitId: string; factor: number; defaultPurchase?: boolean; defaultUsage?: boolean };
type InventoryItem = { id: string; code: string; name: string; groupId: string; unitId: string; unitConversions?: InventoryItemUnitConversion[]; openingQuantity: number; openingAverageCost: number; currentQuantity: number; averageCost: number; stockValue: number; active: boolean };
type InventoryItemForm = { id: string; code: string; name: string; groupId: string; unitId: string; unitConversions: Array<{ unitId: string; factor: string; defaultPurchase: boolean; defaultUsage: boolean }>; active: boolean };
type InventoryWarehouse = { id: string; code: string; name: string; kebunId: string; manager: string; active: boolean; isDefault: boolean };
type Kebun = { id: string; code: string; name: string };
type Props = { workspaceId: string; flash: (text: string) => void; showError: (text: string) => void; section?: 'all' | 'groups' | 'units' | 'items' | 'warehouses'; kebun?: Kebun[] };

const idr = new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 });
const qtyFormat = new Intl.NumberFormat('id-ID', { maximumFractionDigits: 4 });
function apiError(err: unknown, fallback: string) { const response = (err as { response?: { data?: { error?: string; message?: string } } })?.response?.data; return response?.error || response?.message || fallback; }
function blankGroup() { return { id: '', code: '', name: '', canPurchase: true, canStore: true, canSell: false, purchaseAccountId: '', inventoryAccountId: '', salesAccountId: '', cogsAccountId: '', active: true }; }
function blankUnit() { return { id: '', code: '', name: '', active: true }; }
function blankItem(): InventoryItemForm { return { id: '', code: '', name: '', groupId: '', unitId: '', unitConversions: [], active: true }; }
function blankWarehouse() { return { id: '', code: '', name: '', kebunId: '', manager: '', active: true, isDefault: false }; }

export default function InventoryMasters({ workspaceId, flash, showError, section = 'all', kebun = [] }: Props) {
  const [accounts, setAccounts] = useState<AccountingAccount[]>([]);
  const [groups, setGroups] = useState<InventoryGroup[]>([]);
  const [units, setUnits] = useState<InventoryUnit[]>([]);
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [warehouses, setWarehouses] = useState<InventoryWarehouse[]>([]);
  const [groupForm, setGroupForm] = useState(blankGroup());
  const [unitForm, setUnitForm] = useState(blankUnit());
  const [itemForm, setItemForm] = useState(blankItem());
  const [warehouseForm, setWarehouseForm] = useState(blankWarehouse());
  const [saving, setSaving] = useState(false);

  const load = async () => {
    try {
      const [accountRes, masterRes] = await Promise.all([
        api.get('/api/accounting/accounts'),
        api.get('/api/inventory/master'),
      ]);
      setAccounts((accountRes.data as { accounts: AccountingAccount[] }).accounts || []);
      const master = masterRes.data as { groups: InventoryGroup[]; units: InventoryUnit[]; items: InventoryItem[]; warehouses?: InventoryWarehouse[] };
      setGroups(master.groups || []);
      setUnits(master.units || []);
      setItems(master.items || []);
      setWarehouses(master.warehouses || []);
    } catch (err) {
      showError(apiError(err, 'Master Persediaan gagal dimuat.'));
    }
  };
  useEffect(() => { void load(); }, [workspaceId]);

  const postingAccount = (item: AccountingAccount) => (item.level ?? 4) === 4 && item.posting !== false;
  const assetAccounts = accounts.filter(item => item.active && postingAccount(item) && item.group === 'ASSET' && !item.systemKey.startsWith('CASH:') && !item.systemKey.startsWith('AR_') && item.systemKey !== 'VAT_INPUT');
  const purchaseAccounts = accounts.filter(item => item.active && postingAccount(item) && (item.group === 'ASSET' || item.group === 'EXPENSE') && !item.systemKey.startsWith('CASH:') && !item.systemKey.startsWith('AR_') && item.systemKey !== 'VAT_INPUT');
  const revenueAccounts = accounts.filter(item => item.active && postingAccount(item) && item.group === 'REVENUE');
  const expenseAccounts = accounts.filter(item => item.active && postingAccount(item) && item.group === 'EXPENSE');
  const includeSelectedAccount = (eligible: AccountingAccount[], selectedId: string) => { const selected = accounts.find(item => item.id === selectedId); return selected && !eligible.some(item => item.id === selected.id) ? [...eligible, selected] : eligible; };
  const accountMap = useMemo(() => new Map(accounts.map(item => [item.id, item])), [accounts]);
  const groupMap = useMemo(() => new Map(groups.map(item => [item.id, item])), [groups]);
  const unitMap = useMemo(() => new Map(units.map(item => [item.id, item])), [units]);
  const unitLabel = (unitId: string) => { const unit = unitMap.get(unitId); return unit?.code || unit?.name || '-'; };
  const addItemUnitConversion = () => setItemForm(current => ({ ...current, unitConversions: [...current.unitConversions, { unitId: '', factor: '', defaultPurchase: false, defaultUsage: false }] }));
  const updateItemUnitConversion = (index: number, patch: Partial<InventoryItemForm['unitConversions'][number]>) => setItemForm(current => {
    const next = current.unitConversions.map((row, rowIndex) => rowIndex === index ? { ...row, ...patch } : row);
    if (patch.defaultPurchase === true) next.forEach((row, rowIndex) => { if (rowIndex !== index) row.defaultPurchase = false; });
    if (patch.defaultUsage === true) next.forEach((row, rowIndex) => { if (rowIndex !== index) row.defaultUsage = false; });
    return { ...current, unitConversions: next };
  });
  const removeItemUnitConversion = (index: number) => setItemForm(current => ({ ...current, unitConversions: current.unitConversions.filter((_, rowIndex) => rowIndex !== index) }));
  const itemUnitsSummary = (item: InventoryItem) => {
    const base = unitLabel(item.unitId);
    const alternate = (item.unitConversions || []).map(row => unitLabel(row.unitId) + ' = ' + qtyFormat.format(row.factor) + ' ' + base);
    return [base, ...alternate].join(' · ');
  };

  const saveGroup = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!groupForm.name.trim() || (!groupForm.canPurchase && !groupForm.canStore && !groupForm.canSell)) return showError('Nama kelompok dan minimal satu sifat barang wajib dipilih.');
    try {
      setSaving(true);
      if (groupForm.id) await api.put(`/api/inventory/groups/${groupForm.id}`, groupForm); else await api.post('/api/inventory/groups', groupForm);
      const wasEdit = Boolean(groupForm.id);
      setGroupForm(blankGroup());
      await load();
      flash(wasEdit ? 'Kelompok Barang diperbarui.' : 'Kelompok Barang ditambahkan.');
    } catch (err) { showError(apiError(err, 'Kelompok Barang gagal disimpan.')); }
    finally { setSaving(false); }
  };
  const saveUnit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!unitForm.name.trim()) return showError('Nama satuan wajib diisi.');
    try {
      setSaving(true);
      if (unitForm.id) await api.put(`/api/inventory/units/${unitForm.id}`, unitForm); else await api.post('/api/inventory/units', unitForm);
      const wasEdit = Boolean(unitForm.id);
      setUnitForm(blankUnit());
      await load();
      flash(wasEdit ? 'Satuan Barang diperbarui.' : 'Satuan Barang ditambahkan.');
    } catch (err) { showError(apiError(err, 'Satuan Barang gagal disimpan.')); }
    finally { setSaving(false); }
  };
  const saveItem = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!itemForm.name.trim() || !itemForm.groupId || !itemForm.unitId) return showError('Nama barang, kelompok, dan satuan wajib diisi.');
    try {
      setSaving(true);
      const duplicateUnits = new Set(itemForm.unitConversions.filter(row => row.unitId).map(row => row.unitId));
      if (duplicateUnits.size !== itemForm.unitConversions.filter(row => row.unitId).length) return showError('Satuan alternatif pada barang tidak boleh duplikat.');
      if (itemForm.unitConversions.some(row => !row.unitId || row.unitId === itemForm.unitId || !(Number(row.factor) > 0))) return showError('Setiap satuan alternatif wajib dipilih dan faktor konversinya harus lebih dari nol.');
      const payload = { ...itemForm, unitConversions: itemForm.unitConversions.map(row => ({ ...row, factor: Number(row.factor) })) };
      if (itemForm.id) await api.put(`/api/inventory/items/${itemForm.id}`, payload); else await api.post('/api/inventory/items', payload);
      const wasEdit = Boolean(itemForm.id);
      setItemForm(blankItem());
      await load();
      flash(wasEdit ? 'Master Barang diperbarui.' : 'Master Barang ditambahkan.');
    } catch (err) { showError(apiError(err, 'Master Barang gagal disimpan.')); }
    finally { setSaving(false); }
  };
  const saveWarehouse = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!warehouseForm.name.trim()) return showError('Nama Gudang wajib diisi.');
    try {
      setSaving(true);
      const payload = { code: warehouseForm.code, name: warehouseForm.name, kebunId: warehouseForm.kebunId, manager: warehouseForm.manager, active: warehouseForm.active };
      if (warehouseForm.id) await api.put(`/api/inventory/warehouses/${warehouseForm.id}`, payload); else await api.post('/api/inventory/warehouses', payload);
      const wasEdit = Boolean(warehouseForm.id);
      setWarehouseForm(blankWarehouse());
      await load();
      flash(wasEdit ? 'Gudang diperbarui.' : 'Gudang ditambahkan.');
    } catch (err) { showError(apiError(err, 'Gudang gagal disimpan.')); }
    finally { setSaving(false); }
  };
  const remove = async (kind: 'groups' | 'units' | 'items', id: string) => {
    if (!window.confirm('Hapus master ini? Data yang sudah dipakai transaksi tidak dapat dihapus.')) return;
    try {
      await api.delete(`/api/inventory/${kind}/${id}`);
      await load();
      flash('Master berhasil dihapus.');
    } catch (err) { showError(apiError(err, 'Master tidak dapat dihapus. Nonaktifkan bila sudah digunakan.')); }
  };

  return (
    <div className="stack">
      {(section === 'all' || section === 'warehouses') && <section className="panel">
        <div className="panel-head"><div><h3>Master Gudang</h3><p>Gudang adalah lokasi fisik persediaan. Gudang Utama dipakai otomatis untuk seluruh data historis yang sebelumnya belum memiliki lokasi stok.</p></div></div>
        <form className="mini-form" onSubmit={saveWarehouse}>
          <div className="row-2"><Field label="Kode Gudang"><input value={warehouseForm.code} disabled={warehouseForm.isDefault} onChange={event => setWarehouseForm(value => ({ ...value, code: event.target.value }))} placeholder="Otomatis bila kosong" /></Field><Field label="Nama Gudang"><input value={warehouseForm.name} onChange={event => setWarehouseForm(value => ({ ...value, name: event.target.value }))} placeholder="Gudang Utama / Gudang Kebun A" /></Field></div>
          <div className="row-2"><Field label="Kebun Terkait (Opsional)"><select value={warehouseForm.kebunId} onChange={event => setWarehouseForm(value => ({ ...value, kebunId: event.target.value }))}><option value="">Pusat / Melayani semua kebun</option>{kebun.map(item => <option key={item.id} value={item.id}>{item.code} - {item.name}</option>)}</select></Field><Field label="Penanggung Jawab"><input value={warehouseForm.manager} onChange={event => setWarehouseForm(value => ({ ...value, manager: event.target.value }))} placeholder="Nama PIC gudang" /></Field></div>
          <Field label="Status"><select disabled={warehouseForm.isDefault} value={warehouseForm.active ? 'ACTIVE' : 'INACTIVE'} onChange={event => setWarehouseForm(value => ({ ...value, active: event.target.value === 'ACTIVE' }))}><option value="ACTIVE">Aktif</option><option value="INACTIVE">Nonaktif</option></select></Field>
          {warehouseForm.isDefault && <div className="notice">Gudang Utama adalah gudang default sistem dan tidak dapat dinonaktifkan.</div>}
          <div className="form-actions">{warehouseForm.id && <button type="button" className="secondary" onClick={() => setWarehouseForm(blankWarehouse())}>Batal</button>}<button className="primary" disabled={saving}><Save size={16} /> {warehouseForm.id ? 'Simpan Perubahan' : 'Tambah Gudang'}</button></div>
        </form>
        <div className="master-list">{warehouses.length === 0 ? <Empty text="Belum ada Gudang." /> : warehouses.map(item => <div className="master-row" key={item.id}><div><strong>{item.code} · {item.name}{item.isDefault ? ' · DEFAULT' : ''}</strong><span>{item.kebunId ? kebun.find(row => row.id === item.kebunId)?.name || 'Kebun terkait' : 'Pusat / semua kebun'}{item.manager ? ` · PIC ${item.manager}` : ''}</span></div><span className={`status ${item.active ? 'active' : ''}`}>{item.active ? 'AKTIF' : 'NONAKTIF'}</span><button className="icon-btn" onClick={() => setWarehouseForm({ ...item })}><Pencil size={15} /></button></div>)}</div>
      </section>}
      {(section === 'all' || section === 'groups') && <section className="panel">
        <div className="panel-head"><div><h3>Kelompok Barang</h3><p>Tentukan sifat barang dan mapping akun. Mapping baru berlaku untuk transaksi berikutnya.</p></div></div>
        <form className="mini-form" onSubmit={saveGroup}>
          <div className="row-2">
            <Field label="Kode Kelompok"><input value={groupForm.code} onChange={event => setGroupForm(value => ({ ...value, code: event.target.value }))} placeholder="Otomatis bila kosong" /></Field>
            <Field label="Nama Kelompok"><input value={groupForm.name} onChange={event => setGroupForm(value => ({ ...value, name: event.target.value }))} placeholder="Pupuk / Sparepart / Barang Dagang" /></Field>
          </div>
          <div className="nature-checks">
            <label><input type="checkbox" checked={groupForm.canPurchase} onChange={event => setGroupForm(value => ({ ...value, canPurchase: event.target.checked, purchaseAccountId: event.target.checked ? value.purchaseAccountId : '' }))} /> Dibeli</label>
            <label><input type="checkbox" checked={groupForm.canStore} onChange={event => setGroupForm(value => ({ ...value, canStore: event.target.checked, inventoryAccountId: event.target.checked ? value.inventoryAccountId : '' }))} /> Disimpan</label>
            <label><input type="checkbox" checked={groupForm.canSell} onChange={event => setGroupForm(value => ({ ...value, canSell: event.target.checked, salesAccountId: event.target.checked ? value.salesAccountId : '', cogsAccountId: event.target.checked ? value.cogsAccountId : '' }))} /> Dijual</label>
          </div>
          {groupForm.canPurchase && <Field label="Akun Pembelian / Non-stok"><AccountSearchPicker accounts={includeSelectedAccount(purchaseAccounts, groupForm.purchaseAccountId)} value={groupForm.purchaseAccountId} onChange={accountId => setGroupForm(value => ({ ...value, purchaseAccountId: accountId }))} placeholder="Ketik kode atau nama akun pembelian..." ariaLabel="Cari akun pembelian atau non-stok" /></Field>}
          {groupForm.canStore && <Field label="Akun Persediaan"><AccountSearchPicker accounts={includeSelectedAccount(assetAccounts, groupForm.inventoryAccountId)} value={groupForm.inventoryAccountId} onChange={accountId => setGroupForm(value => ({ ...value, inventoryAccountId: accountId }))} placeholder="Ketik kode atau nama akun persediaan..." ariaLabel="Cari akun persediaan" /></Field>}
          {groupForm.canSell && <div className="row-2"><Field label="Akun Penjualan"><AccountSearchPicker accounts={includeSelectedAccount(revenueAccounts, groupForm.salesAccountId)} value={groupForm.salesAccountId} onChange={accountId => setGroupForm(value => ({ ...value, salesAccountId: accountId }))} placeholder="Ketik kode atau nama akun penjualan..." ariaLabel="Cari akun penjualan" /></Field><Field label="Akun HPP"><AccountSearchPicker accounts={includeSelectedAccount(expenseAccounts, groupForm.cogsAccountId)} value={groupForm.cogsAccountId} onChange={accountId => setGroupForm(value => ({ ...value, cogsAccountId: accountId }))} placeholder="Ketik kode atau nama akun HPP..." ariaLabel="Cari akun HPP" /></Field></div>}
          <Field label="Status"><select value={groupForm.active ? 'ACTIVE' : 'INACTIVE'} onChange={event => setGroupForm(value => ({ ...value, active: event.target.value === 'ACTIVE' }))}><option value="ACTIVE">Aktif</option><option value="INACTIVE">Nonaktif</option></select></Field>
          <div className="form-actions">{groupForm.id && <button type="button" className="secondary" onClick={() => setGroupForm(blankGroup())}>Batal</button>}<button className="primary" disabled={saving}><Save size={16} /> {groupForm.id ? 'Simpan Perubahan' : 'Tambah Kelompok'}</button></div>
        </form>
        <div className="master-list">{groups.length === 0 ? <Empty text="Belum ada Kelompok Barang." /> : groups.map(item => <div className="master-row" key={item.id}><div><strong>{item.code} · {item.name}</strong><span>{[item.canPurchase ? 'Dibeli' : '', item.canStore ? 'Disimpan' : '', item.canSell ? 'Dijual' : ''].filter(Boolean).join(' · ')}{item.canStore ? ` · ${accountMap.get(item.inventoryAccountId)?.name || 'Akun persediaan belum ada'}` : ''}</span></div><span className={`status ${item.active ? 'active' : ''}`}>{item.active ? 'AKTIF' : 'NONAKTIF'}</span><button className="icon-btn" onClick={() => setGroupForm({ ...item })}><Pencil size={15} /></button><button className="icon-btn danger" onClick={() => remove('groups', item.id)}><Trash2 size={15} /></button></div>)}</div>
      </section>}

      {(section === 'all' || section === 'units' || section === 'items') && <section className="master-grid">
        {(section === 'all' || section === 'units') && <div className="panel">
          <div className="panel-head"><div><h3>Satuan Barang</h3><p>Satuan bebas diedit: kg, liter, sak, pcs, unit, dan lainnya.</p></div></div>
          <form className="mini-form" onSubmit={saveUnit}>
            <div className="row-2"><Field label="Kode Satuan"><input value={unitForm.code} onChange={event => setUnitForm(value => ({ ...value, code: event.target.value }))} placeholder="KG / LTR / PCS" /></Field><Field label="Nama Satuan"><input value={unitForm.name} onChange={event => setUnitForm(value => ({ ...value, name: event.target.value }))} placeholder="Kilogram" /></Field></div>
            <Field label="Status"><select value={unitForm.active ? 'ACTIVE' : 'INACTIVE'} onChange={event => setUnitForm(value => ({ ...value, active: event.target.value === 'ACTIVE' }))}><option value="ACTIVE">Aktif</option><option value="INACTIVE">Nonaktif</option></select></Field>
            <div className="form-actions">{unitForm.id && <button type="button" className="secondary" onClick={() => setUnitForm(blankUnit())}>Batal</button>}<button className="primary" disabled={saving}><Save size={16} /> {unitForm.id ? 'Simpan Perubahan' : 'Tambah Satuan'}</button></div>
          </form>
          <div className="master-list">{units.length === 0 ? <Empty text="Belum ada Satuan Barang." /> : units.map(item => <div className="master-row" key={item.id}><div><strong>{item.code} · {item.name}</strong></div><span className={`status ${item.active ? 'active' : ''}`}>{item.active ? 'AKTIF' : 'NONAKTIF'}</span><button className="icon-btn" onClick={() => setUnitForm({ ...item })}><Pencil size={15} /></button><button className="icon-btn danger" onClick={() => remove('units', item.id)}><Trash2 size={15} /></button></div>)}</div>
        </div>}
        {(section === 'all' || section === 'items') && <div className="panel">
          <div className="panel-head"><div><h3>Master Barang</h3><p>Saldo awal Qty dan Average diinput dari Akuntansi → COA & Setup → Saldo Awal.</p></div></div>
          <form className="mini-form" onSubmit={saveItem}>
            <div className="row-2"><Field label="Kode Barang"><input value={itemForm.code} onChange={event => setItemForm(value => ({ ...value, code: event.target.value }))} placeholder="Otomatis bila kosong" /></Field><Field label="Nama Barang"><input value={itemForm.name} onChange={event => setItemForm(value => ({ ...value, name: event.target.value }))} placeholder="Pupuk NPK 15-15-15" /></Field></div>
            <div className="row-2"><Field label="Kelompok Barang"><select value={itemForm.groupId} onChange={event => setItemForm(value => ({ ...value, groupId: event.target.value }))}><option value="">Pilih kelompok</option>{groups.filter(item => item.active || item.id === itemForm.groupId).map(item => <option key={item.id} value={item.id}>{item.code} - {item.name}</option>)}</select></Field><Field label="Satuan Dasar / Stok"><select value={itemForm.unitId} onChange={event => { const unitId = event.target.value; setItemForm(value => ({ ...value, unitId, unitConversions: value.unitConversions.filter(row => row.unitId !== unitId) })); }}><option value="">Pilih satuan dasar</option>{units.filter(item => item.active || item.id === itemForm.unitId).map(item => <option key={item.id} value={item.id}>{item.code} - {item.name}</option>)}</select></Field></div>
            <div className="item-unit-conversion-box">
              <div className="item-unit-conversion-head"><div><strong>Satuan Alternatif & Konversi</strong><span>Stok dan HPP selalu disimpan dalam satuan dasar. Konversi hanya berlaku untuk barang ini.</span></div><button type="button" className="secondary small-btn" disabled={!itemForm.unitId} onClick={addItemUnitConversion}>+ Tambah Satuan</button></div>
              {itemForm.unitConversions.length === 0 ? <div className="item-unit-empty">Belum ada satuan alternatif. Barang hanya menggunakan {itemForm.unitId ? unitLabel(itemForm.unitId) : 'satuan dasar'}.</div> : <div className="item-unit-conversion-list">{itemForm.unitConversions.map((row, index) => <div className="item-unit-conversion-row" key={index}>
                <Field label="Satuan Alternatif"><select value={row.unitId} onChange={event => updateItemUnitConversion(index, { unitId: event.target.value })}><option value="">Pilih satuan</option>{units.filter(unit => unit.id !== itemForm.unitId && (unit.active || unit.id === row.unitId) && !itemForm.unitConversions.some((other, otherIndex) => otherIndex !== index && other.unitId === unit.id)).map(unit => <option key={unit.id} value={unit.id}>{unit.code} - {unit.name}</option>)}</select></Field>
                <Field label={'1 ' + (row.unitId ? unitLabel(row.unitId) : 'Satuan') + ' = berapa ' + (itemForm.unitId ? unitLabel(itemForm.unitId) : 'Satuan Dasar')}><input inputMode="decimal" value={row.factor} onChange={event => updateItemUnitConversion(index, { factor: event.target.value.replace(',', '.').replace(/[^0-9.]/g, '') })} placeholder="Contoh: 12" /></Field>
                <div className="item-unit-defaults"><label><input type="checkbox" checked={row.defaultPurchase} onChange={event => updateItemUnitConversion(index, { defaultPurchase: event.target.checked })} /> Default Pembelian</label><label><input type="checkbox" checked={row.defaultUsage} onChange={event => updateItemUnitConversion(index, { defaultUsage: event.target.checked })} /> Default Pemakaian</label></div>
                <button type="button" className="icon-btn danger" title="Hapus satuan alternatif" onClick={() => removeItemUnitConversion(index)}><Trash2 size={15} /></button>
              </div>)}</div>}
            </div>
            <Field label="Status"><select value={itemForm.active ? 'ACTIVE' : 'INACTIVE'} onChange={event => setItemForm(value => ({ ...value, active: event.target.value === 'ACTIVE' }))}><option value="ACTIVE">Aktif</option><option value="INACTIVE">Nonaktif</option></select></Field>
            <div className="form-actions">{itemForm.id && <button type="button" className="secondary" onClick={() => setItemForm(blankItem())}>Batal</button>}<button className="primary" disabled={saving}><Save size={16} /> {itemForm.id ? 'Simpan Perubahan' : 'Tambah Barang'}</button></div>
          </form>
        </div>}
      </section>}

      {(section === 'all' || section === 'items') && <section className="panel">
        <div className="panel-head"><div><h3>Daftar Barang & Saldo</h3><p>Average cost berubah otomatis setiap pembelian barang yang disimpan.</p></div></div>
        {items.length === 0 ? <Empty text="Belum ada Master Barang." /> : <div className="table-wrap"><table><thead><tr><th>Kode / Barang</th><th>Kelompok</th><th>Satuan</th><th className="right">Stok</th><th className="right">Average</th><th className="right">Nilai Persediaan</th><th>Status</th><th></th></tr></thead><tbody>{items.map(item => <tr key={item.id}><td><strong>{item.code}</strong><small className="table-note">{item.name}</small></td><td>{groupMap.get(item.groupId)?.name || '-'}</td><td><strong>{unitLabel(item.unitId)}</strong>{(item.unitConversions || []).length > 0 && <small className="table-note">{itemUnitsSummary(item)}</small>}</td><td className="right">{qtyFormat.format(item.currentQuantity || 0)}</td><td className="right">{idr.format(item.averageCost || 0)}</td><td className="right">{idr.format(item.stockValue || 0)}</td><td><span className={`status ${item.active ? 'active' : ''}`}>{item.active ? 'AKTIF' : 'NONAKTIF'}</span></td><td><div className="action-group"><button className="icon-btn" onClick={() => setItemForm({ id: item.id, code: item.code, name: item.name, groupId: item.groupId, unitId: item.unitId, unitConversions: (item.unitConversions || []).map(row => ({ unitId: row.unitId, factor: String(row.factor), defaultPurchase: row.defaultPurchase === true, defaultUsage: row.defaultUsage === true })), active: item.active !== false })}><Pencil size={15} /></button><button className="icon-btn danger" onClick={() => remove('items', item.id)}><Trash2 size={15} /></button></div></td></tr>)}</tbody></table></div>}
      </section>}
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) { return <label className="field"><span>{label}</span>{children}</label>; }
function Empty({ text }: { text: string }) { return <div className="empty"><span>{text}</span></div>; }


/* v4.13 multi-unit master */
