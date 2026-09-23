import fs from 'node:fs';

const reportFile = 'src/FinancialStatements.tsx';
const cssFile = 'src/farm.css';
const marker = '// v87-hide-zero-financial-lines';
const cssMarker = '/* v87-hide-zero-financial-lines */';

let report = fs.readFileSync(reportFile, 'utf8');
let css = fs.readFileSync(cssFile, 'utf8');
let changed = false;

if (!report.includes(marker)) {
  const stateAnchor = "  const [errorMessage, setErrorMessage] = useState('');";
  if (!report.includes(stateAnchor)) throw new Error('FinancialStatements state anchor not found');
  report = report.replace(stateAnchor, `${stateAnchor}\n  ${marker}\n  const [hideZeroRows, setHideZeroRows] = useState(true);`);

  const renderStart = report.indexOf('  const renderGroup = (group: AccountingGroup, title: string, current: ValueMap, compare: ValueMap) => {');
  const renderEnd = report.indexOf('\n\n  if (loading)', renderStart);
  if (renderStart < 0 || renderEnd < 0) throw new Error('FinancialStatements renderGroup block not found');

  const newRenderGroup = `  const isVisibleAmount = (currentValue: number, compareValue: number) => !hideZeroRows || Math.abs(currentValue) >= 0.5 || Math.abs(compareValue) >= 0.5;\n\n  const renderGroup = (group: AccountingGroup, title: string, current: ValueMap, compare: ValueMap) => {\n    const level2Rows = accounts.filter(account => account.active !== false && account.group === group && account.level === 2).sort((a, b) => a.code.localeCompare(b.code));\n    const renderedLevel2 = level2Rows.map(level2 => {\n      const level3Rows = accounts.filter(account => account.active !== false && account.parentId === level2.id && account.level === 3).sort((a, b) => a.code.localeCompare(b.code));\n      const renderedLevel3 = level3Rows.map(level3 => {\n        const leaves = accounts.filter(account => posting(account) && account.parentId === level3.id).sort((a, b) => a.code.localeCompare(b.code));\n        const currentLevel3 = leaves.reduce((sum, account) => sum + (current.get(account.id) || 0), 0);\n        const compareLevel3 = leaves.reduce((sum, account) => sum + (compare.get(account.id) || 0), 0);\n        const visibleLeaves = leaves.filter(account => isVisibleAmount(current.get(account.id) || 0, compare.get(account.id) || 0));\n        if (hideZeroRows && visibleLeaves.length === 0 && !isVisibleAmount(currentLevel3, compareLevel3)) return null;\n        return <div key={level3.id}>\n          <div className=\"fs-row fs-level3\"><span>{level3.code} · {level3.name}</span><strong>{idr.format(currentLevel3)}</strong><strong>{idr.format(compareLevel3)}</strong></div>\n          {visibleLeaves.map(account => <div className=\"fs-row fs-level4\" key={account.id}><span><b>{account.code}</b> {account.name}</span><span>{idr.format(current.get(account.id) || 0)}</span><span>{idr.format(compare.get(account.id) || 0)}</span></div>)}\n        </div>;\n      }).filter(Boolean);\n      const level2Leaves = level3Rows.flatMap(level3 => accounts.filter(account => posting(account) && account.parentId === level3.id));\n      const currentLevel2 = level2Leaves.reduce((sum, account) => sum + (current.get(account.id) || 0), 0);\n      const compareLevel2 = level2Leaves.reduce((sum, account) => sum + (compare.get(account.id) || 0), 0);\n      if (hideZeroRows && renderedLevel3.length === 0 && !isVisibleAmount(currentLevel2, compareLevel2)) return null;\n      return <div className=\"fs-level2\" key={level2.id}>\n        <div className=\"fs-row fs-subtitle\"><span>{level2.code} · {level2.name}</span><strong>{idr.format(currentLevel2)}</strong><strong>{idr.format(compareLevel2)}</strong></div>\n        {renderedLevel3}\n      </div>;\n    }).filter(Boolean);\n    return <div className=\"fs-group\">\n      <div className=\"fs-group-title\"><strong>{title}</strong><span>{idr.format(sumMap(current, accounts, group))}</span><span>{idr.format(sumMap(compare, accounts, group))}</span></div>\n      {renderedLevel2}\n    </div>;\n  };`;

  report = report.slice(0, renderStart) + newRenderGroup + report.slice(renderEnd);

  const filterAnchor = `        <label className=\"fs-filter\"><span>Pembanding</span><input type=\"month\" value={compareMonth} onChange={event => setCompareMonth(event.target.value)} /></label>`;
  if (!report.includes(filterAnchor)) throw new Error('FinancialStatements filter anchor not found');
  report = report.replace(filterAnchor, `${filterAnchor}\n        <label className=\"fs-zero-toggle\"><input type=\"checkbox\" checked={hideZeroRows} onChange={event => setHideZeroRows(event.target.checked)} /><span>Sembunyikan akun Rp0</span></label>`);

  fs.writeFileSync(reportFile, report);
  changed = true;
}

if (!css.includes(cssMarker)) {
  css += `\n\n${cssMarker}\n.fs-zero-toggle { display: flex; align-items: center; gap: 8px; min-height: 42px; padding: 0 10px; color: #4f5f55; font-size: 12px; white-space: nowrap; }\n.fs-zero-toggle input { width: 16px; height: 16px; accent-color: #315b43; }\n@media (max-width: 760px) { .fs-zero-toggle { min-height: 38px; padding: 0 2px; white-space: normal; } }\n`;
  fs.writeFileSync(cssFile, css);
  changed = true;
}

console.log(changed ? 'Applied v87 hide-zero financial lines' : 'v87 already applied');
