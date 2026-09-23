import { useEffect, useMemo, useState } from 'react';
import { api } from './lib/client';
import {
  buildAutomaticJournals,
  type AccountingAccount,
  type AccountingData,
  type AccountingGroup,
  type JournalEntry,
  type JournalLine,
  type ManualJournal,
  type PurchaseInvoice,
  type InventoryUsage,
} from './AccountingModule';

type Mode = 'income' | 'balance';
type Foundation = {
  settings?: { fiscalYearStartMonth: number; conversionDate: string; setupComplete: boolean } | null;
  opening?: {
    cutoffDate: string;
    status: 'DRAFT' | 'POSTED';
    postedLines?: Array<{ accountId: string; debit: number; credit: number; note?: string; kebunId?: string }>;
  } | null;
};
type Props = { data: AccountingData; mode: Mode };

type ValueMap = Map<string, number>;

const idr = new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 });
const monthFormatter = new Intl.DateTimeFormat('id-ID', { month: 'short', year: 'numeric', timeZone: 'UTC' });

function todayMonth() {
  return new Date().toISOString().slice(0, 7);
}
function monthEnd(month: string) {
  const [year, monthNumber] = month.split('-').map(Number);
  return new Date(Date.UTC(year, monthNumber, 0)).toISOString().slice(0, 10);
}
function previousMonth(month: string) {
  const [year, monthNumber] = month.split('-').map(Number);
  return new Date(Date.UTC(year, monthNumber - 2, 1)).toISOString().slice(0, 7);
}
function monthLabel(month: string) {
  return monthFormatter.format(new Date(`${month}-01T00:00:00Z`));
}
function fiscalStart(month: string, startMonth: number) {
  const [year, monthNumber] = month.split('-').map(Number);
  const startYear = monthNumber >= startMonth ? year : year - 1;
  return `${startYear}-${String(startMonth).padStart(2, '0')}-01`;
}
function posting(account: AccountingAccount) {
  return account.active !== false && (account.level ?? 4) === 4 && account.posting !== false;
}
function accountAmount(account: AccountingAccount, line: JournalLine) {
  return account.normalBalance === 'DEBIT' ? line.debit - line.credit : line.credit - line.debit;
}
function sumMap(values: ValueMap, accounts: AccountingAccount[], group: AccountingGroup) {
  return accounts.filter(account => posting(account) && account.group === group).reduce((sum, account) => sum + (values.get(account.id) || 0), 0);
}

export default function FinancialStatements({ data, mode }: Props) {
  const [accounts, setAccounts] = useState<AccountingAccount[]>([]);
  const [systemAccountIds, setSystemAccountIds] = useState<Record<string, string>>({});
  const [manualJournals, setManualJournals] = useState<ManualJournal[]>([]);
  const [invoices, setInvoices] = useState<PurchaseInvoice[]>([]);
  const [inventoryUsages, setInventoryUsages] = useState<InventoryUsage[]>([]);
  const [foundation, setFoundation] = useState<Foundation>({});
  const [month, setMonth] = useState(todayMonth());
  const [compareMonth, setCompareMonth] = useState(previousMonth(todayMonth()));
  const [incomeBasis, setIncomeBasis] = useState<'MONTH' | 'YTD'>('YTD');
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState('');
  // v87-hide-zero-financial-lines
  const [hideZeroRows, setHideZeroRows] = useState(true);

  useEffect(() => {
    const load = async () => {
      try {
        setLoading(true);
        const [accountRes, journalRes, invoiceRes, usageRes, foundationRes] = await Promise.all([
          api.get('/api/accounting/accounts'),
          api.get('/api/accounting/manual-journals'),
          api.get('/api/purchase-invoices'),
          api.get('/api/inventory-usages'),
          api.get('/api/accounting/foundation'),
        ]);
        const accountPayload = accountRes.data as { accounts?: AccountingAccount[]; systemMappings?: Record<string, string> };
        setAccounts(accountPayload.accounts || []);
        setSystemAccountIds(accountPayload.systemMappings || {});
        setManualJournals((journalRes.data as { journals?: ManualJournal[] }).journals || []);
        setInvoices((invoiceRes.data as { invoices?: PurchaseInvoice[] }).invoices || []);
        setInventoryUsages((usageRes.data as { usages?: InventoryUsage[] }).usages || []);
        setFoundation(foundationRes.data as Foundation);
        setErrorMessage('');
      } catch {
        setErrorMessage('Laporan keuangan belum dapat dimuat. Coba muat ulang halaman.');
      } finally {
        setLoading(false);
      }
    };
    void load();
  }, [data.workspace.id]);

  const accountMap = useMemo(() => new Map(accounts.map(account => [account.id, account])), [accounts]);
  const journals = useMemo<JournalEntry[]>(() => {
    const opening = foundation.opening;
    const cutoff = opening?.status === 'POSTED' ? opening.cutoffDate : '';
    const automatic = buildAutomaticJournals(data, accounts, invoices, systemAccountIds, inventoryUsages).filter(journal => !cutoff || journal.date > cutoff);
    const openingJournal: JournalEntry[] = opening?.status === 'POSTED' && opening.postedLines?.length ? [{
      id: 'OPENING-BALANCE',
      journalNumber: `OPENING-${opening.cutoffDate}`,
      date: opening.cutoffDate,
      description: 'Saldo Awal / Opening Balance',
      reference: 'MIGRASI',
      source: 'OPENING',
      auto: true,
      lines: opening.postedLines.map(line => ({ accountId: line.accountId, kebunId: line.kebunId || '', debit: line.debit, credit: line.credit, memo: line.note || 'Saldo Awal' })),
    }] : [];
    const manual = manualJournals.filter(journal => !cutoff || journal.date > cutoff).map<JournalEntry>(journal => ({ ...journal, source: 'MANUAL', auto: false }));
    return [...openingJournal, ...automatic, ...manual].sort((a, b) => `${a.date}${a.journalNumber}`.localeCompare(`${b.date}${b.journalNumber}`));
  }, [accounts, systemAccountIds, data, foundation.opening, invoices, inventoryUsages, manualJournals]);

  const valuesBetween = (startDate: string, endDate: string) => {
    const values: ValueMap = new Map();
    for (const journal of journals) {
      if (journal.date < startDate || journal.date > endDate) continue;
      for (const line of journal.lines) {
        const account = accountMap.get(line.accountId);
        if (!account || !posting(account) || !['REVENUE', 'EXPENSE'].includes(account.group)) continue;
        const amount = account.group === 'REVENUE' ? line.credit - line.debit : line.debit - line.credit;
        values.set(account.id, (values.get(account.id) || 0) + amount);
      }
    }
    return values;
  };
  const balancesAt = (endDate: string) => {
    const values: ValueMap = new Map();
    for (const journal of journals) {
      if (journal.date > endDate) continue;
      for (const line of journal.lines) {
        const account = accountMap.get(line.accountId);
        if (!account || !posting(account)) continue;
        values.set(account.id, (values.get(account.id) || 0) + accountAmount(account, line));
      }
    }
    return values;
  };

  const startMonth = foundation.settings?.fiscalYearStartMonth || 1;
  const currentEnd = monthEnd(month);
  const compareEnd = monthEnd(compareMonth);
  const currentStart = incomeBasis === 'MONTH' ? `${month}-01` : fiscalStart(month, startMonth);
  const compareStart = incomeBasis === 'MONTH' ? `${compareMonth}-01` : fiscalStart(compareMonth, startMonth);
  const incomeCurrent = valuesBetween(currentStart, currentEnd);
  const incomeCompare = valuesBetween(compareStart, compareEnd);
  const balanceCurrent = balancesAt(currentEnd);
  const balanceCompare = balancesAt(compareEnd);
  const currentFiscalIncome = valuesBetween(fiscalStart(month, startMonth), currentEnd);
  const compareFiscalIncome = valuesBetween(fiscalStart(compareMonth, startMonth), compareEnd);

  const currentRevenue = sumMap(incomeCurrent, accounts, 'REVENUE');
  const currentExpense = sumMap(incomeCurrent, accounts, 'EXPENSE');
  const compareRevenue = sumMap(incomeCompare, accounts, 'REVENUE');
  const compareExpense = sumMap(incomeCompare, accounts, 'EXPENSE');
  const currentProfit = currentRevenue - currentExpense;
  const compareProfit = compareRevenue - compareExpense;
  const currentBalanceProfit = sumMap(currentFiscalIncome, accounts, 'REVENUE') - sumMap(currentFiscalIncome, accounts, 'EXPENSE');
  const compareBalanceProfit = sumMap(compareFiscalIncome, accounts, 'REVENUE') - sumMap(compareFiscalIncome, accounts, 'EXPENSE');

  const groupTotals = (values: ValueMap, group: AccountingGroup) => sumMap(values, accounts, group);
  const currentAssets = groupTotals(balanceCurrent, 'ASSET');
  const compareAssets = groupTotals(balanceCompare, 'ASSET');
  const currentLiabilities = groupTotals(balanceCurrent, 'LIABILITY');
  const compareLiabilities = groupTotals(balanceCompare, 'LIABILITY');
  const currentEquityLedger = groupTotals(balanceCurrent, 'EQUITY');
  const compareEquityLedger = groupTotals(balanceCompare, 'EQUITY');
  const currentEquity = currentEquityLedger + currentBalanceProfit;
  const compareEquity = compareEquityLedger + compareBalanceProfit;
  const currentRightSide = currentLiabilities + currentEquity;
  const compareRightSide = compareLiabilities + compareEquity;
  const currentBalanced = Math.abs(currentAssets - currentRightSide) < 1;
  const compareBalanced = Math.abs(compareAssets - compareRightSide) < 1;

  const isVisibleAmount = (currentValue: number, compareValue: number) => !hideZeroRows || Math.abs(currentValue) >= 0.5 || Math.abs(compareValue) >= 0.5;

  const renderGroup = (group: AccountingGroup, title: string, current: ValueMap, compare: ValueMap) => {
    const level2Rows = accounts.filter(account => account.active !== false && account.group === group && account.level === 2).sort((a, b) => a.code.localeCompare(b.code));
    const renderedLevel2 = level2Rows.map(level2 => {
      const level3Rows = accounts.filter(account => account.active !== false && account.parentId === level2.id && account.level === 3).sort((a, b) => a.code.localeCompare(b.code));
      const renderedLevel3 = level3Rows.map(level3 => {
        const leaves = accounts.filter(account => posting(account) && account.parentId === level3.id).sort((a, b) => a.code.localeCompare(b.code));
        const currentLevel3 = leaves.reduce((sum, account) => sum + (current.get(account.id) || 0), 0);
        const compareLevel3 = leaves.reduce((sum, account) => sum + (compare.get(account.id) || 0), 0);
        const visibleLeaves = leaves.filter(account => isVisibleAmount(current.get(account.id) || 0, compare.get(account.id) || 0));
        if (hideZeroRows && visibleLeaves.length === 0 && !isVisibleAmount(currentLevel3, compareLevel3)) return null;
        return <div key={level3.id}>
          <div className="fs-row fs-level3"><span>{level3.code} · {level3.name}</span><strong>{idr.format(currentLevel3)}</strong><strong>{idr.format(compareLevel3)}</strong></div>
          {visibleLeaves.map(account => <div className="fs-row fs-level4" key={account.id}><span><b>{account.code}</b> {account.name}</span><span>{idr.format(current.get(account.id) || 0)}</span><span>{idr.format(compare.get(account.id) || 0)}</span></div>)}
        </div>;
      }).filter(Boolean);
      const level2Leaves = level3Rows.flatMap(level3 => accounts.filter(account => posting(account) && account.parentId === level3.id));
      const currentLevel2 = level2Leaves.reduce((sum, account) => sum + (current.get(account.id) || 0), 0);
      const compareLevel2 = level2Leaves.reduce((sum, account) => sum + (compare.get(account.id) || 0), 0);
      if (hideZeroRows && renderedLevel3.length === 0 && !isVisibleAmount(currentLevel2, compareLevel2)) return null;
      return <div className="fs-level2" key={level2.id}>
        <div className="fs-row fs-subtitle"><span>{level2.code} · {level2.name}</span><strong>{idr.format(currentLevel2)}</strong><strong>{idr.format(compareLevel2)}</strong></div>
        {renderedLevel3}
      </div>;
    }).filter(Boolean);
    return <div className="fs-group">
      <div className="fs-group-title"><strong>{title}</strong><span>{idr.format(sumMap(current, accounts, group))}</span><span>{idr.format(sumMap(compare, accounts, group))}</span></div>
      {renderedLevel2}
    </div>;
  };

  if (loading) return <section className="panel"><div className="empty"><span>Menyiapkan laporan keuangan...</span></div></section>;
  if (errorMessage) return <section className="panel"><div className="inline-error">{errorMessage}</div></section>;
  if (accounts.length === 0) return <section className="panel"><div className="empty"><span>COA masih kosong. Terapkan atau susun COA terlebih dahulu di Akuntansi → COA & Setup.</span></div></section>;

  const cutoff = foundation.opening?.status === 'POSTED' ? foundation.opening.cutoffDate : '';
  const comparisonBeforeCutoff = Boolean(cutoff && compareEnd <= cutoff);

  return <section className="panel financial-statement">
    <div className="panel-head wrap">
      <div>
        <span className="eyebrow dark">Laporan Keuangan</span>
        <h3>{mode === 'income' ? 'Laba Rugi Standar' : 'Neraca'}</h3>
        <p>{mode === 'income' ? 'Disusun dari akun Pendapatan dan Beban pada jurnal double-entry.' : 'Disusun dari saldo Aset, Liabilitas, dan Ekuitas sampai akhir periode.'}</p>
      </div>
      <div className="filters">
        <label className="fs-filter"><span>Periode</span><input type="month" value={month} onChange={event => setMonth(event.target.value)} /></label>
        <label className="fs-filter"><span>Pembanding</span><input type="month" value={compareMonth} onChange={event => setCompareMonth(event.target.value)} /></label>
        <label className="fs-zero-toggle"><input type="checkbox" checked={hideZeroRows} onChange={event => setHideZeroRows(event.target.checked)} /><span>Sembunyikan akun Rp0</span></label>
        {mode === 'income' && <label className="fs-filter"><span>Cakupan</span><select value={incomeBasis} onChange={event => setIncomeBasis(event.target.value as 'MONTH' | 'YTD')}><option value="YTD">YTD Tahun Buku</option><option value="MONTH">Bulanan</option></select></label>}
      </div>
    </div>
    <div className="fs-period-head"><span>Akun</span><strong>{monthLabel(month)}</strong><strong>{monthLabel(compareMonth)}</strong></div>
    {comparisonBeforeCutoff && <div className="notice">Periode pembanding berada sebelum/hingga cut-off {cutoff}. Detail transaksi historis sebelum cut-off tidak dihitung ulang; laporan pascamigrasi dimulai dari Saldo Awal.</div>}
    {mode === 'income' ? <>
      <div className="report-summary fs-summary"><div><span>Pendapatan</span><strong>{idr.format(currentRevenue)}</strong></div><div><span>Beban</span><strong>{idr.format(currentExpense)}</strong></div><div><span>Laba (Rugi)</span><strong>{idr.format(currentProfit)}</strong></div><div><span>Total Penghasilan Komprehensif</span><strong>{idr.format(currentProfit)}</strong></div></div>
      <div className="fs-body">
        {renderGroup('REVENUE', 'PENDAPATAN', incomeCurrent, incomeCompare)}
        <div className="fs-total"><span>TOTAL PENDAPATAN</span><strong>{idr.format(currentRevenue)}</strong><strong>{idr.format(compareRevenue)}</strong></div>
        {renderGroup('EXPENSE', 'BEBAN', incomeCurrent, incomeCompare)}
        <div className="fs-total"><span>TOTAL BEBAN</span><strong>{idr.format(currentExpense)}</strong><strong>{idr.format(compareExpense)}</strong></div>
        <div className="fs-grand"><span>LABA (RUGI) PERIODE</span><strong>{idr.format(currentProfit)}</strong><strong>{idr.format(compareProfit)}</strong></div>
        <div className="fs-row fs-oci"><span>Penghasilan Komprehensif Lain <small>Belum ada klasifikasi OCI khusus pada COA</small></span><span>{idr.format(0)}</span><span>{idr.format(0)}</span></div>
        <div className="fs-grand"><span>TOTAL PENGHASILAN KOMPREHENSIF</span><strong>{idr.format(currentProfit)}</strong><strong>{idr.format(compareProfit)}</strong></div>
      </div>
    </> : <>
      <div className="report-summary fs-summary"><div><span>Total Aset</span><strong>{idr.format(currentAssets)}</strong></div><div><span>Total Liabilitas</span><strong>{idr.format(currentLiabilities)}</strong></div><div><span>Total Ekuitas</span><strong>{idr.format(currentEquity)}</strong></div><div><span>Status Neraca</span><strong className={currentBalanced ? 'in' : 'out'}>{currentBalanced ? 'SEIMBANG' : 'TIDAK SEIMBANG'}</strong></div></div>
      <div className="fs-body">
        {renderGroup('ASSET', 'ASET', balanceCurrent, balanceCompare)}
        <div className="fs-grand"><span>TOTAL ASET</span><strong>{idr.format(currentAssets)}</strong><strong>{idr.format(compareAssets)}</strong></div>
        {renderGroup('LIABILITY', 'LIABILITAS', balanceCurrent, balanceCompare)}
        <div className="fs-total"><span>TOTAL LIABILITAS</span><strong>{idr.format(currentLiabilities)}</strong><strong>{idr.format(compareLiabilities)}</strong></div>
        {renderGroup('EQUITY', 'EKUITAS', balanceCurrent, balanceCompare)}
        <div className="fs-row fs-derived"><span>Laba (Rugi) Belum Ditutup <small>Dihitung dari akun Pendapatan dan Beban tahun buku berjalan</small></span><strong>{idr.format(currentBalanceProfit)}</strong><strong>{idr.format(compareBalanceProfit)}</strong></div>
        <div className="fs-total"><span>TOTAL EKUITAS</span><strong>{idr.format(currentEquity)}</strong><strong>{idr.format(compareEquity)}</strong></div>
        <div className="fs-grand"><span>TOTAL LIABILITAS & EKUITAS</span><strong>{idr.format(currentRightSide)}</strong><strong>{idr.format(compareRightSide)}</strong></div>
        <div className="fs-balance-check"><span>Selisih Neraca</span><strong className={currentBalanced ? 'in' : 'out'}>{idr.format(currentAssets - currentRightSide)} · {currentBalanced ? 'SEIMBANG' : 'PERLU DIPERIKSA'}</strong><strong className={compareBalanced ? 'in' : 'out'}>{idr.format(compareAssets - (compareLiabilities + compareEquity))} · {compareBalanced ? 'SEIMBANG' : 'PERLU DIPERIKSA'}</strong></div>
      </div>
    </>}
    <div className="fs-footnote">Laporan ini merupakan output sistem berdasarkan COA dan jurnal yang tersedia. Penyesuaian, closing, pajak, OCI, serta pengungkapan/CaLK tetap mengikuti kebijakan akuntansi entitas dan SAK Indonesia yang berlaku.</div>
  </section>;
}
