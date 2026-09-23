import { useMemo, useState } from 'react';
import { api } from './lib/client';
import { ChevronRight, Factory, Pencil, Save, Scale, Trash2, Wallet } from 'lucide-react';
import TbsFieldEntry from './TbsFieldEntry';
import TbsReceivables from './TbsReceivables';
import { readStoredChoice, storeChoice } from './navigationState';
import { formatMoneyInput } from './moneyInput';

type Role = 'OWNER' | 'ADMIN_PUSAT' | 'FINANCE' | 'ADMIN_KEBUN' | 'VIEWER';
type WeightBasis = 'LAPANGAN' | 'PABRIK';
type TransportMode = 'TRIP' | 'KG_LAPANGAN' | 'KG_PABRIK';
type Kebun = { id: string; code: string; name: string; status: 'AKTIF' | 'NONAKTIF' };
type Mill = { id: string; name: string; location: string };
type Harvester = { id: string; name: string; phone: string };
type Vehicle = { id: string; plateNumber: string; name: string; owner: string; ownershipType?: 'OWN' | 'VENDOR'; supplierId?: string; rentMode: TransportMode; defaultRate: number };
type Account = { id: string; name: string; type: 'KAS' | 'BANK' };
type Supplier = { id: string; name: string; active: boolean };
type TbsRate = { id: string; kebunId: string; effectiveDate: string; harvestRatePerKg: number; harvestWeightBasis: WeightBasis; weighingEnabled?: boolean; weighingRatePerKg?: number; langsirEnabled: boolean; langsirRatePerKg: number; langsirWeightBasis: WeightBasis };
type TbsRecord = { id: string; date: string; factoryDate: string; doNumber: string; kebunId: string; millId: string; harvesterId: string; langsirWorkerId?: string; vehicleId: string; fieldWeightKg: number; factoryWeightKg: number; factoryBrutoWeightKg?: number; factoryTareWeightKg?: number; factoryNet1WeightKg?: number; factoryGrossWeightKg?: number; factoryDeductionKg?: number; factoryDeductionPct?: number; deductionAmount?: number; factoryTicketNumber: string; pricePerKg: number; deductions: number; harvestRatePerKg: number; harvestWeightBasis: WeightBasis; weighingRatePerKg?: number; weighingCost?: number; langsirRatePerKg: number; langsirWeightBasis: WeightBasis; transportMode: TransportMode; transportRate: number; harvestCost: number; langsirCost: number; transportCost: number; grossRevenue: number; netRevenue: number; directCost: number; margin: number; weightDifferenceKg: number; weightDifferencePct: number; status: 'LAPANGAN' | 'PABRIK' | 'SELESAI'; note: string; createdAt: string };
type TbsPayment = { id: string; paymentNumber: string; date: string; millId: string; accountId: string; amount: number; reference: string; note: string; allocations: Array<{ tbsId: string; kebunId: string; doNumber: string; amount: number }>; transactionIds: string[]; createdAt: string };
type Data = { workspace: { role: Role }; kebun: Kebun[]; accounts: Account[]; mills: Mill[]; harvesters: Harvester[]; vehicles: Vehicle[]; tbsRates: TbsRate[]; tbs: TbsRecord[]; tbsPayments: TbsPayment[]; suppliers: Supplier[] };
type Props = { data: Data; reload: () => Promise<void>; flash: (text: string) => void; showError: (text: string) => void };
type FactoryForm = { tbsId: string; factoryDate: string; factoryTicketNumber: string; factoryBrutoWeightKg: string; factoryTareWeightKg: string; factoryDeductionKg: string; pricePerKg: string };
type DoGroup = { id: string; key: string; doNumber: string; millId: string; rows: TbsRecord[]; kebunIds: string[]; date: string; factoryDate: string; fieldWeightKg: number; factoryBrutoWeightKg: number; factoryTareWeightKg: number; factoryNet1WeightKg: number; factoryDeductionKg: number; factoryDeductionPct: number; factoryWeightKg: number; factoryTicketNumber: string; pricePerKg: number; deductionAmount: number; netRevenue: number; weightDifferenceKg: number; weightDifferencePct: number; createdAt: string };

const idr = new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 });
const num = new Intl.NumberFormat('id-ID', { maximumFractionDigits: 2 });

function today() {
  return new Date().toISOString().slice(0, 10);
}

function blankFactory(): FactoryForm {
  return { tbsId: '', factoryDate: today(), factoryTicketNumber: '', factoryBrutoWeightKg: '', factoryTareWeightKg: '', factoryDeductionKg: '', pricePerKg: '' };
}

function canTransact(role: Role) {
  return role !== 'VIEWER';
}

function apiError(err: unknown, fallback: string) {
  const response = (err as { response?: { data?: { error?: string; message?: string } } })?.response?.data;
  return response?.error || response?.message || fallback;
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <label className="field"><span>{label}</span>{children}</label>;
}

function buildDoGroups(rows: TbsRecord[]): DoGroup[] {
  const map = new Map<string, TbsRecord[]>();
  rows.forEach(row => {
    const key = `${row.millId}::${row.doNumber.trim().toUpperCase()}`;
    map.set(key, [...(map.get(key) || []), row]);
  });
  return Array.from(map.entries()).map(([key, items]) => {
    const sorted = [...items].sort((a, b) => `${a.date}${a.createdAt}`.localeCompare(`${b.date}${b.createdAt}`));
    const completed = sorted.find(item => (item.factoryNet1WeightKg ?? item.factoryGrossWeightKg ?? item.factoryWeightKg) > 0);
    const fieldWeightKg = sorted.reduce((sum, item) => sum + item.fieldWeightKg, 0);
    const inferredDeduction = (item: TbsRecord) => item.factoryDeductionKg ?? (item.deductions > 0 && item.pricePerKg > 0 ? item.deductions / item.pricePerKg : 0);
    const net1For = (item: TbsRecord) => item.factoryNet1WeightKg ?? item.factoryGrossWeightKg ?? (item.factoryWeightKg + inferredDeduction(item));
    const factoryNet1WeightKg = sorted.reduce((sum, item) => sum + net1For(item), 0);
    const factoryTareWeightKg = sorted.reduce((sum, item) => sum + (item.factoryTareWeightKg ?? 0), 0);
    const factoryBrutoWeightKg = sorted.reduce((sum, item) => sum + (item.factoryBrutoWeightKg ?? (net1For(item) + (item.factoryTareWeightKg ?? 0))), 0);
    const factoryWeightKg = sorted.reduce((sum, item) => sum + item.factoryWeightKg, 0);
    const factoryDeductionKg = sorted.reduce((sum, item) => sum + inferredDeduction(item), 0);
    const deductionAmount = sorted.reduce((sum, item) => sum + (item.deductionAmount ?? item.deductions), 0);
    const factoryDeductionPct = factoryNet1WeightKg > 0 ? (factoryDeductionKg / factoryNet1WeightKg) * 100 : 0;
    const difference = fieldWeightKg - factoryNet1WeightKg;
    return {
      id: sorted[0].id,
      key,
      doNumber: sorted[0].doNumber,
      millId: sorted[0].millId,
      rows: sorted,
      kebunIds: Array.from(new Set(sorted.map(item => item.kebunId))),
      date: sorted[0].date,
      factoryDate: completed?.factoryDate || '',
      fieldWeightKg,
      factoryBrutoWeightKg,
      factoryTareWeightKg,
      factoryNet1WeightKg,
      factoryDeductionKg,
      factoryDeductionPct,
      factoryWeightKg,
      factoryTicketNumber: completed?.factoryTicketNumber || '',
      pricePerKg: completed?.pricePerKg || 0,
      deductionAmount,
      netRevenue: sorted.reduce((sum, item) => sum + item.netRevenue, 0),
      weightDifferenceKg: difference,
      weightDifferencePct: fieldWeightKg > 0 && factoryNet1WeightKg > 0 ? (difference / fieldWeightKg) * 100 : 0,
      createdAt: sorted[sorted.length - 1].createdAt,
    };
  });
}

export default function TbsModule({ data, reload, flash, showError }: Props) {
  const allowedToTransact = canTransact(data.workspace.role);
  const tbsModeStorageKey = 'perkebunan.navigation.tbs.hub';
  const tbsModes = ['hub', 'field', 'factory', 'receivables'] as const;
  type TbsMode = (typeof tbsModes)[number];
  const [mode, setMode] = useState<TbsMode>(() => readStoredChoice(tbsModeStorageKey, tbsModes, 'hub'));
  const changeMode = (nextMode: TbsMode) => {
    setMode(nextMode);
    storeChoice(tbsModeStorageKey, nextMode);
  };
  const tbsModeLabel = mode === 'field' ? 'Timbangan Lapangan' : mode === 'factory' ? 'Timbangan Pabrik' : mode === 'receivables' ? 'Piutang & Pembayaran' : 'Panen & Penjualan TBS';
  const [factoryForm, setFactoryForm] = useState<FactoryForm>(blankFactory());
  const [saving, setSaving] = useState(false);
  const [month, setMonth] = useState(today().slice(0, 7));
  const [filterKebun, setFilterKebun] = useState('');
  const doGroups = useMemo(() => buildDoGroups(data.tbs), [data.tbs]);
  const factoryGroups = doGroups
    .filter(group => (!month || group.rows.some(item => item.date.startsWith(month))) && (!filterKebun || group.rows.some(item => item.kebunId === filterKebun)))
    .sort((a, b) => `${b.date}${b.createdAt}`.localeCompare(`${a.date}${a.createdAt}`));
  const pendingFactory = factoryGroups.filter(item => item.factoryWeightKg <= 0);
  const completedFactory = factoryGroups.filter(item => item.factoryWeightKg > 0);
  const selectedFactoryDo = doGroups.find(item => item.id === factoryForm.tbsId);
  const factoryPreview = useMemo(() => {
    const field = selectedFactoryDo?.fieldWeightKg || 0;
    const brutoWeight = Number(factoryForm.factoryBrutoWeightKg || 0);
    const tareWeight = Math.min(Number(factoryForm.factoryTareWeightKg || 0), brutoWeight);
    const net1Weight = Math.max(0, brutoWeight - tareWeight);
    const deductionKg = Math.min(Number(factoryForm.factoryDeductionKg || 0), net1Weight);
    const net2Weight = Math.max(0, net1Weight - deductionKg);
    const price = Number(factoryForm.pricePerKg || 0);
    const deductionAmount = Math.round(deductionKg * price);
    const netRevenue = Math.round(net2Weight * price);
    const deductionPct = net1Weight > 0 ? (deductionKg / net1Weight) * 100 : 0;
    const difference = field - net1Weight;
    const differencePct = field > 0 && net1Weight > 0 ? (difference / field) * 100 : 0;
    return { brutoWeight, tareWeight, net1Weight, deductionKg, deductionPct, net2Weight, deductionAmount, netRevenue, difference, differencePct };
  }, [factoryForm, selectedFactoryDo]);

  const chooseFactoryDo = (tbsId: string) => {
    const item = doGroups.find(row => row.id === tbsId);
    setFactoryForm(item ? {
      tbsId: item.id,
      factoryDate: item.factoryDate || today(),
      factoryTicketNumber: item.factoryTicketNumber || '',
      factoryBrutoWeightKg: item.factoryBrutoWeightKg ? String(item.factoryBrutoWeightKg) : item.factoryNet1WeightKg ? String(item.factoryNet1WeightKg) : '',
      factoryTareWeightKg: item.factoryTareWeightKg ? String(item.factoryTareWeightKg) : '',
      factoryDeductionKg: item.factoryDeductionKg ? String(Number(item.factoryDeductionKg.toFixed(3))) : '',
      pricePerKg: item.pricePerKg ? String(item.pricePerKg) : '',
    } : blankFactory());
  };

  const removeFactory = async (item: DoGroup) => {
    if (!window.confirm(`Hapus hasil Timbangan Pabrik DO ${item.doNumber}? DO akan kembali ke status Menunggu Timbang Pabrik.`)) return;
    try {
      setSaving(true);
      await api.delete(`/api/tbs/${item.id}/factory`);
      if (factoryForm.tbsId === item.id) setFactoryForm(blankFactory());
      await reload();
      flash(`Riwayat Timbangan Pabrik DO ${item.doNumber} dihapus. DO kembali menunggu pabrik.`);
    } catch (err) {
      showError(apiError(err, 'Riwayat Timbangan Pabrik gagal dihapus.'));
    } finally {
      setSaving(false);
    }
  };

  const submitFactory = async (event: React.FormEvent) => {
    event.preventDefault();
    const brutoWeight = Number(factoryForm.factoryBrutoWeightKg || 0);
    const tareWeight = Number(factoryForm.factoryTareWeightKg || 0);
    const net1Weight = brutoWeight - tareWeight;
    const deductionKg = Number(factoryForm.factoryDeductionKg || 0);
    if (!factoryForm.tbsId || !factoryForm.factoryDate || brutoWeight <= 0 || Number(factoryForm.pricePerKg) <= 0) {
      showError('Pilih DO lalu isi tanggal timbang pabrik, berat bruto, dan harga TBS/kg.');
      return;
    }
    if (tareWeight >= brutoWeight) {
      showError('Tara harus lebih kecil dari berat bruto.');
      return;
    }
    if (deductionKg >= net1Weight) {
      showError('Potongan pabrik (kg) harus lebih kecil dari Netto 1.');
      return;
    }
    try {
      setSaving(true);
      await api.put(`/api/tbs/${factoryForm.tbsId}/factory`, {
        factoryDate: factoryForm.factoryDate,
        factoryTicketNumber: factoryForm.factoryTicketNumber,
        factoryBrutoWeightKg: brutoWeight,
        factoryTareWeightKg: tareWeight,
        factoryDeductionKg: deductionKg,
        pricePerKg: Number(factoryForm.pricePerKg || 0),
      });
      setFactoryForm(blankFactory());
      await reload();
      flash('Timbangan pabrik, Tara, Netto 1, potongan, dan Netto 2 berhasil disimpan.');
    } catch (err) {
      showError(apiError(err, 'Timbangan pabrik gagal disimpan.'));
    } finally {
      setSaving(false);
    }
  };

  return <div className="stack">
    {mode === 'hub' ? <>
      <section className="panel tbs-header"><div><span className="eyebrow dark">Operasional Panen</span><h2>Panen & Penjualan TBS</h2><p>Pilih tahapan proses TBS yang ingin dibuka, dari timbang lapangan sampai penerimaan pembayaran PKS.</p></div></section>
      <div className="master-hub"><section className="master-hub-group"><div className="master-hub-group-head"><div><strong>Alur TBS</strong><span>Satu DO mengalir dari lapangan, pabrik, piutang hingga pembayaran.</span></div></div><div className="master-hub-grid">
        <button type="button" className="master-hub-card" onClick={() => changeMode('field')}><span className="master-hub-card-icon"><Scale size={24} /></span><span className="master-hub-card-copy"><strong>Timbangan Lapangan</strong><small>Catat DO dan rincian timbang dari satu atau beberapa kebun.</small></span><ChevronRight size={18} /></button>
        <button type="button" className="master-hub-card" onClick={() => changeMode('factory')}><span className="master-hub-card-icon"><Factory size={24} /></span><span className="master-hub-card-copy"><strong>Timbangan Pabrik</strong><small>Tarik DO, catat bruto, tara, potongan, Netto dan harga TBS.</small></span><ChevronRight size={18} /></button>
        <button type="button" className="master-hub-card" onClick={() => changeMode('receivables')}><span className="master-hub-card-icon"><Wallet size={24} /></span><span className="master-hub-card-copy"><strong>Piutang & Pembayaran</strong><small>Pantau piutang PKS dan terima pembayaran ke Kas/Bank.</small></span><ChevronRight size={18} /></button>
      </div></section></div>
    </> : <section className="master-detail-nav"><div><span>Panen & Penjualan TBS</span><ChevronRight size={14} /><strong>{tbsModeLabel}</strong></div><button type="button" className="secondary small-btn" onClick={() => changeMode('hub')}>← Kembali ke Panen & TBS</button></section>}

    {mode !== 'hub' && (mode === 'receivables' ? <TbsReceivables data={data} reload={reload} flash={flash} showError={showError} /> : mode === 'factory' ? <div className={`tbs-layout ${allowedToTransact ? '' : 'readonly'}`}>
      <section className="panel tbs-form-panel">
        <div className="panel-head"><div><h3>{selectedFactoryDo?.factoryWeightKg > 0 ? 'Edit Timbangan Pabrik' : 'Proses Timbangan Pabrik'}</h3><p>{selectedFactoryDo?.factoryWeightKg > 0 ? 'Koreksi DO CLOSED yang dipilih dari Riwayat Timbang Pabrik.' : 'Tarik hanya DO lapangan yang belum diproses PKS.'}</p></div>{selectedFactoryDo?.factoryWeightKg > 0 && <button className="text-btn" type="button" onClick={() => setFactoryForm(blankFactory())}>Batal edit</button>}</div>
        {!allowedToTransact ? <div className="notice">Role Viewer hanya dapat melihat data TBS.</div> : <form className="form" onSubmit={submitFactory}>
          <Field label="Tarik No. DO"><select value={factoryForm.tbsId} disabled={Boolean(selectedFactoryDo?.factoryWeightKg > 0)} onChange={e => chooseFactoryDo(e.target.value)}><option value="">Pilih DO</option>{selectedFactoryDo?.factoryWeightKg > 0 && <option value={selectedFactoryDo.id}>EDIT · {selectedFactoryDo.doNumber} · CLOSED</option>}{pendingFactory.map(item => <option key={item.key} value={item.id}>{item.doNumber} · {item.kebunIds.length} kebun · {num.format(item.fieldWeightKg)} kg</option>)}</select></Field>
          {selectedFactoryDo && <div className="notice"><strong>{selectedFactoryDo.doNumber}</strong> · {data.mills.find(row => row.id === selectedFactoryDo.millId)?.name || '-'}<br />Total timbangan lapangan: <b>{num.format(selectedFactoryDo.fieldWeightKg)} kg</b><div className="do-breakdown">{selectedFactoryDo.rows.map(item => <span key={item.id}>{data.kebun.find(row => row.id === item.kebunId)?.name || '-'} · {num.format(item.fieldWeightKg)} kg</span>)}</div></div>}
          <div className="row-2"><Field label="Tanggal Timbang Pabrik"><input type="date" value={factoryForm.factoryDate} onChange={e => setFactoryForm(v => ({ ...v, factoryDate: e.target.value }))} /></Field><Field label="No. Tiket Timbang"><input placeholder="Nomor tiket pabrik" value={factoryForm.factoryTicketNumber} onChange={e => setFactoryForm(v => ({ ...v, factoryTicketNumber: e.target.value }))} /></Field></div>
          <div className="row-2"><Field label="Berat Bruto (kg)"><input inputMode="decimal" placeholder="TBS + berat mobil" value={factoryForm.factoryBrutoWeightKg} onChange={e => setFactoryForm(v => ({ ...v, factoryBrutoWeightKg: e.target.value.replace(/[^0-9.]/g, '') }))} /></Field><Field label="Tara / Berat Mobil (kg)"><input inputMode="decimal" placeholder="0" value={factoryForm.factoryTareWeightKg} onChange={e => setFactoryForm(v => ({ ...v, factoryTareWeightKg: e.target.value.replace(/[^0-9.]/g, '') }))} /></Field></div>
          <div className="row-2"><Field label="Potongan Pabrik (kg)"><input inputMode="decimal" placeholder="0" value={factoryForm.factoryDeductionKg} onChange={e => setFactoryForm(v => ({ ...v, factoryDeductionKg: e.target.value.replace(/[^0-9.]/g, '') }))} /></Field><Field label="Harga TBS / kg"><input inputMode="numeric" placeholder="0" value={formatMoneyInput(factoryForm.pricePerKg)} onChange={e => setFactoryForm(v => ({ ...v, pricePerKg: e.target.value.replace(/[^0-9]/g, '') }))} /></Field></div>
          <div className="calc-preview"><div><span>Bruto</span><strong>{num.format(factoryPreview.brutoWeight)} kg</strong><small>TBS + mobil</small></div><div><span>Tara</span><strong>{num.format(factoryPreview.tareWeight)} kg</strong><small>Berat mobil</small></div><div><span>Netto 1</span><strong>{num.format(factoryPreview.net1Weight)} kg</strong><small>Bruto − Tara</small></div><div><span>Selisih Lapangan vs Netto 1</span><strong>{num.format(factoryPreview.difference)} kg</strong><small>{num.format(factoryPreview.differencePct)}%</small></div><div><span>Potongan Pabrik</span><strong>{num.format(factoryPreview.deductionKg)} kg</strong><small>{num.format(factoryPreview.deductionPct)}% dari Netto 1</small></div><div><span>Netto 2</span><strong>{num.format(factoryPreview.net2Weight)} kg</strong><small>Netto 1 − potongan</small></div><div><span>Nilai Potongan</span><strong>{idr.format(factoryPreview.deductionAmount)}</strong><small>kg × harga</small></div><div><span>Pendapatan Bersih</span><strong>{idr.format(factoryPreview.netRevenue)}</strong><small>Netto 2 × harga</small></div></div>
          <button className="primary wide" disabled={saving || !selectedFactoryDo}><Save size={18} /> {saving ? 'Menyimpan...' : selectedFactoryDo?.factoryWeightKg > 0 ? 'Simpan Koreksi Timbangan Pabrik' : 'Simpan Timbangan Pabrik'}</button>
        </form>}
      </section>
      <section className="panel list-panel">
        <div className="panel-head wrap"><div><h3>DO Menunggu Timbang Pabrik</h3><p>{pendingFactory.length} DO belum diproses.</p></div><div className="filters"><input type="month" value={month} onChange={e => setMonth(e.target.value)} /><select value={filterKebun} onChange={e => setFilterKebun(e.target.value)}><option value="">Semua kebun</option>{data.kebun.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}</select></div></div>
        {pendingFactory.length === 0 ? <div className="empty"><span>Semua DO pada filter ini sudah diproses pabrik.</span></div> : <div className="table-wrap"><table className="tbs-table"><thead><tr><th>DO</th><th>Kebun</th><th>Pabrik</th><th>Catatan Lapangan</th><th className="right">Total Lapangan</th><th></th></tr></thead><tbody>{pendingFactory.map(item => <tr key={item.key}><td><strong>{item.doNumber}</strong><small className="table-note">{item.date}</small></td><td>{item.kebunIds.map(id => data.kebun.find(row => row.id === id)?.name || '-').join(', ')}</td><td>{data.mills.find(row => row.id === item.millId)?.name || '-'}</td><td>{item.rows.length} timbang</td><td className="right">{num.format(item.fieldWeightKg)} kg</td><td className="right">{allowedToTransact && <button className="secondary small-btn" type="button" onClick={() => chooseFactoryDo(item.id)}>Proses DO</button>}</td></tr>)}</tbody></table></div>}
        <div className="form-section-title">Riwayat Timbang Pabrik</div>
        {completedFactory.length === 0 ? <div className="empty"><span>Belum ada hasil timbang pabrik.</span></div> : <div className="table-wrap"><table className="tbs-table"><thead><tr><th>DO</th><th>Kebun</th><th className="right">Lapangan</th><th className="right">Bruto</th><th className="right">Tara</th><th className="right">Netto 1</th><th className="right">Potongan</th><th className="right">Netto 2</th><th className="right">Selisih</th><th className="right">Pendapatan</th><th></th></tr></thead><tbody>{completedFactory.map(item => <tr key={item.key}><td><strong>{item.doNumber}</strong><small className="table-note">{item.factoryDate}</small></td><td>{item.kebunIds.map(id => data.kebun.find(row => row.id === id)?.name || '-').join(', ')}</td><td className="right">{num.format(item.fieldWeightKg)} kg</td><td className="right">{num.format(item.factoryBrutoWeightKg)} kg</td><td className="right">{num.format(item.factoryTareWeightKg)} kg</td><td className="right">{num.format(item.factoryNet1WeightKg)} kg</td><td className="right">{num.format(item.factoryDeductionKg)} kg<small className="table-note">{num.format(item.factoryDeductionPct)}% · {idr.format(item.deductionAmount)}</small></td><td className="right">{num.format(item.factoryWeightKg)} kg</td><td className="right">{num.format(item.weightDifferenceKg)} kg<small className="table-note">{num.format(item.weightDifferencePct)}%</small></td><td className="right money in">{idr.format(item.netRevenue)}</td><td className="right">{allowedToTransact && <div className="action-group"><button className="icon-btn" type="button" onClick={() => chooseFactoryDo(item.id)} title="Koreksi timbang pabrik"><Pencil size={15} /></button><button className="icon-btn danger" type="button" disabled={saving} onClick={() => removeFactory(item)} title="Hapus riwayat timbang pabrik"><Trash2 size={15} /></button></div>}</td></tr>)}</tbody></table></div>}
      </section>
    </div> : <TbsFieldEntry data={data} reload={reload} flash={flash} showError={showError} />)}
  </div>;
}
