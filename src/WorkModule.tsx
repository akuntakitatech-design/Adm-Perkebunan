import { useMemo, useState } from 'react';
import { api } from './lib/client';
import { Pencil, Plus, Save, Trash2 } from 'lucide-react';
import { formatMoneyInput } from './moneyInput';

type Role = 'OWNER' | 'ADMIN_PUSAT' | 'FINANCE' | 'ADMIN_KEBUN' | 'VIEWER';
type Kebun = { id: string; code: string; name: string };
type Worker = { id: string; name: string; phone: string };
type WorkType = { id: string; name: string; unit: string; active: boolean; createdAt: string };
type WorkRate = { id: string; workTypeId: string; kebunId: string; effectiveDate: string; rate: number; createdAt: string };
type WorkEntry = { id: string; date: string; kebunId: string; workerId: string; workTypeId: string; workName: string; unit: string; quantity: number; rate: number; amount: number; note: string; createdAt: string };
type PayrollRun = { id: string; lines: Array<{ sourceType: string; sourceId: string }> };
type Data = { workspace: { role: Role }; kebun: Kebun[]; harvesters: Worker[]; workTypes: WorkType[]; workRates: WorkRate[]; workEntries: WorkEntry[]; payrollRuns: PayrollRun[] };
type Props = { data: Data; reload: () => Promise<void>; flash: (text: string) => void; showError: (text: string) => void; mastersOnly?: boolean; masterSection?: 'all' | 'types' | 'rates' };

type EntryForm = { id: string; date: string; kebunId: string; workerId: string; workTypeId: string; quantity: string; note: string };
type TypeForm = { id: string; name: string; unit: string; active: boolean };
type RateForm = { id: string; workTypeId: string; kebunId: string; effectiveDate: string; rate: string };

const idr = new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 });
const num = new Intl.NumberFormat('id-ID', { maximumFractionDigits: 2 });
function today() { return new Date().toISOString().slice(0, 10); }
function blankEntry(): EntryForm { return { id: '', date: today(), kebunId: '', workerId: '', workTypeId: '', quantity: '', note: '' }; }
function blankType(): TypeForm { return { id: '', name: '', unit: 'pohon', active: true }; }
function blankRate(): RateForm { return { id: '', workTypeId: '', kebunId: '', effectiveDate: today(), rate: '' }; }
function canInput(role: Role) { return role !== 'VIEWER'; }
function canMaster(role: Role) { return role === 'OWNER' || role === 'ADMIN_PUSAT'; }
function apiError(err: unknown, fallback: string) { const response = (err as { response?: { data?: { error?: string; message?: string } } })?.response?.data; return response?.error || response?.message || fallback; }

function latestRate(data: Data, workTypeId: string, kebunId: string, date: string) {
  return data.workRates
    .filter(item => item.workTypeId === workTypeId && item.kebunId === kebunId && item.effectiveDate <= date)
    .sort((a, b) => b.effectiveDate.localeCompare(a.effectiveDate))[0];
}

export default function WorkModule({ data, reload, flash, showError, mastersOnly = false, masterSection = 'all' }: Props) {
  const masterAllowed = canMaster(data.workspace.role);
  const inputAllowed = canInput(data.workspace.role);
  const mode: 'entries' | 'master' = mastersOnly ? 'master' : 'entries';
  const [entryForm, setEntryForm] = useState<EntryForm>(blankEntry());
  const [typeForm, setTypeForm] = useState<TypeForm>(blankType());
  const [rateForm, setRateForm] = useState<RateForm>(blankRate());
  const [saving, setSaving] = useState(false);
  const [month, setMonth] = useState(today().slice(0, 7));
  const [filterKebun, setFilterKebun] = useState('');

  const selectedType = data.workTypes.find(item => item.id === entryForm.workTypeId);
  const selectedRate = latestRate(data, entryForm.workTypeId, entryForm.kebunId, entryForm.date);
  const previewAmount = Math.round(Number(entryForm.quantity || 0) * Number(selectedRate?.rate || 0));
  const usedEntryIds = useMemo(() => new Set(data.payrollRuns.flatMap(run => run.lines.filter(line => line.sourceType === 'KEBUN_WORK').map(line => line.sourceId))), [data.payrollRuns]);
  const filteredEntries = [...data.workEntries]
    .filter(item => (!month || item.date.startsWith(month)) && (!filterKebun || item.kebunId === filterKebun))
    .sort((a, b) => `${b.date}${b.createdAt}`.localeCompare(`${a.date}${a.createdAt}`));
  const totalFiltered = filteredEntries.reduce((sum, item) => sum + item.amount, 0);

  const saveEntry = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!entryForm.date || !entryForm.kebunId || !entryForm.workerId || !entryForm.workTypeId || Number(entryForm.quantity) <= 0) return showError('Lengkapi tanggal, kebun, pekerja, pekerjaan, dan volume.');
    if (!selectedRate) return showError('Tarif pekerjaan untuk kebun dan tanggal ini belum dibuat di Master Data → Pekerjaan.');
    try {
      setSaving(true);
      const payload = { date: entryForm.date, kebunId: entryForm.kebunId, workerId: entryForm.workerId, workTypeId: entryForm.workTypeId, quantity: Number(entryForm.quantity), note: entryForm.note };
      if (entryForm.id) await api.put(`/api/work-entries/${entryForm.id}`, payload); else await api.post('/api/work-entries', payload);
      const edited = Boolean(entryForm.id);
      setEntryForm(blankEntry());
      await reload();
      flash(edited ? 'Pekerjaan kebun diperbarui.' : 'Pekerjaan kebun dicatat dan siap masuk Payroll.');
    } catch (err) { showError(apiError(err, 'Pekerjaan kebun gagal disimpan.')); }
    finally { setSaving(false); }
  };
  const editEntry = (item: WorkEntry) => {
    setEntryForm({ id: item.id, date: item.date, kebunId: item.kebunId, workerId: item.workerId, workTypeId: item.workTypeId, quantity: String(item.quantity), note: item.note || '' });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };
  const deleteEntry = async (item: WorkEntry) => {
    if (!window.confirm(`Hapus pekerjaan ${item.workName} tanggal ${item.date}?`)) return;
    try { await api.delete(`/api/work-entries/${item.id}`); await reload(); flash('Pekerjaan kebun dihapus.'); }
    catch (err) { showError(apiError(err, 'Pekerjaan kebun gagal dihapus.')); }
  };

  const saveType = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!typeForm.name.trim() || !typeForm.unit.trim()) return showError('Nama pekerjaan dan satuan wajib diisi.');
    try {
      setSaving(true);
      if (typeForm.id) await api.put(`/api/work-types/${typeForm.id}`, typeForm); else await api.post('/api/work-types', typeForm);
      const edited = Boolean(typeForm.id);
      setTypeForm(blankType());
      await reload();
      flash(edited ? 'Master pekerjaan diperbarui.' : 'Master pekerjaan ditambahkan.');
    } catch (err) { showError(apiError(err, 'Master pekerjaan gagal disimpan.')); }
    finally { setSaving(false); }
  };
  const deleteType = async (item: WorkType) => {
    if (!window.confirm(`Hapus master pekerjaan ${item.name}?`)) return;
    try { await api.delete(`/api/work-types/${item.id}`); await reload(); flash('Master pekerjaan dihapus.'); }
    catch (err) { showError(apiError(err, 'Master pekerjaan masih digunakan atau gagal dihapus.')); }
  };

  const saveRate = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!rateForm.workTypeId || !rateForm.kebunId || !rateForm.effectiveDate || Number(rateForm.rate) <= 0) return showError('Lengkapi pekerjaan, kebun, tanggal berlaku, dan tarif.');
    try {
      setSaving(true);
      const payload = { ...rateForm, rate: Number(rateForm.rate) };
      if (rateForm.id) await api.put(`/api/work-rates/${rateForm.id}`, payload); else await api.post('/api/work-rates', payload);
      const edited = Boolean(rateForm.id);
      setRateForm(blankRate());
      await reload();
      flash(edited ? 'Tarif pekerjaan per kebun diperbarui.' : 'Tarif pekerjaan per kebun ditambahkan.');
    } catch (err) { showError(apiError(err, 'Tarif pekerjaan gagal disimpan.')); }
    finally { setSaving(false); }
  };
  const deleteRate = async (item: WorkRate) => {
    if (!window.confirm('Hapus tarif pekerjaan ini? Transaksi lama tidak berubah.')) return;
    try { await api.delete(`/api/work-rates/${item.id}`); await reload(); flash('Tarif pekerjaan dihapus.'); }
    catch (err) { showError(apiError(err, 'Tarif pekerjaan gagal dihapus.')); }
  };

  const masterTitle = masterSection === 'types' ? 'Master Pekerjaan' : masterSection === 'rates' ? 'Tarif Pekerjaan' : 'Master Pekerjaan & Tarif';
  const masterDescription = masterSection === 'types' ? 'Kelola jenis pekerjaan dan satuan yang digunakan di kebun.' : masterSection === 'rates' ? 'Kelola tarif pekerjaan per kebun dan tanggal berlaku.' : 'Kelola jenis pekerjaan, satuan, serta tarif per kebun dan tanggal berlaku.';

  return <div className="stack">
    <section className="panel tbs-header">
      <div><span className="eyebrow dark">{mastersOnly ? 'Master Data' : 'Operasional Kebun'}</span><h2>{mastersOnly ? masterTitle : 'Pekerjaan Kebun'}</h2><p>{mastersOnly ? masterDescription : 'Catat pekerjaan langsung seperti mupuk, nunas, nyemprot, dan pekerjaan lain. Tarif ditarik dari Master Data → Pekerjaan lalu otomatis menjadi komponen Payroll.'}</p></div>
    </section>

    {mode === 'entries' && <div className="grid-form-list">
      <section className="panel form-panel">
        <div className="panel-head"><div><h3>{entryForm.id ? 'Edit Pekerjaan Kebun' : 'Input Pekerjaan Kebun'}</h3><p>Pilih kebun terlebih dahulu. Tarif ditarik otomatis sesuai master dan tanggal transaksi.</p></div>{entryForm.id && <button className="text-btn" type="button" onClick={() => setEntryForm(blankEntry())}>Batal edit</button>}</div>
        {!inputAllowed ? <div className="notice">Role Viewer hanya dapat melihat riwayat pekerjaan.</div> : <form className="form" onSubmit={saveEntry}>
          <div className="row-2"><label className="field"><span>Tanggal</span><input type="date" value={entryForm.date} onChange={e => setEntryForm(v => ({ ...v, date: e.target.value }))} /></label><label className="field"><span>Kebun</span><select value={entryForm.kebunId} onChange={e => setEntryForm(v => ({ ...v, kebunId: e.target.value }))}><option value="">Pilih kebun</option>{data.kebun.map(item => <option key={item.id} value={item.id}>{item.code} - {item.name}</option>)}</select></label></div>
          <div className="row-2"><label className="field"><span>Pekerja</span><select value={entryForm.workerId} onChange={e => setEntryForm(v => ({ ...v, workerId: e.target.value }))}><option value="">Pilih pekerja</option>{data.harvesters.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label><label className="field"><span>Jenis Pekerjaan</span><select value={entryForm.workTypeId} onChange={e => setEntryForm(v => ({ ...v, workTypeId: e.target.value }))}><option value="">Pilih pekerjaan</option>{data.workTypes.filter(item => item.active || item.id === entryForm.workTypeId).map(item => <option key={item.id} value={item.id}>{item.name} · /{item.unit}</option>)}</select></label></div>
          <div className="row-2"><label className="field"><span>Volume {selectedType ? `(${selectedType.unit})` : ''}</span><input inputMode="decimal" value={entryForm.quantity} onChange={e => setEntryForm(v => ({ ...v, quantity: e.target.value.replace(/[^0-9.]/g, '') }))} placeholder="0" /></label><label className="field"><span>Tarif Berlaku</span><input readOnly value={selectedRate ? idr.format(selectedRate.rate) + ` / ${selectedType?.unit || 'unit'}` : ''} placeholder="Pilih kebun & pekerjaan" /></label></div>
          {entryForm.kebunId && entryForm.workTypeId && !selectedRate && <div className="notice">Belum ada tarif yang berlaku. Buat tarif pekerjaan untuk kebun ini terlebih dahulu.</div>}
          <label className="field"><span>Catatan</span><textarea rows={2} value={entryForm.note} onChange={e => setEntryForm(v => ({ ...v, note: e.target.value }))} placeholder="Blok, kondisi pekerjaan, atau catatan lain" /></label>
          <div className="calc-preview"><div><span>Volume</span><strong>{num.format(Number(entryForm.quantity || 0))} {selectedType?.unit || ''}</strong></div><div><span>Tarif</span><strong>{selectedRate ? idr.format(selectedRate.rate) : '-'}</strong></div><div><span>Upah Pekerjaan</span><strong>{idr.format(previewAmount)}</strong></div></div>
          <div className="form-actions"><button className="primary" disabled={saving || !selectedRate}><Save size={16} /> {entryForm.id ? 'Simpan Perubahan' : 'Simpan Pekerjaan'}</button></div>
        </form>}
      </section>
      <section className="panel">
        <div className="panel-head wrap"><div><h3>Riwayat Pekerjaan Kebun</h3><p>{filteredEntries.length} transaksi · {idr.format(totalFiltered)}</p></div><div className="filters"><input type="month" value={month} onChange={e => setMonth(e.target.value)} /><select value={filterKebun} onChange={e => setFilterKebun(e.target.value)}><option value="">Semua kebun</option>{data.kebun.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}</select></div></div>
        {filteredEntries.length === 0 ? <div className="empty"><span>Belum ada pekerjaan kebun pada filter ini.</span></div> : <div className="table-wrap"><table className="payroll-table"><thead><tr><th>Tanggal</th><th>Kebun</th><th>Pekerja</th><th>Pekerjaan</th><th className="right">Volume</th><th className="right">Tarif</th><th className="right">Nominal</th><th>Status</th><th></th></tr></thead><tbody>{filteredEntries.map(item => { const locked = usedEntryIds.has(item.id); return <tr key={item.id}><td>{item.date}</td><td>{data.kebun.find(row => row.id === item.kebunId)?.name || '-'}</td><td>{data.harvesters.find(row => row.id === item.workerId)?.name || '-'}</td><td><strong>{item.workName}</strong><small className="table-note">{item.note || item.unit}</small></td><td className="right">{num.format(item.quantity)} {item.unit}</td><td className="right">{idr.format(item.rate)}</td><td className="right money">{idr.format(item.amount)}</td><td><span className={`pill ${locked ? 'transfer' : 'in'}`}>{locked ? 'TERPROSES PAYROLL' : 'TERBUKA'}</span></td><td className="right">{inputAllowed && !locked && <div className="action-group"><button className="icon-btn" type="button" onClick={() => editEntry(item)}><Pencil size={15} /></button><button className="icon-btn danger" type="button" onClick={() => deleteEntry(item)}><Trash2 size={15} /></button></div>}</td></tr>; })}</tbody></table></div>}
      </section>
    </div>}

    {mode === 'master' && masterAllowed && <div className="stack">
      {(masterSection === 'all' || masterSection === 'types') && <section className="panel">
        <div className="panel-head"><div><h3>Master Pekerjaan</h3><p>Nama dan satuan fleksibel. Contoh: Mupuk / pohon, Nunas / pohon, Nyemprot / hektar.</p></div></div>
        <form className="mini-form" onSubmit={saveType}><div className="row-2"><label className="field"><span>Nama Pekerjaan</span><input value={typeForm.name} onChange={e => setTypeForm(v => ({ ...v, name: e.target.value }))} placeholder="Mupuk / Nunas / Nyemprot" /></label><label className="field"><span>Satuan</span><input list="work-units" value={typeForm.unit} onChange={e => setTypeForm(v => ({ ...v, unit: e.target.value }))} placeholder="pohon, hektar, hari..." /><datalist id="work-units"><option value="pohon" /><option value="hektar" /><option value="hari" /><option value="unit" /><option value="kg" /><option value="borongan" /></datalist></label></div><label className="check-row"><input type="checkbox" checked={typeForm.active} onChange={e => setTypeForm(v => ({ ...v, active: e.target.checked }))} /><span>Pekerjaan aktif dan dapat dipilih saat input</span></label><div className="form-actions">{typeForm.id && <button type="button" className="secondary" onClick={() => setTypeForm(blankType())}>Batal</button>}<button className="primary" disabled={saving}><Save size={16} /> {typeForm.id ? 'Simpan Perubahan' : 'Tambah Pekerjaan'}</button></div></form>
        <div className="master-list">{data.workTypes.length === 0 ? <div className="empty"><Plus size={18} /><span>Tambahkan pekerjaan seperti Mupuk, Nunas, dan Nyemprot.</span></div> : data.workTypes.map(item => <div className="master-row" key={item.id}><div><strong>{item.name}</strong><span>Satuan: {item.unit} · {item.active ? 'Aktif' : 'Nonaktif'}</span></div><button className="icon-btn" type="button" onClick={() => setTypeForm({ id: item.id, name: item.name, unit: item.unit, active: item.active })}><Pencil size={15} /></button><button className="icon-btn danger" type="button" onClick={() => deleteType(item)}><Trash2 size={15} /></button></div>)}</div>
      </section>}

      {(masterSection === 'all' || masterSection === 'rates') && <section className="panel">
        <div className="panel-head"><div><h3>Tarif Pekerjaan per Kebun</h3><p>Satu pekerjaan dapat mempunyai tarif berbeda di setiap kebun dan periode.</p></div></div>
        <form className="mini-form" onSubmit={saveRate}><div className="row-2"><label className="field"><span>Pekerjaan</span><select value={rateForm.workTypeId} onChange={e => setRateForm(v => ({ ...v, workTypeId: e.target.value }))}><option value="">Pilih pekerjaan</option>{data.workTypes.map(item => <option key={item.id} value={item.id}>{item.name} / {item.unit}</option>)}</select></label><label className="field"><span>Kebun</span><select value={rateForm.kebunId} onChange={e => setRateForm(v => ({ ...v, kebunId: e.target.value }))}><option value="">Pilih kebun</option>{data.kebun.map(item => <option key={item.id} value={item.id}>{item.code} - {item.name}</option>)}</select></label></div><div className="row-2"><label className="field"><span>Berlaku Mulai</span><input type="date" value={rateForm.effectiveDate} onChange={e => setRateForm(v => ({ ...v, effectiveDate: e.target.value }))} /></label><label className="field"><span>Tarif</span><input inputMode="numeric" value={formatMoneyInput(rateForm.rate)} onChange={e => setRateForm(v => ({ ...v, rate: e.target.value.replace(/[^0-9]/g, '') }))} placeholder="0" /></label></div><div className="form-actions">{rateForm.id && <button type="button" className="secondary" onClick={() => setRateForm(blankRate())}>Batal</button>}<button className="primary" disabled={saving}><Save size={16} /> {rateForm.id ? 'Simpan Perubahan' : 'Tambah Tarif'}</button></div></form>
        <div className="table-wrap"><table className="payroll-table"><thead><tr><th>Pekerjaan</th><th>Kebun</th><th>Berlaku Mulai</th><th className="right">Tarif</th><th></th></tr></thead><tbody>{[...data.workRates].sort((a, b) => b.effectiveDate.localeCompare(a.effectiveDate)).map(item => { const type = data.workTypes.find(row => row.id === item.workTypeId); return <tr key={item.id}><td>{type?.name || '-'}</td><td>{data.kebun.find(row => row.id === item.kebunId)?.name || '-'}</td><td>{item.effectiveDate}</td><td className="right money">{idr.format(item.rate)} / {type?.unit || 'unit'}</td><td className="right"><div className="action-group"><button className="icon-btn" type="button" onClick={() => setRateForm({ id: item.id, workTypeId: item.workTypeId, kebunId: item.kebunId, effectiveDate: item.effectiveDate, rate: String(item.rate) })}><Pencil size={15} /></button><button className="icon-btn danger" type="button" onClick={() => deleteRate(item)}><Trash2 size={15} /></button></div></td></tr>; })}</tbody></table></div>
      </section>}
    </div>}
  </div>;
}
