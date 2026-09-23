import { useMemo, useState } from 'react';
import { api } from './lib/client';
import { Banknote, Pencil, ReceiptText, Save, Trash2, Undo2 } from 'lucide-react';
import { readStoredChoice, storeChoice } from './navigationState';
import PayrollSlip from './PayrollSlip';
import { formatMoneyInput } from './moneyInput';

type Role = 'OWNER' | 'ADMIN_PUSAT' | 'FINANCE' | 'ADMIN_KEBUN' | 'VIEWER';
type Kebun = { id: string; code: string; name: string };
type Account = { id: string; name: string; type: 'KAS' | 'BANK' };
type Worker = { id: string; name: string; phone: string };
type TbsRecord = {
  id: string;
  date: string;
  doNumber: string;
  kebunId: string;
  harvesterId: string;
  langsirWorkerId?: string;
  harvestCost: number;
  weighingCost?: number;
  langsirCost: number;
};
type PayrollManual = {
  id: string;
  date: string;
  workerId: string;
  kebunId: string;
  kind: 'EARNING' | 'DEDUCTION';
  category: string;
  amount: number;
  note: string;
  createdAt: string;
};
type EmployeeReceivable = {
  id: string;
  date: string;
  workerId: string;
  description: string;
  totalAmount: number;
  installmentCount: number;
  note: string;
  createdAt: string;
};
type PayrollLine = {
  sourceKey: string;
  sourceType: 'TBS_PANEN' | 'TBS_TIMBANG' | 'TBS_LANGSIR' | 'KEBUN_WORK' | 'MANUAL' | 'EMPLOYEE_RECEIVABLE';
  sourceId: string;
  kebunId: string;
  date: string;
  kind: 'EARNING' | 'DEDUCTION';
  label: string;
  amount: number;
  doNumber?: string;
};
type PayrollRun = {
  id: string;
  payrollNumber: string;
  periodStart: string;
  periodEnd: string;
  workerId: string;
  workerName: string;
  lines: PayrollLine[];
  grossEarnings: number;
  deductions: number;
  netPay: number;
  status: 'OPEN' | 'PAID';
  paymentDate: string;
  accountId: string;
  reference: string;
  note: string;
  transactionIds: string[];
  createdAt: string;
};
type EmployeeReceivableOption = {
  receivableId: string;
  description: string;
  totalAmount: number;
  totalDeducted: number;
  outstandingAmount: number;
  installmentCount: number;
  currentInstallment: number;
  suggestedAmount: number;
};
type PayrollPreview = {
  workerId: string;
  workerName: string;
  lines: PayrollLine[];
  grossEarnings: number;
  deductions: number;
  netPay: number;
  receivableOptions: EmployeeReceivableOption[];
};
type Data = {
  workspace: { role: Role; name?: string };
  kebun: Kebun[];
  accounts: Account[];
  harvesters: Worker[];
  tbs: TbsRecord[];
  employeeReceivables: EmployeeReceivable[];
  payrollManual: PayrollManual[];
  payrollRuns: PayrollRun[];
};
type Props = {
  data: Data;
  reload: () => Promise<void>;
  flash: (text: string) => void;
  showError: (text: string) => void;
  workersOnly?: boolean;
};

const idr = new Intl.NumberFormat('id-ID', {
  style: 'currency',
  currency: 'IDR',
  maximumFractionDigits: 0,
});

function today() {
  return new Date().toISOString().slice(0, 10);
}
function firstDayOfMonth() {
  return `${today().slice(0, 7)}-01`;
}
function canManagePayroll(role: Role) {
  return role === 'OWNER' || role === 'ADMIN_PUSAT' || role === 'FINANCE';
}
function canManageWorkers(role: Role) {
  return role === 'OWNER' || role === 'ADMIN_PUSAT';
}
function apiError(err: unknown, fallback: string) {
  const response = (err as { response?: { data?: { error?: string; message?: string } } })?.response?.data;
  return response?.error || response?.message || fallback;
}
function lineBreakdown(lines: PayrollLine[]) {
  return {
    panen: lines.filter(line => line.sourceType === 'TBS_PANEN').reduce((sum, line) => sum + line.amount, 0),
    timbang: lines.filter(line => line.sourceType === 'TBS_TIMBANG').reduce((sum, line) => sum + line.amount, 0),
    langsir: lines.filter(line => line.sourceType === 'TBS_LANGSIR').reduce((sum, line) => sum + line.amount, 0),
    work: lines.filter(line => line.sourceType === 'KEBUN_WORK').reduce((sum, line) => sum + line.amount, 0),
    other: lines.filter(line => line.sourceType === 'MANUAL' && line.kind === 'EARNING').reduce((sum, line) => sum + line.amount, 0),
  };
}

export default function PayrollModule({ data, reload, flash, showError, workersOnly = false }: Props) {
  const payrollModeStorageKey = 'perkebunan.navigation.payroll';
  const storedPayrollMode = readStoredChoice(payrollModeStorageKey, ['runs', 'manual'] as const, 'runs');
  const [mode, setMode] = useState<'runs' | 'manual' | 'workers'>(() => workersOnly ? 'workers' : storedPayrollMode);
  const [periodStart, setPeriodStart] = useState(firstDayOfMonth());
  const [periodEnd, setPeriodEnd] = useState(today());
  const [saving, setSaving] = useState(false);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewLoaded, setPreviewLoaded] = useState(false);
  const [previewRows, setPreviewRows] = useState<PayrollPreview[]>([]);
  const [selectedWorkerIds, setSelectedWorkerIds] = useState<string[]>([]);
  const [receivableAmounts, setReceivableAmounts] = useState<Record<string, string>>({});
  const [selectedRunId, setSelectedRunId] = useState('');
  const [slipRunId, setSlipRunId] = useState('');
  const [payForm, setPayForm] = useState({ date: today(), accountId: '', reference: '', note: '' });
  const [manualEditId, setManualEditId] = useState('');
  const [manualForm, setManualForm] = useState({
    date: today(),
    workerId: '',
    kebunId: '',
    kind: 'EARNING' as 'EARNING' | 'DEDUCTION',
    category: 'Upah Harian',
    amount: '',
    note: '',
  });
  const [workerEditId, setWorkerEditId] = useState('');
  const [workerForm, setWorkerForm] = useState({ name: '', phone: '' });

  const allowed = canManagePayroll(data.workspace.role);
  const workerAdmin = canManageWorkers(data.workspace.role);
  const runs = [...data.payrollRuns].sort((a, b) => `${b.periodEnd}${b.createdAt}`.localeCompare(`${a.periodEnd}${a.createdAt}`));
  const openRuns = runs.filter(run => run.status === 'OPEN');
  const manuals = [...data.payrollManual].sort((a, b) => `${b.date}${b.createdAt}`.localeCompare(`${a.date}${a.createdAt}`));
  const usedManualIds = useMemo(
    () => new Set(data.payrollRuns.flatMap(run => run.lines.filter(line => line.sourceType === 'MANUAL').map(line => line.sourceId))),
    [data.payrollRuns]
  );
  const selectedRun = runs.find(run => run.id === selectedRunId);
  const slipRun = runs.find(run => run.id === slipRunId);
  const openTotal = openRuns.reduce((sum, run) => sum + run.netPay, 0);
  const paidTotal = runs.filter(run => run.status === 'PAID').reduce((sum, run) => sum + run.netPay, 0);
  const grossTotal = runs.reduce((sum, run) => sum + run.grossEarnings, 0);
  const deductionTotal = runs.reduce((sum, run) => sum + run.deductions, 0);
  const allPreviewSelected = previewRows.length > 0 && previewRows.every(row => selectedWorkerIds.includes(row.workerId));

  const changeMode = (nextMode: 'runs' | 'manual') => {
    setMode(nextMode);
    storeChoice(payrollModeStorageKey, nextMode);
  };
  const resetPreview = () => {
    setPreviewLoaded(false);
    setPreviewRows([]);
    setSelectedWorkerIds([]);
    setReceivableAmounts({});
  };
  const changePeriodStart = (value: string) => {
    setPeriodStart(value);
    resetPreview();
  };
  const changePeriodEnd = (value: string) => {
    setPeriodEnd(value);
    resetPreview();
  };
  const loadPreview = async (silent = false) => {
    if (!periodStart || !periodEnd || periodStart > periodEnd) {
      if (!silent) showError('Periode Payroll tidak valid.');
      return;
    }
    try {
      setPreviewLoading(true);
      const response = await api.post('/api/payroll-preview', { periodStart, periodEnd });
      const candidates = ((response.data as { candidates?: PayrollPreview[] }).candidates || []);
      setPreviewRows(candidates);
      setSelectedWorkerIds([]);
      setReceivableAmounts({});
      setPreviewLoaded(true);
    } catch (err) {
      if (!silent) showError(apiError(err, 'Daftar pekerja Payroll gagal dimuat.'));
    } finally {
      setPreviewLoading(false);
    }
  };
  const toggleWorker = (workerId: string) => {
    const removing = selectedWorkerIds.includes(workerId);
    setSelectedWorkerIds(current => removing ? current.filter(id => id !== workerId) : [...current, workerId]);
    if (removing) {
      const optionIds = new Set(previewRows.find(row => row.workerId === workerId)?.receivableOptions.map(option => option.receivableId) || []);
      setReceivableAmounts(current => Object.fromEntries(Object.entries(current).filter(([id]) => !optionIds.has(id))));
    }
  };
  const toggleReceivable = (workerId: string, option: EmployeeReceivableOption) => {
    const selected = Object.prototype.hasOwnProperty.call(receivableAmounts, option.receivableId);
    setReceivableAmounts(current => {
      if (selected) return Object.fromEntries(Object.entries(current).filter(([id]) => id !== option.receivableId));
      return { ...current, [option.receivableId]: String(option.suggestedAmount) };
    });
    if (!selected && !selectedWorkerIds.includes(workerId)) setSelectedWorkerIds(current => [...current, workerId]);
  };
  const toggleAllWorkers = () => {
    setSelectedWorkerIds(allPreviewSelected ? [] : previewRows.map(row => row.workerId));
  };
  const processPayroll = async () => {
    if (selectedWorkerIds.length === 0) {
      showError('Centang minimal satu pekerja yang sudah direview.');
      return;
    }
    const receivableDeductions = previewRows.flatMap(row => row.receivableOptions
      .filter(option => selectedWorkerIds.includes(row.workerId) && Object.prototype.hasOwnProperty.call(receivableAmounts, option.receivableId))
      .map(option => ({ workerId: row.workerId, receivableId: option.receivableId, amount: Number(receivableAmounts[option.receivableId] || 0) })));
    if (receivableDeductions.some(item => item.amount <= 0)) {
      showError('Nominal potongan Piutang Karyawan harus lebih dari nol.');
      return;
    }
    const invalidWorker = previewRows.find(row => selectedWorkerIds.includes(row.workerId) && row.receivableOptions
      .filter(option => Object.prototype.hasOwnProperty.call(receivableAmounts, option.receivableId))
      .reduce((sum, option) => sum + Number(receivableAmounts[option.receivableId] || 0), 0) > row.netPay);
    if (invalidWorker) {
      showError(`Potongan Piutang Karyawan ${invalidWorker.workerName} melebihi netto Payroll yang tersedia.`);
      return;
    }
    try {
      setSaving(true);
      const response = await api.post('/api/payroll-runs', { periodStart, periodEnd, workerIds: selectedWorkerIds, receivableDeductions });
      const created = ((response.data as { created?: PayrollRun[] }).created || []);
      if (selectedWorkerIds.length === 1 && created[0]?.id) setSlipRunId(created[0].id);
      await reload();
      await loadPreview(true);
      flash('Payroll pekerja terpilih berhasil diproses dan slip gaji sudah tersedia.');
    } catch (err) {
      showError(apiError(err, 'Payroll gagal diproses.'));
    } finally {
      setSaving(false);
    }
  };
  const startPay = (run: PayrollRun) => {
    setSelectedRunId(run.id);
    setPayForm({ date: today(), accountId: data.accounts[0]?.id || '', reference: '', note: '' });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };
  const payRun = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!selectedRun || !payForm.date || !payForm.accountId) {
      showError('Tanggal dan akun pembayaran wajib diisi.');
      return;
    }
    try {
      setSaving(true);
      await api.post(`/api/payroll-runs/${selectedRun.id}/pay`, payForm);
      setSelectedRunId('');
      await reload();
      flash('Payroll berhasil dibayar dan Kas/Bank sudah diperbarui.');
    } catch (err) {
      showError(apiError(err, 'Pembayaran Payroll gagal.'));
    } finally {
      setSaving(false);
    }
  };
  const cancelPayment = async (run: PayrollRun) => {
    if (!window.confirm(`Batalkan pembayaran ${run.workerName}? Mutasi Kas/Bank terkait juga akan dihapus.`)) return;
    try {
      await api.delete(`/api/payroll-runs/${run.id}/payment`);
      await reload();
      flash('Pembayaran Payroll dibatalkan.');
    } catch (err) {
      showError(apiError(err, 'Pembayaran Payroll gagal dibatalkan.'));
    }
  };
  const deleteRun = async (run: PayrollRun) => {
    if (!window.confirm(`Batalkan proses Payroll ${run.workerName} periode ${run.periodStart} s.d. ${run.periodEnd}?`)) return;
    try {
      await api.delete(`/api/payroll-runs/${run.id}`);
      if (selectedRunId === run.id) setSelectedRunId('');
      await reload();
      if (previewLoaded) await loadPreview(true);
      flash('Proses Payroll dibatalkan dan sumber kembali ke daftar review.');
    } catch (err) {
      showError(apiError(err, 'Payroll gagal dibatalkan.'));
    }
  };
  const saveManual = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!manualForm.date || !manualForm.workerId || !manualForm.kebunId || !manualForm.category || Number(manualForm.amount) <= 0) {
      showError('Lengkapi komponen Payroll manual.');
      return;
    }
    const payload = { ...manualForm, amount: Number(manualForm.amount || 0) };
    try {
      setSaving(true);
      if (manualEditId) await api.put(`/api/payroll-manual/${manualEditId}`, payload);
      else await api.post('/api/payroll-manual', payload);
      setManualEditId('');
      setManualForm({ date: today(), workerId: '', kebunId: '', kind: 'EARNING', category: 'Upah Harian', amount: '', note: '' });
      await reload();
      flash(manualEditId ? 'Komponen Payroll diperbarui.' : 'Komponen Payroll ditambahkan.');
    } catch (err) {
      showError(apiError(err, 'Komponen Payroll gagal disimpan.'));
    } finally {
      setSaving(false);
    }
  };
  const editManual = (item: PayrollManual) => {
    setManualEditId(item.id);
    setManualForm({
      date: item.date,
      workerId: item.workerId,
      kebunId: item.kebunId,
      kind: item.kind,
      category: item.category,
      amount: String(item.amount),
      note: item.note || '',
    });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };
  const deleteManual = async (item: PayrollManual) => {
    if (!window.confirm(`Hapus komponen ${item.category}?`)) return;
    try {
      await api.delete(`/api/payroll-manual/${item.id}`);
      await reload();
      flash('Komponen Payroll dihapus.');
    } catch (err) {
      showError(apiError(err, 'Komponen Payroll gagal dihapus.'));
    }
  };
  const saveWorker = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!workerForm.name.trim()) {
      showError('Nama tenaga kerja wajib diisi.');
      return;
    }
    try {
      setSaving(true);
      const body = { name: workerForm.name, phone: workerForm.phone };
      if (workerEditId) await api.put(`/api/tbs-master/harvesters/${workerEditId}`, body);
      else await api.post('/api/tbs-master/harvesters', body);
      setWorkerEditId('');
      setWorkerForm({ name: '', phone: '' });
      await reload();
      flash(workerEditId ? 'Tenaga kerja diperbarui.' : 'Tenaga kerja ditambahkan.');
    } catch (err) {
      showError(apiError(err, 'Tenaga kerja gagal disimpan.'));
    } finally {
      setSaving(false);
    }
  };
  const deleteWorker = async (worker: Worker) => {
    if (!window.confirm(`Hapus ${worker.name} dari master tenaga kerja?`)) return;
    try {
      await api.delete(`/api/tbs-master/harvesters/${worker.id}`);
      await reload();
      flash('Tenaga kerja dihapus.');
    } catch (err) {
      showError(apiError(err, 'Tenaga kerja masih digunakan atau gagal dihapus.'));
    }
  };

  return (
    <div className="stack">
      <section className="panel tbs-header">
        <div>
          <span className="eyebrow dark">{workersOnly ? 'Master Data' : 'Tenaga Kerja Kebun'}</span>
          <h2>{workersOnly ? 'Master Tenaga Kerja' : 'Payroll Kebun'}</h2>
          <p>{workersOnly ? 'Satu master tenaga kerja dipakai oleh Panen & TBS, Pekerjaan Kebun, Piutang Karyawan, dan Payroll.' : 'Review pekerjaan per pekerja terlebih dahulu, proses yang sudah disetujui, lalu lanjutkan pembayaran ke Kas/Bank.'}</p>
        </div>
        {!workersOnly && <div className="mode-tabs payroll-tabs">
          <button type="button" className={mode === 'runs' ? 'active' : ''} onClick={() => changeMode('runs')}>Proses Payroll</button>
          <button type="button" className={mode === 'manual' ? 'active' : ''} onClick={() => changeMode('manual')}>Komponen Manual</button>
        </div>}
      </section>

      {mode === 'runs' && (
        <>
          <div className="receivable-summary">
            <div><span>Penghasilan Diproses</span><strong>{idr.format(grossTotal)}</strong><small>Seluruh payroll yang sudah diproses</small></div>
            <div><span>Total Potongan</span><strong>{idr.format(deductionTotal)}</strong><small>Kasbon dan potongan lainnya</small></div>
            <div><span>Siap Dibayar</span><strong>{idr.format(openTotal)}</strong><small>{openRuns.length} payroll belum dibayar</small></div>
            <div><span>Sudah Dibayar</span><strong>{idr.format(paidTotal)}</strong><small>{runs.filter(run => run.status === 'PAID').length} payroll</small></div>
          </div>

          <section className="panel">
            <div className="panel-head wrap">
              <div>
                <h3>1. Review Pekerja & Pekerjaan</h3>
                <p>Pilih periode, tampilkan pekerja, cek rincian pekerjaannya, lalu centang hanya yang sudah siap diproses.</p>
              </div>
              {allowed && (
                <button className="secondary" type="button" disabled={previewLoading} onClick={() => void loadPreview()}>
                  {previewLoading ? 'Memuat...' : 'Tampilkan Pekerja'}
                </button>
              )}
            </div>
            <div className="row-2">
              <label className="field">
                <span>Periode Mulai</span>
                <input type="date" value={periodStart} onChange={event => changePeriodStart(event.target.value)} />
              </label>
              <label className="field">
                <span>Periode Sampai</span>
                <input type="date" value={periodEnd} onChange={event => changePeriodEnd(event.target.value)} />
              </label>
            </div>
            {!allowed && <div className="notice">Role Anda hanya dapat melihat hasil Payroll yang sudah diproses.</div>}

            {allowed && previewLoaded && (
              <div className="payroll-review-area">
                <div className="payroll-review-toolbar">
                  <div>
                    <strong>{previewRows.length} pekerja belum diproses</strong>
                    <span>{selectedWorkerIds.length} pekerja dicentang</span>
                  </div>
                  {previewRows.length > 0 && (
                    <button className="text-btn" type="button" onClick={toggleAllWorkers}>
                      {allPreviewSelected ? 'Batalkan Semua' : 'Pilih Semua'}
                    </button>
                  )}
                </div>

                {previewRows.length === 0 ? (
                  <div className="empty"><span>Tidak ada komponen Payroll baru pada periode ini.</span></div>
                ) : (
                  <div className="payroll-review-list">
                    {previewRows.map(row => {
                      const breakdown = lineBreakdown(row.lines);
                      const checked = selectedWorkerIds.includes(row.workerId);
                      const selectedReceivableTotal = row.receivableOptions
                        .filter(option => Object.prototype.hasOwnProperty.call(receivableAmounts, option.receivableId))
                        .reduce((sum, option) => sum + Number(receivableAmounts[option.receivableId] || 0), 0);
                      const adjustedNet = Math.max(0, row.netPay - selectedReceivableTotal);
                      return (
                        <article className={`payroll-worker-card ${checked ? 'selected' : ''}`} key={row.workerId}>
                          <div className="payroll-worker-head">
                            <input
                              type="checkbox"
                              checked={checked}
                              onChange={() => toggleWorker(row.workerId)}
                              aria-label={`Pilih ${row.workerName}`}
                            />
                            <div className="payroll-worker-name">
                              <strong>{row.workerName}</strong>
                              <span>{row.lines.length} komponen · Panen {idr.format(breakdown.panen)} · Timbang {idr.format(breakdown.timbang)} · Langsir {idr.format(breakdown.langsir)} · Pekerjaan {idr.format(breakdown.work)}</span>
                            </div>
                            <div className="payroll-worker-total">
                              <span>Netto setelah pilihan potongan</span>
                              <strong>{idr.format(adjustedNet)}</strong>
                              {(row.deductions + selectedReceivableTotal) > 0 && <small>Total potongan {idr.format(row.deductions + selectedReceivableTotal)}</small>}
                            </div>
                          </div>
                          <details className="payroll-review-detail">
                            <summary>Lihat detail pekerjaan & komponen</summary>
                            <div className="payroll-review-lines">
                              {row.lines.map(line => {
                                const kebun = data.kebun.find(item => item.id === line.kebunId);
                                return (
                                  <div className="payroll-review-line" key={line.sourceKey}>
                                    <div>
                                      <strong>{line.label}</strong>
                                      <span>{line.date} · {kebun ? `${kebun.code} - ${kebun.name}` : 'Kebun'}{line.doNumber ? ` · DO ${line.doNumber}` : ''}</span>
                                    </div>
                                    <b className={line.kind === 'DEDUCTION' ? 'out' : 'in'}>{line.kind === 'DEDUCTION' ? '- ' : ''}{idr.format(line.amount)}</b>
                                  </div>
                                );
                              })}
                            </div>
                          </details>
                          {row.receivableOptions.length > 0 && <div className="payroll-debt-options">
                            <strong>Piutang Karyawan · pilih jika dipotong pada Payroll ini</strong>
                            {row.receivableOptions.map(option => {
                              const selected = Object.prototype.hasOwnProperty.call(receivableAmounts, option.receivableId);
                              const amount = Number(receivableAmounts[option.receivableId] || 0);
                              return <div className={`payroll-debt-option ${selected ? 'selected' : ''}`} key={option.receivableId}>
                                <input type="checkbox" checked={selected} onChange={() => toggleReceivable(row.workerId, option)} aria-label={`Potong ${option.description}`} />
                                <div><b>{option.description}</b><span>Sisa {idr.format(option.outstandingAmount)} · cicilan aktif {option.currentInstallment}/{option.installmentCount} · saran {idr.format(option.suggestedAmount)}</span></div>
                                {selected && <label><span>Potong sekarang</span><input inputMode="numeric" value={formatMoneyInput(receivableAmounts[option.receivableId] || '')} onChange={event => setReceivableAmounts(current => ({ ...current, [option.receivableId]: event.target.value.replace(/[^0-9]/g, '') }))} /></label>}
                                {selected && amount !== option.suggestedAmount && <small>{amount < option.suggestedAmount ? `Kurang ${idr.format(option.suggestedAmount - amount)} akan tetap menjadi sisa cicilan aktif.` : `Lebih ${idr.format(amount - option.suggestedAmount)} otomatis mengurangi cicilan berikutnya.`}</small>}
                              </div>;
                            })}
                          </div>}
                        </article>
                      );
                    })}
                  </div>
                )}

                {previewRows.length > 0 && (
                  <div className="payroll-review-actions">
                    <span>Pastikan rincian pekerjaan sudah benar sebelum diproses.</span>
                    <button className="primary" type="button" disabled={saving || selectedWorkerIds.length === 0} onClick={processPayroll}>
                      <Banknote size={17} /> {saving ? 'Memproses...' : `Proses Payroll Terpilih (${selectedWorkerIds.length})`}
                    </button>
                  </div>
                )}
              </div>
            )}
          </section>

          <section className="panel">
            <div className="panel-head">
              <div>
                <h3>2. Payroll Siap Dibayar</h3>
                <p>Tombol pembayaran baru tersedia setelah pekerja selesai diproses Payroll.</p>
              </div>
            </div>
            {openRuns.length === 0 ? (
              <div className="empty"><span>Belum ada Payroll yang menunggu pembayaran.</span></div>
            ) : (
              <div className="payroll-ready-list">
                {openRuns.map(run => (
                  <div className="payroll-ready-row" key={run.id}>
                    <div>
                      <strong>{run.workerName}</strong>
                      <span>{run.periodStart} s.d. {run.periodEnd} · {run.payrollNumber}</span>
                    </div>
                    <b>{idr.format(run.netPay)}</b>
                    <div className="payroll-ready-actions">
                      <button className="secondary small-btn" type="button" onClick={() => setSlipRunId(run.id)}><ReceiptText size={15} /> Slip Gaji</button>
                      {allowed && <button className="primary small-btn" type="button" onClick={() => startPay(run)}>Bayar</button>}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>

          {selectedRun && allowed && (
            <section className="panel">
              <div className="panel-head">
                <div>
                  <h3>Bayar Payroll · {selectedRun.workerName}</h3>
                  <p>{selectedRun.payrollNumber} · Netto {idr.format(selectedRun.netPay)}</p>
                </div>
                <button className="text-btn" type="button" onClick={() => setSelectedRunId('')}>Tutup</button>
              </div>
              <form className="form" onSubmit={payRun}>
                <div className="row-2">
                  <label className="field">
                    <span>Tanggal Bayar</span>
                    <input type="date" value={payForm.date} onChange={event => setPayForm(value => ({ ...value, date: event.target.value }))} />
                  </label>
                  <label className="field">
                    <span>Kas / Bank</span>
                    <select value={payForm.accountId} onChange={event => setPayForm(value => ({ ...value, accountId: event.target.value }))}>
                      <option value="">Pilih akun</option>
                      {data.accounts.map(item => <option key={item.id} value={item.id}>{item.name} · {item.type}</option>)}
                    </select>
                  </label>
                </div>
                <div className="row-2">
                  <label className="field">
                    <span>Referensi</span>
                    <input value={payForm.reference} onChange={event => setPayForm(value => ({ ...value, reference: event.target.value }))} placeholder="No. transfer / bukti" />
                  </label>
                  <label className="field">
                    <span>Catatan</span>
                    <input value={payForm.note} onChange={event => setPayForm(value => ({ ...value, note: event.target.value }))} />
                  </label>
                </div>
                <button className="primary" disabled={saving}><Save size={16} /> Simpan Pembayaran</button>
              </form>
            </section>
          )}

          <section className="panel">
            <div className="panel-head"><div><h3>Riwayat Payroll</h3><p>{runs.length} payroll sudah diproses.</p></div></div>
            {runs.length === 0 ? (
              <div className="empty"><span>Belum ada payroll yang diproses.</span></div>
            ) : (
              <div className="table-wrap">
                <table className="payroll-table">
                  <thead>
                    <tr>
                      <th>Tenaga Kerja</th><th>Periode</th><th className="right">Panen</th><th className="right">Timbang</th><th className="right">Langsir</th><th className="right">Pekerjaan</th><th className="right">Tambahan</th><th className="right">Potongan</th><th className="right">Netto</th><th>Status</th><th></th>
                    </tr>
                  </thead>
                  <tbody>
                    {runs.map(run => {
                      const part = lineBreakdown(run.lines);
                      return (
                        <tr key={run.id}>
                          <td>
                            <strong>{run.workerName}</strong>
                            <small className="table-note">{run.payrollNumber}</small>
                            <details className="payroll-detail">
                              <summary>{run.lines.length} komponen</summary>
                              <div className="payroll-lines">
                                {run.lines.map(line => <span key={line.sourceKey}>{line.date} · {line.label}{line.doNumber ? ` · DO ${line.doNumber}` : ''} · {idr.format(line.amount)}</span>)}
                              </div>
                            </details>
                          </td>
                          <td>{run.periodStart}<small className="table-note">s.d. {run.periodEnd}</small></td>
                          <td className="right">{idr.format(part.panen)}</td>
                          <td className="right">{idr.format(part.timbang)}</td>
                          <td className="right">{idr.format(part.langsir)}</td>
                          <td className="right">{idr.format(part.work)}</td>
                          <td className="right">{idr.format(part.other)}</td>
                          <td className="right out">{idr.format(run.deductions)}</td>
                          <td className="right money">{idr.format(run.netPay)}</td>
                          <td>
                            <span className={`pill ${run.status === 'PAID' ? 'in' : 'out'}`}>{run.status === 'PAID' ? 'LUNAS' : 'BELUM BAYAR'}</span>
                            {run.paymentDate && <small className="table-note">{run.paymentDate}</small>}
                          </td>
                          <td className="right">
                            <div className="action-group">
                              <button className="icon-btn" type="button" onClick={() => setSlipRunId(run.id)} title="Slip Gaji"><ReceiptText size={15} /></button>
                              {allowed && (run.status === 'OPEN'
                                ? <button className="icon-btn danger" type="button" onClick={() => deleteRun(run)} title="Batalkan proses"><Trash2 size={15} /></button>
                                : <button className="icon-btn" type="button" onClick={() => cancelPayment(run)} title="Batalkan pembayaran"><Undo2 size={15} /></button>)}
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
          {slipRun && (
            <PayrollSlip
              run={slipRun}
              allRuns={data.payrollRuns}
              receivables={data.employeeReceivables}
              kebun={data.kebun}
              accounts={data.accounts}
              workspaceName={data.workspace.name}
              onClose={() => setSlipRunId('')}
            />
          )}
        </>
      )}

      {mode === 'manual' && (
        <div className={`grid-form-list ${allowed ? '' : 'readonly'}`}>
          <section className="panel form-panel">
            <div className="panel-head">
              <div><h3>{manualEditId ? 'Edit Komponen Payroll' : 'Tambah Komponen Payroll'}</h3><p>Untuk tambahan atau potongan di luar sumber pekerjaan otomatis.</p></div>
              {manualEditId && <button className="text-btn" type="button" onClick={() => { setManualEditId(''); setManualForm({ date: today(), workerId: '', kebunId: '', kind: 'EARNING', category: 'Upah Harian', amount: '', note: '' }); }}>Batal</button>}
            </div>
            {!allowed ? (
              <div className="notice">Role Anda hanya dapat melihat komponen Payroll.</div>
            ) : (
              <form className="form" onSubmit={saveManual}>
                <label className="field"><span>Tanggal</span><input type="date" value={manualForm.date} onChange={event => setManualForm(value => ({ ...value, date: event.target.value }))} /></label>
                <label className="field"><span>Tenaga Kerja</span><select value={manualForm.workerId} onChange={event => setManualForm(value => ({ ...value, workerId: event.target.value }))}><option value="">Pilih tenaga kerja</option>{data.harvesters.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>
                <label className="field"><span>Kebun</span><select value={manualForm.kebunId} onChange={event => setManualForm(value => ({ ...value, kebunId: event.target.value }))}><option value="">Pilih kebun</option>{data.kebun.map(item => <option key={item.id} value={item.id}>{item.code} - {item.name}</option>)}</select></label>
                <div className="row-2">
                  <label className="field"><span>Jenis</span><select value={manualForm.kind} onChange={event => setManualForm(value => ({ ...value, kind: event.target.value as 'EARNING' | 'DEDUCTION', category: event.target.value === 'DEDUCTION' ? 'Kasbon' : 'Upah Harian' }))}><option value="EARNING">Penghasilan / Tambahan</option><option value="DEDUCTION">Potongan</option></select></label>
                  <label className="field"><span>Kategori</span><select value={manualForm.category} onChange={event => setManualForm(value => ({ ...value, category: event.target.value }))}>{manualForm.kind === 'EARNING' ? <><option>Upah Harian</option><option>Premi / Bonus</option><option>Lembur</option><option>Tunjangan</option><option>Lainnya</option></> : <><option>Kasbon</option><option>Potongan Lain</option></>}</select></label>
                </div>
                <label className="field"><span>Nominal</span><input inputMode="numeric" value={formatMoneyInput(manualForm.amount)} onChange={event => setManualForm(value => ({ ...value, amount: event.target.value.replace(/[^0-9]/g, '') }))} placeholder="0" /></label>
                <label className="field"><span>Catatan</span><textarea rows={2} value={manualForm.note} onChange={event => setManualForm(value => ({ ...value, note: event.target.value }))} /></label>
                <button className="primary" disabled={saving}><Save size={16} /> {manualEditId ? 'Simpan Perubahan' : 'Tambah Komponen'}</button>
              </form>
            )}
          </section>
          <section className="panel">
            <div className="panel-head"><div><h3>Daftar Komponen Manual</h3><p>Komponen yang sudah masuk Payroll akan dikunci.</p></div></div>
            {manuals.length === 0 ? (
              <div className="empty"><span>Belum ada komponen manual.</span></div>
            ) : (
              <div className="table-wrap">
                <table className="payroll-table">
                  <thead><tr><th>Tanggal</th><th>Tenaga Kerja</th><th>Kebun</th><th>Kategori</th><th className="right">Nominal</th><th>Status</th><th></th></tr></thead>
                  <tbody>
                    {manuals.map(item => {
                      const locked = usedManualIds.has(item.id);
                      return (
                        <tr key={item.id}>
                          <td>{item.date}</td>
                          <td>{data.harvesters.find(row => row.id === item.workerId)?.name || '-'}</td>
                          <td>{data.kebun.find(row => row.id === item.kebunId)?.name || '-'}</td>
                          <td>{item.category}<small className="table-note">{item.kind === 'EARNING' ? 'Penghasilan' : 'Potongan'}</small></td>
                          <td className={`right money ${item.kind === 'DEDUCTION' ? 'out' : 'in'}`}>{idr.format(item.amount)}</td>
                          <td><span className={`pill ${locked ? 'transfer' : 'in'}`}>{locked ? 'TERPROSES' : 'TERBUKA'}</span></td>
                          <td className="right">{allowed && !locked && <div className="action-group"><button className="icon-btn" type="button" onClick={() => editManual(item)}><Pencil size={15} /></button><button className="icon-btn danger" type="button" onClick={() => deleteManual(item)}><Trash2 size={15} /></button></div>}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </div>
      )}

      {mode === 'workers' && (
        <div className={`grid-form-list ${workerAdmin ? '' : 'readonly'}`}>
          <section className="panel form-panel">
            <div className="panel-head">
              <div><h3>{workerEditId ? 'Edit Tenaga Kerja' : 'Master Tenaga Kerja'}</h3><p>Master yang sama dipakai untuk seluruh pekerjaan kebun.</p></div>
              {workerEditId && <button className="text-btn" type="button" onClick={() => { setWorkerEditId(''); setWorkerForm({ name: '', phone: '' }); }}>Batal</button>}
            </div>
            {!workerAdmin ? (
              <div className="notice">Owner/Admin Pusat yang dapat mengubah master tenaga kerja.</div>
            ) : (
              <form className="form" onSubmit={saveWorker}>
                <label className="field"><span>Nama</span><input value={workerForm.name} onChange={event => setWorkerForm(value => ({ ...value, name: event.target.value }))} /></label>
                <label className="field"><span>No. HP</span><input value={workerForm.phone} onChange={event => setWorkerForm(value => ({ ...value, phone: event.target.value }))} /></label>
                <button className="primary" disabled={saving}><Save size={16} /> {workerEditId ? 'Simpan Perubahan' : 'Tambah Tenaga Kerja'}</button>
              </form>
            )}
          </section>
          <section className="panel">
            <div className="panel-head"><div><h3>Daftar Tenaga Kerja</h3><p>{data.harvesters.length} tenaga kerja terdaftar.</p></div></div>
            <div className="master-list">
              {data.harvesters.map(worker => (
                <div className="master-row" key={worker.id}>
                  <div><strong>{worker.name}</strong><span>{worker.phone || 'No. HP belum diisi'}</span></div>
                  {workerAdmin && <><button className="icon-btn" type="button" onClick={() => { setWorkerEditId(worker.id); setWorkerForm({ name: worker.name, phone: worker.phone || '' }); window.scrollTo({ top: 0, behavior: 'smooth' }); }}><Pencil size={15} /></button><button className="icon-btn danger" type="button" onClick={() => deleteWorker(worker)}><Trash2 size={15} /></button></>}
                </div>
              ))}
            </div>
          </section>
        </div>
      )}
    </div>
  );
}
