import fs from 'node:fs';

const appFile = 'src/FarmApp.tsx';
const financialFile = 'src/FinancialStatements.tsx';
const marker = '// v86-report-detail-cleanup';

let app = fs.readFileSync(appFile, 'utf8');
let financial = fs.readFileSync(financialFile, 'utf8');
let changed = false;

if (!app.includes(marker)) {
  const oldBlock = `  if (reportPage === 'financial') return <div className="stack">\n    {detailNav}\n    <section className="panel tbs-header">\n      <div><span className="eyebrow dark">Laporan Keuangan</span><h2>Laporan Keuangan</h2><p>Laporan formal disusun dari COA dan jurnal yang telah diposting.</p></div>\n      <div className="mode-tabs report-tabs financial-report-tabs">\n        <button type="button" className={reportMode === 'income' ? 'active' : ''} onClick={() => changeReportMode('income')}><BookOpen size={16} /> Laba Rugi</button>\n        <button type="button" className={reportMode === 'balance' ? 'active' : ''} onClick={() => changeReportMode('balance')}><Landmark size={16} /> Neraca</button>\n      </div>\n    </section>\n    <FinancialStatements data={data} mode={reportMode} />\n  </div>;`;

  const newBlock = `  ${marker}\n  if (reportPage === 'financial') return <div className="stack">\n    <section className="master-detail-nav">\n      <div><span>Laporan</span><ChevronRight size={14} /><span>Laporan Keuangan</span><ChevronRight size={14} /><strong>{reportMode === 'income' ? 'Laba Rugi Standar' : 'Neraca'}</strong></div>\n      <button type="button" className="secondary small-btn" onClick={() => changeReportPage('hub')}>← Kembali ke Laporan</button>\n    </section>\n    <FinancialStatements data={data} mode={reportMode} />\n  </div>;`;

  if (!app.includes(oldBlock)) throw new Error('Financial report detail block not found');
  app = app.replace(oldBlock, newBlock);
  fs.writeFileSync(appFile, app);
  changed = true;
}

const oldTitle = `<h3>{mode === 'income' ? 'Laporan Laba Rugi & Penghasilan Komprehensif Lain' : 'Laporan Posisi Keuangan (Neraca)'}</h3>`;
const newTitle = `<h3>{mode === 'income' ? 'Laba Rugi Standar' : 'Neraca'}</h3>`;
if (financial.includes(oldTitle)) {
  financial = financial.replace(oldTitle, newTitle);
  fs.writeFileSync(financialFile, financial);
  changed = true;
}

console.log(changed ? 'Applied v86 report detail cleanup' : 'v86 already applied');
