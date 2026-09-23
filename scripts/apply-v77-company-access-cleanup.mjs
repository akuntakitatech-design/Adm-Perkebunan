import fs from 'node:fs';

const appFile = 'src/FarmApp.tsx';
const cssFile = 'src/farm.css';
let app = fs.readFileSync(appFile, 'utf8');
let css = fs.readFileSync(cssFile, 'utf8');

if (app.includes('/* v4.12.1 company access cleanup */')) {
  console.log('v4.12.1 company access cleanup already applied.');
  process.exit(0);
}

function replaceOnce(source, from, to, label) {
  if (!source.includes(from)) throw new Error(`Anchor not found: ${label}`);
  return source.replace(from, to);
}

// 1) Join company belongs on the post-login company selector, not inside the active company page.
const signOutAnchor = `  const signOut = async () => {`;
const joinAction = `  const joinCompanyFromSelector = async (code: string) => {\n    const inviteCode = code.trim();\n    if (!inviteCode) return;\n    try {\n      setLoading(true);\n      setErrorMessage('');\n      await api.post('/api/workspace/join', { code: inviteCode });\n      await loadData();\n      navigate('dashboard');\n      setCompanySelected(true);\n    } catch (err) {\n      setErrorMessage(apiError(err, 'Kode undangan perusahaan belum dapat digunakan.'));\n    } finally {\n      setLoading(false);\n    }\n  };\n\n`;
app = replaceOnce(app, signOutAnchor, joinAction + signOutAnchor, 'join selector action');

app = replaceOnce(
  app,
  `      onCreate={createCompanyFromSelector}\n      onLogout={signOut}`,
  `      onCreate={createCompanyFromSelector}\n      onJoin={joinCompanyFromSelector}\n      onLogout={signOut}`,
  'selector onJoin prop',
);

app = replaceOnce(
  app,
  `  user, data, loading, error, onSelect, onCreate, onLogout,`,
  `  user, data, loading, error, onSelect, onCreate, onJoin, onLogout,`,
  'selector args',
);
app = replaceOnce(
  app,
  `  onCreate: (name: string) => Promise<void>;\n  onLogout: () => Promise<void>;`,
  `  onCreate: (name: string) => Promise<void>;\n  onJoin: (code: string) => Promise<void>;\n  onLogout: () => Promise<void>;`,
  'selector types',
);
app = replaceOnce(
  app,
  `  const [companyName, setCompanyName] = useState('');\n  return (`,
  `  const [companyName, setCompanyName] = useState('');\n  const [joinCode, setJoinCode] = useState('');\n  return (`,
  'selector join state',
);

const createForm = `        <form className="company-create-card" onSubmit={event => { event.preventDefault(); const name = companyName.trim(); if (name.length >= 2) void onCreate(name); }}>\n          <div><strong>Tambah perusahaan baru</strong><span>Buat ruang data perusahaan yang benar-benar terpisah.</span></div>\n          <div className="company-create-row"><input placeholder="Contoh: PT Sawit Makmur" value={companyName} onChange={event => setCompanyName(event.target.value)} maxLength={120} /><button className="primary" disabled={loading || companyName.trim().length < 2}><Plus size={17} /> Buat Perusahaan</button></div>\n        </form>`;
const createAndJoinForms = `${createForm}\n        <form className="company-create-card company-join-card" onSubmit={event => { event.preventDefault(); const code = joinCode.trim(); if (code) void onJoin(code); }}>\n          <div><strong>Punya kode undangan?</strong><span>Gabung ke perusahaan yang sudah dibuat oleh Owner.</span></div>\n          <div className="company-create-row"><input placeholder="Tempel kode undangan" value={joinCode} onChange={event => setJoinCode(event.target.value)} /><button className="secondary" disabled={loading || !joinCode.trim()}><UsersRound size={17} /> Gabung Perusahaan</button></div>\n        </form>`;
app = replaceOnce(app, createForm, createAndJoinForms, 'selector join form');

// 2) Remove duplicate company switching/creation UI from the active company page.
app = app.replace(`  const [companyName, setCompanyName] = useState('');\n`, '');
app = app.replace(`  const [joinCode, setJoinCode] = useState('');\n`, '');

const switchStart = app.indexOf(`  const switchWorkspace = async (workspaceId: string) => {`, app.indexOf('function AccessPanel('));
const createInviteStart = app.indexOf(`  const createInvite = async (e: React.FormEvent) => {`, app.indexOf('function AccessPanel('));
if (switchStart === -1 || createInviteStart === -1 || createInviteStart <= switchStart) {
  throw new Error('AccessPanel company action block not found.');
}
app = app.slice(0, switchStart) + app.slice(createInviteStart);

const companyPanelStart = app.indexOf(`      <section className="access-grid">\n        <div className="panel">\n          <div className="panel-head"><div><h3>Perusahaan Saya</h3>`, app.indexOf('function AccessPanel('));
const accessCardStart = app.indexOf(`        <div className="panel">\n          <div className="panel-head"><div><h3>Akses Saya</h3>`, companyPanelStart);
if (companyPanelStart === -1 || accessCardStart === -1) {
  throw new Error('Duplicate company card not found.');
}
app = app.slice(0, companyPanelStart) + `      <section className="access-grid single-access">\n` + app.slice(accessCardStart);

app = app.replace('Perkebunan · v4.12.0', 'Perkebunan · v4.12.1');
app += `\n/* v4.12.1 company access cleanup */\n`;

if (!css.includes('/* v4.12.1 company access cleanup */')) {
  css += `\n\n/* v4.12.1 company access cleanup */\n.access-grid.single-access { grid-template-columns: 1fr; }\n.company-join-card { margin-top: 12px; }\n`;
}

fs.writeFileSync(appFile, app);
fs.writeFileSync(cssFile, css);
console.log('v4.12.1 company access cleanup applied.');
