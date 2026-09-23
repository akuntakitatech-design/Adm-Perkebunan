import { useEffect, useMemo, useState } from 'react';
import { api } from './lib/client';
import AccountSearchPicker from './AccountSearchPicker';
import {
  buildAutomaticJournals,
  type AccountingAccount,
  type AccountingData,
  type AccountingGroup,
  type InventoryUsage,
  type JournalEntry,
  type JournalLine,
  type ManualJournal,
  type PurchaseInvoice,
} from './AccountingModule';

export type AccountingReportMode = 'journals' | 'ledger' | 'trial';
type Props = { data: AccountingData; mode: AccountingReportMode };
type Foundation = { opening?: { cutoffDate: string; status: 'DRAFT' | 'POSTED'; postedLines?: JournalLine[] } | null };

const idr = new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 });
const groupLabels: Record<AccountingGroup, string> = { ASSET: 'Aset', LIABILITY: 'Liabilitas', EQUITY: 'Ekuitas', REVENUE: 'Pendapatan', EXPENSE: 'Beban' };
function todayMonth() { return new Date().toISOString().slice(0, 7); }
function monthEnd(month: string) { const [year, monthNumber] = month.split('-').map(Number); return new Date(Date.UTC(year, monthNumber, 0)).toISOString().slice(0, 10); }
function formatDate(value: string) { return new Intl.DateTimeFormat('id-ID', { day: '2-digit', month: 'short', year: 'numeric' }).format(new Date(`${value}T00:00:00`)); }

export default function AccountingReports({ data, mode }: Props) {
  // v89-report-grouping
  const [accounts, setAccounts] = useState<AccountingAccount[]>([]);
  const [systemAccountIds, setSystemAccountIds] = useState<Record<string, string>>({});
  const [manualJournals, setManualJournals] = useState<ManualJournal[]>([]);
  const [purchaseInvoices, setPurchaseInvoices] = useState<PurchaseInvoice[]>([]);
  const [inventoryUsages, setInventoryUsages] = useState<InventoryUsage[]>([]);
  const [openingBalance, setOpeningBalance] = useState<Foundation['opening']>(null);
  const [month, setMonth] = useState(todayMonth());
  const [sourceFilter, setSourceFilter] = useState<'ALL' | 'AUTO' | 'MANUAL'>('ALL');
  const [ledgerAccountId, setLedgerAccountId] = useState('');
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState('');

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
        const nextAccounts = accountPayload.accounts || [];
        setAccounts(nextAccounts);
        setSystemAccountIds(accountPayload.systemMappings || {});
        setManualJournals((journalRes.data as { journals?: ManualJournal[] }).journals || []);
        setPurchaseInvoices((invoiceRes.data as { invoices?: PurchaseInvoice[] }).invoices || []);
        setInventoryUsages((usageRes.data as { usages?: InventoryUsage[] }).usages || []);
        setOpeningBalance((foundationRes.data as Foundation).opening || null);
        const firstPosting = nextAccounts.find(item => item.active !== false && (item.level ?? 4) === 4 && item.posting !== false);
        setLedgerAccountId(current => current || firstPosting?.id || '');
        setErrorMessage('');
      } catch {
        setErrorMessage('Laporan akuntansi belum dapat dimuat. Coba muat ulang halaman.');
      } finally {
        setLoading(false);
      }
    };
    void load();
  }, [data.workspace.id]);

  const journals = useMemo<JournalEntry[]>(() => {
    const cutoff = openingBalance?.status === 'POSTED' ? openingBalance.cutoffDate : '';
    const automatic = buildAutomaticJournals(data, accounts, purchaseInvoices, systemAccountIds, inventoryUsages).filter(item => !cutoff || item.date > cutoff);
    const openingJournal: JournalEntry[] = openingBalance?.status === 'POSTED' && openingBalance.postedLines?.length ? [{
      id: 'OPENING-BALANCE', journalNumber: `OPENING-${openingBalance.cutoffDate}`, date: openingBalance.cutoffDate,
      description: 'Saldo Awal / Opening Balance', reference: 'MIGRASI', source: 'OPENING', auto: true,
      lines: openingBalance.postedLines.map(line => ({ ...line, kebunId: line.kebunId || '', memo: line.memo || 'Saldo Awal' })),
    }] : [];
    const manual = manualJournals.filter(item => !cutoff || item.date > cutoff).map<JournalEntry>(item => ({ ...item, source: item.sourceType === 'STOCKTAKE' ? 'STOCK OPNAME' : 'MANUAL', auto: item.sourceType === 'STOCKTAKE' }));
    return [...openingJournal, ...automatic, ...manual].sort((a, b) => `${a.date}${a.journalNumber}`.localeCompare(`${b.date}${b.journalNumber}`));
  }, [data, accounts, purchaseInvoices, systemAccountIds, inventoryUsages, openingBalance, manualJournals]);

  const accountMap = useMemo(() => new Map(accounts.map(item => [item.id, item])), [accounts]);
  const kebunName = (id: string) => data.kebun.find(item => item.id === id)?.name || (id ? '-' : 'Pusat / Umum');
  const monthRows = journals.filter(item => item.date.startsWith(month) && (sourceFilter === 'ALL' || (sourceFilter === 'AUTO' ? item.auto : !item.auto)));
  const totalJournalDebit = monthRows.flatMap(item => item.lines).reduce((sum, item) => sum + item.debit, 0);

  const ledgerAccount = accounts.find(item => item.id === ledgerAccountId);
  const ledgerStart = `${month}-01`;
  const accountDelta = (line: JournalLine, account: AccountingAccount) => account.normalBalance === 'DEBIT' ? line.debit - line.credit : line.credit - line.debit;
  const allLedgerLines = journals.flatMap(journal => journal.lines.filter(line => line.accountId === ledgerAccountId).map(line => ({ journal, line }))).sort((a, b) => `${a.journal.date}${a.journal.journalNumber}`.localeCompare(`${b.journal.date}${b.journal.journalNumber}`));
  let ledgerRunning = ledgerAccount ? allLedgerLines.filter(row => row.journal.date < ledgerStart).reduce((sum, row) => sum + accountDelta(row.line, ledgerAccount), 0) : 0;
  const ledgerOpening = ledgerRunning;
  const ledgerRows = ledgerAccount ? allLedgerLines.filter(row => row.journal.date.startsWith(month)).map(row => { ledgerRunning += accountDelta(row.line, ledgerAccount); return { ...row, balance: ledgerRunning }; }) : [];

  const cutoff = monthEnd(month);
  const trial = accounts.filter(item => item.active !== false && (item.level ?? 4) === 4 && item.posting !== false).map(account => {
    const lines = journals.filter(journal => journal.date <= cutoff).flatMap(journal => journal.lines.filter(line => line.accountId === account.id));
    const movementDebit = lines.reduce((sum, line) => sum + line.debit, 0);
    const movementCredit = lines.reduce((sum, line) => sum + line.credit, 0);
    const signed = account.normalBalance === 'DEBIT' ? movementDebit - movementCredit : movementCredit - movementDebit;
    const debitBalance = account.normalBalance === 'DEBIT' ? Math.max(0, signed) : Math.max(0, -signed);
    const creditBalance = account.normalBalance === 'CREDIT' ? Math.max(0, signed) : Math.max(0, -signed);
    return { account, movementDebit, movementCredit, debitBalance, creditBalance };
  }).filter(item => item.movementDebit > 0 || item.movementCredit > 0);
  const trialDebit = trial.reduce((sum, item) => sum + item.debitBalance, 0);
  const trialCredit = trial.reduce((sum, item) => sum + item.creditBalance, 0);

  if (loading) return <section className="panel"><div className="empty"><span>Menyiapkan laporan akuntansi...</span></div></section>;
  if (errorMessage) return <section className="panel"><div className="inline-error">{errorMessage}</div></section>;

  if (mode === 'journals') return <section className="panel"><div className="panel-head wrap"><div><span className="eyebrow dark">{mode === 'trial' ? 'Laporan Keuangan' : 'Laporan Buku Besar'}</span><h3>Daftar Jurnal</h3><p>Daftar jurnal otomatis dan jurnal penyesuaian dalam periode yang dipilih.</p></div><div className="filters"><input type="month" value={month} onChange={e => setMonth(e.target.value)} /><select value={sourceFilter} onChange={e => setSourceFilter(e.target.value as typeof sourceFilter)}><option value="ALL">Semua jurnal</option><option value="AUTO">Otomatis</option><option value="MANUAL">Manual</option></select></div></div><div className="report-summary"><div><span>Jumlah Jurnal</span><strong>{monthRows.length}</strong></div><div><span>Total Debit</span><strong>{idr.format(totalJournalDebit)}</strong></div><div><span>Total Kredit</span><strong>{idr.format(totalJournalDebit)}</strong></div></div>{monthRows.length === 0 ? <div className="empty"><span>Belum ada jurnal pada periode ini.</span></div> : <div className="journal-list">{monthRows.map(journal => <article className="journal-card" key={journal.id}><div className="journal-head"><div><strong>{journal.journalNumber}</strong><span>{formatDate(journal.date)} · {journal.source} · {journal.auto ? 'OTOMATIS' : 'MANUAL'}</span></div><div><b>{journal.description}</b><span>{journal.reference || '-'}</span></div></div><div className="table-wrap"><table><thead><tr><th>Akun</th><th>Kebun</th><th className="right">Debit</th><th className="right">Kredit</th></tr></thead><tbody>{journal.lines.map((line, index) => { const account = accountMap.get(line.accountId); return <tr key={`${journal.id}-${index}`}><td><strong>{account?.code || '-'}</strong> · {account?.name || 'Akun tidak ditemukan'}</td><td>{kebunName(line.kebunId)}</td><td className="right">{line.debit ? idr.format(line.debit) : '-'}</td><td className="right">{line.credit ? idr.format(line.credit) : '-'}</td></tr>; })}</tbody></table></div></article>)}</div>}</section>;

  if (mode === 'ledger') return <section className="panel"><div className="panel-head wrap"><div><span className="eyebrow dark">{mode === 'trial' ? 'Laporan Keuangan' : 'Laporan Buku Besar'}</span><h3>Buku Besar</h3><p>Mutasi Debit/Kredit dan saldo berjalan untuk satu akun akuntansi.</p></div><div className="filters"><input type="month" value={month} onChange={e => setMonth(e.target.value)} /><AccountSearchPicker className="ledger-account-search" accounts={accounts.filter(item => item.active !== false && (item.level ?? 4) === 4 && item.posting !== false)} value={ledgerAccountId} onChange={setLedgerAccountId} placeholder="Ketik kode atau nama akun..." ariaLabel="Cari akun Buku Besar" /></div></div>{!ledgerAccount ? <div className="empty"><span>Pilih akun terlebih dahulu.</span></div> : <><div className="report-summary"><div><span>Saldo Awal</span><strong>{idr.format(ledgerOpening)}</strong></div><div><span>Saldo Akhir</span><strong>{idr.format(ledgerRows.length ? ledgerRows[ledgerRows.length - 1].balance : ledgerOpening)}</strong></div></div><div className="table-wrap"><table><thead><tr><th>Tanggal</th><th>No. Jurnal</th><th>Keterangan</th><th>Kebun</th><th className="right">Debit</th><th className="right">Kredit</th><th className="right">Saldo</th></tr></thead><tbody><tr><td>{ledgerStart}</td><td>-</td><td><strong>Saldo Awal</strong></td><td>-</td><td className="right">-</td><td className="right">-</td><td className="right"><strong>{idr.format(ledgerOpening)}</strong></td></tr>{ledgerRows.map(({ journal, line, balance }, index) => <tr key={`${journal.id}-${line.accountId}-${index}`}><td>{formatDate(journal.date)}</td><td>{journal.journalNumber}</td><td>{journal.description}</td><td>{kebunName(line.kebunId)}</td><td className="right">{line.debit ? idr.format(line.debit) : '-'}</td><td className="right">{line.credit ? idr.format(line.credit) : '-'}</td><td className="right"><strong>{idr.format(balance)}</strong></td></tr>)}</tbody></table></div></>}</section>;

  return <section className="panel"><div className="panel-head wrap"><div><span className="eyebrow dark">{mode === 'trial' ? 'Laporan Keuangan' : 'Laporan Buku Besar'}</span><h3>Neraca Saldo</h3><p>Saldo akhir seluruh akun sampai akhir periode yang dipilih.</p></div><div className="filters"><input type="month" value={month} onChange={e => setMonth(e.target.value)} /></div></div><div className={`allocation-total ${trialDebit === trialCredit ? 'balanced' : ''}`}><span>Total Neraca Saldo</span><strong>Debit {idr.format(trialDebit)} · Kredit {idr.format(trialCredit)}</strong><small>{trialDebit === trialCredit ? 'SEIMBANG' : `Selisih ${idr.format(trialDebit - trialCredit)}`}</small></div><div className="table-wrap"><table><thead><tr><th>Kode</th><th>Akun</th><th>Kelompok</th><th className="right">Debit</th><th className="right">Kredit</th></tr></thead><tbody>{trial.map(item => <tr key={item.account.id}><td><strong>{item.account.code}</strong></td><td>{item.account.name}</td><td>{groupLabels[item.account.group]}</td><td className="right">{item.debitBalance ? idr.format(item.debitBalance) : '-'}</td><td className="right">{item.creditBalance ? idr.format(item.creditBalance) : '-'}</td></tr>)}</tbody><tfoot><tr><th colSpan={3}>TOTAL</th><th className="right">{idr.format(trialDebit)}</th><th className="right">{idr.format(trialCredit)}</th></tr></tfoot></table></div></section>;
}
