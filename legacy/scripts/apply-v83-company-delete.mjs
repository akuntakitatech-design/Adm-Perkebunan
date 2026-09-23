import fs from 'node:fs';

const appPath = 'src/FarmApp.tsx';
const cssPath = 'src/farm.css';
const backendPath = 'backend/index.ts';
const sdkPath = 'backend/localSdk.ts';

let app = fs.readFileSync(appPath, 'utf8');
let css = fs.readFileSync(cssPath, 'utf8');
let backend = fs.readFileSync(backendPath, 'utf8');
let sdk = fs.readFileSync(sdkPath, 'utf8');

const marker = '/* v4.15 company deletion */';
if (app.includes(marker) && backend.includes(marker) && sdk.includes(marker)) process.exit(0);

function replaceOnce(source, from, to, label) {
  if (!source.includes(from)) throw new Error(`Anchor not found: ${label}`);
  return source.replace(from, to);
}

// Local SDK: backup all workspace rows to a JSON file, then delete the workspace rows,
// memberships, and active-workspace pointers in one database transaction.
if (!sdk.includes('export async function backupAndDeleteWorkspace(')) {
  const anchor = `export const storage = {`;
  const helper = `export async function backupAndDeleteWorkspace(\n  workspaceId: string,\n  details: { workspaceName: string; deletedBy: string }\n) {\n  const normalizedId = workspaceId.trim();\n  if (!/^[A-Za-z0-9._-]{1,160}$/.test(normalizedId)) throw new Error('Workspace ID tidak valid.');\n  const client = await pool.connect();\n  try {\n    await client.query('BEGIN');\n    const rows = await client.query<{ table_name: string; id: string; record: unknown; created_at: Date; updated_at: Date }>(\n      \`SELECT table_name, id, record, created_at, updated_at\n       FROM app_records\n       WHERE RIGHT(table_name, LENGTH($1) + 1) = ':' || $1\n          OR record->>'workspaceId' = $1\n          OR record->>'activeWorkspaceId' = $1\n       FOR UPDATE\`,\n      [normalizedId]\n    );\n\n    const backupDir = path.join(storageRoot, 'workspace-deletions');\n    await fs.mkdir(backupDir, { recursive: true });\n    const stamp = new Date().toISOString().replace(/[:.]/g, '-');\n    const fileName = \`${'${stamp}'}-${'${normalizedId}'}.json\`;\n    const backupPayload = {\n      version: 1,\n      workspaceId: normalizedId,\n      workspaceName: details.workspaceName,\n      deletedBy: details.deletedBy,\n      deletedAt: new Date().toISOString(),\n      rows: rows.rows,\n    };\n    await fs.writeFile(path.join(backupDir, fileName), JSON.stringify(backupPayload));\n\n    const deleted = await client.query(\n      \`DELETE FROM app_records\n       WHERE RIGHT(table_name, LENGTH($1) + 1) = ':' || $1\n          OR record->>'workspaceId' = $1\n          OR record->>'activeWorkspaceId' = $1\`,\n      [normalizedId]\n    );\n    await client.query('COMMIT');\n    return { deletedCount: deleted.rowCount || 0, backupPath: \`workspace-deletions/${'${fileName}'}\` };\n  } catch (err) {\n    await client.query('ROLLBACK');\n    throw err;\n  } finally {\n    client.release();\n  }\n}\n\n${marker}\n\n${anchor}`;
  sdk = replaceOnce(sdk, anchor, helper, 'workspace deletion SDK helper');
}

// Backend route: current company only, OWNER only, exact-name confirmation, and require
// at least one other company so the user always has a safe fallback after deletion.
if (!backend.includes("'POST /api/workspace/delete': [")) {
  backend = replaceOnce(
    backend,
    `import { db, router, json, error, requireAuth, storage } from './localSdk';`,
    `import { db, router, json, error, requireAuth, storage, backupAndDeleteWorkspace } from './localSdk';`,
    'localSdk import',
  );
  const anchor = `  'POST /api/workspace/create': [`;
  const route = `  'POST /api/workspace/delete': [\n    requireAuth(),\n    async ctx => {\n      const wc = await workspaceContext(ctx.user!);\n      if (wc.membership.role !== 'OWNER') return error('Hanya Owner yang dapat menghapus perusahaan.', 403);\n      if (wc.memberships.length <= 1) {\n        return error('Perusahaan terakhir tidak dapat dihapus. Buat atau gabung ke perusahaan lain terlebih dahulu.', 409);\n      }\n\n      const metaRows = (await db.list<WorkspaceMeta>(metaTable(wc.workspaceId), { limit: 1 })).items;\n      const companyName = (metaRows[0]?.name || wc.workspaceName).trim();\n      const body = objectBody(ctx.body);\n      const confirmationName = text(body.confirmationName);\n      if (!confirmationName || confirmationName !== companyName) {\n        return error('Nama perusahaan untuk konfirmasi belum sesuai.', 400);\n      }\n\n      const result = await backupAndDeleteWorkspace(wc.workspaceId, {\n        workspaceName: companyName,\n        deletedBy: ctx.user!.userId,\n      });\n\n      return json({\n        deleted: true,\n        workspaceId: wc.workspaceId,\n        workspaceName: companyName,\n        deletedCount: result.deletedCount,\n      });\n    },\n  ],\n\n${marker}\n\n${anchor}`;
  backend = replaceOnce(backend, anchor, route, 'workspace create route');
}

// FarmApp: after deletion, reload fallback company data, clear browser company session,
// return to the company selector, and keep the deleted company out of the selector.
if (!app.includes('onCompanyDeleted={() => {')) {
  const oldRender = `            <CompanyPanel\n              user={user}\n              data={data}\n              reload={loadData}\n              flash={flash}\n              showError={setErrorMessage}\n            />`;
  const newRender = `            <CompanyPanel\n              user={user}\n              data={data}\n              reload={loadData}\n              flash={flash}\n              showError={setErrorMessage}\n              onCompanyDeleted={() => {\n                clearCompanySession();\n                setCompanySelected(false);\n                setTab('dashboard');\n                storeChoice(mainTabStorageKey, 'dashboard');\n                if (typeof window !== 'undefined') window.history.replaceState({}, '', '/');\n              }}\n            />`;
  app = replaceOnce(app, oldRender, newRender, 'CompanyPanel render props');
}

if (!app.includes("const [deleteConfirmation, setDeleteConfirmation]")) {
  app = replaceOnce(
    app,
    `  user, data, reload, flash, showError,\n}: {\n  user: User;\n  data: Bootstrap;\n  reload: () => Promise<void>;\n  flash: (text: string) => void;\n  showError: (text: string) => void;\n}) {`,
    `  user, data, reload, flash, showError, onCompanyDeleted,\n}: {\n  user: User;\n  data: Bootstrap;\n  reload: () => Promise<void>;\n  flash: (text: string) => void;\n  showError: (text: string) => void;\n  onCompanyDeleted: () => void;\n}) {`,
    'CompanyPanel props',
  );
  app = replaceOnce(
    app,
    `  const [profileSaving, setProfileSaving] = useState(false);\n  const [coaStatus, setCoaStatus] = useState({ accounts: 0, mappings: 0 });`,
    `  const [profileSaving, setProfileSaving] = useState(false);\n  const [deleteOpen, setDeleteOpen] = useState(false);\n  const [deleteConfirmation, setDeleteConfirmation] = useState('');\n  const [deletingCompany, setDeletingCompany] = useState(false);\n  const [coaStatus, setCoaStatus] = useState({ accounts: 0, mappings: 0 });`,
    'CompanyPanel deletion state',
  );

  const handlerAnchor = `  const profileReady = Boolean(profile.name.trim() && profile.businessType.trim() && profile.address.trim());`;
  const handler = `  const deleteCompany = async () => {\n    if (data.workspace.role !== 'OWNER') return showError('Hanya Owner yang dapat menghapus perusahaan.');\n    const expectedName = (profile.name || data.workspace.name).trim();\n    if (data.workspaces.length <= 1) return showError('Buat atau gabung ke perusahaan lain terlebih dahulu sebelum menghapus perusahaan ini.');\n    if (deleteConfirmation.trim() !== expectedName) return showError('Ketik nama perusahaan persis seperti yang tampil untuk melanjutkan.');\n    try {\n      setDeletingCompany(true);\n      await api.post('/api/workspace/delete', { confirmationName: deleteConfirmation.trim() });\n      await reload();\n      setDeleteConfirmation('');\n      setDeleteOpen(false);\n      flash('Perusahaan berhasil dihapus.');\n      onCompanyDeleted();\n    } catch (err) {\n      showError(apiError(err, 'Perusahaan belum dapat dihapus.'));\n    } finally {\n      setDeletingCompany(false);\n    }\n  };\n\n${handlerAnchor}`;
  app = replaceOnce(app, handlerAnchor, handler, 'CompanyPanel delete handler');

  const accessAnchor = `      <AccessPanel user={user} data={data} reload={reload} flash={flash} showError={showError} />`;
  const dangerZone = `      {data.workspace.role === 'OWNER' && (\n        <section className="panel company-danger-zone">\n          <div className="panel-head">\n            <div><h3>Hapus Perusahaan</h3><p>Menghapus perusahaan aktif beserta seluruh master, transaksi, persediaan, jurnal, laporan, akses user, dan data terkait. Perusahaan lain tidak terpengaruh.</p></div>\n            {!deleteOpen && <button type="button" className="danger-button" disabled={data.workspaces.length <= 1} onClick={() => { setDeleteConfirmation(''); setDeleteOpen(true); }}><Trash2 size={16} /> Hapus Perusahaan</button>}\n          </div>\n          {data.workspaces.length <= 1 && <div className="notice danger-note">Perusahaan terakhir tidak dapat dihapus. Buat atau gabung ke perusahaan lain terlebih dahulu.</div>}\n          {deleteOpen && data.workspaces.length > 1 && (\n            <div className="company-delete-confirmation">\n              <div className="inline-error"><strong>Tindakan ini permanen.</strong> Backup internal dibuat sebelum data dihapus. Untuk konfirmasi, ketik nama perusahaan berikut: <strong>{profile.name || data.workspace.name}</strong></div>\n              <Field label="Ketik nama perusahaan"><input autoFocus value={deleteConfirmation} onChange={event => setDeleteConfirmation(event.target.value)} placeholder={profile.name || data.workspace.name} /></Field>\n              <div className="company-delete-actions">\n                <button type="button" className="secondary" disabled={deletingCompany} onClick={() => { setDeleteOpen(false); setDeleteConfirmation(''); }}>Batal</button>\n                <button type="button" className="danger-button" disabled={deletingCompany || deleteConfirmation.trim() !== (profile.name || data.workspace.name).trim()} onClick={() => void deleteCompany()}><Trash2 size={16} /> {deletingCompany ? 'Menghapus...' : 'Ya, Hapus Permanen'}</button>\n              </div>\n            </div>\n          )}\n        </section>\n      )}\n\n${accessAnchor}`;
  app = replaceOnce(app, accessAnchor, dangerZone, 'CompanyPanel danger zone');
}

if (!css.includes('/* v4.15 company deletion */')) {
  css += `\n\n/* v4.15 company deletion */\n.company-danger-zone { border: 1px solid #f0c7c2; background: #fffafa; }\n.company-danger-zone .panel-head { align-items: flex-start; }\n.company-danger-zone h3 { color: #9f2f25; }\n.company-danger-zone .panel-head p { max-width: 760px; }\n.danger-button { border: 0; border-radius: 10px; background: #b33a2f; color: #fff; min-height: 38px; padding: 0 14px; font: inherit; font-size: 12px; font-weight: 700; display: inline-flex; align-items: center; justify-content: center; gap: 7px; cursor: pointer; }\n.danger-button:hover:not(:disabled) { background: #942d24; }\n.danger-button:disabled { opacity: .45; cursor: not-allowed; }\n.company-delete-confirmation { margin-top: 14px; padding-top: 14px; border-top: 1px solid #efd9d6; display: grid; gap: 12px; max-width: 760px; }\n.company-delete-actions { display: flex; justify-content: flex-end; gap: 10px; flex-wrap: wrap; }\n.danger-note { border-color: #eed4d0; background: #fff5f3; color: #8d463f; }\n@media (max-width: 720px) { .company-danger-zone .panel-head { display: grid; gap: 12px; } .danger-button { width: 100%; } .company-delete-actions > button { flex: 1 1 140px; } }\n`;
}

if (app.includes('Perkebunan · v4.14.1')) app = app.replace('Perkebunan · v4.14.1', 'Perkebunan · v4.15.0');
else if (!app.includes('Perkebunan · v4.15.0')) throw new Error('App version anchor v4.14.1 not found');

if (!app.includes(marker)) app += `\n${marker}\n`;
if (!backend.includes(marker)) backend += `\n${marker}\n`;
if (!sdk.includes(marker)) sdk += `\n${marker}\n`;

fs.writeFileSync(appPath, app);
fs.writeFileSync(cssPath, css);
fs.writeFileSync(backendPath, backend);
fs.writeFileSync(sdkPath, sdk);
