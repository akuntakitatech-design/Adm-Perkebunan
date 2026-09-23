import { useEffect, useMemo, useState } from 'react';
import { api } from './lib/client';
import { Pencil, Save, Trash2 } from 'lucide-react';
import AccountSearchPicker from './AccountSearchPicker';
import { formatMoneyInput } from './moneyInput';
// v83-fixed-asset-group-ux

type AccountingGroup = 'ASSET' | 'LIABILITY' | 'EQUITY' | 'REVENUE' | 'EXPENSE';
type AccountingAccount = { id: string; code: string; name: string; group: AccountingGroup; active: boolean; level?: number; posting?: boolean };
type DepreciationMethod = 'NONE' | 'STRAIGHT_LINE' | 'DECLINING_BALANCE' | 'UNITS_OF_PRODUCTION';
type MeasurementModel = 'COST' | 'REVALUATION';
type AssetStatus = 'ACTIVE' | 'DISPOSED' | 'WRITTEN_OFF';
type FixedAssetGroup = { id: string; code: string; name: string; templateKey?: string; depreciable: boolean; depreciationMethod: DepreciationMethod; usefulLifeMonths: number; defaultResidualRate: number; measurementModel: MeasurementModel; assetAccountId: string; accumulatedDepreciationAccountId: string; depreciationExpenseAccountId: string; gainAccountId: string; lossAccountId: string; active: boolean };
type FixedAsset = { id: string; code: string; name: string; groupId: string; kebunId: string; location: string; acquisitionDate: string; availableForUseDate: string; acquisitionCost: number; residualValue: number; usefulLifeMonths: number; depreciationMethod: DepreciationMethod; openingAccumulatedDepreciation: number; openingDepreciationOverride?: boolean; openingDepreciationThroughDate?: string; sourceReference: string; serialNumber: string; note: string; status: AssetStatus };
type Kebun = { id: string; code: string; name: string };
type Props = { workspaceId: string; kebun: Kebun[]; openingPosted?: boolean; cutoffDate?: string; flash: (text: string) => void; showError: (text: string) => void; section: 'groups' | 'assets' };

const idr = new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 });
const methodLabel: Record<DepreciationMethod, string> = { NONE: 'Tidak Disusutkan', STRAIGHT_LINE: 'Garis Lurus', DECLINING_BALANCE: 'Saldo Menurun', UNITS_OF_PRODUCTION: 'Unit Produksi' };
function apiError(err: unknown, fallback: string) { const response = (err as { response?: { data?: { error?: string; message?: string } } })?.response?.data; return response?.error || response?.message || fallback; }
function today() { return new Date().toISOString().slice(0, 10); }
const fixedAssetDayMs = 86_400_000;
const accountingDateFormat = new Intl.DateTimeFormat('id-ID', { day: '2-digit', month: 'long', year: 'numeric', timeZone: 'UTC' });
function formatAccountingDate(value: string) { const date = value ? new Date(`${value}T00:00:00Z`) : null; return date && Number.isFinite(date.getTime()) ? accountingDateFormat.format(date) : '-'; }
function fixedAssetDaysInMonth(year: number, monthIndex: number) { return new Date(Date.UTC(year, monthIndex + 1, 0)).getUTCDate(); }
function fixedAssetUsefulLifeEnd(start: Date, usefulLifeMonths: number) { const targetIndex = start.getUTCMonth() + usefulLifeMonths; const targetYear = start.getUTCFullYear() + Math.floor(targetIndex / 12); const targetMonth = targetIndex % 12; const targetDay = Math.min(start.getUTCDate(), fixedAssetDaysInMonth(targetYear, targetMonth)); return new Date(Date.UTC(targetYear, targetMonth, targetDay) - fixedAssetDayMs); }
function automaticOpeningDepreciation(acquisitionCost: number, residualValue: number, usefulLifeMonths: number, depreciationMethod: DepreciationMethod, availableForUseDate: string, throughDate: string) {
  if (depreciationMethod !== 'STRAIGHT_LINE' || usefulLifeMonths <= 0 || !availableForUseDate || !throughDate) return 0;
  const start = new Date(`${availableForUseDate}T00:00:00Z`);
  const through = new Date(`${throughDate}T00:00:00Z`);
  if (!Number.isFinite(start.getTime()) || !Number.isFinite(through.getTime()) || start.getTime() > through.getTime()) return 0;
  const depreciableBase = Math.max(0, acquisitionCost - residualValue);
  if (depreciableBase <= 0) return 0;
  const usefulLifeEnd = fixedAssetUsefulLifeEnd(start, usefulLifeMonths);
  if (through.getTime() >= usefulLifeEnd.getTime()) return Math.round(depreciableBase);
  const monthlyDepreciation = depreciableBase / usefulLifeMonths;
  let total = 0;
  let cursor = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth(), 1));
  let guard = 0;
  while (cursor.getTime() <= through.getTime() && guard < usefulLifeMonths + 2) {
    const year = cursor.getUTCFullYear();
    const month = cursor.getUTCMonth();
    const monthStart = new Date(Date.UTC(year, month, 1));
    const monthEnd = new Date(Date.UTC(year, month + 1, 0));
    const activeStart = Math.max(start.getTime(), monthStart.getTime());
    const activeEnd = Math.min(through.getTime(), monthEnd.getTime());
    if (activeStart <= activeEnd) {
      const activeDays = Math.floor((activeEnd - activeStart) / fixedAssetDayMs) + 1;
      total += monthlyDepreciation * activeDays / fixedAssetDaysInMonth(year, month);
    }
    cursor = new Date(Date.UTC(year, month + 1, 1));
    guard += 1;
  }
  return Math.min(Math.round(depreciableBase), Math.max(0, Math.round(total)));
}
function blankGroup() { return { id: '', code: '', name: '', depreciable: true, depreciationMethod: 'STRAIGHT_LINE' as DepreciationMethod, usefulLifeMonths: '48', defaultResidualRate: '0', measurementModel: 'COST' as MeasurementModel, assetAccountId: '', accumulatedDepreciationAccountId: '', depreciationExpenseAccountId: '', gainAccountId: '', lossAccountId: '', active: true }; }
function blankAsset() { return { id: '', code: '', name: '', groupId: '', kebunId: '', location: '', acquisitionDate: today(), availableForUseDate: today(), acquisitionCost: '', residualValue: '', usefulLifeMonths: '', depreciationMethod: 'STRAIGHT_LINE' as DepreciationMethod, openingAccumulatedDepreciation: '', openingDepreciationOverride: false, sourceReference: '', serialNumber: '', note: '', status: 'ACTIVE' as AssetStatus }; }
function includeSelected(accounts: AccountingAccount[], selectedId: string, all: AccountingAccount[]) { const selected = all.find(item => item.id === selectedId); return selected && !accounts.some(item => item.id === selected.id) ? [...accounts, selected] : accounts; }

export default function FixedAssets({ workspaceId, kebun, openingPosted = false, cutoffDate = '', flash, showError, section }: Props) {
  const [accounts, setAccounts] = useState<AccountingAccount[]>([]);
  const [groups, setGroups] = useState<FixedAssetGroup[]>([]);
  const [assets, setAssets] = useState<FixedAsset[]>([]);
  const [groupForm, setGroupForm] = useState(blankGroup());
  const [assetForm, setAssetForm] = useState(blankAsset());
  const [saving, setSaving] = useState(false);
  const [groupFormOpen, setGroupFormOpen] = useState(false);
  const [accountLoadIssue, setAccountLoadIssue] = useState(false);
  const [openingDepreciationThroughDate, setOpeningDepreciationThroughDate] = useState('');

  const load = async () => {
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
  useEffect(() => { void load(); }, [workspaceId]);
  const postingAccounts = useMemo(() => accounts.filter(item => item.active && (item.level ?? 4) === 4 && item.posting !== false), [accounts]);
  const assetAccounts = postingAccounts.filter(item => item.group === 'ASSET');
  const expenseAccounts = postingAccounts.filter(item => item.group === 'EXPENSE');
  const revenueAccounts = postingAccounts.filter(item => item.group === 'REVENUE');
  const eligibleAssetAccounts = assetAccounts.length > 0 ? assetAccounts : postingAccounts;
  const eligibleExpenseAccounts = expenseAccounts.length > 0 ? expenseAccounts : postingAccounts;
  const eligibleRevenueAccounts = revenueAccounts.length > 0 ? revenueAccounts : postingAccounts;
  const duplicateGroup = !groupForm.id && groupForm.name.trim() ? groups.find(item => item.name.trim().toLowerCase() === groupForm.name.trim().toLowerCase()) : undefined;
  const accountMap = useMemo(() => new Map(accounts.map(item => [item.id, item])), [accounts]);
  const groupMap = useMemo(() => new Map(groups.map(item => [item.id, item])), [groups]);
  const kebunMap = useMemo(() => new Map(kebun.map(item => [item.id, item])), [kebun]);
  const effectiveOpeningThroughDate = openingDepreciationThroughDate || cutoffDate;
  const automaticOpeningAmount = automaticOpeningDepreciation(Number(assetForm.acquisitionCost || 0), Number(assetForm.residualValue || 0), Number(assetForm.usefulLifeMonths || 0), assetForm.depreciationMethod, assetForm.availableForUseDate, effectiveOpeningThroughDate);
  const openingAccumulatedPreview = assetForm.depreciationMethod === 'NONE' ? 0 : (assetForm.openingDepreciationOverride ? Number(assetForm.openingAccumulatedDepreciation || 0) : automaticOpeningAmount);
  const automaticOpeningUnsupported = !assetForm.openingDepreciationOverride && !['STRAIGHT_LINE', 'NONE'].includes(assetForm.depreciationMethod) && Boolean(effectiveOpeningThroughDate) && assetForm.availableForUseDate <= effectiveOpeningThroughDate;

  const saveGroup = async (event: React.FormEvent) => { event.preventDefault(); if (!groupForm.name.trim() || !groupForm.assetAccountId) return showError('Nama kelompok dan Akun Aset wajib diisi.'); if (groupForm.depreciable && (!groupForm.accumulatedDepreciationAccountId || !groupForm.depreciationExpenseAccountId || Number(groupForm.usefulLifeMonths) <= 0)) return showError('Kelompok yang disusutkan wajib memiliki umur manfaat, akun akumulasi, dan akun beban penyusutan.'); try { setSaving(true); const payload = { ...groupForm, usefulLifeMonths: groupForm.depreciable ? Number(groupForm.usefulLifeMonths || 0) : 0, defaultResidualRate: Number(groupForm.defaultResidualRate || 0), depreciationMethod: groupForm.depreciable ? groupForm.depreciationMethod : 'NONE', accumulatedDepreciationAccountId: groupForm.depreciable ? groupForm.accumulatedDepreciationAccountId : '', depreciationExpenseAccountId: groupForm.depreciable ? groupForm.depreciationExpenseAccountId : '' }; if (groupForm.id) await api.put(`/api/fixed-assets/groups/${groupForm.id}`, payload); else await api.post('/api/fixed-assets/groups', payload); const edited = Boolean(groupForm.id); setGroupForm(blankGroup()); setGroupFormOpen(false); await load(); flash(edited ? 'Kelompok Aset Tetap diperbarui.' : 'Kelompok Aset Tetap ditambahkan.'); } catch (err) { showError(apiError(err, 'Kelompok Aset Tetap gagal disimpan.')); } finally { setSaving(false); } };
  const selectGroup = (groupId: string) => { const selected = groups.find(item => item.id === groupId); setAssetForm(value => ({ ...value, groupId, depreciationMethod: selected?.depreciable ? selected.depreciationMethod : 'NONE', usefulLifeMonths: selected?.depreciable ? String(selected.usefulLifeMonths || '') : '0', residualValue: value.acquisitionCost && selected?.defaultResidualRate ? String(Math.round(Number(value.acquisitionCost) * selected.defaultResidualRate / 100)) : value.residualValue, openingAccumulatedDepreciation: '', openingDepreciationOverride: false })); };
  const saveAsset = async (event: React.FormEvent) => { event.preventDefault(); if (!assetForm.name.trim() || !assetForm.groupId || !assetForm.acquisitionDate || Number(assetForm.acquisitionCost) <= 0) return showError('Nama aset, kelompok, tanggal perolehan, dan harga perolehan wajib diisi.'); if (automaticOpeningUnsupported) return showError('Metode Saldo Menurun/Unit Produksi membutuhkan Override Manual untuk Akumulasi Penyusutan Saldo Awal.'); try { setSaving(true); const payload = { ...assetForm, acquisitionCost: Number(assetForm.acquisitionCost || 0), residualValue: Number(assetForm.residualValue || 0), usefulLifeMonths: Number(assetForm.usefulLifeMonths || 0), openingAccumulatedDepreciation: openingAccumulatedPreview }; if (assetForm.id) await api.put(`/api/fixed-assets/assets/${assetForm.id}`, payload); else await api.post('/api/fixed-assets/assets', payload); const edited = Boolean(assetForm.id); setAssetForm(blankAsset()); await load(); flash(edited ? 'Aset Tetap diperbarui.' : 'Aset Tetap ditambahkan dan siap ditarik ke Saldo Awal.'); } catch (err) { showError(apiError(err, 'Aset Tetap gagal disimpan.')); } finally { setSaving(false); } };
  const editGroup = (item: FixedAssetGroup) => {
    setGroupForm({ id: item.id, code: item.code, name: item.name, depreciable: item.depreciable, depreciationMethod: item.depreciationMethod, usefulLifeMonths: String(item.usefulLifeMonths || ''), defaultResidualRate: String(item.defaultResidualRate || 0), measurementModel: item.measurementModel, assetAccountId: item.assetAccountId, accumulatedDepreciationAccountId: item.accumulatedDepreciationAccountId, depreciationExpenseAccountId: item.depreciationExpenseAccountId, gainAccountId: item.gainAccountId, lossAccountId: item.lossAccountId, active: item.active });
    setGroupFormOpen(true);
    window.requestAnimationFrame(() => document.getElementById('fixed-asset-group-form')?.scrollIntoView({ behavior: 'smooth', block: 'start' }));
  };
  const removeGroup = async (id: string) => { if (!window.confirm('Hapus Kelompok Aset Tetap ini?')) return; try { await api.delete(`/api/fixed-assets/groups/${id}`); await load(); flash('Kelompok Aset Tetap dihapus.'); } catch (err) { showError(apiError(err, 'Kelompok Aset Tetap tidak dapat dihapus.')); } };
  const removeAsset = async (id: string) => { if (!window.confirm('Hapus Aset Tetap ini?')) return; try { await api.delete(`/api/fixed-assets/assets/${id}`); await load(); flash('Aset Tetap dihapus.'); } catch (err) { showError(apiError(err, 'Aset Tetap tidak dapat dihapus.')); } };

  if (section === 'groups') return <div className="stack">
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
  </div>;

  return <div className="stack"><section className="panel"><div className="panel-head"><div><h3>Daftar Aset Tetap</h3><p>Register aset menjadi subledger yang membentuk Saldo Awal. Perolehan baru setelah cut-off belum membuat jurnal otomatis dari layar ini.</p></div></div>{openingPosted ? <div className="notice">Saldo Awal sudah diposting. Nilai finansial aset yang diperoleh sebelum/hingga cut-off {cutoffDate || '-'} dikunci. Aset setelah cut-off dapat diregister, tetapi jurnal perolehannya tetap harus berasal dari transaksi akuntansi.</div> : <div className="notice">Aset dengan tanggal perolehan sampai cut-off akan otomatis masuk ke Saldo Awal: Debit Akun Aset sebesar harga perolehan dan Kredit Akumulasi Penyusutan sebesar akumulasi awal.</div>}<form className="mini-form" onSubmit={saveAsset}>
    <div className="row-2"><Field label="Kode Aset"><input value={assetForm.code} onChange={event => setAssetForm(value => ({ ...value, code: event.target.value }))} placeholder="Otomatis bila kosong" /></Field><Field label="Nama Aset"><input value={assetForm.name} onChange={event => setAssetForm(value => ({ ...value, name: event.target.value }))} placeholder="Gedung Kantor Kebun / Hilux BM..." /></Field></div>
    <div className="row-2"><Field label="Kelompok Aset"><select value={assetForm.groupId} onChange={event => selectGroup(event.target.value)}><option value="">Pilih kelompok</option>{groups.filter(item => item.active || item.id === assetForm.groupId).map(item => <option key={item.id} value={item.id}>{item.code} - {item.name}</option>)}</select></Field><Field label="Kebun / Cost Center"><select value={assetForm.kebunId} onChange={event => setAssetForm(value => ({ ...value, kebunId: event.target.value }))}><option value="">Pusat / Umum</option>{kebun.map(item => <option key={item.id} value={item.id}>{item.code} - {item.name}</option>)}</select></Field></div>
    <div className="row-2"><Field label="Lokasi"><input value={assetForm.location} onChange={event => setAssetForm(value => ({ ...value, location: event.target.value }))} placeholder="Kebun / kantor / gudang" /></Field><Field label="No. Polisi / Serial"><input value={assetForm.serialNumber} onChange={event => setAssetForm(value => ({ ...value, serialNumber: event.target.value }))} /></Field></div>
    <div className="row-2"><Field label="Tanggal Perolehan"><input type="date" value={assetForm.acquisitionDate} onChange={event => setAssetForm(value => ({ ...value, acquisitionDate: event.target.value }))} /></Field><Field label="Tanggal Siap Digunakan"><input type="date" value={assetForm.availableForUseDate} onChange={event => setAssetForm(value => ({ ...value, availableForUseDate: event.target.value }))} /></Field></div>
    <div className="row-2"><Field label="Harga Perolehan"><input inputMode="numeric" value={formatMoneyInput(assetForm.acquisitionCost)} onChange={event => { const acquisitionCost = event.target.value.replace(/[^0-9]/g, ''); const group = groupMap.get(assetForm.groupId); const residualValue = !assetForm.residualValue && group?.defaultResidualRate ? String(Math.round(Number(acquisitionCost || 0) * group.defaultResidualRate / 100)) : assetForm.residualValue; setAssetForm(value => ({ ...value, acquisitionCost, residualValue })); }} /></Field><Field label="Nilai Residu"><input inputMode="numeric" value={formatMoneyInput(assetForm.residualValue)} onChange={event => setAssetForm(value => ({ ...value, residualValue: event.target.value.replace(/[^0-9]/g, '') }))} /></Field></div>
    <div className="row-2"><Field label="Umur Manfaat (bulan)"><input inputMode="numeric" disabled={assetForm.depreciationMethod === 'NONE'} value={assetForm.usefulLifeMonths} onChange={event => setAssetForm(value => ({ ...value, usefulLifeMonths: event.target.value.replace(/[^0-9]/g, '') }))} /></Field><Field label="Metode Penyusutan"><select value={assetForm.depreciationMethod} onChange={event => setAssetForm(value => ({ ...value, depreciationMethod: event.target.value as DepreciationMethod }))}><option value="STRAIGHT_LINE">Garis Lurus</option><option value="DECLINING_BALANCE">Saldo Menurun</option><option value="UNITS_OF_PRODUCTION">Unit Produksi</option><option value="NONE">Tidak Disusutkan</option></select></Field></div>
    <div className="row-2"><Field label={`Akumulasi Penyusutan Otomatis${effectiveOpeningThroughDate ? ` s.d. ${formatAccountingDate(effectiveOpeningThroughDate)}` : ''}`}><input inputMode="numeric" disabled value={formatMoneyInput(openingAccumulatedPreview || '')} placeholder="Dihitung otomatis" /></Field><Field label="Referensi Perolehan"><input value={assetForm.sourceReference} onChange={event => setAssetForm(value => ({ ...value, sourceReference: event.target.value }))} placeholder="Invoice / BAST / dokumen" /></Field></div>
    {assetForm.depreciationMethod !== 'NONE' && <label className="check-row"><input type="checkbox" checked={assetForm.openingDepreciationOverride} onChange={event => setAssetForm(value => ({ ...value, openingDepreciationOverride: event.target.checked, openingAccumulatedDepreciation: event.target.checked ? String(automaticOpeningAmount || '') : '' }))} /><span>Override Manual khusus migrasi bila angka buku lama berbeda dari hasil hitung sistem</span></label>}
    {assetForm.openingDepreciationOverride && <Field label="Override Akumulasi Penyusutan"><input inputMode="numeric" value={formatMoneyInput(assetForm.openingAccumulatedDepreciation)} onChange={event => setAssetForm(value => ({ ...value, openingAccumulatedDepreciation: event.target.value.replace(/[^0-9]/g, '') }))} placeholder="Masukkan angka buku migrasi" /></Field>}
    {automaticOpeningUnsupported && <div className="notice">Metode {methodLabel[assetForm.depreciationMethod]} memerlukan Override Manual untuk saldo awal karena parameter perhitungan metode tersebut belum tersedia.</div>}
    {!assetForm.openingDepreciationOverride && effectiveOpeningThroughDate && assetForm.depreciationMethod === 'STRAIGHT_LINE' && <div className="notice">Dihitung otomatis sejak Tanggal Siap Digunakan sampai {formatAccountingDate(effectiveOpeningThroughDate)}. Periode setelah tanggal tersebut yang masih OPEN tidak masuk ke Saldo Awal.</div>}
    <div className="row-2"><Field label="Status"><select value={assetForm.status} onChange={event => setAssetForm(value => ({ ...value, status: event.target.value as AssetStatus }))}><option value="ACTIVE">Aktif</option><option value="DISPOSED">Dijual/Dilepas</option><option value="WRITTEN_OFF">Dihapuskan</option></select></Field><Field label="Catatan"><input value={assetForm.note} onChange={event => setAssetForm(value => ({ ...value, note: event.target.value }))} /></Field></div><div className="allocation-total"><span>Nilai Buku Awal</span><strong>{idr.format(Math.max(0, Number(assetForm.acquisitionCost || 0) - openingAccumulatedPreview))}</strong></div><div className="form-actions">{assetForm.id && <button type="button" className="secondary" onClick={() => setAssetForm(blankAsset())}>Batal</button>}<button className="primary" disabled={saving}><Save size={16} /> {assetForm.id ? 'Simpan Perubahan' : 'Tambah Aset'}</button></div>
  </form></section>
  <section className="panel"><div className="panel-head"><div><h3>Register Aset Tetap</h3><p>{assets.length} aset tercatat.</p></div></div>{assets.length === 0 ? <div className="empty"><span>Belum ada Aset Tetap.</span></div> : <div className="table-wrap"><table><thead><tr><th>Kode / Aset</th><th>Kelompok</th><th>Cost Center</th><th>Tanggal</th><th className="right">Perolehan</th><th className="right">Akumulasi</th><th className="right">Nilai Buku Awal</th><th>Status</th><th></th></tr></thead><tbody>{assets.map(item => <tr key={item.id}><td><strong>{item.code}</strong><br />{item.name}</td><td>{groupMap.get(item.groupId)?.name || '-'}</td><td>{item.kebunId ? kebunMap.get(item.kebunId)?.name || '-' : 'Pusat / Umum'}</td><td>{item.acquisitionDate}</td><td className="right">{idr.format(item.acquisitionCost)}</td><td className="right">{idr.format(item.openingAccumulatedDepreciation)}</td><td className="right"><strong>{idr.format(Math.max(0, item.acquisitionCost - item.openingAccumulatedDepreciation))}</strong></td><td><span className={`status ${item.status === 'ACTIVE' ? 'active' : ''}`}>{item.status}</span></td><td><div className="action-group"><button className="icon-btn" onClick={() => setAssetForm({ id: item.id, code: item.code, name: item.name, groupId: item.groupId, kebunId: item.kebunId || '', location: item.location || '', acquisitionDate: item.acquisitionDate, availableForUseDate: item.availableForUseDate, acquisitionCost: String(item.acquisitionCost || ''), residualValue: String(item.residualValue || ''), usefulLifeMonths: String(item.usefulLifeMonths || ''), depreciationMethod: item.depreciationMethod, openingAccumulatedDepreciation: item.openingDepreciationOverride ? String(item.openingAccumulatedDepreciation || '') : '', openingDepreciationOverride: item.openingDepreciationOverride === true, sourceReference: item.sourceReference || '', serialNumber: item.serialNumber || '', note: item.note || '', status: item.status })}><Pencil size={15} /></button><button className="icon-btn danger" onClick={() => removeAsset(item.id)}><Trash2 size={15} /></button></div></td></tr>)}</tbody></table></div>}</section></div>;
}
function Field({ label, children }: { label: string; children: React.ReactNode }) { return <label className="field"><span>{label}</span>{children}</label>; }
