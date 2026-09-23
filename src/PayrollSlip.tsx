import { useRef } from 'react';
import { Printer, X } from 'lucide-react';

type Kebun = { id: string; code: string; name: string };
type Account = { id: string; name: string; type: 'KAS' | 'BANK' };
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
  createdAt: string;
};
type Props = {
  run: PayrollRun;
  allRuns: PayrollRun[];
  receivables: EmployeeReceivable[];
  kebun: Kebun[];
  accounts: Account[];
  workspaceName?: string;
  onClose: () => void;
};

type LineGroup = { label: string; lines: PayrollLine[]; total: number };

type DebtLine = {
  receivable: EmployeeReceivable;
  amountThisRun: number;
  progress: ReturnType<typeof debtProgress>;
};

type CompactRow = {
  key: string;
  category: string;
  label: string;
  location: string;
  count: number;
  total: number;
  doNumbers: string[];
};

const idr = new Intl.NumberFormat('id-ID', {
  style: 'currency',
  currency: 'IDR',
  maximumFractionDigits: 0,
});

function earningGroupLabel(line: PayrollLine) {
  if (line.sourceType === 'TBS_PANEN') return 'Upah Panen';
  if (line.sourceType === 'TBS_TIMBANG') return 'Upah Timbang';
  if (line.sourceType === 'TBS_LANGSIR') return 'Upah Langsir';
  if (line.sourceType === 'KEBUN_WORK') return 'Pekerjaan Kebun';
  return 'Tambahan / Pendapatan Lain';
}

function deductionGroupLabel(line: PayrollLine) {
  if (line.sourceType === 'EMPLOYEE_RECEIVABLE') return 'Piutang Karyawan';
  return line.label || 'Potongan Lain';
}

function groupLines(lines: PayrollLine[], labeler: (line: PayrollLine) => string) {
  const map = new Map<string, PayrollLine[]>();
  lines.forEach(line => {
    const label = labeler(line);
    map.set(label, [...(map.get(label) || []), line]);
  });
  return Array.from(map.entries()).map(([label, groupedLines]): LineGroup => ({
    label,
    lines: groupedLines,
    total: groupedLines.reduce((sum, line) => sum + line.amount, 0),
  }));
}

function plannedInstallments(total: number, countValue: number) {
  const count = Math.max(1, Math.floor(countValue || 1));
  const base = Math.floor(total / count);
  const rows = Array.from({ length: count }, () => base);
  rows[count - 1] += total - base * count;
  return rows;
}

function runsThrough(target: PayrollRun, allRuns: PayrollRun[]) {
  return allRuns
    .filter(run => run.createdAt < target.createdAt || run.id === target.id)
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
}

function debtProgress(receivable: EmployeeReceivable, target: PayrollRun, allRuns: PayrollRun[]) {
  const relevantRuns = runsThrough(target, allRuns);
  const cutRuns = relevantRuns.filter(run => run.lines.some(line => line.sourceType === 'EMPLOYEE_RECEIVABLE' && line.sourceId === receivable.id && line.amount > 0));
  const deducted = relevantRuns.flatMap(run => run.lines)
    .filter(line => line.sourceType === 'EMPLOYEE_RECEIVABLE' && line.sourceId === receivable.id)
    .reduce((sum, line) => sum + line.amount, 0);
  let applied = Math.min(receivable.totalAmount, deducted);
  const installments = plannedInstallments(receivable.totalAmount, receivable.installmentCount).map(planned => {
    const paid = Math.min(planned, applied);
    applied -= paid;
    return { planned, paid, remaining: planned - paid };
  });
  return {
    deducted: Math.min(receivable.totalAmount, deducted),
    outstanding: Math.max(0, receivable.totalAmount - deducted),
    cutCount: cutRuns.length,
    remainingCuts: installments.filter(item => item.remaining > 0).length,
  };
}

function kebunName(kebun: Kebun[], id: string) {
  const item = kebun.find(row => row.id === id);
  return item ? `${item.code} - ${item.name}` : 'Kebun tidak tersedia';
}

function compactRows(lines: PayrollLine[], kebun: Kebun[], kind: 'EARNING' | 'DEDUCTION') {
  const rows = new Map<string, CompactRow>();
  lines.filter(line => line.kind === kind).forEach(line => {
    const category = kind === 'EARNING' ? earningGroupLabel(line) : deductionGroupLabel(line);
    const label = line.sourceType === 'EMPLOYEE_RECEIVABLE'
      ? line.label.replace(/^Piutang Karyawan\s*·\s*/, '')
      : line.sourceType === 'KEBUN_WORK' || line.sourceType === 'MANUAL'
        ? line.label
        : category;
    const location = line.sourceType === 'EMPLOYEE_RECEIVABLE' ? '-' : kebunName(kebun, line.kebunId);
    const key = `${category}|${label}|${location}`;
    const current = rows.get(key) || { key, category, label, location, count: 0, total: 0, doNumbers: [] };
    current.count += 1;
    current.total += line.amount;
    if (line.doNumber && !current.doNumbers.includes(line.doNumber)) current.doNumbers.push(line.doNumber);
    rows.set(key, current);
  });
  return Array.from(rows.values());
}

export default function PayrollSlip({ run, allRuns, receivables, kebun, accounts, workspaceName, onClose }: Props) {
  const earnings = groupLines(run.lines.filter(line => line.kind === 'EARNING'), earningGroupLabel);
  const deductions = groupLines(run.lines.filter(line => line.kind === 'DEDUCTION'), deductionGroupLabel);
  const workerDebts = receivables.filter(item => item.workerId === run.workerId && item.date <= run.periodEnd);
  const globalDebtProgress = workerDebts.map(item => ({ item, progress: debtProgress(item, run, allRuns) }));
  const globalOutstanding = globalDebtProgress.reduce((sum, row) => sum + row.progress.outstanding, 0);
  const globalRemainingCuts = globalDebtProgress.reduce((sum, row) => sum + row.progress.remainingCuts, 0);
  const debtLines = Array.from(new Set(run.lines.filter(line => line.sourceType === 'EMPLOYEE_RECEIVABLE').map(line => line.sourceId)))
    .map(receivableId => {
      const receivable = receivables.find(item => item.id === receivableId);
      if (!receivable) return null;
      const amountThisRun = run.lines
        .filter(line => line.sourceType === 'EMPLOYEE_RECEIVABLE' && line.sourceId === receivableId)
        .reduce((sum, line) => sum + line.amount, 0);
      return { receivable, amountThisRun, progress: debtProgress(receivable, run, allRuns) };
    })
    .filter((item): item is DebtLine => item !== null);
  const paymentAccount = accounts.find(item => item.id === run.accountId);
  const compactEarnings = compactRows(run.lines, kebun, 'EARNING');
  const compactDeductions = compactRows(run.lines, kebun, 'DEDUCTION');
  const printDebtRows = globalDebtProgress
    .map(({ item, progress }) => ({
      receivable: item,
      progress,
      amountThisRun: run.lines
        .filter(line => line.sourceType === 'EMPLOYEE_RECEIVABLE' && line.sourceId === item.id)
        .reduce((sum, line) => sum + line.amount, 0),
    }))
    .filter(row => row.progress.outstanding > 0 || row.amountThisRun > 0);
  const sheetRef = useRef<HTMLElement>(null);

  const printSlip = () => {
    const sheet = sheetRef.current;
    if (!sheet) {
      window.print();
      return;
    }
    const printableWidthMm = 198;
    const printableHeightPx = (297 - 12) * (96 / 25.4);
    const cleanup = () => {
      sheet.classList.remove('print-prep');
      sheet.style.removeProperty('--payroll-print-zoom');
      sheet.style.removeProperty('--payroll-print-width');
      window.removeEventListener('afterprint', cleanup);
    };
    sheet.classList.add('print-prep');
    sheet.style.setProperty('--payroll-print-zoom', '1');
    sheet.style.setProperty('--payroll-print-width', `${printableWidthMm}mm`);
    requestAnimationFrame(() => {
      const measuredHeight = Math.max(1, sheet.scrollHeight);
      const zoom = Math.min(1, (printableHeightPx / measuredHeight) * 0.98);
      const safeZoom = Math.max(0.1, zoom);
      sheet.style.setProperty('--payroll-print-zoom', String(safeZoom));
      sheet.style.setProperty('--payroll-print-width', `${printableWidthMm / safeZoom}mm`);
      window.addEventListener('afterprint', cleanup, { once: true });
      requestAnimationFrame(() => window.print());
    });
  };

  return (
    <div className="payroll-slip-backdrop" role="dialog" aria-modal="true" aria-label={`Slip gaji ${run.workerName}`}>
      <div className="payroll-slip">
        <div className="payroll-slip-toolbar no-print">
          <div><strong>Slip Gaji · {run.workerName}</strong><span>{run.payrollNumber}</span></div>
          <div className="action-group">
            <button className="secondary small-btn" type="button" onClick={printSlip}><Printer size={15} /> Cetak Slip</button>
            <button className="icon-btn" type="button" onClick={onClose} title="Tutup"><X size={17} /></button>
          </div>
        </div>

        <article className="payroll-slip-sheet" ref={sheetRef}>
          <header className="payroll-slip-header">
            <div><span>SLIP GAJI</span><h2>{workspaceName || 'Administrasi Perkebunan'}</h2><p>Payroll tenaga kerja kebun</p></div>
            <div><b>{run.payrollNumber}</b><span>Periode {run.periodStart} s.d. {run.periodEnd}</span></div>
          </header>

          <div className="payroll-slip-meta">
            <div><span>Nama Pekerja</span><strong>{run.workerName}</strong></div>
            <div><span>Status</span><strong>{run.status === 'PAID' ? 'LUNAS' : 'BELUM DIBAYAR'}</strong></div>
            <div><span>Tanggal Bayar</span><strong>{run.paymentDate || '-'}</strong></div>
            <div><span>Kas / Bank</span><strong>{paymentAccount?.name || '-'}</strong></div>
          </div>

          <section className="payroll-slip-section screen-only">
            <div className="payroll-slip-section-title"><h3>Komponen Pendapatan</h3><strong>{idr.format(run.grossEarnings)}</strong></div>
            {earnings.map(group => (
              <div className="payroll-slip-group" key={group.label}>
                <div className="payroll-slip-group-head"><strong>{group.label}</strong><b>{idr.format(group.total)}</b></div>
                {group.lines.map(line => (
                  <div className="payroll-slip-line" key={line.sourceKey}>
                    <div><b>{line.label}</b><span>{line.date} · {kebunName(kebun, line.kebunId)}{line.doNumber ? ` · DO ${line.doNumber}` : ''}</span></div>
                    <strong>{idr.format(line.amount)}</strong>
                  </div>
                ))}
              </div>
            ))}
          </section>

          <section className="payroll-slip-section screen-only">
            <div className="payroll-slip-section-title"><h3>Komponen Potongan</h3><strong>- {idr.format(run.deductions)}</strong></div>
            {deductions.length === 0 ? <p className="payroll-slip-empty">Tidak ada potongan pada periode ini.</p> : deductions.map(group => (
              <div className="payroll-slip-group" key={group.label}>
                <div className="payroll-slip-group-head"><strong>{group.label}</strong><b>- {idr.format(group.total)}</b></div>
                {group.lines.map(line => (
                  <div className="payroll-slip-line" key={line.sourceKey}>
                    <div><b>{line.label}</b><span>{line.sourceType === 'EMPLOYEE_RECEIVABLE' ? 'Potongan Piutang Karyawan' : `${line.date} · ${kebunName(kebun, line.kebunId)}`}</span></div>
                    <strong>- {idr.format(line.amount)}</strong>
                  </div>
                ))}
              </div>
            ))}
          </section>

          {workerDebts.length > 0 && (
            <section className="payroll-slip-section payroll-slip-debt-section screen-only">
              <div className="payroll-slip-section-title"><h3>Piutang Karyawan</h3><span>Posisi setelah Payroll ini</span></div>
              {debtLines.length === 0 && <p className="payroll-slip-empty">Tidak ada potongan piutang pada Payroll ini, tetapi saldo piutang aktif tetap ditampilkan pada ringkasan global.</p>}
              {debtLines.map(({ receivable, amountThisRun, progress }) => (
                <div className="payroll-slip-debt" key={receivable.id}>
                  <div><strong>{receivable.description}</strong><span>Potongan ke-{progress.cutCount} · rencana awal {receivable.installmentCount}x</span></div>
                  <div><span>Dipotong Payroll ini</span><b>{idr.format(amountThisRun)}</b></div>
                  <div><span>Sisa Piutang</span><b>{idr.format(progress.outstanding)}</b></div>
                  <div><span>Sisa Rencana Bayar</span><b>{progress.remainingCuts}x</b></div>
                </div>
              ))}
              <div className="payroll-slip-debt-global">
                <div><span>Total Sisa Piutang Karyawan</span><strong>{idr.format(globalOutstanding)}</strong></div>
                <div><span>Sisa Rencana Potong Global</span><strong>{globalRemainingCuts}x bayar</strong></div>
              </div>
            </section>
          )}

          <div className="payroll-slip-print-compact print-only">
            <section>
              <div className="payroll-slip-section-title"><h3>Komponen Pendapatan · Detail per Kebun</h3><strong>{idr.format(run.grossEarnings)}</strong></div>
              <table className="payroll-slip-compact-table">
                <thead><tr><th>Komponen</th><th>Kebun</th><th>Detail</th><th>Nominal</th></tr></thead>
                <tbody>{compactEarnings.map(row => <tr key={row.key}><td><strong>{row.label}</strong>{row.category !== row.label && <span>{row.category}</span>}</td><td>{row.location}</td><td>{row.count} transaksi{row.doNumbers.length > 0 && <span> · DO {row.doNumbers.slice(0, 3).join(', ')}{row.doNumbers.length > 3 ? ` +${row.doNumbers.length - 3}` : ''}</span>}</td><td>{idr.format(row.total)}</td></tr>)}</tbody>
              </table>
            </section>

            <section>
              <div className="payroll-slip-section-title"><h3>Komponen Potongan</h3><strong>- {idr.format(run.deductions)}</strong></div>
              {compactDeductions.length === 0 ? <p className="payroll-slip-empty">Tidak ada potongan pada periode ini.</p> : <table className="payroll-slip-compact-table"><thead><tr><th>Potongan</th><th>Kebun</th><th>Detail</th><th>Nominal</th></tr></thead><tbody>{compactDeductions.map(row => <tr key={row.key}><td><strong>{row.label}</strong>{row.category !== row.label && <span>{row.category}</span>}</td><td>{row.location}</td><td>{row.count} transaksi</td><td>- {idr.format(row.total)}</td></tr>)}</tbody></table>}
            </section>

            {printDebtRows.length > 0 && <section className="payroll-slip-print-debt">
              <div className="payroll-slip-section-title"><h3>Piutang Karyawan</h3><span>Posisi setelah Payroll ini</span></div>
              {printDebtRows.map(({ receivable, progress, amountThisRun }) => <div className="payroll-slip-print-debt-row" key={receivable.id}><div><strong>{receivable.description}</strong><span>Potongan ke-{progress.cutCount} dari rencana {receivable.installmentCount}x</span></div><div><span>Payroll ini</span><b>{idr.format(amountThisRun)}</b></div><div><span>Sisa</span><b>{idr.format(progress.outstanding)}</b></div><div><span>Sisa bayar</span><b>{progress.remainingCuts}x</b></div></div>)}
              <div className="payroll-slip-print-debt-global"><span>Total sisa piutang <strong>{idr.format(globalOutstanding)}</strong></span><span>Sisa rencana potong <strong>{globalRemainingCuts}x bayar</strong></span></div>
            </section>}
          </div>

          <div className="payroll-slip-summary">
            <div><span>Total Pendapatan</span><strong>{idr.format(run.grossEarnings)}</strong></div>
            <div><span>Total Potongan</span><strong>- {idr.format(run.deductions)}</strong></div>
            <div className="take-home"><span>Take Home Pay</span><strong>{idr.format(run.netPay)}</strong></div>
          </div>

          {run.reference && <div className="payroll-slip-note"><span>Referensi Pembayaran</span><strong>{run.reference}</strong></div>}
          {run.note && <div className="payroll-slip-note"><span>Catatan</span><strong>{run.note}</strong></div>}
          <footer className="payroll-slip-footer">Slip ini dibuat dari data Payroll Administrasi Perkebunan.</footer>
        </article>
      </div>
    </div>
  );
}
