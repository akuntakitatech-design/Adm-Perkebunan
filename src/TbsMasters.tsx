import { useState } from 'react';
import { api } from './lib/client';
import { Pencil, Save, Trash2 } from 'lucide-react';
import { formatMoneyInput } from './moneyInput';

type WeightBasis = 'LAPANGAN' | 'PABRIK';
type TransportMode = 'TRIP' | 'KG_LAPANGAN' | 'KG_PABRIK';
type Kebun = { id: string; name: string };
type Mill = { id: string; name: string; location: string };
type Harvester = { id: string; name: string; phone: string };
type Vehicle = { id: string; plateNumber: string; name: string; owner: string; ownershipType?: 'OWN' | 'VENDOR'; supplierId?: string; rentMode: TransportMode; defaultRate: number };
type Supplier = { id: string; name: string; active: boolean };
type TbsRate = { id: string; kebunId: string; effectiveDate: string; harvestRatePerKg: number; harvestWeightBasis: WeightBasis; weighingEnabled?: boolean; weighingRatePerKg?: number; weighingWeightBasis?: WeightBasis; langsirEnabled: boolean; langsirRatePerKg: number; langsirWeightBasis: WeightBasis };
type Data = { kebun: Kebun[]; mills: Mill[]; harvesters: Harvester[]; vehicles: Vehicle[]; suppliers: Supplier[]; tbsRates: TbsRate[] };
type Props = { data: Data; reload: () => Promise<void>; flash: (text: string) => void; showError: (text: string) => void; includeWorkers?: boolean; section?: 'all' | 'mills' | 'vehicles' | 'rates' };

const idr = new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 });

function today() {
  return new Date().toISOString().slice(0, 10);
}

function apiError(err: unknown, fallback: string) {
  const response = (err as { response?: { data?: { error?: string; message?: string } } })?.response?.data;
  return response?.error || response?.message || fallback;
}

function blankVehicle() {
  return { id: '', plateNumber: '', name: '', owner: '', ownershipType: 'OWN' as 'OWN' | 'VENDOR', supplierId: '', rentMode: 'TRIP' as TransportMode, defaultRate: '' };
}

function blankRate() {
  return { id: '', kebunId: '', effectiveDate: today(), harvestRatePerKg: '', harvestWeightBasis: 'LAPANGAN' as WeightBasis, weighingEnabled: false, weighingRatePerKg: '', weighingWeightBasis: 'LAPANGAN' as WeightBasis, langsirEnabled: false, langsirRatePerKg: '', langsirWeightBasis: 'LAPANGAN' as WeightBasis };
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <label className="field"><span>{label}</span>{children}</label>;
}

function MasterActions({ editing, saving, cancel }: { editing: boolean; saving: boolean; cancel: () => void }) {
  return <div className="form-actions">{editing && <button type="button" className="secondary" onClick={cancel}>Batal</button>}<button className="primary" disabled={saving}><Save size={16} /> {editing ? 'Simpan Perubahan' : 'Tambah'}</button></div>;
}

function MasterRow({ title, subtitle, edit, remove }: { title: string; subtitle: string; edit: () => void; remove: () => void }) {
  return <div className="master-row"><div><strong>{title}</strong><span>{subtitle}</span></div><button className="icon-btn" type="button" onClick={edit}><Pencil size={15} /></button><button className="icon-btn danger" type="button" onClick={remove}><Trash2 size={15} /></button></div>;
}

function transportLabel(mode: TransportMode) {
  if (mode === 'KG_LAPANGAN') return 'per kg lapangan';
  if (mode === 'KG_PABRIK') return 'per kg pabrik';
  return 'per trip';
}

export default function TbsMasters({ data, reload, flash, showError, includeWorkers = true, section = 'all' }: Props) {
  const [mill, setMill] = useState({ id: '', name: '', location: '' });
  const [harvester, setHarvester] = useState({ id: '', name: '', phone: '' });
  const [vehicle, setVehicle] = useState(blankVehicle());
  const [rate, setRate] = useState(blankRate());
  const [saving, setSaving] = useState(false);
  const [newVendorName, setNewVendorName] = useState('');
  const [addingVendor, setAddingVendor] = useState(false);

  const save = async (kind: 'mills' | 'harvesters' | 'vehicles' | 'rates', id: string, body: Record<string, unknown>, resetMaster: () => void) => {
    try {
      setSaving(true);
      if (id) await api.put(`/api/tbs-master/${kind}/${id}`, body);
      else await api.post(`/api/tbs-master/${kind}`, body);
      resetMaster();
      await reload();
      flash(id ? 'Master operasional diperbarui.' : 'Master operasional ditambahkan.');
    } catch (err) {
      showError(apiError(err, 'Master operasional gagal disimpan.'));
    } finally {
      setSaving(false);
    }
  };

  const removeMaster = async (kind: 'mills' | 'harvesters' | 'vehicles' | 'rates', id: string) => {
    if (!window.confirm('Hapus master ini?')) return;
    try {
      await api.delete(`/api/tbs-master/${kind}/${id}`);
      await reload();
      flash('Master operasional dihapus.');
    } catch (err) {
      showError(apiError(err, 'Master masih digunakan atau gagal dihapus.'));
    }
  };

  const saveVehicle = () => {
    if (vehicle.ownershipType === 'VENDOR' && !vehicle.supplierId) {
      showError('Pilih supplier/vendor untuk armada vendor, atau tambahkan vendor baru terlebih dahulu.');
      return;
    }
    void save('vehicles', vehicle.id, { ...vehicle, supplierId: vehicle.ownershipType === 'VENDOR' ? vehicle.supplierId : '', defaultRate: Number(vehicle.defaultRate || 0) }, () => setVehicle(blankVehicle()));
  };

  const addVendor = async () => {
    const name = newVendorName.trim();
    if (!name) {
      showError('Isi nama vendor terlebih dahulu.');
      return;
    }
    try {
      setAddingVendor(true);
      const response = await api.post('/api/suppliers', { name, active: true });
      const supplierId = String(response.data.id || '');
      if (!supplierId) throw new Error('Supplier baru belum mendapatkan ID.');
      setVehicle(current => ({ ...current, ownershipType: 'VENDOR', supplierId, owner: current.owner || name }));
      setNewVendorName('');
      await reload();
      flash(`Vendor ${name} berhasil ditambahkan dan dipilih.`);
    } catch (err) {
      showError(apiError(err, 'Vendor baru gagal ditambahkan.'));
    } finally {
      setAddingVendor(false);
    }
  };

  return <div className="tbs-master-grid">
    {(section === 'all' || section === 'mills') && <section className="panel">
      <div className="panel-head"><div><h3>Master Pabrik / PKS</h3><p>Tujuan penjualan TBS.</p></div></div>
      <form className="mini-form" onSubmit={event => { event.preventDefault(); void save('mills', mill.id, { name: mill.name, location: mill.location }, () => setMill({ id: '', name: '', location: '' })); }}>
        <Field label="Nama Pabrik"><input value={mill.name} onChange={e => setMill(v => ({ ...v, name: e.target.value }))} placeholder="Nama PKS" /></Field>
        <Field label="Lokasi"><input value={mill.location} onChange={e => setMill(v => ({ ...v, location: e.target.value }))} /></Field>
        <MasterActions editing={Boolean(mill.id)} saving={saving} cancel={() => setMill({ id: '', name: '', location: '' })} />
      </form>
      <div className="master-list">{data.mills.map(item => <MasterRow key={item.id} title={item.name} subtitle={item.location || 'Lokasi belum diisi'} edit={() => setMill({ id: item.id, name: item.name, location: item.location || '' })} remove={() => removeMaster('mills', item.id)} />)}</div>
    </section>}

    {includeWorkers && section === 'all' && <section className="panel">
      <div className="panel-head"><div><h3>Master Tenaga Kerja / Pemanen</h3><p>Dipakai untuk pemanen, pekerja timbang, pekerja langsir, dan Payroll.</p></div></div>
      <form className="mini-form" onSubmit={event => { event.preventDefault(); void save('harvesters', harvester.id, { name: harvester.name, phone: harvester.phone }, () => setHarvester({ id: '', name: '', phone: '' })); }}>
        <Field label="Nama Tenaga Kerja"><input value={harvester.name} onChange={e => setHarvester(v => ({ ...v, name: e.target.value }))} /></Field>
        <Field label="No. HP (opsional)"><input value={harvester.phone} onChange={e => setHarvester(v => ({ ...v, phone: e.target.value }))} /></Field>
        <MasterActions editing={Boolean(harvester.id)} saving={saving} cancel={() => setHarvester({ id: '', name: '', phone: '' })} />
      </form>
      <div className="master-list">{data.harvesters.map(item => <MasterRow key={item.id} title={item.name} subtitle={item.phone || 'No. HP belum diisi'} edit={() => setHarvester({ id: item.id, name: item.name, phone: item.phone || '' })} remove={() => removeMaster('harvesters', item.id)} />)}</div>
    </section>}

    {(section === 'all' || section === 'vehicles') && <section className="panel">
      <div className="panel-head"><div><h3>Master Armada</h3><p>Armada dan standar biaya sewanya.</p></div></div>
      <form className="mini-form" onSubmit={event => { event.preventDefault(); saveVehicle(); }}>
        <div className="row-2"><Field label="No. Polisi"><input value={vehicle.plateNumber} onChange={e => setVehicle(v => ({ ...v, plateNumber: e.target.value }))} placeholder="BM 1234 XX" /></Field><Field label="Nama / Jenis Armada"><input value={vehicle.name} onChange={e => setVehicle(v => ({ ...v, name: e.target.value }))} /></Field></div>
        <Field label="Jenis Armada"><select value={vehicle.ownershipType} onChange={e => setVehicle(v => ({ ...v, ownershipType: e.target.value as 'OWN' | 'VENDOR', supplierId: e.target.value === 'OWN' ? '' : v.supplierId }))}><option value="OWN">Milik Sendiri</option><option value="VENDOR">Vendor / Supplier</option></select></Field>
        <Field label="Pemilik / Vendor Armada"><input value={vehicle.owner} onChange={e => setVehicle(v => ({ ...v, owner: e.target.value }))} /></Field>
        {vehicle.ownershipType === 'VENDOR' && <><Field label="Supplier / Vendor Hutang"><select value={vehicle.supplierId} onChange={e => setVehicle(v => ({ ...v, supplierId: e.target.value }))}><option value="">Pilih supplier/vendor</option>{data.suppliers.filter(item => item.active !== false).map(item => <option key={item.id} value={item.id}>{item.name}</option>)}</select></Field><div className="row-2"><Field label="Tambah Vendor Baru"><input value={newVendorName} onChange={e => setNewVendorName(e.target.value)} placeholder="Contoh: SW Transport" /></Field><button type="button" className="secondary" disabled={addingVendor} onClick={() => void addVendor()}>{addingVendor ? 'Menambahkan...' : 'Tambah Vendor'}</button></div></>}
        <div className="row-2"><Field label="Pola Sewa"><select value={vehicle.rentMode} onChange={e => setVehicle(v => ({ ...v, rentMode: e.target.value as TransportMode }))}><option value="TRIP">Per Trip</option><option value="KG_LAPANGAN">Per Kg Lapangan</option><option value="KG_PABRIK">Per Kg Pabrik</option></select></Field><Field label="Tarif Default"><input inputMode="numeric" value={formatMoneyInput(vehicle.defaultRate)} onChange={e => setVehicle(v => ({ ...v, defaultRate: e.target.value.replace(/[^0-9]/g, '') }))} /></Field></div>
        <MasterActions editing={Boolean(vehicle.id)} saving={saving} cancel={() => setVehicle(blankVehicle())} />
      </form>
      <div className="master-list">{data.vehicles.map(item => <MasterRow key={item.id} title={`${item.plateNumber} · ${item.name || 'Armada'}`} subtitle={`${item.owner || 'Pemilik belum diisi'} · ${item.supplierId ? `Vendor: ${data.suppliers.find(row => row.id === item.supplierId)?.name || 'Supplier'}` : 'Armada sendiri'} · ${transportLabel(item.rentMode)} · ${idr.format(item.defaultRate)}`} edit={() => setVehicle({ id: item.id, plateNumber: item.plateNumber, name: item.name || '', owner: item.owner || '', ownershipType: item.ownershipType || (item.supplierId ? 'VENDOR' : 'OWN'), supplierId: item.supplierId || '', rentMode: item.rentMode, defaultRate: String(item.defaultRate || '') })} remove={() => removeMaster('vehicles', item.id)} />)}</div>
    </section>}

    {(section === 'all' || section === 'rates') && <section className="panel">
      <div className="panel-head"><div><h3>Standar Tarif per Kebun</h3><p>Panen, timbang, dan langsir dapat otomatis terisi saat kebun dipilih.</p></div></div>
      <form className="mini-form" onSubmit={event => { event.preventDefault(); void save('rates', rate.id, { ...rate, harvestRatePerKg: Number(rate.harvestRatePerKg || 0), weighingRatePerKg: Number(rate.weighingRatePerKg || 0), langsirRatePerKg: Number(rate.langsirRatePerKg || 0) }, () => setRate(blankRate())); }}>
        <div className="row-2"><Field label="Kebun"><select value={rate.kebunId} onChange={e => setRate(v => ({ ...v, kebunId: e.target.value }))}><option value="">Pilih kebun</option>{data.kebun.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}</select></Field><Field label="Berlaku Mulai"><input type="date" value={rate.effectiveDate} onChange={e => setRate(v => ({ ...v, effectiveDate: e.target.value }))} /></Field></div>
        <div className="row-2"><Field label="Upah Panen / kg"><input inputMode="numeric" value={formatMoneyInput(rate.harvestRatePerKg)} onChange={e => setRate(v => ({ ...v, harvestRatePerKg: e.target.value.replace(/[^0-9]/g, '') }))} /></Field><Field label="Dasar Timbang Panen"><select value={rate.harvestWeightBasis} onChange={e => setRate(v => ({ ...v, harvestWeightBasis: e.target.value as WeightBasis }))}><option value="LAPANGAN">Lapangan</option><option value="PABRIK">Pabrik</option></select></Field></div>
        <label className="check-row"><input type="checkbox" checked={rate.weighingEnabled} onChange={e => setRate(v => ({ ...v, weighingEnabled: e.target.checked, weighingRatePerKg: e.target.checked ? v.weighingRatePerKg : '' }))} /><span>Kebun menggunakan upah timbang</span></label>
        {rate.weighingEnabled && <div className="row-2"><Field label="Upah Timbang / kg"><input inputMode="numeric" value={formatMoneyInput(rate.weighingRatePerKg)} onChange={e => setRate(v => ({ ...v, weighingRatePerKg: e.target.value.replace(/[^0-9]/g, '') }))} placeholder="0" /></Field><Field label="Dasar Upah Timbang"><select value={rate.weighingWeightBasis} onChange={e => setRate(v => ({ ...v, weighingWeightBasis: e.target.value as WeightBasis }))}><option value="LAPANGAN">Timbangan Lapangan</option><option value="PABRIK">Timbangan Pabrik</option></select></Field></div>}
        <label className="check-row"><input type="checkbox" checked={rate.langsirEnabled} onChange={e => setRate(v => ({ ...v, langsirEnabled: e.target.checked }))} /><span>Kebun menggunakan tambahan upah langsir</span></label>
        {rate.langsirEnabled && <div className="row-2"><Field label="Upah Langsir / kg"><input inputMode="numeric" value={formatMoneyInput(rate.langsirRatePerKg)} onChange={e => setRate(v => ({ ...v, langsirRatePerKg: e.target.value.replace(/[^0-9]/g, '') }))} /></Field><Field label="Dasar Timbang Langsir"><select value={rate.langsirWeightBasis} onChange={e => setRate(v => ({ ...v, langsirWeightBasis: e.target.value as WeightBasis }))}><option value="LAPANGAN">Lapangan</option><option value="PABRIK">Pabrik</option></select></Field></div>}
        <MasterActions editing={Boolean(rate.id)} saving={saving} cancel={() => setRate(blankRate())} />
      </form>
      <div className="master-list">{[...data.tbsRates].sort((a, b) => b.effectiveDate.localeCompare(a.effectiveDate)).map(item => { const kebun = data.kebun.find(row => row.id === item.kebunId); const weighingEnabled = item.weighingEnabled ?? Number(item.weighingRatePerKg || 0) > 0; const weighingWeightBasis = item.weighingWeightBasis || 'LAPANGAN'; return <MasterRow key={item.id} title={`${kebun?.name || 'Kebun'} · ${item.effectiveDate}`} subtitle={`Panen ${idr.format(item.harvestRatePerKg)}/kg (${item.harvestWeightBasis})${weighingEnabled ? ` · Timbang ${idr.format(item.weighingRatePerKg || 0)}/kg (${weighingWeightBasis})` : ' · Tanpa upah timbang'}${item.langsirEnabled ? ` · Langsir ${idr.format(item.langsirRatePerKg)}/kg` : ' · Tanpa langsir'}`} edit={() => setRate({ id: item.id, kebunId: item.kebunId, effectiveDate: item.effectiveDate, harvestRatePerKg: String(item.harvestRatePerKg || ''), harvestWeightBasis: item.harvestWeightBasis, weighingEnabled, weighingRatePerKg: weighingEnabled ? String(item.weighingRatePerKg || '') : '', weighingWeightBasis, langsirEnabled: item.langsirEnabled, langsirRatePerKg: String(item.langsirRatePerKg || ''), langsirWeightBasis: item.langsirWeightBasis })} remove={() => removeMaster('rates', item.id)} />; })}</div>
    </section>}
  </div>;
}
