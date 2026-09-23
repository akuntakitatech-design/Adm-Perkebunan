import { useMemo, useState } from 'react';
import { api } from './lib/client';
import { Pencil, Plus, Save, Trash2 } from 'lucide-react';
import { formatMoneyInput } from './moneyInput';

type Role = 'OWNER' | 'ADMIN_PUSAT' | 'FINANCE' | 'ADMIN_KEBUN' | 'VIEWER';
type WeightBasis = 'LAPANGAN' | 'PABRIK';
type TransportMode = 'TRIP' | 'KG_LAPANGAN' | 'KG_PABRIK';
type Kebun = { id: string; code: string; name: string; status: 'AKTIF' | 'NONAKTIF' };
type Mill = { id: string; name: string };
type Harvester = { id: string; name: string };
type Vehicle = { id: string; plateNumber: string; name: string; owner: string; supplierId?: string; rentMode: TransportMode; defaultRate: number };
type Supplier = { id: string; name: string; active: boolean };
type TbsRate = { id: string; kebunId: string; effectiveDate: string; harvestRatePerKg: number; harvestWeightBasis: WeightBasis; weighingEnabled?: boolean; weighingRatePerKg?: number; weighingWeightBasis?: WeightBasis; langsirEnabled: boolean; langsirRatePerKg: number; langsirWeightBasis: WeightBasis };
type TbsRecord = { id: string; date: string; doNumber: string; kebunId: string; millId: string; harvesterId: string; langsirWorkerId?: string; vehicleId: string; fieldWeightKg: number; factoryWeightKg: number; harvestRatePerKg: number; harvestWeightBasis: WeightBasis; weighingRatePerKg?: number; weighingWeightBasis?: WeightBasis; weighingCost?: number; langsirRatePerKg: number; langsirWeightBasis: WeightBasis; transportMode: TransportMode; transportRate: number; harvestCost: number; langsirCost: number; transportCost: number; directCost: number; note: string; createdAt: string };
type Data = { workspace: { role: Role }; kebun: Kebun[]; mills: Mill[]; harvesters: Harvester[]; vehicles: Vehicle[]; tbsRates: TbsRate[]; tbs: TbsRecord[]; suppliers: Supplier[] };
type Props = { data: Data; reload: () => Promise<void>; flash: (text: string) => void; showError: (text: string) => void };
type CommonForm = { date: string; doNumber: string; millId: string; vehicleId: string; transportMode: TransportMode; transportRate: string; note: string };
type DetailForm = { key: string; kebunId: string; harvesterId: string; langsirWorkerId: string; fieldWeightKg: string; harvestRatePerKg: string; harvestWeightBasis: WeightBasis; weighingRatePerKg: string; weighingWeightBasis: WeightBasis; langsirRatePerKg: string; langsirWeightBasis: WeightBasis };

const idr = new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 });
const num = new Intl.NumberFormat('id-ID', { maximumFractionDigits: 2 });

function today() {
  return new Date().toISOString().slice(0, 10);
}

function detailKey() {
  return Math.random().toString(36).slice(2, 9);
}

function blankCommon(): CommonForm {
  return { date: today(), doNumber: '', millId: '', vehicleId: '', transportMode: 'TRIP', transportRate: '', note: '' };
}

function blankDetail(): DetailForm {
  return {
    key: detailKey(),
    kebunId: '',
    harvesterId: '',
    langsirWorkerId: '',
    fieldWeightKg: '',
    harvestRatePerKg: '',
    harvestWeightBasis: 'LAPANGAN',
    weighingRatePerKg: '',
    weighingWeightBasis: 'LAPANGAN',
    langsirRatePerKg: '',
    langsirWeightBasis: 'LAPANGAN',
  };
}

function canTransact(role: Role) {
  return role !== 'VIEWER';
}

function apiError(err: unknown, fallback: string) {
  const response = (err as { response?: { data?: { error?: string; message?: string } } })?.response?.data;
  return response?.error || response?.message || fallback;
}

function latestRate(data: Data, kebunId: string, date: string) {
  return [...data.tbsRates]
    .filter(item => item.kebunId === kebunId && (!date || item.effectiveDate <= date))
    .sort((a, b) => b.effectiveDate.localeCompare(a.effectiveDate))[0];
}

function allocateProportional(total: number, weights: number[]) {
  const roundedTotal = Math.max(0, Math.round(total));
  const weightTotal = weights.reduce((sum, value) => sum + Math.max(0, value), 0);
  if (roundedTotal <= 0 || weightTotal <= 0) return weights.map(() => 0);
  let assigned = 0;
  return weights.map((weight, index) => {
    if (index === weights.length - 1) return roundedTotal - assigned;
    const part = Math.floor((roundedTotal * Math.max(0, weight)) / weightTotal);
    assigned += part;
    return part;
  });
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <label className="field"><span>{label}</span>{children}</label>;
}

export default function TbsFieldEntry({ data, reload, flash, showError }: Props) {
  const [common, setCommon] = useState<CommonForm>(blankCommon());
  const [details, setDetails] = useState<DetailForm[]>([blankDetail()]);
  const [editId, setEditId] = useState('');
  const [saving, setSaving] = useState(false);
  const [month, setMonth] = useState(today().slice(0, 7));
  const [filterKebun, setFilterKebun] = useState('');
  const allowed = canTransact(data.workspace.role);
  const selectedVehicle = data.vehicles.find(item => item.id === common.vehicleId);
  const rows = [...data.tbs]
    .filter(item => (!month || item.date.startsWith(month)) && (!filterKebun || item.kebunId === filterKebun))
    .sort((a, b) => `${b.date}${b.createdAt}`.localeCompare(`${a.date}${a.createdAt}`));

  const detailPreviews = useMemo(() => {
    const weights = details.map(item => Number(item.fieldWeightKg || 0));
    const tripParts = common.transportMode === 'TRIP'
      ? allocateProportional(Number(common.transportRate || 0), weights)
      : weights.map(() => 0);
    return details.map((item, index) => {
      const fieldWeight = weights[index];
      const harvestBase = item.harvestWeightBasis === 'LAPANGAN' ? fieldWeight : 0;
      const langsirBase = item.langsirWeightBasis === 'LAPANGAN' ? fieldWeight : 0;
      const harvestCost = Math.round(harvestBase * Number(item.harvestRatePerKg || 0));
      const weighingCost = item.weighingWeightBasis === 'PABRIK' ? 0 : Math.round(fieldWeight * Number(item.weighingRatePerKg || 0));
      const langsirCost = Math.round(langsirBase * Number(item.langsirRatePerKg || 0));
      const transportCost = common.transportMode === 'TRIP'
        ? tripParts[index]
        : common.transportMode === 'KG_LAPANGAN'
          ? Math.round(fieldWeight * Number(common.transportRate || 0))
          : 0;
      return { fieldWeight, harvestCost, weighingCost, langsirCost, transportCost, directCost: harvestCost + weighingCost + langsirCost + transportCost };
    });
  }, [common.transportMode, common.transportRate, details]);

  const totals = useMemo(() => detailPreviews.reduce((result, item) => ({
    fieldWeight: result.fieldWeight + item.fieldWeight,
    harvestCost: result.harvestCost + item.harvestCost,
    weighingCost: result.weighingCost + item.weighingCost,
    langsirCost: result.langsirCost + item.langsirCost,
    transportCost: result.transportCost + item.transportCost,
    directCost: result.directCost + item.directCost,
  }), { fieldWeight: 0, harvestCost: 0, weighingCost: 0, langsirCost: 0, transportCost: 0, directCost: 0 }), [detailPreviews]);

  const setDetail = (index: number, patch: Partial<DetailForm>) => {
    setDetails(current => current.map((item, itemIndex) => itemIndex === index ? { ...item, ...patch } : item));
  };

  const chooseKebun = (index: number, kebunId: string) => {
    const rate = latestRate(data, kebunId, common.date);
    const weighingEnabled = rate ? (rate.weighingEnabled ?? Number(rate.weighingRatePerKg || 0) > 0) : false;
    setDetail(index, {
      kebunId,
      harvestRatePerKg: rate ? String(rate.harvestRatePerKg || '') : '',
      harvestWeightBasis: rate?.harvestWeightBasis || 'LAPANGAN',
      weighingRatePerKg: weighingEnabled ? String(rate?.weighingRatePerKg || '') : '',
      weighingWeightBasis: weighingEnabled ? (rate?.weighingWeightBasis || 'LAPANGAN') : 'LAPANGAN',
      langsirRatePerKg: rate?.langsirEnabled ? String(rate.langsirRatePerKg || '') : '',
      langsirWeightBasis: rate?.langsirWeightBasis || 'LAPANGAN',
    });
  };

  const chooseVehicle = (vehicleId: string) => {
    const vehicle = data.vehicles.find(item => item.id === vehicleId);
    setCommon(current => ({
      ...current,
      vehicleId,
      transportMode: vehicle?.rentMode || 'TRIP',
      transportRate: vehicle ? String(vehicle.defaultRate || '') : '',
    }));
  };

  const reset = () => {
    setCommon(blankCommon());
    setDetails([blankDetail()]);
    setEditId('');
  };

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!common.date || !common.doNumber.trim() || !common.millId || !common.vehicleId) {
      showError('Lengkapi tanggal, nomor DO, pabrik, dan armada.');
      return;
    }
    const invalidDetail = details.some(item => !item.kebunId || !item.harvesterId || Number(item.fieldWeightKg || 0) <= 0);
    if (invalidDetail) {
      showError('Setiap rincian wajib memiliki kebun, pemanen, dan berat lapangan.');
      return;
    }
    const detailPayload = details.map(item => ({
      kebunId: item.kebunId,
      harvesterId: item.harvesterId,
      langsirWorkerId: item.langsirWorkerId || item.harvesterId,
      fieldWeightKg: Number(item.fieldWeightKg || 0),
      harvestRatePerKg: Number(item.harvestRatePerKg || 0),
      harvestWeightBasis: item.harvestWeightBasis,
      weighingRatePerKg: Number(item.weighingRatePerKg || 0),
      weighingWeightBasis: item.weighingWeightBasis,
      langsirRatePerKg: Number(item.langsirRatePerKg || 0),
      langsirWeightBasis: item.langsirWeightBasis,
    }));
    try {
      setSaving(true);
      if (editId) {
        await api.put(`/api/tbs/${editId}`, {
          ...common,
          ...detailPayload[0],
          transportRate: Number(common.transportRate || 0),
        });
      } else {
        await api.post('/api/tbs/batch', {
          ...common,
          transportRate: Number(common.transportRate || 0),
          details: detailPayload,
        });
      }
      const count = details.length;
      reset();
      await reload();
      flash(editId ? 'Timbangan lapangan berhasil diperbarui.' : `${count} rincian Timbangan Lapangan berhasil disimpan dalam satu DO.`);
    } catch (err) {
      showError(apiError(err, 'Timbangan lapangan gagal disimpan.'));
    } finally {
      setSaving(false);
    }
  };

  const startEdit = (item: TbsRecord) => {
    setEditId(item.id);
    setCommon({
      date: item.date,
      doNumber: item.doNumber,
      millId: item.millId,
      vehicleId: item.vehicleId,
      transportMode: item.transportMode,
      transportRate: String(item.transportRate || ''),
      note: item.note || '',
    });
    setDetails([{
      key: detailKey(),
      kebunId: item.kebunId,
      harvesterId: item.harvesterId,
      langsirWorkerId: item.langsirWorkerId || item.harvesterId,
      fieldWeightKg: String(item.fieldWeightKg || ''),
      harvestRatePerKg: String(item.harvestRatePerKg || ''),
      harvestWeightBasis: item.harvestWeightBasis,
      weighingRatePerKg: String(item.weighingRatePerKg || ''),
      weighingWeightBasis: item.weighingWeightBasis || 'LAPANGAN',
      langsirRatePerKg: String(item.langsirRatePerKg || ''),
      langsirWeightBasis: item.langsirWeightBasis,
    }]);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const remove = async (item: TbsRecord) => {
    if (!window.confirm(`Hapus rincian DO ${item.doNumber} untuk kebun ini?`)) return;
    try {
      await api.delete(`/api/tbs/${item.id}`);
      if (item.id === editId) reset();
      await reload();
      flash('Rincian Timbangan Lapangan berhasil dihapus.');
    } catch (err) {
      showError(apiError(err, 'Data TBS gagal dihapus.'));
    }
  };

  return <div className="stack">
    <section className="panel tbs-form-panel">
      <div className="panel-head wrap">
        <div>
          <h3>{editId ? 'Edit Rincian Timbangan Lapangan' : 'Input Pengiriman / Timbangan Lapangan'}</h3>
          <p>{editId ? 'Koreksi satu rincian kebun.' : 'Isi data pengiriman sekali, lalu tambahkan satu atau beberapa rincian kebun.'}</p>
        </div>
        {editId && <button className="text-btn" type="button" onClick={reset}>Batal edit</button>}
      </div>
      {!allowed ? <div className="notice">Role Viewer hanya dapat melihat data TBS.</div> : data.kebun.length === 0 || data.mills.length === 0 || data.harvesters.length === 0 || data.vehicles.length === 0 ? <div className="notice">Siapkan Kebun, Pabrik, Pemanen, dan Armada terlebih dahulu sebelum membuat DO.</div> : <form className="batch-form" onSubmit={submit}>
        <div className="batch-common-grid">
          <Field label="Tanggal Panen"><input type="date" value={common.date} onChange={e => setCommon(v => ({ ...v, date: e.target.value }))} /></Field>
          <Field label="No. DO ke Pabrik"><input placeholder="DO-001" value={common.doNumber} onChange={e => setCommon(v => ({ ...v, doNumber: e.target.value }))} /></Field>
          <Field label="Pabrik / PKS"><select value={common.millId} onChange={e => setCommon(v => ({ ...v, millId: e.target.value }))}><option value="">Pilih pabrik</option>{data.mills.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}</select></Field>
          <Field label="Armada"><select value={common.vehicleId} onChange={e => chooseVehicle(e.target.value)}><option value="">Pilih armada</option>{data.vehicles.map(item => <option key={item.id} value={item.id}>{item.plateNumber} - {item.name || item.owner || 'Armada'}</option>)}</select></Field>
          <Field label="Pola Sewa Armada"><select value={common.transportMode} onChange={e => setCommon(v => ({ ...v, transportMode: e.target.value as TransportMode }))}><option value="TRIP">Per Trip</option><option value="KG_LAPANGAN">Per Kg Lapangan</option><option value="KG_PABRIK">Per Kg Pabrik</option></select></Field>
          <Field label={common.transportMode === 'TRIP' ? (editId ? 'Alokasi Sewa / Trip' : 'Sewa / Trip — Total DO') : 'Tarif Armada / kg'}><input inputMode="numeric" placeholder="0" value={formatMoneyInput(common.transportRate)} onChange={e => setCommon(v => ({ ...v, transportRate: e.target.value.replace(/[^0-9]/g, '') }))} /></Field>
        </div>
        {selectedVehicle && <div className="notice">{selectedVehicle.supplierId ? <>Armada vendor · {data.suppliers.find(item => item.id === selectedVehicle.supplierId)?.name || selectedVehicle.owner || 'Supplier'} · biaya armada otomatis masuk Hutang Supplier.</> : <>Armada milik sendiri · biaya armada tidak membentuk Hutang Supplier.</>}</div>}
        <Field label="Catatan Pengiriman"><textarea rows={2} placeholder="Kondisi jalan, langsir, atau catatan DO" value={common.note} onChange={e => setCommon(v => ({ ...v, note: e.target.value }))} /></Field>

        <div className="batch-section-head">
          <div><strong>Rincian Kebun</strong><span>{editId ? 'Mode koreksi satu rincian.' : 'Tambahkan semua kebun yang ikut dalam DO ini.'}</span></div>
          {!editId && <button type="button" className="secondary small-btn" onClick={() => setDetails(current => [...current, blankDetail()])}><Plus size={15} /> Tambah Kebun</button>}
        </div>

        <div className="batch-details">
          {details.map((item, index) => {
            const preview = detailPreviews[index];
            return <div className="batch-detail-card" key={item.key}>
              <div className="batch-detail-head">
                <strong>Rincian {index + 1}</strong>
                {!editId && details.length > 1 && <button type="button" className="icon-btn danger" onClick={() => setDetails(current => current.filter((_, itemIndex) => itemIndex !== index))} title="Hapus rincian"><Trash2 size={15} /></button>}
              </div>
              <div className="batch-detail-grid">
                <Field label="Kebun"><select value={item.kebunId} onChange={e => chooseKebun(index, e.target.value)}><option value="">Pilih kebun</option>{data.kebun.filter(kebun => kebun.status === 'AKTIF').map(kebun => <option key={kebun.id} value={kebun.id}>{kebun.code} - {kebun.name}</option>)}</select></Field>
                <Field label="Pemanen"><select value={item.harvesterId} onChange={e => setDetail(index, { harvesterId: e.target.value, langsirWorkerId: item.langsirWorkerId || e.target.value })}><option value="">Pilih pemanen</option>{data.harvesters.map(worker => <option key={worker.id} value={worker.id}>{worker.name}</option>)}</select></Field>
                <Field label="Pekerja Langsir"><select value={item.langsirWorkerId} onChange={e => setDetail(index, { langsirWorkerId: e.target.value })}><option value="">Sama dengan pemanen</option>{data.harvesters.map(worker => <option key={worker.id} value={worker.id}>{worker.name}</option>)}</select></Field>
                <Field label="Berat Lapangan (kg)"><input inputMode="decimal" placeholder="0" value={item.fieldWeightKg} onChange={e => setDetail(index, { fieldWeightKg: e.target.value.replace(/[^0-9.]/g, '') })} /></Field>
                <Field label="Upah Panen / kg"><input inputMode="numeric" placeholder="0" value={formatMoneyInput(item.harvestRatePerKg)} onChange={e => setDetail(index, { harvestRatePerKg: e.target.value.replace(/[^0-9]/g, '') })} /></Field>
                <Field label="Dasar Upah Panen"><select value={item.harvestWeightBasis} onChange={e => setDetail(index, { harvestWeightBasis: e.target.value as WeightBasis })}><option value="LAPANGAN">Timbangan Lapangan</option><option value="PABRIK">Timbangan Pabrik</option></select></Field>
                <Field label="Upah Timbang / kg"><input inputMode="numeric" placeholder="0" value={formatMoneyInput(item.weighingRatePerKg)} onChange={e => setDetail(index, { weighingRatePerKg: e.target.value.replace(/[^0-9]/g, '') })} /></Field>
                <Field label="Dasar Upah Timbang"><select value={item.weighingWeightBasis} onChange={e => setDetail(index, { weighingWeightBasis: e.target.value as WeightBasis })}><option value="LAPANGAN">Timbangan Lapangan</option><option value="PABRIK">Timbangan Pabrik</option></select></Field>
                <Field label="Upah Langsir / kg"><input inputMode="numeric" placeholder="0 jika tidak ada" value={formatMoneyInput(item.langsirRatePerKg)} onChange={e => setDetail(index, { langsirRatePerKg: e.target.value.replace(/[^0-9]/g, '') })} /></Field>
                <Field label="Dasar Upah Langsir"><select value={item.langsirWeightBasis} onChange={e => setDetail(index, { langsirWeightBasis: e.target.value as WeightBasis })}><option value="LAPANGAN">Timbangan Lapangan</option><option value="PABRIK">Timbangan Pabrik</option></select></Field>
              </div>
              <div className="batch-cost-row">
                <span>Panen <b>{idr.format(preview.harvestCost)}</b></span>
                <span>Timbang <b>{idr.format(preview.weighingCost)}</b></span>
                <span>Langsir <b>{idr.format(preview.langsirCost)}</b></span>
                <span>Armada <b>{idr.format(preview.transportCost)}</b></span>
                <span>Total <b>{idr.format(preview.directCost)}</b></span>
              </div>
            </div>;
          })}
        </div>

        <div className="batch-summary">
          <div><span>Total Lapangan</span><strong>{num.format(totals.fieldWeight)} kg</strong></div>
          <div><span>Upah Panen</span><strong>{idr.format(totals.harvestCost)}</strong></div>
          <div><span>Upah Timbang</span><strong>{idr.format(totals.weighingCost)}</strong></div>
          <div><span>Upah Langsir</span><strong>{idr.format(totals.langsirCost)}</strong></div>
          <div><span>Biaya Armada</span><strong>{idr.format(totals.transportCost)}</strong></div>
          <div><span>Total Biaya</span><strong>{idr.format(totals.directCost)}</strong></div>
        </div>
        <button className="primary wide" disabled={saving}><Save size={18} /> {saving ? 'Menyimpan...' : editId ? 'Simpan Perubahan Lapangan' : `Simpan ${details.length} Rincian Timbangan`}</button>
      </form>}
    </section>

    <section className="panel list-panel">
      <div className="panel-head wrap">
        <div><h3>Daftar Timbangan Lapangan</h3><p>{rows.length} rincian timbang sesuai filter. Satu DO dapat berisi beberapa kebun.</p></div>
        <div className="filters"><input type="month" value={month} onChange={e => setMonth(e.target.value)} /><select value={filterKebun} onChange={e => setFilterKebun(e.target.value)}><option value="">Semua kebun</option>{data.kebun.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}</select></div>
      </div>
      {rows.length === 0 ? <div className="empty"><span>Belum ada timbangan lapangan.</span></div> : <div className="table-wrap"><table className="tbs-table"><thead><tr><th>DO</th><th>Kebun</th><th>Pabrik</th><th>Pemanen / Armada</th><th className="right">Lapangan</th><th className="right">Upah Timbang</th><th className="right">Biaya</th><th>Status</th><th></th></tr></thead><tbody>{rows.map(item => <tr key={item.id}><td><strong>{item.doNumber}</strong><small className="table-note">{item.date}</small></td><td>{data.kebun.find(row => row.id === item.kebunId)?.name || '-'}</td><td>{data.mills.find(row => row.id === item.millId)?.name || '-'}</td><td><strong>{data.harvesters.find(row => row.id === item.harvesterId)?.name || '-'}</strong><small className="table-note">{data.vehicles.find(row => row.id === item.vehicleId)?.plateNumber || '-'}</small></td><td className="right">{num.format(item.fieldWeightKg)} kg</td><td className="right money">{idr.format(item.weighingCost || 0)}</td><td className="right money out">{idr.format(item.directCost)}</td><td><span className={`pill ${item.factoryWeightKg > 0 ? 'in' : 'out'}`}>{item.factoryWeightKg > 0 ? 'SUDAH PABRIK' : 'MENUNGGU PABRIK'}</span></td><td>{allowed && <div className="action-group">{item.factoryWeightKg <= 0 && <button className="icon-btn" type="button" onClick={() => startEdit(item)} title="Edit lapangan"><Pencil size={15} /></button>}<button className="icon-btn danger" type="button" onClick={() => item.factoryWeightKg > 0 ? showError('Hapus riwayat Timbangan Pabrik DO ini terlebih dahulu, lalu hapus Timbangan Lapangannya.') : remove(item)} title={item.factoryWeightKg > 0 ? 'Hapus Timbangan Pabrik terlebih dahulu' : 'Hapus Timbangan Lapangan'}><Trash2 size={15} /></button></div>}</td></tr>)}</tbody></table></div>}
    </section>
  </div>;
}
