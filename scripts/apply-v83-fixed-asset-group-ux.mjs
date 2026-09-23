import fs from 'node:fs';

const file = 'src/FixedAssets.tsx';
let source = fs.readFileSync(file, 'utf8');
const marker = '// v83-fixed-asset-group-ux';

if (source.includes(marker)) {
  console.log('v83 fixed asset group UX already applied');
  process.exit(0);
}

const importNeedle = "import { formatMoneyInput } from './moneyInput';";
if (!source.includes(importNeedle)) throw new Error('FixedAssets import anchor not found');
source = source.replace(importNeedle, `${importNeedle}\n${marker}`);

const stateNeedle = "  const [saving, setSaving] = useState(false);\n  const [openingDepreciationThroughDate, setOpeningDepreciationThroughDate] = useState('');";
if (!source.includes(stateNeedle)) throw new Error('FixedAssets state anchor not found');
source = source.replace(stateNeedle, "  const [saving, setSaving] = useState(false);\n  const [groupFormOpen, setGroupFormOpen] = useState(false);\n  const [accountLoadIssue, setAccountLoadIssue] = useState(false);\n  const [openingDepreciationThroughDate, setOpeningDepreciationThroughDate] = useState('');");

const loadStart = source.indexOf('  const load = async () => {');
const loadEnd = source.indexOf('  useEffect(() => { void load(); }, [workspaceId]);', loadStart);
if (loadStart < 0 || loadEnd < 0) throw new Error('FixedAssets load block not found');
const newLoad = `  const load = async () => {
    const [masterResult, accountResult] = await Promise.allSettled([
      api.get('/api/fixed-assets/master'),
      api.get('/api/accounting/accounts'),
    ]);
    if (masterResult.status === 'fulfilled') {
      const master = masterResult.value.data as { groups: FixedAssetGroup[]; assets: FixedAsset[]; openingDepreciationThroughDate?: string };
      setGroups(master.groups || []);
      setAssets(master.assets || []);
      setOpeningDepreciationThroughDate(master.openingDepreciationThroughDate || '');
    } else {
      showError(apiError(masterResult.reason, 'Kelompok dan Daftar Aset Tetap gagal dimuat.'));
    }
    if (accountResult.status === 'fulfilled') {
      setAccounts((accountResult.value.data as { accounts: AccountingAccount[] }).accounts || []);
      setAccountLoadIssue(false);
    } else {
      setAccounts([]);
      setAccountLoadIssue(true);
      showError(apiError(accountResult.reason, 'COA untuk mapping Aset Tetap gagal dimuat. Kelompok aset tetap tetap ditampilkan dan akun dapat dimuat ulang.'));
    }
  };
`;
source = source.slice(0, loadStart) + newLoad + source.slice(loadEnd);

const accountNeedle = "  const assetAccounts = postingAccounts.filter(item => item.group === 'ASSET');\n  const expenseAccounts = postingAccounts.filter(item => item.group === 'EXPENSE');\n  const revenueAccounts = postingAccounts.filter(item => item.group === 'REVENUE');";
if (!source.includes(accountNeedle)) throw new Error('FixedAssets account filters anchor not found');
source = source.replace(accountNeedle, "  const assetAccounts = postingAccounts.filter(item => item.group === 'ASSET');\n  const expenseAccounts = postingAccounts.filter(item => item.group === 'EXPENSE');\n  const revenueAccounts = postingAccounts.filter(item => item.group === 'REVENUE');\n  const eligibleAssetAccounts = assetAccounts.length > 0 ? assetAccounts : postingAccounts;\n  const eligibleExpenseAccounts = expenseAccounts.length > 0 ? expenseAccounts : postingAccounts;\n  const eligibleRevenueAccounts = revenueAccounts.length > 0 ? revenueAccounts : postingAccounts;\n  const duplicateGroup = !groupForm.id && groupForm.name.trim() ? groups.find(item => item.name.trim().toLowerCase() === groupForm.name.trim().toLowerCase()) : undefined;");

const closeNeedle = "setGroupForm(blankGroup()); await load(); flash(edited ? 'Kelompok Aset Tetap diperbarui.' : 'Kelompok Aset Tetap ditambahkan.');";
if (!source.includes(closeNeedle)) throw new Error('FixedAssets save group close anchor not found');
source = source.replace(closeNeedle, "setGroupForm(blankGroup()); setGroupFormOpen(false); await load(); flash(edited ? 'Kelompok Aset Tetap diperbarui.' : 'Kelompok Aset Tetap ditambahkan.');");

const removeNeedle = "  const removeGroup = async (id: string) => {";
if (!source.includes(removeNeedle)) throw new Error('FixedAssets remove group anchor not found');
const editHelper = `  const editGroup = (item: FixedAssetGroup) => {
    setGroupForm({ id: item.id, code: item.code, name: item.name, depreciable: item.depreciable, depreciationMethod: item.depreciationMethod, usefulLifeMonths: String(item.usefulLifeMonths || ''), defaultResidualRate: String(item.defaultResidualRate || 0), measurementModel: item.measurementModel, assetAccountId: item.assetAccountId, accumulatedDepreciationAccountId: item.accumulatedDepreciationAccountId, depreciationExpenseAccountId: item.depreciationExpenseAccountId, gainAccountId: item.gainAccountId, lossAccountId: item.lossAccountId, active: item.active });
    setGroupFormOpen(true);
    window.requestAnimationFrame(() => document.getElementById('fixed-asset-group-form')?.scrollIntoView({ behavior: 'smooth', block: 'start' }));
  };
`;
source = source.replace(removeNeedle, editHelper + removeNeedle);

const groupStart = source.indexOf('  if (section === \'groups\') return <div className="stack">');
const groupEnd = source.indexOf('\n\n  return <div className="stack"><section', groupStart);
if (groupStart < 0 || groupEnd < 0) throw new Error('FixedAssets groups render block not found');

const newGroupSection = `  if (section === 'groups') return <div className="stack">
    <section className="panel">
      <div className="panel-head wrap"><div><h3>Daftar Kelompok Aset Tetap</h3><p>{groups.length} kelompok tersedia. Kelompok standar yang sudah ada tidak perlu dibuat ulang.</p></div><button type="button" className="primary" onClick={() => { setGroupForm(blankGroup()); setGroupFormOpen(true); }}>+ Tambah Kelompok</button></div>
      <div className="notice">Kelompok standar awal tetap tersimpan per perusahaan. Pilih ikon edit untuk melihat atau mengubah mapping akun kelompok yang sudah ada.</div>
      {groups.length === 0 ? <div className="empty"><span>Belum ada kelompok aset tetap. Jika sebelumnya ada kelompok standar, coba muat ulang halaman sebelum membuat ulang.</span></div> : <div className="table-wrap"><table><thead><tr><th>Kode</th><th>Kelompok</th><th>Metode</th><th>Umur</th><th>Akun Aset</th><th>Status</th><th></th></tr></thead><tbody>{groups.map(item => <tr key={item.id}><td><strong>{item.code}</strong></td><td>{item.name}</td><td>{methodLabel[item.depreciationMethod]}</td><td>{item.depreciable ? String(item.usefulLifeMonths) + ' bln (' + (item.usefulLifeMonths / 12).toFixed(1) + ' th)' : '-'}</td><td>{accountMap.get(item.assetAccountId)?.code || '-'} · {accountMap.get(item.assetAccountId)?.name || (accounts.length === 0 ? 'COA belum termuat' : 'Belum dipetakan')}</td><td><span className={'status ' + (item.active ? 'active' : '')}>{item.active ? 'AKTIF' : 'NONAKTIF'}</span></td><td><div className="action-group"><button type="button" className="icon-btn" aria-label={'Edit ' + item.name} onClick={() => editGroup(item)}><Pencil size={15} /></button><button type="button" className="icon-btn danger" aria-label={'Hapus ' + item.name} onClick={() => removeGroup(item.id)}><Trash2 size={15} /></button></div></td></tr>)}</tbody></table></div>}
    </section>

    {accountLoadIssue && <section className="panel"><div className="notice">Daftar COA belum berhasil dimuat. Data kelompok aset tetap tetap aman. Klik tombol berikut untuk mencoba memuat akun kembali.</div><div className="form-actions"><button type="button" className="secondary" onClick={() => void load()}>Muat Ulang Akun</button></div></section>}

    {groupFormOpen && <section id="fixed-asset-group-form" className="panel"><div className="panel-head wrap"><div><h3>{groupForm.id ? 'Edit Kelompok Aset Tetap' : 'Tambah Kelompok Aset Tetap'}</h3><p>Klik kolom akun untuk menampilkan daftar akun posting, lalu cari dengan kode atau nama.</p></div><button type="button" className="secondary" onClick={() => { setGroupForm(blankGroup()); setGroupFormOpen(false); }}>Tutup</button></div>
      {!groupForm.id && duplicateGroup && <div className="notice">Kelompok <strong>{duplicateGroup.code} · {duplicateGroup.name}</strong> sudah ada. Sebaiknya edit kelompok tersebut, bukan membuat duplikat. <button type="button" className="text-btn" onClick={() => editGroup(duplicateGroup)}>Edit kelompok existing</button></div>}
      <form className="mini-form" onSubmit={saveGroup}>
        <div className="row-2"><Field label="Kode Kelompok"><input value={groupForm.code} onChange={event => setGroupForm(value => ({ ...value, code: event.target.value }))} placeholder="Otomatis bila kosong" /></Field><Field label="Nama Kelompok"><input value={groupForm.name} onChange={event => setGroupForm(value => ({ ...value, name: event.target.value }))} placeholder="Bangunan / Kendaraan / Prasarana" /></Field></div>
        <label className="check-row"><input type="checkbox" checked={groupForm.depreciable} onChange={event => setGroupForm(value => ({ ...value, depreciable: event.target.checked, depreciationMethod: event.target.checked ? (value.depreciationMethod === 'NONE' ? 'STRAIGHT_LINE' : value.depreciationMethod) : 'NONE', usefulLifeMonths: event.target.checked ? value.usefulLifeMonths : '0', accumulatedDepreciationAccountId: event.target.checked ? value.accumulatedDepreciationAccountId : '', depreciationExpenseAccountId: event.target.checked ? value.depreciationExpenseAccountId : '' }))} /><span>Disusutkan</span></label>
        <div className="row-2"><Field label="Metode Penyusutan"><select disabled={!groupForm.depreciable} value={groupForm.depreciationMethod} onChange={event => setGroupForm(value => ({ ...value, depreciationMethod: event.target.value as DepreciationMethod }))}><option value="STRAIGHT_LINE">Garis Lurus</option><option value="DECLINING_BALANCE">Saldo Menurun</option><option value="UNITS_OF_PRODUCTION">Unit Produksi</option><option value="NONE">Tidak Disusutkan</option></select></Field><Field label="Umur Manfaat Default (bulan)"><input disabled={!groupForm.depreciable} inputMode="numeric" value={groupForm.usefulLifeMonths} onChange={event => setGroupForm(value => ({ ...value, usefulLifeMonths: event.target.value.replace(/[^0-9]/g, '') }))} placeholder="Contoh 240" /></Field></div>
        <div className="row-2"><Field label="Nilai Residu Default (%)"><input inputMode="decimal" value={groupForm.defaultResidualRate} onChange={event => setGroupForm(value => ({ ...value, defaultResidualRate: event.target.value.replace(',', '.').replace(/[^0-9.]/g, '') }))} /></Field><Field label="Model Pengukuran"><select value={groupForm.measurementModel} onChange={event => setGroupForm(value => ({ ...value, measurementModel: event.target.value as MeasurementModel }))}><option value="COST">Model Biaya</option><option value="REVALUATION">Model Revaluasi</option></select></Field></div>
        <Field label="Akun Aset"><AccountSearchPicker accounts={includeSelected(eligibleAssetAccounts, groupForm.assetAccountId, accounts)} value={groupForm.assetAccountId} onChange={assetAccountId => setGroupForm(value => ({ ...value, assetAccountId }))} placeholder="Klik atau ketik kode/nama akun aset..." ariaLabel="Cari akun aset tetap" /></Field>
        {groupForm.depreciable && <div className="row-2"><Field label="Akumulasi Penyusutan"><AccountSearchPicker accounts={includeSelected(eligibleAssetAccounts, groupForm.accumulatedDepreciationAccountId, accounts)} value={groupForm.accumulatedDepreciationAccountId} onChange={accumulatedDepreciationAccountId => setGroupForm(value => ({ ...value, accumulatedDepreciationAccountId }))} placeholder="Klik atau ketik akun akumulasi..." ariaLabel="Cari akun akumulasi penyusutan" /></Field><Field label="Beban Penyusutan Default"><AccountSearchPicker accounts={includeSelected(eligibleExpenseAccounts, groupForm.depreciationExpenseAccountId, accounts)} value={groupForm.depreciationExpenseAccountId} onChange={depreciationExpenseAccountId => setGroupForm(value => ({ ...value, depreciationExpenseAccountId }))} placeholder="Klik atau ketik akun beban penyusutan..." ariaLabel="Cari akun beban penyusutan" /></Field></div>}
        <div className="row-2"><Field label="Laba Pelepasan Aset"><AccountSearchPicker accounts={includeSelected(eligibleRevenueAccounts, groupForm.gainAccountId, accounts)} value={groupForm.gainAccountId} onChange={gainAccountId => setGroupForm(value => ({ ...value, gainAccountId }))} placeholder="Klik atau ketik akun laba pelepasan..." ariaLabel="Cari akun laba pelepasan aset" /></Field><Field label="Rugi Pelepasan / Penghapusan"><AccountSearchPicker accounts={includeSelected(eligibleExpenseAccounts, groupForm.lossAccountId, accounts)} value={groupForm.lossAccountId} onChange={lossAccountId => setGroupForm(value => ({ ...value, lossAccountId }))} placeholder="Klik atau ketik akun rugi pelepasan..." ariaLabel="Cari akun rugi pelepasan aset" /></Field></div>
        <Field label="Status"><select value={groupForm.active ? 'ACTIVE' : 'INACTIVE'} onChange={event => setGroupForm(value => ({ ...value, active: event.target.value === 'ACTIVE' }))}><option value="ACTIVE">Aktif</option><option value="INACTIVE">Nonaktif</option></select></Field>
        <div className="notice">COA aktif yang termuat: <strong>{postingAccounts.length}</strong> akun posting. Daftar akun muncul saat kolom mapping diklik.</div>
        <div className="form-actions"><button type="button" className="secondary" onClick={() => { setGroupForm(blankGroup()); setGroupFormOpen(false); }}>Batal</button><button className="primary" disabled={saving || Boolean(duplicateGroup)}><Save size={16} /> {groupForm.id ? 'Simpan Perubahan' : 'Tambah Kelompok'}</button></div>
      </form>
    </section>}
  </div>;`;

source = source.slice(0, groupStart) + newGroupSection + source.slice(groupEnd);

fs.writeFileSync(file, source);
console.log('Applied v83 fixed asset group UX');
