import fs from 'node:fs';

const cssFile = 'src/farm.css';
let css = fs.readFileSync(cssFile, 'utf8');
const marker = '/* v74 COA readable font */';

if (!css.includes(marker)) {
  css += `\n\n${marker}\n.coa-tree-table th { font-size: 11px; padding: 12px 10px; }\n.coa-tree-table td { font-size: 12px; padding: 12px 10px; line-height: 1.45; }\n.coa-tree-table .coa-name strong { font-size: 12.5px; line-height: 1.35; }\n.coa-tree-table .coa-name span { font-size: 12px; line-height: 1.4; }\n.coa-tree-table .coa-name small { font-size: 10.5px; line-height: 1.35; }\n.coa-tree-table .level-badge { min-width: 34px; padding: 5px 7px; font-size: 11px; }\n.coa-tree-table .coa-row-level-1 .coa-name strong { font-size: 14px; }\n.coa-tree-table .coa-row-level-1 .coa-name span { font-size: 13px; }\n.coa-tree-table .coa-row-level-2 .coa-name strong { font-size: 13px; }\n.coa-tree-table .coa-row-level-2 .coa-name span { font-size: 12.5px; }\n.coa-list-search input { font-size: 12px; }\n@media (max-width: 900px) {\n  .coa-tree-table th { font-size: 10px; }\n  .coa-tree-table td { font-size: 11px; }\n  .coa-tree-table .coa-name strong { font-size: 11.5px; }\n  .coa-tree-table .coa-name span { font-size: 11px; }\n}\n`;
  fs.writeFileSync(cssFile, css);
  console.log('v74: font COA dibesarkan agar lebih nyaman dibaca.');
} else {
  console.log('v74: font COA sudah diterapkan.');
}
