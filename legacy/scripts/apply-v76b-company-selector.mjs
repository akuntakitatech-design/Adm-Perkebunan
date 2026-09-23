import fs from 'node:fs';

const appFile = 'src/FarmApp.tsx';
const cssFile = 'src/farm.css';
let app = fs.readFileSync(appFile, 'utf8');
let css = fs.readFileSync(cssFile, 'utf8');
let appChanged = false;
let cssChanged = false;

function replaceApp(from, to, label) {
  if (!app.includes(from)) throw new Error(`Anchor not found: ${label}`);
  app = app.replace(from, to);
  appChanged = true;
}

if (!app.includes('const [companySelected, setCompanySelected]')) {
  replaceApp(
    '  const [mobileMenu, setMobileMenu] = useState(false);',
    '  const [mobileMenu, setMobileMenu] = useState(false);\n  const [companySelected, setCompanySelected] = useState(false);',
    'company selected state',
  );
}

if (!app.includes('const selectCompany = async (workspaceId: string) =>')) {
  const anchor = `  const navigate = (nextTab: Tab) => {\n    setTab(nextTab);\n    storeChoice(mainTabStorageKey, nextTab);\n  };`;
  const addition = [
    anchor,
    '',
    '  const selectCompany = async (workspaceId: string) => {',
    '    try {',
    '      setLoading(true);',
    "      setErrorMessage('');",
    "      if (workspaceId !== data.workspace.id) await api.post('/api/workspace/switch', { workspaceId });",
    '      await loadData();',
    "      navigate('dashboard');",
    '      setCompanySelected(true);',
    '    } catch (err) {',
    "      setErrorMessage(apiError(err, 'Perusahaan belum dapat dibuka.'));",
    '    } finally {',
    '      setLoading(false);',
    '    }',
    '  };',
    '',
    '  const createCompanyFromSelector = async (name: string) => {',
    '    try {',
    '      setLoading(true);',
    "      setErrorMessage('');",
    "      await api.post('/api/workspace/create', { name });",
    '      await loadData();',
    "      navigate('dashboard');",
    '      setCompanySelected(true);',
    '    } catch (err) {',
    "      setErrorMessage(apiError(err, 'Perusahaan baru belum dapat dibuat.'));",
    '    } finally {',
    '      setLoading(false);',
    '    }',
    '  };',
  ].join('\n');
  replaceApp(anchor, addition, 'selector actions');

  replaceApp(
    "    setData(emptyData);\n    navigate('dashboard');",
    "    setData(emptyData);\n    setCompanySelected(false);\n    navigate('dashboard');",
    'logout reset',
  );
}

if (!app.includes('<CompanySelector')) {
  const anchor = "  if (loading && !user) return <Splash />;\n  if (!user) return <Login onLogin={signIn} error={errorMessage} />;";
  const replacement = [
    anchor,
    '  if (!companySelected) return (',
    '    <CompanySelector',
    '      user={user}',
    '      data={data}',
    '      loading={loading}',
    '      error={errorMessage}',
    '      onSelect={selectCompany}',
    '      onCreate={createCompanyFromSelector}',
    '      onLogout={signOut}',
    '    />',
    '  );',
  ].join('\n');
  replaceApp(anchor, replacement, 'selector render');
}

if (!app.includes("{ id: 'access', label: 'Perusahaan', icon: Building2 }")) {
  replaceApp(
    "    { id: 'access', label: 'Pengguna & Akses', icon: UsersRound },",
    "    { id: 'access', label: 'Perusahaan', icon: Building2 },",
    'company menu label',
  );
}

if (app.includes('<span>Workspace aktif</span>')) {
  app = app.replace('<span>Workspace aktif</span>', '<span>Perusahaan aktif</span>');
  appChanged = true;
}
if (app.includes('Perkebunan · v4.11.0')) {
  app = app.replace('Perkebunan · v4.11.0', 'Perkebunan · v4.12.0');
  appChanged = true;
}
if (!app.includes('className="company-switch-btn"')) {
  replaceApp(
    '<button className="refresh-btn" onClick={loadData}><RefreshCw size={16} /> <span>Refresh</span></button>',
    '<div className="topbar-actions"><button className="company-switch-btn" onClick={() => setCompanySelected(false)}><Building2 size={16} /> <span>Ganti Perusahaan</span></button><button className="refresh-btn" onClick={loadData}><RefreshCw size={16} /> <span>Refresh</span></button></div>',
    'topbar company switch',
  );
}

if (app.includes('Masuk untuk membuka workspace perkebunan Anda.')) {
  app = app.replace('Masuk untuk membuka workspace perkebunan Anda.', 'Masuk, lalu pilih perusahaan yang akan dikerjakan.');
  app = app.replace('Data tersimpan di database aplikasi dan akses diatur berdasarkan workspace serta role pengguna.', 'Setiap perusahaan memiliki data terpisah. Hak akses mengikuti perusahaan dan role pengguna.');
  appChanged = true;
}

if (!app.includes('function CompanySelector(')) {
  const anchor = 'function Dashboard({ data, onNavigate }: { data: Bootstrap; onNavigate: (tab: Tab) => void }) {';
  const component = [
    'function CompanySelector({',
    '  user, data, loading, error, onSelect, onCreate, onLogout,',
    '}: {',
    '  user: User;',
    '  data: Bootstrap;',
    '  loading: boolean;',
    '  error: string;',
    '  onSelect: (workspaceId: string) => Promise<void>;',
    '  onCreate: (name: string) => Promise<void>;',
    '  onLogout: () => Promise<void>;',
    '}) {',
    "  const [companyName, setCompanyName] = useState('');",
    '  return (',
    '    <div className="company-select-page">',
    '      <div className="company-select-shell">',
    '        <div className="company-select-head">',
    '          <div className="brand">',
    '            <div className="brand-mark"><Sprout size={24} /></div>',
    '            <div><strong>Administrasi</strong><span>Perkebunan</span></div>',
    '          </div>',
    '          <button className="secondary" onClick={() => void onLogout()}><LogOut size={16} /> Keluar</button>',
    '        </div>',
    '        <div className="company-select-copy">',
    '          <span className="eyebrow dark">Pilih Perusahaan</span>',
    '          <h1>Perusahaan mana yang akan dikerjakan?</h1>',
    '          <p>Setelah perusahaan dipilih, seluruh master, transaksi, persediaan, akuntansi, dan laporan hanya memakai data perusahaan tersebut.</p>',
    '        </div>',
    '        {error && <div className="inline-error">{error}</div>}',
    '        <div className="company-choice-grid">',
    '          {data.workspaces.map(item => (',
    '            <button key={item.id} className="company-choice-card" disabled={loading} onClick={() => void onSelect(item.id)}>',
    '              <span className="company-choice-icon"><Building2 size={25} /></span>',
    '              <span className="company-choice-copy"><strong>{item.name}</strong><small>{roleLabel(item.role)}</small></span>',
    '              <ChevronRight size={18} />',
    '            </button>',
    '          ))}',
    '        </div>',
    '        <form className="company-create-card" onSubmit={event => { event.preventDefault(); const name = companyName.trim(); if (name.length >= 2) void onCreate(name); }}>',
    '          <div><strong>Tambah perusahaan baru</strong><span>Buat ruang data perusahaan yang benar-benar terpisah.</span></div>',
    '          <div className="company-create-row"><input placeholder="Contoh: PT Sawit Makmur" value={companyName} onChange={event => setCompanyName(event.target.value)} maxLength={120} /><button className="primary" disabled={loading || companyName.trim().length < 2}><Plus size={17} /> Buat Perusahaan</button></div>',
    '        </form>',
    '        <div className="company-user-note">Login sebagai <strong>{user.name || user.email || \'Pengguna\'}</strong></div>',
    '      </div>',
    '    </div>',
    '  );',
    '}',
    '',
    anchor,
  ].join('\n');
  replaceApp(anchor, component, 'CompanySelector component');
}

if (!css.includes('/* v4.12 company selector */')) {
  css += `\n\n/* v4.12 company selector */\n.topbar-actions { margin-left: auto; display: flex; align-items: center; gap: 8px; }\n.topbar-actions .refresh-btn { margin-left: 0; }\n.company-switch-btn { border: 1px solid #d6e0d7; background: #f5f8f3; color: #315d43; border-radius: 10px; padding: 9px 12px; display: inline-flex; align-items: center; gap: 7px; font-weight: 750; cursor: pointer; }\n.company-select-page { min-height: 100vh; background: linear-gradient(145deg,#eef3eb,#f8faf7 42%,#edf4e6); padding: 36px; }\n.company-select-shell { width: min(980px,100%); margin: 0 auto; }\n.company-select-head { display: flex; justify-content: space-between; align-items: center; gap: 16px; }\n.company-select-head .brand span { color: #718078; }\n.company-select-copy { padding: 62px 0 26px; max-width: 720px; }\n.company-select-copy h1 { margin: 8px 0 10px; font-size: clamp(28px,4vw,44px); line-height: 1.08; color: #173d2c; }\n.company-select-copy p { margin: 0; color: #68776e; line-height: 1.7; font-size: 13px; }\n.eyebrow.dark { color: #426b50; }\n.company-choice-grid { display: grid; grid-template-columns: repeat(2,minmax(0,1fr)); gap: 14px; margin-top: 20px; }\n.company-choice-card { border: 1px solid #dce5dc; background: #fff; border-radius: 16px; padding: 18px; display: flex; align-items: center; gap: 14px; text-align: left; cursor: pointer; box-shadow: 0 4px 18px rgba(30,60,42,.04); }\n.company-choice-card:hover { border-color: #9ebaa5; box-shadow: 0 9px 26px rgba(30,60,42,.08); transform: translateY(-1px); }\n.company-choice-icon { width: 46px; height: 46px; border-radius: 13px; display: grid; place-items: center; background: #eaf3df; color: #27553d; }\n.company-choice-copy { min-width: 0; flex: 1; }\n.company-choice-copy strong, .company-choice-copy small { display: block; }\n.company-choice-copy strong { font-size: 14px; color: #21352a; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }\n.company-choice-copy small { margin-top: 4px; color: #7f8c83; font-size: 10px; }\n.company-create-card { margin-top: 18px; background: #173d2c; color: #fff; border-radius: 17px; padding: 20px; display: grid; gap: 14px; }\n.company-create-card > div:first-child strong, .company-create-card > div:first-child span { display: block; }\n.company-create-card > div:first-child strong { font-size: 14px; }\n.company-create-card > div:first-child span { color: #b8ccbe; font-size: 11px; margin-top: 4px; }\n.company-create-row { display: grid; grid-template-columns: 1fr auto; gap: 10px; }\n.company-create-row input { width: 100%; border: 1px solid #4b6c5b; background: #214936; color: #fff; border-radius: 11px; padding: 11px 12px; outline: none; }\n.company-create-row input::placeholder { color: #9eb5a7; }\n.company-user-note { text-align: center; color: #7b887f; font-size: 10px; padding: 18px; }\n@media (max-width: 760px) { .company-select-page { padding: 22px 16px; } .company-select-copy { padding-top: 38px; } .company-choice-grid { grid-template-columns: 1fr; } .company-create-row { grid-template-columns: 1fr; } .company-switch-btn span { display: none; } }\n`;
  cssChanged = true;
}

if (appChanged) fs.writeFileSync(appFile, app);
if (cssChanged) fs.writeFileSync(cssFile, css);
console.log(appChanged || cssChanged ? 'v76 company selector applied.' : 'v76 company selector already applied.');
