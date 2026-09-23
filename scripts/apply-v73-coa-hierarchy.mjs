import fs from 'node:fs';

const appFile = 'src/AccountingFoundation.tsx';
const cssFile = 'src/farm.css';

let app = fs.readFileSync(appFile, 'utf8');
let css = fs.readFileSync(cssFile, 'utf8');
let changed = false;

const oldSort = "  const sortedAccounts = useMemo(() => [...accounts].sort((a, b) => a.code.localeCompare(b.code, 'id-ID', { numeric: true, sensitivity: 'base' })), [accounts]);";
const newSort = `  const sortedAccounts = useMemo(() => {\n    const collator = new Intl.Collator('id-ID', { numeric: true, sensitivity: 'base' });\n    const ordered = [...accounts].sort((a, b) => collator.compare(a.code, b.code) || a.name.localeCompare(b.name, 'id-ID'));\n    const ids = new Set(ordered.map(item => item.id));\n    const children = new Map<string, Account[]>();\n    const roots: Account[] = [];\n    ordered.forEach(item => {\n      if (!item.parentId || !ids.has(item.parentId)) {\n        roots.push(item);\n        return;\n      }\n      const list = children.get(item.parentId) || [];\n      list.push(item);\n      children.set(item.parentId, list);\n    });\n    const result: Account[] = [];\n    const seen = new Set<string>();\n    const visit = (item: Account) => {\n      if (seen.has(item.id)) return;\n      seen.add(item.id);\n      result.push(item);\n      (children.get(item.id) || [])\n        .sort((a, b) => collator.compare(a.code, b.code) || a.name.localeCompare(b.name, 'id-ID'))\n        .forEach(visit);\n    };\n    roots\n      .sort((a, b) => collator.compare(a.code, b.code) || a.name.localeCompare(b.name, 'id-ID'))\n      .forEach(visit);\n    ordered.filter(item => !seen.has(item.id)).forEach(visit);\n    return result;\n  }, [accounts]);`;

if (app.includes(oldSort)) {
  app = app.replace(oldSort, newSort);
  changed = true;
}

const oldDesc = '<p>{accounts.length} node. Level 1–3 header; Level 4 akun posting.</p>';
const newDesc = '<p>{accounts.length} node. Disusun mengikuti parent: Level 1–3 sebagai header, Level 4 sebagai akun posting.</p>';
if (app.includes(oldDesc)) {
  app = app.replace(oldDesc, newDesc);
  changed = true;
}

const oldTableStart = '<table><thead><tr><th>Level</th><th>Kode / Nama</th><th>Klasifikasi</th><th>Arus Kas</th><th>Parent</th><th>Status</th><th></th></tr></thead><tbody>';
const newTableStart = '<table className="coa-tree-table"><thead><tr><th>Level</th><th>Kode / Nama</th><th>Klasifikasi</th><th>Arus Kas</th><th>Status</th><th></th></tr></thead><tbody>';
if (app.includes(oldTableStart)) {
  app = app.replace(oldTableStart, newTableStart);
  changed = true;
}

const oldMapStart = "{filteredAccounts.map(item => { const level = item.level ?? 4; const parent = accountMap.get(item.parentId || ''); return <tr key={item.id}>";
const newMapStart = "{filteredAccounts.map(item => { const level = item.level ?? 4; return <tr key={item.id} className={`coa-row coa-row-level-${level}`}>";
if (app.includes(oldMapStart)) {
  app = app.replace(oldMapStart, newMapStart);
  changed = true;
}

const oldParentCell = "<td>{parent ? `${parent.code} · ${parent.name}` : '-'}</td>";
if (app.includes(oldParentCell)) {
  app = app.replace(oldParentCell, '');
  changed = true;
}

const cssMarker = '/* v73 COA hierarchy */';
if (!css.includes(cssMarker)) {
  css += `\n\n${cssMarker}\n.coa-tree-table { border-collapse: separate; border-spacing: 0; }\n.coa-tree-table thead th { position: sticky; top: 0; z-index: 1; background: #fff; }\n.coa-tree-table .coa-row td { transition: background .15s ease; vertical-align: middle; }\n.coa-tree-table .coa-row:hover td { background: #f8faf7; }\n.coa-tree-table .coa-row-level-1 td { background: #edf4e9; border-top: 2px solid #d6e3d1; border-bottom-color: #dfe8dc; }\n.coa-tree-table .coa-row-level-1 .coa-name strong { font-size: 13px; color: #173d2c; }\n.coa-tree-table .coa-row-level-1 .coa-name span { font-weight: 800; color: #244c38; text-transform: uppercase; letter-spacing: .025em; }\n.coa-tree-table .coa-row-level-2 td { background: #fafcf9; }\n.coa-tree-table .coa-name { position: relative; min-width: 220px; }\n.coa-tree-table .coa-indent-2 { padding-left: 26px; }\n.coa-tree-table .coa-indent-3 { padding-left: 52px; }\n.coa-tree-table .coa-indent-4 { padding-left: 78px; }\n.coa-tree-table .coa-indent-2::before,\n.coa-tree-table .coa-indent-3::before,\n.coa-tree-table .coa-indent-4::before { content: '↳'; position: absolute; color: #8aa093; font-weight: 800; }\n.coa-tree-table .coa-indent-2::before { left: 7px; }\n.coa-tree-table .coa-indent-3::before { left: 32px; }\n.coa-tree-table .coa-indent-4::before { left: 58px; }\n.coa-tree-table .coa-row-level-2 .coa-name strong,\n.coa-tree-table .coa-row-level-2 .coa-name span { font-weight: 750; }\n.coa-tree-table .coa-row-level-3 .coa-name strong { color: #405449; }\n.coa-tree-table .coa-row-level-4 .coa-name strong { color: #52665a; }\n.coa-tree-table .coa-row-level-4 .coa-name span { color: #53665b; }\n.coa-tree-table .level-badge.l1 { background: #dfead9; color: #173d2c; }\n.coa-tree-table .level-badge.l2 { background: #e9f0e6; color: #31523f; }\n.coa-tree-table .level-badge.l3 { background: #eef2ec; color: #55675c; }\n.coa-tree-table .level-badge.l4 { background: #f3f5f2; color: #6d7b72; }\n@media (max-width: 900px) {\n  .coa-tree-table .coa-indent-2 { padding-left: 18px; }\n  .coa-tree-table .coa-indent-3 { padding-left: 32px; }\n  .coa-tree-table .coa-indent-4 { padding-left: 46px; }\n  .coa-tree-table .coa-indent-2::before { left: 3px; }\n  .coa-tree-table .coa-indent-3::before { left: 18px; }\n  .coa-tree-table .coa-indent-4::before { left: 32px; }\n}\n`;
  changed = true;
}

if (changed) {
  fs.writeFileSync(appFile, app);
  fs.writeFileSync(cssFile, css);
  console.log('v73: COA hierarchy dan tampilan berhasil dirapikan.');
} else {
  console.log('v73: tidak ada perubahan; hierarchy sudah diterapkan atau pola source berubah.');
}
