import { useMemo, useState } from 'react';
import { api } from './lib/client';
import { Pencil, Save, Trash2 } from 'lucide-react';
import { formatMoneyInput } from './moneyInput';

type Role = 'OWNER' | 'ADMIN_PUSAT' | 'FINANCE' | 'ADMIN_KEBUN' | 'VIEWER';
type Worker = { id: string; name: string; phone: string };
type Account = { id: string; name: string; type: 'KAS' | 'BANK' };
type EmployeeReceivable = {
  id: string;
  date: string;
  workerId: string;
  accountId?: string;
  transactionId?: string;
  description: string;
  totalAmount: number;
  installmentCount: number;
  note: string;
  createdAt: string;
};
type PayrollLine = {
  sourceType: 'TBS_PANEN' | 'TBS_TIMBANG' | 'TBS_LANGSIR' | 'KEBUN_WORK' | 'MANUAL' | 'EMPLOYEE_RECEIVABLE';
  sourceId: string;
  amount: number;
};
type PayrollRun = { id: string; lines: PayrollLine[] };
type Data = {
  workspace: { role: Role };
  harvesters: Worker[];
  accounts: Account[];
  employeeReceivables: EmployeeReceivable[];
  payrollRuns: PayrollRun[];
};
type Props = { data: Data; reload: () => Promise<void>; flash: (text: string) => void; showError: (text: string) => void };

type FormState = {
  date: string;
  workerId: string;
  accountId: string;
  description: string;
  totalAmount: string;
  installmentCount: string;
  note: string;
};

const idr = new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 });
function today() { return new Date().toISOString().slice(0, 10); }
function blankForm(): FormState {
  return { date: today(), workerId: '', accountId: '', description: '', totalAmount: '', installmentCount: '1', note: '' };
}
function canManage(role: Role) { return role === 'OWNER' || role === 'ADMIN_PUSAT' || role === 'FINANCE'; }
function apiError(err: unknown, fallback: string) {
  const response = (err as { response?: { data?: { error?: string; message?: string } } })?.response?.data;
  return response?.error || response?.message || fallback;
}
function installmentPlan(totalAmount: number, installmentCount: number) {
  const count = Math.max(1, Math.floor(installmentCount || 1));
  const base = Math.floor(totalAmount / count);
  const rows = Array.from({ length: count }, () => base);
  rows[count - 1] += totalAmount - base * count;
  return rows;
}
function receivableProgress(item: EmployeeReceivable, runs: PayrollRun[]) {
  const totalDeducted = Math.min(
    item.totalAmount,
    runs.flatMap(run => run.lines || [])
      .filter(line => line.sourceType === 'EMPLOYEE_RECEIVABLE' && line.sourceId === item.id)
      .reduce((sum, line) => sum + line.amount, 0)
  );
  let applied = totalDeducted;
  const installments = installmentPlan(item.totalAmount, item.installmentCount).map((planned, index) => {
    const deducted = Math.min(planned, applied);
    applied -= deducted;
    return { number: index + 1, planned, deducted, remaining: planned - deducted };
  });
  const current = installments.find(row => row.remaining > 0);
  return {
    totalDeducted,
    outstanding: Math.max(0, item.totalAmount - totalDeducted),
    currentInstallment: current?.number || item.installmentCount,
    installments,
  };
}

export default function EmployeeReceivables({ data, reload, flash, showError }: Props) {
  const allowed = canManage(data.workspace.role);
  const [saving, setSaving] = useState(false);
  const [editId, setEditId] = useState('');
  const [form, setForm] = useState<FormState>(blankForm());
  const rows = useMemo(
    () => [...data.employeeReceivables].sort((a, b) => `${b.date}${b.createdAt}`.localeCompare(`${a.date}${a.createdAt}`)),
    [data.employeeReceivables]
  );
  const progressRows = rows.map(item => ({ item, progress: receivableProgress(item, data.payrollRuns) }));
  const totalReceivable = progressRows.reduce((sum, row) => sum + row.item.totalAmount, 0);
  const totalDeducted = progressRows.reduce((sum, row) => sum + row.progress.totalDeducted, 0);
  const totalOutstanding = progressRows.reduce((sum, row) => sum + row.progress.outstanding, 0);
  const planPreview = installmentPlan(Number(form.totalAmount || 0), Number(form.installmentCount || 1));

  const resetForm = () => { setEditId(''); setForm(blankForm()); };
  const save = async (event: React.FormEvent) => {
    event.preventDefault();
    const totalAmount = Number(form.totalAmount || 0);
    const installmentCount = Number(form.installmentCount || 0);
    if (!form.date || !form.workerId || !form.accountId || !form.description.trim() || totalAmount <= 0 || installmentCount < 1) {
      showError('Lengkapi tanggal, pekerja, Kas/Bank sumber dana, keterangan piutang, total piutang, dan jumlah kali potong.');
      return;
    }
    try {
      setSaving(true);
      const payload = { ...form, totalAmount, installmentCount };
      if (editId) await api.put(`/api/employee-receivables/${editId}`, payload);
      else await api.post('/api/employee-receivables', payload);
      resetForm();
      await reload();
      flash(editId ? 'Piutang karyawan dan mutasi Kas/Bank diperbarui.' : 'Piutang karyawan disimpan dan Kas/Bank sumber dana sudah berkurang.');
    } catch (err) {
      showError(apiError(err, 'Piutang karyawan gagal disimpan.'));
    } finally {
      setSaving(false);
    }
  };
  const edit = (item: EmployeeReceivable) => {
    setEditId(item.id);
    setForm({
      date: item.date,
      workerId: item.workerId,
      accountId: item.accountId || '',
      description: item.description,
      totalAmount: String(item.totalAmount),
      installmentCount: String(item.installmentCount),
      note: item.note || '',
    });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };
  const remove = async (item: EmployeeReceivable) => {
    if (!window.confirm(`Hapus piutang ${item.description}? Mutasi Kas/Bank pencairannya juga akan dihapus.`)) return;
    try {
      await api.delete(`/api/employee-receivables/${item.id}`);
      await reload();
      flash('Piutang karyawan dan mutasi Kas/Bank pencairannya dihapus.');
    } catch (err) {
      showError(apiError(err, 'Piutang karyawan gagal dihapus.'));
    }
  };

  return <div className="stack">
    <section className="panel tbs-header">
      <div><span className="eyebrow dark">Tenaga Kerja Kebun</span><h2>Piutang Karyawan</h2><p>Atur pencairan dari Kas/Bank, saldo piutang, dan rencana cicilan. Potongan aktual tetap dipilih dan dapat diubah nominalnya saat review Payroll.</p></div>
    </section>

    <div className="receivable-summary">
      <div><span>Total Piutang</span><strong>{idr.format(totalReceivable)}</strong><small>{rows.length} catatan piutang</small></div>
      <div><span>Sudah Dipotong Payroll</span><strong>{idr.format(totalDeducted)}</strong><small>Termasuk Payroll belum dibayar</small></div>
      <div><span>Sisa Piutang</span><strong>{idr.format(totalOutstanding)}</strong><small>Saldo yang masih dapat dipotong</small></div>
      <div><span>Piutang Aktif</span><strong>{progressRows.filter(row => row.progress.outstanding > 0).length}</strong><small>Belum lunas</small></div>
    </div>

    <div className={`grid-form-list ${allowed ? '' : 'readonly'}`}>
      <section className="panel form-panel">
        <div className="panel-head"><div><h3>{editId ? 'Edit Piutang Karyawan' : 'Tambah Piutang Karyawan'}</h3><p>Kas/Bank sumber dana otomatis berkurang saat piutang disimpan. Jumlah kali potong hanya menjadi rencana.</p></div>{editId && <button className="text-btn" type="button" onClick={resetForm}>Batal</button>}</div>
        {!allowed ? <div className="notice">Hanya Owner, Admin Pusat, dan Finance yang dapat mengelola Piutang Karyawan.</div> : <form className="form" onSubmit={save}>
          <label className="field"><span>Tanggal Piutang</span><input type="date" value={form.date} onChange={event => setForm(value => ({ ...value, date: event.target.value }))} /></label>
          <label className="field"><span>Nama Pekerja</span><select value={form.workerId} onChange={event => setForm(value => ({ ...value, workerId: event.target.value }))}><option value="">Pilih pekerja</option>{data.harvesters.map(worker => <option key={worker.id} value={worker.id}>{worker.name}</option>)}</select></label>
          <label className="field"><span>Keterangan Piutang</span><input value={form.description} onChange={event => setForm(value => ({ ...value, description: event.target.value }))} placeholder="Contoh: Kasbon, pinjaman, pembelian barang" /></label>
          <label className="field"><span>Kas / Bank Sumber Dana</span><select value={form.accountId} onChange={event => setForm(value => ({ ...value, accountId: event.target.value }))}><option value="">Pilih sumber dana</option>{data.accounts.map(account => <option key={account.id} value={account.id}>{account.name} · {account.type}</option>)}</select></label>
          <div className="row-2">
            <label className="field"><span>Total Piutang</span><input inputMode="numeric" value={formatMoneyInput(form.totalAmount)} onChange={event => setForm(value => ({ ...value, totalAmount: event.target.value.replace(/[^0-9]/g, '') }))} placeholder="0" /></label>
            <label className="field"><span>Jumlah Kali Potong</span><input type="number" min="1" max="60" value={form.installmentCount} onChange={event => setForm(value => ({ ...value, installmentCount: event.target.value }))} /></label>
          </div>
          {Number(form.totalAmount || 0) > 0 && Number(form.installmentCount || 0) > 0 && <div className="notice">Rencana awal: {planPreview.length} kali potong. Cicilan pertama {idr.format(planPreview[0] || 0)}{planPreview.length > 1 ? `, cicilan terakhir ${idr.format(planPreview[planPreview.length - 1] || 0)}` : ''}. Nominal aktual tetap bisa diubah saat Payroll.</div>}
          <label className="field"><span>Catatan</span><textarea rows={3} value={form.note} onChange={event => setForm(value => ({ ...value, note: event.target.value }))} /></label>
          <button className="primary" disabled={saving}><Save size={16} /> {saving ? 'Menyimpan...' : editId ? 'Simpan Perubahan' : 'Simpan Piutang'}</button>
        </form>}
      </section>

      <section className="panel">
        <div className="panel-head"><div><h3>Daftar Piutang Karyawan</h3><p>Pencairan tercatat sebagai Kas/Bank keluar, sedangkan cicilan menyesuaikan berdasarkan potongan yang benar-benar masuk Payroll.</p></div></div>
        {progressRows.length === 0 ? <div className="empty"><span>Belum ada piutang karyawan.</span></div> : <div className="table-wrap"><table className="payment-table"><thead><tr><th>Pekerja</th><th>Piutang</th><th>Sumber Dana</th><th className="right">Total</th><th className="right">Terpotong</th><th className="right">Sisa</th><th>Status</th><th></th></tr></thead><tbody>{progressRows.map(({ item, progress }) => {
          const worker = data.harvesters.find(row => row.id === item.workerId);
          const account = data.accounts.find(row => row.id === item.accountId);
          const locked = progress.totalDeducted > 0;
          return <tr key={item.id}>
            <td><strong>{worker?.name || 'Pekerja'}</strong><small className="table-note">{item.date}</small></td>
            <td><strong>{item.description}</strong><small className="table-note">Rencana {item.installmentCount} kali potong · cicilan aktif #{progress.currentInstallment}</small><details className="payroll-detail"><summary>Lihat rincian cicilan</summary><div className="payroll-lines">{progress.installments.map(row => <span key={row.number}>Cicilan {row.number}: rencana {idr.format(row.planned)} · terpotong {idr.format(row.deducted)} · sisa {idr.format(row.remaining)}</span>)}</div></details></td>
            <td><strong>{account?.name || 'Belum tercatat'}</strong><small className="table-note">{account?.type || (item.accountId ? 'Akun tidak ditemukan' : 'Edit piutang untuk pilih sumber dana')}</small></td>
            <td className="right money">{idr.format(item.totalAmount)}</td>
            <td className="right">{idr.format(progress.totalDeducted)}</td>
            <td className="right money">{idr.format(progress.outstanding)}</td>
            <td><span className={`pill ${progress.outstanding === 0 ? 'in' : locked ? 'transfer' : 'out'}`}>{progress.outstanding === 0 ? 'LUNAS' : locked ? 'BERJALAN' : 'BELUM DIPOTONG'}</span></td>
            <td className="right">{allowed && !locked && <div className="action-group"><button className="icon-btn" type="button" onClick={() => edit(item)} title="Edit"><Pencil size={15} /></button><button className="icon-btn danger" type="button" onClick={() => remove(item)} title="Hapus"><Trash2 size={15} /></button></div>}</td>
          </tr>;
        })}</tbody></table></div>}
      </section>
    </div>
  </div>;
}
