import fs from 'node:fs';

const coaPath = 'src/AccountingFoundation.tsx';
const farmPath = 'src/FarmApp.tsx';
let source = fs.readFileSync(coaPath, 'utf8');
let farm = fs.readFileSync(farmPath, 'utf8');
const marker = '/* v4.13.1 coa auto code */';
let changed = false;

function replaceOnce(from, to, label) {
  if (!source.includes(from)) throw new Error(`Anchor not found: ${label}`);
  source = source.replace(from, to);
}

if (!source.includes(marker)) {
  const helperAnchor = `function posting(account: Account) { return (account.level ?? 4) === 4 && account.posting !== false; }`;
  const helperAddition = `${helperAnchor}\nfunction incrementCoaCode(code: string) {\n  const value = code.trim();\n  const match = value.match(/^(.*?)(\\d+)(\\D*)$/);\n  if (!match) return '';\n  const next = String(Number(match[2]) + 1).padStart(match[2].length, '0');\n  return match[1] + next + match[3];\n}\nfunction suggestedCoaCode(accounts: Account[], level: 1 | 2 | 3 | 4, parentId = '') {\n  const collator = new Intl.Collator('id-ID', { numeric: true, sensitivity: 'base' });\n  const siblings = accounts.filter(item => {\n    const itemLevel = item.level ?? 4;\n    if (itemLevel !== level) return false;\n    return level === 1 ? !item.parentId : item.parentId === parentId;\n  }).sort((a, b) => collator.compare(a.code, b.code));\n  const latest = siblings[siblings.length - 1];\n  if (latest) return incrementCoaCode(latest.code);\n  if (level === 1) return '1';\n  const parent = accounts.find(item => item.id === parentId);\n  if (!parent) return '';\n  const parentCode = parent.code.trim();\n  if (level === 2) return /^\\d+$/.test(parentCode) ? parentCode + '1' : parentCode + '-01';\n  if (level === 3) return /^\\d+$/.test(parentCode) ? parentCode + '10' : parentCode + '-01';\n  return parentCode + '-00-001';\n}`;
  replaceOnce(helperAnchor, helperAddition, 'COA code suggestion helpers');

  const parentAnchor = `  const parentOptions = accounts.filter(item => (item.level ?? 4) === accountForm.level - 1 && item.group === accountForm.group);`;
  const parentAddition = `${parentAnchor}\n  const changeCoaLevel = (level: 1 | 2 | 3 | 4) => setAccountForm(current => ({ ...current, level, parentId: '', code: current.id ? current.code : level === 1 ? suggestedCoaCode(accounts, 1) : '' }));\n  const changeCoaGroup = (group: Group) => setAccountForm(current => ({ ...current, group, parentId: '', code: current.id ? current.code : current.level === 1 ? suggestedCoaCode(accounts, 1) : '', normalBalance: ['LIABILITY','EQUITY','REVENUE'].includes(group) ? 'CREDIT' : 'DEBIT' }));\n  const changeCoaParent = (parentId: string) => setAccountForm(current => ({ ...current, parentId, code: current.id ? current.code : parentId ? suggestedCoaCode(accounts, current.level, parentId) : '' }));`;
  replaceOnce(parentAnchor, parentAddition, 'COA change handlers');

  replaceOnce(
    `onChange={e => setAccountForm(v => ({ ...v, level: Number(e.target.value) as 1|2|3|4, parentId: '' }))}`,
    `onChange={e => changeCoaLevel(Number(e.target.value) as 1|2|3|4)}`,
    'level change handler',
  );

  replaceOnce(
    `onChange={e => { const group = e.target.value as Group; setAccountForm(v => ({ ...v, group, parentId: '', normalBalance: ['LIABILITY','EQUITY','REVENUE'].includes(group) ? 'CREDIT' : 'DEBIT' })); }}`,
    `onChange={e => changeCoaGroup(e.target.value as Group)}`,
    'group change handler',
  );

  replaceOnce(
    `<Field label="Kode"><input value={accountForm.code} onChange={e => setAccountForm(v => ({ ...v, code: e.target.value }))} placeholder="Contoh 5110-00-001" /></Field>`,
    `<Field label="Kode"><input value={accountForm.code} onChange={e => setAccountForm(v => ({ ...v, code: e.target.value }))} placeholder={accountForm.level > 1 && !accountForm.parentId ? 'Pilih parent untuk kode otomatis' : 'Kode otomatis / dapat diedit'} />{!accountForm.id && <small>{accountForm.level === 1 ? 'Mengikuti kode Level 1 terakhir.' : accountForm.parentId ? 'Mengikuti kode terakhir pada parent yang dipilih.' : 'Kode akan terisi otomatis setelah parent dipilih.'}</small>}</Field>`,
    'code field helper',
  );

  replaceOnce(
    `<select value={accountForm.parentId} onChange={e => setAccountForm(v => ({ ...v, parentId: e.target.value }))}>`,
    `<select value={accountForm.parentId} onChange={e => changeCoaParent(e.target.value)}>`,
    'parent change handler',
  );

  source += `\n\n${marker}\n`;
  changed = true;
}

if (farm.includes('Perkebunan · v4.13.0')) {
  farm = farm.replace('Perkebunan · v4.13.0', 'Perkebunan · v4.13.1');
  changed = true;
}

if (changed) {
  fs.writeFileSync(coaPath, source);
  fs.writeFileSync(farmPath, farm);
}
