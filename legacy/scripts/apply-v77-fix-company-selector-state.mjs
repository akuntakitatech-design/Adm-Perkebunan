import fs from 'node:fs';

const file = 'src/FarmApp.tsx';
let source = fs.readFileSync(file, 'utf8');
let changed = false;

const marker = '/* v4.12.2 fix company selector state */';
if (!source.includes(marker)) {
  const anchor = `function CompanySelector({\n  user, data, loading, error, onSelect, onCreate, onJoin, onLogout,\n}: {\n  user: User;\n  data: Bootstrap;\n  loading: boolean;\n  error: string;\n  onSelect: (workspaceId: string) => Promise<void>;\n  onCreate: (name: string) => Promise<void>;\n  onJoin: (code: string) => Promise<void>;\n  onLogout: () => Promise<void>;\n}) {\n  return (`;
  const replacement = `function CompanySelector({\n  user, data, loading, error, onSelect, onCreate, onJoin, onLogout,\n}: {\n  user: User;\n  data: Bootstrap;\n  loading: boolean;\n  error: string;\n  onSelect: (workspaceId: string) => Promise<void>;\n  onCreate: (name: string) => Promise<void>;\n  onJoin: (code: string) => Promise<void>;\n  onLogout: () => Promise<void>;\n}) {\n  const [companyName, setCompanyName] = useState('');\n  const [joinCode, setJoinCode] = useState('');\n  return (`;

  if (!source.includes(anchor)) throw new Error('CompanySelector anchor not found.');
  source = source.replace(anchor, replacement);
  source = source.replace('Perkebunan · v4.12.1', 'Perkebunan · v4.12.2');
  source += `\n\n${marker}\n`;
  changed = true;
}

if (!changed) {
  console.log('v4.12.2 company selector state fix already applied.');
  process.exit(0);
}

fs.writeFileSync(file, source);
console.log('v4.12.2 company selector state fix applied.');
