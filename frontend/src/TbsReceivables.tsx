import { useMemo, useState } from 'react';
import { api } from './lib/client';
import { Pencil, Save, Trash2, WandSparkles } from 'lucide-react';
import { formatMoneyInput } from './moneyInput';

type Role = 'OWNER' | 'ADMIN_PUSAT' | 'FINANCE' | 'ADMIN_KEBUN' | 'VIEWER';
type Kebun = { id: string; code: string; name: string };
type Account = { id: string; name: string; type: 'KAS' | 'BANK' };
type Mill = { id: string; name: string; location: string };
type TbsRecord = { id: string; date: string; factoryDate: string; doNumber: string; kebunId: string; millId: string; netRevenue: number; status: 'LAPANGAN' | 'PABRIK' | 'SELESAI' };
type Allocation = { tbsId: string; kebunId: string; doNumber: string; amount: number };
type TbsPayment = { id: string; paymentNumber: string; date: string; millId: string; accountId: string; amount: number; reference: string; note: string; allocations: Allocation[]; transactionIds: string[]; createdAt: string };
type Data = { workspace: { role: Role }; kebun: Kebun[]; accounts: Account[]; mills: Mill[]; tbs: TbsRecord[]; tbsPayments: TbsPayment[] };
type Props = { data: Data; reload: () => Promise<void>; flash: (text: string) => void; showError: (text: string) => void };
type ReceivableGroup = { key: string; doNumber: string; millId: string; date: string; kebunIds: string[]; sale: number; paid: number; outstanding: number };

const idr = new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 });

function today() {
  return new Date().toISOString().slice(0, 10);
}
function canManage(role: Role) {
  return role === 'OWNER' || role === 'ADMIN_PUSAT' || role === 'FINANCE';
}
function apiError(err: unknown, fallback: string) {
  const response = (err as { response?: { data?: { error?: string; message?: string } } })?.response?.data;
  return response?.error || response?.message || fallback;
}
function formatDate(value: string) {
  if (!value) return '-';
  return new Intl.DateTimeFormat('id-ID', { day: '2-digit', month: 'short', year: 'numeric' }).format(new Date(`${value}T00:00:00`));
}
function groupKey(millId: string, doNumber: string) {
  return `${millId}::${doNumber.trim().toUpperCase()}`;
}

export default function TbsReceivables({ data, reload, flash, showError }: Props) {
  const allowed = canManage(data.workspace.role);
  const [saving, setSaving] = useState(false);
  const [filterMill, setFilterMill] = useState('');
  const [filterStatus, setFilterStatus] = useState<'ALL' | 'OPEN' | 'PAID'>('OPEN');
  const [form, setForm] = useState({ date: today(), millId: '', accountId: '', amount: '', reference: '', note: '' });
  const [allocations, setAllocations] = useState<Record<string, string>>({});
  const [editingId, setEditingId] = useState('');

  const paidByTbs = useMemo(() => {
    const result = new Map<string, number>();
    for (const payment of data.tbsPayments) {
      for (const allocation of payment.allocations || []) {
        result.set(allocation.tbsId, (result.get(allocation.tbsId) || 0) + allocation.amount);
      }
    }
    return result;
  }, [data.tbsPayments]);

  const receivables = useMemo(() => {
    const map = new Map<string, ReceivableGroup>();
    for (const item of data.tbs.filter(row => row.netRevenue > 0)) {
      const key = groupKey(item.millId, item.doNumber);
      const current = map.get(key) || {
        key,
        doNumber: item.doNumber,
        millId: item.millId,
        date: item.factoryDate || item.date,
        kebunIds: [],
        sale: 0,
        paid: 0,
        outstanding: 0,
      };
      current.sale += item.netRevenue;
      current.paid += paidByTbs.get(item.id) || 0;
      if (!current.kebunIds.includes(item.kebunId)) current.kebunIds.push(item.kebunId);
      if ((item.factoryDate || item.date) < current.date) current.date = item.factoryDate || item.date;
      map.set(key, current);
    }
    return Array.from(map.values())
      .map(item => ({ ...item, outstanding: Math.max(0, item.sale - item.paid) }))
      .sort((a, b) => `${a.date}${a.doNumber}`.localeCompare(`${b.date}${b.doNumber}`));
  }, [data.tbs, paidByTbs]);

  const filtered = receivables.filter(item =>
    (!filterMill || item.millId === filterMill) &&
    (filterStatus === 'ALL' || (filterStatus === 'OPEN' ? item.outstanding > 0 : item.outstanding === 0))
  );
  const editingPayment = data.tbsPayments.find(item => item.id === editingId);
  const editingAllocatedByGroup = useMemo(() => {
    const result = new Map<string, number>();
    if (!editingPayment) return result;
    for (const allocation of editingPayment.allocations || []) {
      const key = groupKey(editingPayment.millId, allocation.doNumber);
      result.set(key, (result.get(key) || 0) + allocation.amount);
    }
    return result;
  }, [editingPayment]);
  const available = receivables
    .filter(item => item.millId === form.millId)
    .map(item => ({ ...item, outstanding: item.outstanding + (editingPayment?.millId === item.millId ? (editingAllocatedByGroup.get(item.key) || 0) : 0) }))
    .filter(item => item.outstanding > 0);
  const totalRecognized = receivables.reduce((sum, item) => sum + item.sale, 0);
  const totalPaid = receivables.reduce((sum, item) => sum + item.paid, 0);
  const totalOutstanding = receivables.reduce((sum, item) => sum + item.outstanding, 0);
  const allocationTotal = Object.values(allocations).reduce((sum, value) => sum + Number(value || 0), 0);
  const paymentAmount = Number(form.amount || 0);

  const resetPaymentForm = () => {
    setEditingId('');
    setForm({ date: today(), millId: '', accountId: '', amount: '', reference: '', note: '' });
    setAllocations({});
  };
  const startEditPayment = (payment: TbsPayment) => {
    const next: Record<string, string> = {};
    for (const allocation of payment.allocations || []) {
      const key = groupKey(payment.millId, allocation.doNumber);
      next[key] = String(Number(next[key] || 0) + allocation.amount);
    }
    setEditingId(payment.id);
    setForm({ date: payment.date, millId: payment.millId, accountId: payment.accountId, amount: String(payment.amount), reference: payment.reference || '', note: payment.note || '' });
    setAllocations(next);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };
  const changeMill = (millId: string) => {
    setForm(current => ({ ...current, millId }));
    setAllocations({});
  };
  const autoAllocate = () => {
    if (!form.millId) return showError('Pilih pabrik terlebih dahulu.');
    if (paymentAmount <= 0) return showError('Isi nominal yang diterima terlebih dahulu.');
    let remaining = paymentAmount;
    const next: Record<string, string> = {};
    for (const item of available) {
      if (remaining <= 0) break;
      const amount = Math.min(item.outstanding, remaining);
      if (amount > 0) next[item.key] = String(amount);
      remaining -= amount;
    }
    setAllocations(next);
    if (remaining > 0) showError(`Masih ada ${idr.format(remaining)} yang belum dapat dialokasikan ke DO pabrik ini.`);
  };
  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    const rows = available
      .map(item => ({ doNumber: item.doNumber, amount: Number(allocations[item.key] || 0) }))
      .filter(item => item.amount > 0);
    if (!form.date || !form.millId || !form.accountId || paymentAmount <= 0 || rows.length === 0) {
      showError('Lengkapi tanggal, pabrik, Kas/Bank, nominal diterima, dan alokasi DO.');
      return;
    }
    if (allocationTotal !== paymentAmount) {
      showError('Total alokasi DO harus sama persis dengan nominal yang diterima.');
      return;
    }
    try {
      setSaving(true);
      const isEditing = Boolean(editingId);
      if (editingId) await api.put(`/api/tbs-payments/${editingId}`, { ...form, amount: paymentAmount, allocations: rows });
      else await api.post('/api/tbs-payments', { ...form, amount: paymentAmount, allocations: rows });
      resetPaymentForm();
      await reload();
      flash(isEditing ? 'Penerimaan PKS berhasil diperbarui dan mutasi Kas/Bank sudah disesuaikan.' : 'Penerimaan PKS berhasil dicatat dan dialokasikan ke kebun dalam DO.');
    } catch (err) {
      showError(apiError(err, 'Penerimaan PKS gagal disimpan.'));
    } finally {
      setSaving(false);
    }
  };
  const removePayment = async (payment: TbsPayment) => {
    if (!window.confirm(`Hapus pembayaran ${payment.paymentNumber}? Mutasi Kas/Bank terkait ikut dihapus.`)) return;
    try {
      await api.delete(`/api/tbs-payments/${payment.id}`);
      if (editingId === payment.id) resetPaymentForm();
      await reload();
      flash('Pembayaran PKS dan mutasi Kas/Bank terkait berhasil dihapus.');
    } catch (err) {
      showError(apiError(err, 'Pembayaran PKS gagal dihapus.'));
    }
  };
  const kebunLabel = (ids: string[]) => ids.map(id => data.kebun.find(item => item.id === id)?.name || '-').join(', ');

  return (
    <div className="stack">
      <section className="receivable-summary">
        <Summary label="Penjualan Diakui" value={idr.format(totalRecognized)} note={`${receivables.length} DO bernilai jual`} />
        <Summary label="Sudah Diterima" value={idr.format(totalPaid)} note={`${data.tbsPayments.length} penerimaan PKS`} />
        <Summary label="Sisa Piutang" value={idr.format(totalOutstanding)} note={`${receivables.filter(item => item.outstanding > 0).length} DO belum lunas`} />
        <Summary label="Tingkat Pelunasan" value={totalRecognized > 0 ? `${((totalPaid / totalRecognized) * 100).toFixed(1)}%` : '0%'} note="Dari penjualan yang sudah diakui" />
      </section>

      <div className={`receivable-layout ${allowed ? '' : 'readonly'}`}>
        {allowed && (
          <section className="panel receivable-form-panel">
            <div className="panel-head"><div><h3>{editingId ? 'Edit Penerimaan PKS' : 'Catat Penerimaan PKS'}</h3><p>{editingId ? 'Koreksi penerimaan dan alokasi DO. Mutasi Kas/Bank lama akan diganti otomatis.' : 'Satu transfer dapat dialokasikan ke beberapa DO. Jika satu DO berisi beberapa kebun, sistem membaginya otomatis.'}</p></div>{editingId && <button type="button" className="text-btn" onClick={resetPaymentForm}>Batal edit</button>}</div>
            <form className="form" onSubmit={submit}>
              <div className="row-2">
                <Field label="Tanggal Diterima"><input type="date" value={form.date} onChange={e => setForm(v => ({ ...v, date: e.target.value }))} /></Field>
                <Field label="Pabrik / PKS"><select value={form.millId} onChange={e => changeMill(e.target.value)}><option value="">Pilih pabrik</option>{data.mills.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}</select></Field>
              </div>
              <Field label="Masuk ke Kas / Bank"><select value={form.accountId} onChange={e => setForm(v => ({ ...v, accountId: e.target.value }))}><option value="">Pilih akun penerimaan</option>{data.accounts.map(item => <option key={item.id} value={item.id}>{item.name} · {item.type}</option>)}</select></Field>
              <Field label="Nominal Diterima"><input inputMode="numeric" placeholder="0" value={formatMoneyInput(form.amount)} onChange={e => setForm(v => ({ ...v, amount: e.target.value.replace(/[^0-9]/g, '') }))} /></Field>
              <div className="allocation-head"><div><strong>Alokasi ke DO</strong><span>Pilih sisa piutang yang dilunasi.</span></div><button type="button" className="secondary small-btn" onClick={autoAllocate}><WandSparkles size={14} /> Alokasikan Otomatis</button></div>
              {!form.millId ? <div className="notice">Pilih pabrik untuk menampilkan DO yang masih memiliki piutang.</div> : available.length === 0 ? <div className="notice">Tidak ada piutang terbuka pada pabrik ini.</div> : (
                <div className="allocation-list">
                  {available.map(item => <div className="allocation-row" key={item.key}><div><strong>{item.doNumber}</strong><span>{kebunLabel(item.kebunIds)} · Sisa {idr.format(item.outstanding)}</span></div><input aria-label={`Alokasi ${item.doNumber}`} inputMode="numeric" placeholder="0" value={formatMoneyInput(allocations[item.key] || '')} onChange={e => { const clean = e.target.value.replace(/[^0-9]/g, ''); const capped = Math.min(Number(clean || 0), item.outstanding); setAllocations(current => ({ ...current, [item.key]: capped ? String(capped) : '' })); }} /></div>)}
                </div>
              )}
              <div className={`allocation-total ${allocationTotal === paymentAmount && paymentAmount > 0 ? 'balanced' : ''}`}><span>Total Alokasi</span><strong>{idr.format(allocationTotal)}</strong><small>Selisih {idr.format(paymentAmount - allocationTotal)}</small></div>
              <Field label="No. Referensi / Transfer"><input placeholder="Mutasi bank / bukti transfer" value={form.reference} onChange={e => setForm(v => ({ ...v, reference: e.target.value }))} /></Field>
              <Field label="Catatan"><textarea rows={2} value={form.note} onChange={e => setForm(v => ({ ...v, note: e.target.value }))} placeholder="Opsional" /></Field>
              <button className="primary wide" disabled={saving}><Save size={18} /> {saving ? 'Menyimpan...' : editingId ? 'Simpan Perubahan Penerimaan' : 'Simpan Penerimaan PKS'}</button>
            </form>
          </section>
        )}

        <section className="panel list-panel">
          <div className="panel-head wrap"><div><h3>Piutang TBS per DO</h3><p>Satu DO tampil satu kali walaupun berasal dari beberapa kebun.</p></div><div className="filters"><select value={filterMill} onChange={e => setFilterMill(e.target.value)}><option value="">Semua pabrik</option>{data.mills.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}</select><select value={filterStatus} onChange={e => setFilterStatus(e.target.value as 'ALL' | 'OPEN' | 'PAID')}><option value="OPEN">Belum lunas</option><option value="PAID">Sudah lunas</option><option value="ALL">Semua</option></select></div></div>
          {filtered.length === 0 ? <div className="empty"><span>Belum ada piutang pada filter ini.</span></div> : <div className="table-wrap"><table className="receivable-table"><thead><tr><th>DO</th><th>Kebun Asal</th><th>Pabrik</th><th className="right">Penjualan</th><th className="right">Diterima</th><th className="right">Sisa</th><th>Status</th></tr></thead><tbody>{filtered.map(item => { const mill = data.mills.find(row => row.id === item.millId); return <tr key={item.key}><td><strong>{item.doNumber}</strong><small className="table-note">{formatDate(item.date)}</small></td><td>{kebunLabel(item.kebunIds)}</td><td>{mill?.name || '-'}</td><td className="right">{idr.format(item.sale)}</td><td className="right money in">{idr.format(item.paid)}</td><td className="right money">{idr.format(item.outstanding)}</td><td><span className={`pill ${item.outstanding === 0 ? 'in' : 'out'}`}>{item.outstanding === 0 ? 'LUNAS' : item.paid > 0 ? 'SEBAGIAN' : 'BELUM BAYAR'}</span></td></tr>; })}</tbody></table></div>}
        </section>
      </div>

      <section className="panel">
        <div className="panel-head"><div><h3>Riwayat Penerimaan PKS</h3><p>Penerimaan otomatis tercermin sebagai uang masuk Kas/Bank, bukan sebagai pendapatan baru.</p></div></div>
        {data.tbsPayments.length === 0 ? <div className="empty"><span>Belum ada pembayaran dari pabrik.</span></div> : <div className="table-wrap"><table className="payment-table"><thead><tr><th>No. Penerimaan</th><th>Tanggal</th><th>Pabrik</th><th>Kas / Bank</th><th>Alokasi DO</th><th>Referensi</th><th className="right">Nominal</th><th></th></tr></thead><tbody>{[...data.tbsPayments].sort((a, b) => `${b.date}${b.createdAt}`.localeCompare(`${a.date}${a.createdAt}`)).map(payment => { const mill = data.mills.find(item => item.id === payment.millId); const account = data.accounts.find(item => item.id === payment.accountId); const doNumbers = Array.from(new Set(payment.allocations.map(item => item.doNumber))); return <tr key={payment.id}><td><strong>{payment.paymentNumber}</strong></td><td>{formatDate(payment.date)}</td><td>{mill?.name || '-'}</td><td>{account?.name || '-'}</td><td>{doNumbers.join(', ') || '-'}</td><td>{payment.reference || '-'}</td><td className="right money in">{idr.format(payment.amount)}</td><td>{allowed && <div className="action-group"><button className="icon-btn" type="button" onClick={() => startEditPayment(payment)} title="Edit penerimaan"><Pencil size={15} /></button><button className="icon-btn danger" type="button" onClick={() => removePayment(payment)} title="Hapus penerimaan"><Trash2 size={15} /></button></div>}</td></tr>; })}</tbody></table></div>}
      </section>
    </div>
  );
}

function Summary({ label, value, note }: { label: string; value: string; note: string }) {
  return <div><span>{label}</span><strong>{value}</strong><small>{note}</small></div>;
}
function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <label className="field"><span>{label}</span>{children}</label>;
}
