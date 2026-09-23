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

if (!app.includes('type CompanyProfile = {')) {
  const anchor = `type WorkspaceInvite = {\n  id: string;\n  code: string;\n  email: string;\n  role: Role;\n  assignedKebunIds: string[];\n  status: 'OPEN' | 'USED';\n};`;
  const addition = `${anchor}\ntype CompanyProfile = {\n  name: string;\n  shortName: string;\n  businessType: string;\n  npwp: string;\n  nib: string;\n  address: string;\n  village: string;\n  district: string;\n  city: string;\n  province: string;\n  postalCode: string;\n  phone: string;\n  email: string;\n  website: string;\n  picName: string;\n  picPosition: string;\n  fiscalYearStartMonth: number;\n  currency: string;\n  reportName: string;\n  logoUrl: string;\n};`;
  replaceApp(anchor, addition, 'CompanyProfile type');
}

if (!app.includes('<CompanyPanel')) {
  const oldRender = `          {tab === 'access' && (\n            <AccessPanel\n              user={user}\n              data={data}\n              reload={loadData}\n              flash={flash}\n              showError={setErrorMessage}\n            />\n          )}`;
  const newRender = `          {tab === 'access' && (\n            <CompanyPanel\n              user={user}\n              data={data}\n              reload={loadData}\n              flash={flash}\n              showError={setErrorMessage}\n            />\n          )}`;
  replaceApp(oldRender, newRender, 'company tab render');
}

if (!app.includes('function CompanyPanel(')) {
  const anchor = 'function AccessPanel({';
  const lines = [
    'function CompanyPanel({',
    '  user, data, reload, flash, showError,',
    '}: {',
    '  user: User;',
    '  data: Bootstrap;',
    '  reload: () => Promise<void>;',
    '  flash: (text: string) => void;',
    '  showError: (text: string) => void;',
    '}) {',
    '  const defaultProfile: CompanyProfile = {',
    "    name: data.workspace.name, shortName: '', businessType: '', npwp: '', nib: '', address: '', village: '', district: '', city: '', province: '', postalCode: '', phone: '', email: '', website: '', picName: '', picPosition: '', fiscalYearStartMonth: 1, currency: 'IDR', reportName: data.workspace.name, logoUrl: '',",
    '  };',
    '  const [profile, setProfile] = useState<CompanyProfile>(defaultProfile);',
    '  const [canEditProfile, setCanEditProfile] = useState(false);',
    '  const [profileLoading, setProfileLoading] = useState(true);',
    '  const [profileSaving, setProfileSaving] = useState(false);',
    '  const [coaStatus, setCoaStatus] = useState({ accounts: 0, mappings: 0 });',
    '',
    '  const loadProfile = async () => {',
    '    try {',
    '      setProfileLoading(true);',
    "      const [profileResult, coaResult] = await Promise.allSettled([api.get('/api/workspace/profile'), api.get('/api/accounting/accounts')]);",
    "      if (profileResult.status === 'fulfilled') {",
    '        const payload = profileResult.value.data as { profile?: CompanyProfile; canEdit?: boolean };',
    '        if (payload.profile) setProfile({ ...defaultProfile, ...payload.profile });',
    '        setCanEditProfile(Boolean(payload.canEdit));',
    '      }',
    "      if (coaResult.status === 'fulfilled') {",
    '        const payload = coaResult.value.data as { accounts?: unknown[]; systemMappings?: Record<string, string> };',
    '        setCoaStatus({ accounts: payload.accounts?.length || 0, mappings: Object.values(payload.systemMappings || {}).filter(Boolean).length });',
    '      }',
    '    } catch (err) {',
    "      showError(apiError(err, 'Profil Perusahaan belum dapat dimuat.'));",
    '    } finally {',
    '      setProfileLoading(false);',
    '    }',
    '  };',
    '',
    '  useEffect(() => { void loadProfile(); }, [data.workspace.id]);',
    '',
    '  const saveProfile = async (event: React.FormEvent) => {',
    '    event.preventDefault();',
    '    if (!canEditProfile) return;',
    "    if (profile.name.trim().length < 2) return showError('Nama perusahaan minimal 2 karakter.');",
    '    try {',
    '      setProfileSaving(true);',
    "      await api.put('/api/workspace/profile', profile);",
    '      await reload();',
    '      await loadProfile();',
    "      flash('Profil Perusahaan berhasil diperbarui.');",
    '    } catch (err) {',
    "      showError(apiError(err, 'Profil Perusahaan belum dapat disimpan.'));",
    '    } finally {',
    '      setProfileSaving(false);',
    '    }',
    '  };',
    '',
    '  const profileReady = Boolean(profile.name.trim() && profile.businessType.trim() && profile.address.trim());',
    '  const setupItems = [',
    "    { label: 'Profil Perusahaan', ready: profileReady, detail: profileReady ? 'Identitas utama terisi' : 'Lengkapi bentuk usaha dan alamat' },",
    "    { label: 'Chart of Accounts', ready: coaStatus.accounts > 0, detail: coaStatus.accounts > 0 ? coaStatus.accounts + ' akun tersedia' : 'Belum tersedia' },",
    "    { label: 'Akun Penting', ready: coaStatus.mappings > 0, detail: coaStatus.mappings > 0 ? coaStatus.mappings + ' mapping terhubung' : 'Belum diatur' },",
    "    { label: 'Kebun / Cost Center', ready: data.kebun.length > 0, detail: data.kebun.length > 0 ? data.kebun.length + ' kebun tersedia' : 'Belum ada kebun' },",
    "    { label: 'Kas & Bank', ready: data.accounts.length > 0, detail: data.accounts.length > 0 ? data.accounts.length + ' rekening tersedia' : 'Belum ada rekening' },",
    "    { label: 'Saldo Awal', ready: Boolean(data.accountingOpeningPosted), detail: data.accountingOpeningPosted ? 'Sudah diposting' : 'Belum diposting' },",
    '  ];',
    '  const readyCount = setupItems.filter(item => item.ready).length;',
    '  const progress = Math.round((readyCount / setupItems.length) * 100);',
    '',
    '  return (',
    '    <div className="stack">',
    '      <section className="company-profile-hero">',
    '        <div><span className="eyebrow">Perusahaan Aktif</span><h2>{profile.name || data.workspace.name}</h2><p>{profile.address || \'Alamat perusahaan belum dilengkapi.\'}</p></div>',
    '        <div className="company-setup-score"><strong>{progress}%</strong><span>Setup awal</span></div>',
    '      </section>',
    '',
    '      <section className="access-grid">',
    '        <form className="panel company-profile-form" onSubmit={saveProfile}>',
    '          <div className="panel-head"><div><h3>Profil Perusahaan</h3><p>Identitas ini menjadi sumber nama dan informasi perusahaan pada laporan.</p></div>{canEditProfile && <button className="primary small-btn" disabled={profileSaving || profileLoading}><Save size={15} /> {profileSaving ? \'Menyimpan...\' : \'Simpan Profil\'}</button>}</div>',
    '          <div className="company-form-grid">',
    '            <Field label="Nama Perusahaan"><input value={profile.name} disabled={!canEditProfile} onChange={e => setProfile(v => ({ ...v, name: e.target.value }))} /></Field>',
    '            <Field label="Nama Singkat / Brand"><input value={profile.shortName} disabled={!canEditProfile} onChange={e => setProfile(v => ({ ...v, shortName: e.target.value }))} /></Field>',
    '            <Field label="Bentuk Usaha"><select value={profile.businessType} disabled={!canEditProfile} onChange={e => setProfile(v => ({ ...v, businessType: e.target.value }))}><option value="">Pilih bentuk usaha</option><option>PT</option><option>CV</option><option>UD</option><option>Koperasi</option><option>Perorangan</option><option>Yayasan</option><option>Lainnya</option></select></Field>',
    '            <Field label="NPWP"><input value={profile.npwp} disabled={!canEditProfile} onChange={e => setProfile(v => ({ ...v, npwp: e.target.value }))} /></Field>',
    '            <Field label="NIB"><input value={profile.nib} disabled={!canEditProfile} onChange={e => setProfile(v => ({ ...v, nib: e.target.value }))} /></Field>',
    '            <Field label="Nama pada Laporan"><input value={profile.reportName} disabled={!canEditProfile} onChange={e => setProfile(v => ({ ...v, reportName: e.target.value }))} /></Field>',
    '            <Field label="Alamat Lengkap"><textarea rows={3} value={profile.address} disabled={!canEditProfile} onChange={e => setProfile(v => ({ ...v, address: e.target.value }))} /></Field>',
    '            <div className="company-form-grid nested">',
    '              <Field label="Kelurahan / Desa"><input value={profile.village} disabled={!canEditProfile} onChange={e => setProfile(v => ({ ...v, village: e.target.value }))} /></Field>',
    '              <Field label="Kecamatan"><input value={profile.district} disabled={!canEditProfile} onChange={e => setProfile(v => ({ ...v, district: e.target.value }))} /></Field>',
    '              <Field label="Kota / Kabupaten"><input value={profile.city} disabled={!canEditProfile} onChange={e => setProfile(v => ({ ...v, city: e.target.value }))} /></Field>',
    '              <Field label="Provinsi"><input value={profile.province} disabled={!canEditProfile} onChange={e => setProfile(v => ({ ...v, province: e.target.value }))} /></Field>',
    '              <Field label="Kode Pos"><input value={profile.postalCode} disabled={!canEditProfile} onChange={e => setProfile(v => ({ ...v, postalCode: e.target.value }))} /></Field>',
    '            </div>',
    '            <Field label="Telepon / WhatsApp"><input value={profile.phone} disabled={!canEditProfile} onChange={e => setProfile(v => ({ ...v, phone: e.target.value }))} /></Field>',
    '            <Field label="Email"><input type="email" value={profile.email} disabled={!canEditProfile} onChange={e => setProfile(v => ({ ...v, email: e.target.value }))} /></Field>',
    '            <Field label="Website"><input value={profile.website} disabled={!canEditProfile} onChange={e => setProfile(v => ({ ...v, website: e.target.value }))} /></Field>',
    '            <Field label="PIC / Penanggung Jawab"><input value={profile.picName} disabled={!canEditProfile} onChange={e => setProfile(v => ({ ...v, picName: e.target.value }))} /></Field>',
    '            <Field label="Jabatan PIC"><input value={profile.picPosition} disabled={!canEditProfile} onChange={e => setProfile(v => ({ ...v, picPosition: e.target.value }))} /></Field>',
    '            <Field label="Awal Tahun Buku"><select value={profile.fiscalYearStartMonth} disabled={!canEditProfile} onChange={e => setProfile(v => ({ ...v, fiscalYearStartMonth: Number(e.target.value) }))}>{[\'Januari\',\'Februari\',\'Maret\',\'April\',\'Mei\',\'Juni\',\'Juli\',\'Agustus\',\'September\',\'Oktober\',\'November\',\'Desember\'].map((name, index) => <option key={name} value={index + 1}>{name}</option>)}</select></Field>',
    '            <Field label="Mata Uang"><select value={profile.currency} disabled={!canEditProfile} onChange={e => setProfile(v => ({ ...v, currency: e.target.value }))}><option value="IDR">IDR - Rupiah</option></select></Field>',
    '            <Field label="URL Logo (opsional)"><input value={profile.logoUrl} disabled={!canEditProfile} placeholder="https://..." onChange={e => setProfile(v => ({ ...v, logoUrl: e.target.value }))} /></Field>',
    '          </div>',
    '        </form>',
    '',
    '        <section className="panel">',
    '          <div className="panel-head"><div><h3>Status Setup Awal</h3><p>Indikator kesiapan perusahaan sebelum transaksi rutin.</p></div><span className="role-badge">{readyCount}/{setupItems.length}</span></div>',
    '          <div className="setup-progress"><span style={{ width: progress + \'%\' }} /></div>',
    '          <div className="setup-checklist">{setupItems.map(item => <div key={item.label} className={item.ready ? \'ready\' : \'\'}><span className="setup-dot">{item.ready ? \'✓\' : \'!\'}</span><div><strong>{item.label}</strong><small>{item.detail}</small></div></div>)}</div>',
    '          <div className="notice">Status ini membantu screening awal. Kesiapan final tetap mengikuti validasi COA, Akun Penting, subledger, periode, dan Saldo Awal.</div>',
    '        </section>',
    '      </section>',
    '',
    '      <AccessPanel user={user} data={data} reload={reload} flash={flash} showError={showError} />',
    '    </div>',
    '  );',
    '}',
    '',
    anchor,
  ];
  replaceApp(anchor, lines.join('\n'), 'CompanyPanel component');
}

if (!css.includes('/* v4.12 company profile */')) {
  css += `\n\n/* v4.12 company profile */\n.company-profile-hero { background: linear-gradient(125deg,#173d2c,#346247); color: #fff; border-radius: 19px; padding: 24px 26px; display: flex; align-items: center; justify-content: space-between; gap: 20px; }\n.company-profile-hero h2 { margin: 7px 0 5px; font-size: 24px; }\n.company-profile-hero p { margin: 0; color: #c8d9ce; font-size: 11px; }\n.company-setup-score { min-width: 100px; border-left: 1px solid rgba(255,255,255,.16); padding-left: 24px; text-align: right; }\n.company-setup-score strong, .company-setup-score span { display: block; }\n.company-setup-score strong { font-size: 26px; color: #d8ec9e; }\n.company-setup-score span { font-size: 10px; color: #bed0c5; margin-top: 2px; }\n.company-profile-form { align-self: start; }\n.company-form-grid { display: grid; grid-template-columns: repeat(2,minmax(0,1fr)); gap: 12px; }\n.company-form-grid > .field:nth-of-type(7) { grid-column: 1 / -1; }\n.company-form-grid.nested { grid-column: 1 / -1; grid-template-columns: repeat(2,minmax(0,1fr)); background: #f7f9f6; padding: 12px; border-radius: 12px; border: 1px solid #e7ece5; }\n.setup-progress { height: 8px; background: #edf1eb; border-radius: 99px; overflow: hidden; margin-bottom: 14px; }\n.setup-progress span { display: block; height: 100%; background: #69a269; border-radius: inherit; transition: width .2s ease; }\n.setup-checklist { display: grid; gap: 8px; margin-bottom: 14px; }\n.setup-checklist > div { display: flex; align-items: center; gap: 10px; padding: 11px; border: 1px solid #ecefeb; border-radius: 11px; background: #fbfcfa; }\n.setup-checklist > div.ready { background: #f3f8ef; border-color: #dcebd6; }\n.setup-dot { width: 26px; height: 26px; border-radius: 50%; display: grid; place-items: center; background: #f5e8d5; color: #8a6228; font-size: 11px; font-weight: 900; }\n.setup-checklist > div.ready .setup-dot { background: #dff0d9; color: #2f6d3c; }\n.setup-checklist strong, .setup-checklist small { display: block; }\n.setup-checklist strong { font-size: 11px; }\n.setup-checklist small { font-size: 9px; color: #87938a; margin-top: 2px; }\n@media (max-width: 760px) { .company-form-grid, .company-form-grid.nested { grid-template-columns: 1fr; } .company-form-grid > .field:nth-of-type(7) { grid-column: auto; } .company-profile-hero { align-items: flex-start; } .company-setup-score { min-width: auto; padding-left: 14px; } }\n`;
  cssChanged = true;
}

if (appChanged) fs.writeFileSync(appFile, app);
if (cssChanged) fs.writeFileSync(cssFile, css);
console.log(appChanged || cssChanged ? 'v76 company panel applied.' : 'v76 company panel already applied.');
