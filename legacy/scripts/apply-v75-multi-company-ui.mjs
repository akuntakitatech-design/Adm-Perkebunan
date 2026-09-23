import fs from 'node:fs';

const file = 'src/FarmApp.tsx';
let source = fs.readFileSync(file, 'utf8');

if (source.includes("const [companyName, setCompanyName] = useState('');")) {
  console.log('v75 multi-company UI already applied.');
  process.exit(0);
}

function replaceOnce(from, to, label) {
  if (!source.includes(from)) throw new Error(`Anchor not found: ${label}`);
  source = source.replace(from, to);
}

replaceOnce(
  "  const [joinCode, setJoinCode] = useState('');\n  const [invite, setInvite] = useState({ email: '', role: 'VIEWER' as Exclude<Role, 'OWNER'>, assignedKebunId: '' });",
  "  const [companyName, setCompanyName] = useState('');\n  const [joinCode, setJoinCode] = useState('');\n  const [invite, setInvite] = useState({ email: '', role: 'VIEWER' as Exclude<Role, 'OWNER'>, assignedKebunId: '' });",
  'company state'
);

replaceOnce(
  "  const join = async (e: React.FormEvent) => {",
  `  const createCompany = async (e: React.FormEvent) => {\n    e.preventDefault();\n    const name = companyName.trim();\n    if (name.length < 2) return showError('Nama perusahaan minimal 2 karakter.');\n    try {\n      setSaving(true);\n      await api.post('/api/workspace/create', { name });\n      setCompanyName('');\n      await reload();\n      flash('Perusahaan baru dibuat dan langsung diaktifkan.');\n    } catch (err) { showError(apiError(err, 'Perusahaan baru belum dapat dibuat.')); }\n    finally { setSaving(false); }\n  };\n\n  const join = async (e: React.FormEvent) => {`,
  'create company handler'
);

replaceOnce(
  '<div className="panel-head"><div><h3>Workspace Saya</h3><p>Data dipisahkan per perusahaan/workspace.</p></div><span className="role-badge">{roleLabel(data.workspace.role)}</span></div>',
  '<div className="panel-head"><div><h3>Perusahaan Saya</h3><p>Satu login dapat mengelola beberapa perusahaan. Data setiap perusahaan tetap terpisah.</p></div><span className="role-badge">{roleLabel(data.workspace.role)}</span></div>',
  'company panel heading'
);

replaceOnce(
  '<div className="workspace-current"><ShieldCheck size={24} /><div><strong>{data.workspace.name}</strong><span>Workspace aktif</span></div></div>',
  '<div className="workspace-current"><ShieldCheck size={24} /><div><strong>{data.workspace.name}</strong><span>Perusahaan aktif</span></div></div>',
  'active company label'
);

replaceOnce(
  `          <form className="join-form" onSubmit={join}>\n            <Field label="Gabung Workspace dengan Kode Undangan"><input placeholder="Tempel kode undangan" value={joinCode} onChange={e => setJoinCode(e.target.value)} /></Field>\n            <button className="secondary" disabled={saving}>Gabung Workspace</button>\n          </form>`,
  `          <form className="join-form" onSubmit={createCompany}>\n            <Field label="Tambah Perusahaan Baru"><input placeholder="Contoh: PT Sawit Makmur" value={companyName} onChange={e => setCompanyName(e.target.value)} maxLength={120} /></Field>\n            <button className="primary" disabled={saving || companyName.trim().length < 2}><Building2 size={16} /> Buat Perusahaan</button>\n          </form>\n          <form className="join-form" onSubmit={join}>\n            <Field label="Gabung Perusahaan dengan Kode Undangan"><input placeholder="Tempel kode undangan" value={joinCode} onChange={e => setJoinCode(e.target.value)} /></Field>\n            <button className="secondary" disabled={saving}>Gabung Perusahaan</button>\n          </form>`,
  'company create form'
);

source = source
  .replace("flash('Workspace berhasil diganti.');", "flash('Perusahaan aktif berhasil diganti.');")
  .replace("apiError(err, 'Workspace gagal diganti.')", "apiError(err, 'Perusahaan gagal diganti.')")
  .replace("showError('Masukkan kode undangan workspace.')", "showError('Masukkan kode undangan perusahaan.')")
  .replace("flash('Berhasil bergabung dan berpindah ke workspace baru.');", "flash('Berhasil bergabung dan berpindah ke perusahaan baru.');")
  .replace('<div className="panel-head"><div><h3>Akses Saya</h3><p>Hak akses mengikuti role di workspace aktif.</p></div></div>', '<div className="panel-head"><div><h3>Akses Saya</h3><p>Hak akses mengikuti role di perusahaan aktif.</p></div></div>')
  .replace('<div className="panel-head"><div><h3>Anggota Workspace</h3><p>{data.members.length} pengguna terdaftar.</p></div></div>', '<div className="panel-head"><div><h3>Pengguna Perusahaan</h3><p>{data.members.length} pengguna terdaftar pada perusahaan aktif.</p></div></div>');

fs.writeFileSync(file, source);
console.log('v75 multi-company UI applied.');
