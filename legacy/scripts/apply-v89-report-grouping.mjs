import fs from 'node:fs';

const appFile = 'src/FarmApp.tsx';
const accountingReportsFile = 'src/AccountingReports.tsx';
const marker = '// v89-report-grouping';

let app = fs.readFileSync(appFile, 'utf8');
let accountingReports = fs.readFileSync(accountingReportsFile, 'utf8');
let changed = false;

const replaceOnce = (source, oldText, newText, label) => {
  if (!source.includes(oldText)) throw new Error(`${label} anchor not found`);
  return source.replace(oldText, newText);
};

if (!app.includes(marker)) {
  app = replaceOnce(
    app,
    "    { id: 'financial' as const, title: 'Laporan Keuangan', description: 'Laba Rugi dan Neraca berdasarkan COA dan jurnal.', icon: Landmark },\n    { id: 'accounting' as const, title: 'Laporan Akuntansi', description: 'Daftar jurnal, buku besar dan neraca saldo.', icon: BookOpen },",
    "    { id: 'financial' as const, title: 'Laporan Keuangan', description: 'Laba Rugi, Neraca dan Neraca Saldo berdasarkan COA dan jurnal.', icon: Landmark },\n    { id: 'accounting' as const, title: 'Laporan Buku Besar', description: 'Daftar jurnal dan buku besar per akun.', icon: BookOpen },",
    'report card labels',
  );

  app = replaceOnce(
    app,
    "    financial: 'Laporan Keuangan',\n    accounting: 'Laporan Akuntansi',",
    "    financial: 'Laporan Keuangan',\n    accounting: 'Laporan Buku Besar',",
    'report page titles',
  );

  const oldSubmenu = `                {item.id === 'financial' ? <>\n                  <button type=\"button\" onClick={() => openFinancialReport('income')}><span className=\"report-submenu-mark\">•</span><span>Laba Rugi Standar</span><ChevronRight size={16} /></button>\n                  <button type=\"button\" onClick={() => openFinancialReport('balance')}><span className=\"report-submenu-mark\">•</span><span>Neraca</span><ChevronRight size={16} /></button>\n                </> : <>\n                  <button type=\"button\" onClick={() => openAccountingReport('journals')}><span className=\"report-submenu-mark\">•</span><span>Daftar Jurnal</span><ChevronRight size={16} /></button>\n                  <button type=\"button\" onClick={() => openAccountingReport('ledger')}><span className=\"report-submenu-mark\">•</span><span>Buku Besar</span><ChevronRight size={16} /></button>\n                  <button type=\"button\" onClick={() => openAccountingReport('trial')}><span className=\"report-submenu-mark\">•</span><span>Neraca Saldo</span><ChevronRight size={16} /></button>\n                </>}`;
  const newSubmenu = `                {item.id === 'financial' ? <>\n                  <button type=\"button\" onClick={() => openFinancialReport('income')}><span className=\"report-submenu-mark\">•</span><span>Laba Rugi Standar</span><ChevronRight size={16} /></button>\n                  <button type=\"button\" onClick={() => openFinancialReport('balance')}><span className=\"report-submenu-mark\">•</span><span>Neraca</span><ChevronRight size={16} /></button>\n                  <button type=\"button\" onClick={() => openAccountingReport('trial')}><span className=\"report-submenu-mark\">•</span><span>Neraca Saldo</span><ChevronRight size={16} /></button>\n                </> : <>\n                  <button type=\"button\" onClick={() => openAccountingReport('journals')}><span className=\"report-submenu-mark\">•</span><span>Daftar Jurnal</span><ChevronRight size={16} /></button>\n                  <button type=\"button\" onClick={() => openAccountingReport('ledger')}><span className=\"report-submenu-mark\">•</span><span>Buku Besar</span><ChevronRight size={16} /></button>\n                </>}`;
  app = replaceOnce(app, oldSubmenu, newSubmenu, 'report submenu grouping');

  app = replaceOnce(
    app,
    "      <div><span>Laporan</span><ChevronRight size={14} /><span>Laporan Akuntansi</span><ChevronRight size={14} /><strong>{accountingReportMode === 'journals' ? 'Daftar Jurnal' : accountingReportMode === 'ledger' ? 'Buku Besar' : 'Neraca Saldo'}</strong></div>",
    "      <div><span>Laporan</span><ChevronRight size={14} /><span>{accountingReportMode === 'trial' ? 'Laporan Keuangan' : 'Laporan Buku Besar'}</span><ChevronRight size={14} /><strong>{accountingReportMode === 'journals' ? 'Daftar Jurnal' : accountingReportMode === 'ledger' ? 'Buku Besar' : 'Neraca Saldo'}</strong></div>",
    'accounting report breadcrumb',
  );

  app = app.replace("function Reports({ data }: { data: Bootstrap }) {", `function Reports({ data }: { data: Bootstrap }) {\n  ${marker}`);
  fs.writeFileSync(appFile, app);
  changed = true;
}

if (!accountingReports.includes(marker)) {
  accountingReports = accountingReports.replaceAll(
    '<span className="eyebrow dark">Laporan Akuntansi</span>',
    '<span className="eyebrow dark">{mode === \'trial\' ? \'Laporan Keuangan\' : \'Laporan Buku Besar\'}</span>',
  );
  if (!accountingReports.includes("mode === 'trial' ? 'Laporan Keuangan' : 'Laporan Buku Besar'")) {
    throw new Error('AccountingReports eyebrow replacement failed');
  }
  accountingReports = accountingReports.replace(
    "export default function AccountingReports({ data, mode }: Props) {",
    `export default function AccountingReports({ data, mode }: Props) {\n  ${marker}`,
  );
  fs.writeFileSync(accountingReportsFile, accountingReports);
  changed = true;
}

console.log(changed ? 'Applied v89 report grouping' : 'v89 already applied');
