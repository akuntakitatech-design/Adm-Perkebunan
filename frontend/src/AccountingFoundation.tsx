import { useEffect, useMemo, useRef, useState } from 'react';
import { api } from './lib/client';
import { Pencil, Plus, Save, Search, Trash2 } from 'lucide-react';
import { readStoredChoice, storeChoice } from './navigationState';
import { formatMoneyInput } from './moneyInput';

type Role = 'OWNER' | 'ADMIN_PUSAT' | 'FINANCE' | 'ADMIN_KEBUN' | 'VIEWER';
type Group = 'ASSET' | 'LIABILITY' | 'EQUITY' | 'REVENUE' | 'EXPENSE';
type NormalBalance = 'DEBIT' | 'CREDIT';
type CashFlowClass = 'OPERATING' | 'INVESTING' | 'FINANCING' | 'NON_CASH';
type Account = { id: string; code: string; name: string; group: Group; normalBalance: NormalBalance; systemKey: string; level?: 1 | 2 | 3 | 4; parentId?: string; posting?: boolean; templateKey?: string; cashFlowClass?: CashFlowClass; active: boolean; locked: boolean };
type Settings = { id?: string; fiscalYear: number; fiscalYearStartMonth: number; conversionDate: string; setupComplete: boolean; openingPosted: boolean };
type Period = { id: string; periodKey: string; label: string; startDate: string; endDate: string; status: 'OPEN' | 'CLOSED' | 'LOCKED' };
type GeneralLine = { accountId: string; debit: number | string; credit: number | string; note: string };
type SubKind = 'CASH_BANK' | 'PKS' | 'EMPLOYEE' | 'SUPPLIER' | 'INVENTORY';
type Subledger = { kind: SubKind; accountId?: string; entityId: string; description: string; reference: string; amount: number | string; quantity: number | string; unitCost: number | string; inputQuantity?: number | string; inputUnitId?: string; inputUnit?: string; conversionFactor?: number; inputUnitCost?: number | string; debit?: number; credit?: number; search?: string }; // v73-opening-inventory
type Opening = { id: string; cutoffDate: string; status: 'DRAFT' | 'POSTED'; generalLines: GeneralLine[]; subledgers: Subledger[]; fixedAssets?: Array<{ assetId: string; kebunId: string; assetAccountId: string; accumulatedDepreciationAccountId: string; acquisitionCost: number; accumulatedDepreciation: number; description: string }>; postedLines?: Array<{ accountId: string; debit: number; credit: number; note: string; kebunId?: string }>; totalDebit: number; totalCredit: number; postedAt?: string };
type FixedAssetGroup = { id: string; name: string; depreciable: boolean; assetAccountId: string; accumulatedDepreciationAccountId: string };
type FixedAsset = { id: string; code: string; name: string; groupId: string; kebunId: string; acquisitionDate: string; acquisitionCost: number; openingAccumulatedDepreciation: number; status: 'ACTIVE' | 'DISPOSED' | 'WRITTEN_OFF' };
type InventoryGroup = { id: string; name: string; canStore: boolean; inventoryAccountId: string };
type InventoryItemUnitConversion = { unitId: string; factor: number; defaultPurchase?: boolean; defaultUsage?: boolean };
type InventoryItem = { id: string; code: string; name: string; groupId: string; unitId: string; unitConversions?: InventoryItemUnitConversion[]; active: boolean };
type InventoryUnit = { id: string; code: string; name: string; active: boolean };
type FoundationData = { workspace: { id: string; role: Role }; kebun: Array<{ id: string; code: string; name: string }>; accounts: Array<{ id: string; name: string; type: 'KAS' | 'BANK' }>; mills: Array<{ id: string; name: string }>; harvesters: Array<{ id: string; name: string }>; suppliers: Array<{ id: string; code: string; name: string; active: boolean }> };
type FoundationSection = 'coa' | 'opening' | 'periods';
type Props = { data: FoundationData; accounts: Account[]; systemAccountIds?: Record<string, string>; reloadAccounts: () => Promise<void>; flash: (text: string) => void; showError: (text: string) => void; section?: FoundationSection };

const idr = new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 });
const groups: Group[] = ['ASSET', 'LIABILITY', 'EQUITY', 'REVENUE', 'EXPENSE'];
const groupLabel: Record<Group, string> = { ASSET: 'Aset', LIABILITY: 'Liabilitas', EQUITY: 'Ekuitas', REVENUE: 'Pendapatan', EXPENSE: 'Beban' };
const cashFlowLabel: Record<CashFlowClass, string> = { OPERATING: 'Operating', INVESTING: 'Investing', FINANCING: 'Financing', NON_CASH: 'Non-Cash / N/A' };
const monthNames = ['Januari','Februari','Maret','April','Mei','Juni','Juli','Agustus','September','Oktober','November','Desember'];
function apiError(err: unknown, fallback: string) { const response = (err as { response?: { data?: { error?: string; message?: string } } })?.response?.data; return response?.error || response?.message || fallback; }
function currentYear() { return new Date().getFullYear(); }
function blankAccount() { return { id: '', code: '', name: '', level: 4 as 1 | 2 | 3 | 4, parentId: '', group: 'ASSET' as Group, normalBalance: 'DEBIT' as NormalBalance, cashFlowClass: '' as CashFlowClass | '', active: true, systemKey: '' }; }
function blankGeneral(): GeneralLine { return { accountId: '', debit: '', credit: '', note: '' }; }
function blankSub(): Subledger { return { kind: 'CASH_BANK', entityId: '', description: '', reference: '', amount: '', quantity: '', unitCost: '' }; }
function blankInventorySub(): Subledger { return { kind: 'INVENTORY', entityId: '', description: '', reference: '', amount: '', quantity: '', unitCost: '', inputQuantity: '', inputUnitId: '', inputUnitCost: '', search: '' }; }
function openingItemUnitChoices(item: InventoryItem | undefined, units: InventoryUnit[]) {
  if (!item) return [] as Array<{ unitId: string; label: string; factor: number }>;
  const map = new Map(units.map(unit => [unit.id, unit]));
  const base = map.get(item.unitId);
  const rows = [{ unitId: item.unitId, label: base?.code || base?.name || '-', factor: 1 }];
  for (const conversion of item.unitConversions || []) { const unit = map.get(conversion.unitId); if (unit && unit.active !== false && conversion.factor > 0) rows.push({ unitId: conversion.unitId, label: unit.code || unit.name, factor: conversion.factor }); }
  return rows;
}
function posting(account: Account) { return (account.level ?? 4) === 4 && account.posting !== false; }
function incrementCoaCode(code: string) {
  const value = code.trim();
  const match = value.match(/^(.*?)(\d+)(\D*)$/);
  if (!match) return '';
  const next = String(Number(match[2]) + 1).padStart(match[2].length, '0');
  return match[1] + next + match[3];
}
function suggestedCoaCode(accounts: Account[], level: 1 | 2 | 3 | 4, parentId = '') {
  const collator = new Intl.Collator('id-ID', { numeric: true, sensitivity: 'base' });
  const siblings = accounts.filter(item => {
    const itemLevel = item.level ?? 4;
    if (itemLevel !== level) return false;
    return level === 1 ? !item.parentId : item.parentId === parentId;
  }).sort((a, b) => collator.compare(a.code, b.code));
  const latest = siblings[siblings.length - 1];
  if (latest) return incrementCoaCode(latest.code);
  if (level === 1) return '1';
  const parent = accounts.find(item => item.id === parentId);
  if (!parent) return '';
  const parentCode = parent.code.trim();
  if (level === 2) return /^\d+$/.test(parentCode) ? parentCode + '1' : parentCode + '-01';
  if (level === 3) return /^\d+$/.test(parentCode) ? parentCode + '10' : parentCode + '-01';
  return parentCode + '-00-001';
}

export default function AccountingFoundation({ data, accounts, systemAccountIds = {}, reloadAccounts, flash, showError, section: fixedSection }: Props) {
  const storageKey = 'perkebunan.navigation.accounting.foundation';
  const [section, setSection] = useState<FoundationSection>(() => readStoredChoice(storageKey, ['coa', 'opening', 'periods'] as const, 'coa'));
  const [settings, setSettings] = useState<Settings | null>(null);
  const [periods, setPeriods] = useState<Period[]>([]);
  const [opening, setOpening] = useState<Opening | null>(null);
  const [inventoryGroups, setInventoryGroups] = useState<InventoryGroup[]>([]);
  const [inventoryItems, setInventoryItems] = useState<InventoryItem[]>([]);
  const [inventoryUnits, setInventoryUnits] = useState<InventoryUnit[]>([]);
  const [fixedAssetGroups, setFixedAssetGroups] = useState<FixedAssetGroup[]>([]);
  const [fixedAssets, setFixedAssets] = useState<FixedAsset[]>([]);
  const [accountForm, setAccountForm] = useState(blankAccount());
  const [settingsForm, setSettingsForm] = useState({ fiscalYear: String(currentYear()), fiscalYearStartMonth: '1', conversionDate: `${currentYear() - 1}-12-31` });
  const [generalLines, setGeneralLines] = useState<GeneralLine[]>([blankGeneral()]);
  const [subledgers, setSubledgers] = useState<Subledger[]>([blankSub()]);
  const [saving, setSaving] = useState(false);
  const [coaSearch, setCoaSearch] = useState('');
  const [openingSearch, setOpeningSearch] = useState('');
  const [openingInventoryPicker, setOpeningInventoryPicker] = useState<number | null>(null);
  const coaFormRef = useRef<HTMLElement | null>(null);
  const loadFoundation = async () => { try { const [foundationRes, inventoryRes, fixedAssetRes] = await Promise.all([api.get('/api/accounting/foundation'), api.get('/api/inventory/master'), api.get('/api/fixed-assets/master')]); const payload = foundationRes.data as { settings: Settings | null; periods: Period[]; opening: Opening | null }; setSettings(payload.settings || null); setPeriods(payload.periods || []); if (payload.settings) setSettingsForm({ fiscalYear: String(payload.settings.fiscalYear), fiscalYearStartMonth: String(payload.settings.fiscalYearStartMonth), conversionDate: payload.settings.conversionDate }); setOpening(payload.opening || null); if (payload.opening) { setGeneralLines(payload.opening.generalLines?.length ? payload.opening.generalLines.map(line => ({ ...line, debit: line.debit || '', credit: line.credit || '' })) : [blankGeneral()]); setSubledgers(payload.opening.subledgers?.length ? payload.opening.subledgers.map(line => ({ ...line, amount: line.amount || '', quantity: line.quantity || '', unitCost: line.unitCost || '', inputQuantity: (line.inputQuantity ?? line.quantity) || '', inputUnitId: line.inputUnitId || '', inputUnitCost: (line.inputUnitCost ?? line.unitCost) || '' })) : [blankSub()]); } const master = inventoryRes.data as { groups: InventoryGroup[]; items: InventoryItem[]; units: InventoryUnit[] }; setInventoryGroups(master.groups || []); setInventoryItems(master.items || []); setInventoryUnits(master.units || []); const fixedMaster = fixedAssetRes.data as { groups: FixedAssetGroup[]; assets: FixedAsset[] }; setFixedAssetGroups(fixedMaster.groups || []); setFixedAssets(fixedMaster.assets || []); } catch (err) { showError(apiError(err, 'Fondasi Akuntansi gagal dimuat.')); } };
  useEffect(() => { void loadFoundation(); }, [data.workspace.id]);
  const changeSection = (next: typeof section) => { setSection(next); storeChoice(storageKey, next); };
  const activeSection = fixedSection || section;
  const sortedAccounts = useMemo(() => {
    const collator = new Intl.Collator('id-ID', { numeric: true, sensitivity: 'base' });
    const ordered = [...accounts].sort((a, b) => collator.compare(a.code, b.code) || a.name.localeCompare(b.name, 'id-ID'));
    const ids = new Set(ordered.map(item => item.id));
    const children = new Map<string, Account[]>();
    const roots: Account[] = [];
    ordered.forEach(item => {
      if (!item.parentId || !ids.has(item.parentId)) {
        roots.push(item);
        return;
      }
      const list = children.get(item.parentId) || [];
      list.push(item);
      children.set(item.parentId, list);
    });
    const result: Account[] = [];
    const seen = new Set<string>();
    const visit = (item: Account) => {
      if (seen.has(item.id)) return;
      seen.add(item.id);
      result.push(item);
      (children.get(item.id) || [])
        .sort((a, b) => collator.compare(a.code, b.code) || a.name.localeCompare(b.name, 'id-ID'))
        .forEach(visit);
    };
    roots
      .sort((a, b) => collator.compare(a.code, b.code) || a.name.localeCompare(b.name, 'id-ID'))
      .forEach(visit);
    ordered.filter(item => !seen.has(item.id)).forEach(visit);
    return result;
  }, [accounts]);
  const filteredAccounts = useMemo(() => {
    const needle = coaSearch.trim().toLowerCase();
    if (!needle) return sortedAccounts;
    return sortedAccounts.filter(item => `${item.code} ${item.name}`.toLowerCase().includes(needle));
  }, [sortedAccounts, coaSearch]);
  const accountMap = useMemo(() => new Map(accounts.map(item => [item.id, item])), [accounts]);
  const groupMap = useMemo(() => new Map(inventoryGroups.map(item => [item.id, item])), [inventoryGroups]);
  const unitMap = useMemo(() => new Map(inventoryUnits.map(item => [item.id, item])), [inventoryUnits]);
  const parentOptions = accounts.filter(item => (item.level ?? 4) === accountForm.level - 1 && item.group === accountForm.group);
  const changeCoaLevel = (level: 1 | 2 | 3 | 4) => setAccountForm(current => ({ ...current, level, parentId: '', code: current.id ? current.code : level === 1 ? suggestedCoaCode(accounts, 1) : '' }));
  const changeCoaGroup = (group: Group) => setAccountForm(current => ({ ...current, group, parentId: '', code: current.id ? current.code : current.level === 1 ? suggestedCoaCode(accounts, 1) : '', normalBalance: ['LIABILITY','EQUITY','REVENUE'].includes(group) ? 'CREDIT' : 'DEBIT' }));
  const changeCoaParent = (parentId: string) => setAccountForm(current => ({ ...current, parentId, code: current.id ? current.code : parentId ? suggestedCoaCode(accounts, current.level, parentId) : '' }));
  const fixedAssetControlledIds = useMemo(() => { const values = new Set<string>(); fixedAssetGroups.forEach(item => { if (item.assetAccountId) values.add(item.assetAccountId); if (item.accumulatedDepreciationAccountId) values.add(item.accumulatedDepreciationAccountId); }); return values; }, [fixedAssetGroups]);
  const controlledIds = useMemo(() => {
    const values = new Set(accounts.filter(item => item.systemKey.startsWith('CASH:') || ['AR_PKS', 'AR_EMPLOYEE', 'AP_SUPPLIER'].includes(item.systemKey)).map(item => item.id));
    ['AR_PKS', 'AR_EMPLOYEE', 'AP_SUPPLIER'].forEach(key => { if (systemAccountIds[key]) values.add(systemAccountIds[key]); });
    inventoryGroups.filter(item => item.canStore && item.inventoryAccountId).forEach(item => values.add(item.inventoryAccountId));
    fixedAssetControlledIds.forEach(id => values.add(id));
    return values;
  }, [accounts, systemAccountIds, inventoryGroups, fixedAssetControlledIds]);
  const openingAccounts = useMemo(() => sortedAccounts.filter(item => item.active && posting(item) && /^[123]/.test(item.code.trim())), [sortedAccounts]);
  const filteredOpeningAccounts = useMemo(() => {
    const needle = openingSearch.trim().toLowerCase();
    if (!needle) return openingAccounts;
    return openingAccounts.filter(item => `${item.code} ${item.name}`.toLowerCase().includes(needle));
  }, [openingAccounts, openingSearch]);
  const openingAccountIds = useMemo(() => new Set(openingAccounts.map(item => item.id)), [openingAccounts]);
  const generalLineMap = useMemo(() => new Map(generalLines.filter(row => row.accountId).map(row => [row.accountId, row])), [generalLines]);
  const setGeneralAccount = (accountId: string, patch: Partial<GeneralLine>) => setGeneralLines(rows => {
    const current = rows.find(row => row.accountId === accountId) || blankGeneral();
    const next = { ...current, accountId, ...patch };
    const others = rows.filter(row => row.accountId !== accountId);
    if (Number(next.debit || 0) <= 0 && Number(next.credit || 0) <= 0 && !next.note.trim()) return others;
    return [...others, next];
  });
  const setSub = (index: number, patch: Partial<Subledger>) => setSubledgers(rows => rows.map((row, i) => i === index ? { ...row, ...patch } : row));
  const subAmount = (row: Subledger) => row.kind === 'INVENTORY' ? Math.round(Number((row.inputQuantity ?? row.quantity) || 0) * Number((row.inputUnitCost ?? row.unitCost) || 0)) : Number(row.amount || 0);
  const openingInventoryRows = useMemo(() => subledgers.map((row, index) => ({ row, index })).filter(item => item.row.kind === 'INVENTORY'), [subledgers]);
  const openingDetailRows = useMemo(() => subledgers.map((row, index) => ({ row, index })).filter(item => item.row.kind !== 'INVENTORY'), [subledgers]);
  const openingInventoryTotal = useMemo(() => openingInventoryRows.reduce((sum, item) => sum + subAmount(item.row), 0), [openingInventoryRows]);
  const storableInventoryItems = useMemo(() => inventoryItems.filter(item => item.active !== false && groupMap.get(item.groupId)?.canStore), [inventoryItems, groupMap]);
  const selectOpeningInventoryItem = (index: number, itemId: string) => { const item = inventoryItems.find(candidate => candidate.id === itemId); setSub(index, { entityId: itemId, inputUnitId: item?.unitId || '', inputQuantity: '', inputUnitCost: '', search: '' }); };
  const subAccountId = (row: Subledger) => {
    if (row.kind === 'CASH_BANK') return accounts.find(item => item.systemKey === `CASH:${row.entityId}`)?.id || '';
    if (row.kind === 'PKS') return systemAccountIds.AR_PKS || accounts.find(item => item.systemKey === 'AR_PKS')?.id || '';
    if (row.kind === 'EMPLOYEE') return systemAccountIds.AR_EMPLOYEE || accounts.find(item => item.systemKey === 'AR_EMPLOYEE')?.id || '';
    if (row.kind === 'SUPPLIER') return systemAccountIds.AP_SUPPLIER || accounts.find(item => item.systemKey === 'AP_SUPPLIER')?.id || '';
    const item = inventoryItems.find(candidate => candidate.id === row.entityId);
    return item ? groupMap.get(item.groupId)?.inventoryAccountId || '' : '';
  };
  const subledgerTotalsByAccount = useMemo(() => {
    const totals = new Map<string, { debit: number; credit: number }>();
    subledgers.forEach(row => {
      const accountId = subAccountId(row);
      const amount = subAmount(row);
      if (!accountId || amount <= 0) return;
      const current = totals.get(accountId) || { debit: 0, credit: 0 };
      if (row.kind === 'SUPPLIER') current.credit += amount;
      else current.debit += amount;
      totals.set(accountId, current);
    });
    return totals;
  }, [subledgers, accounts, inventoryItems, groupMap]);
  const fixedAssetGroupMap = useMemo(() => new Map(fixedAssetGroups.map(item => [item.id, item])), [fixedAssetGroups]);
  const openingFixedAssets = useMemo(() => fixedAssets.filter(item => item.status === 'ACTIVE' && item.acquisitionCost > 0 && (!settings?.conversionDate || item.acquisitionDate <= settings.conversionDate)), [fixedAssets, settings?.conversionDate]);
  const fixedAssetTotalsByAccount = useMemo(() => { const totals = new Map<string, { debit: number; credit: number }>(); openingFixedAssets.forEach(asset => { const group = fixedAssetGroupMap.get(asset.groupId); if (!group?.assetAccountId) return; const assetTotal = totals.get(group.assetAccountId) || { debit: 0, credit: 0 }; assetTotal.debit += asset.acquisitionCost; totals.set(group.assetAccountId, assetTotal); if (group.depreciable && group.accumulatedDepreciationAccountId && asset.openingAccumulatedDepreciation > 0) { const accumTotal = totals.get(group.accumulatedDepreciationAccountId) || { debit: 0, credit: 0 }; accumTotal.credit += asset.openingAccumulatedDepreciation; totals.set(group.accumulatedDepreciationAccountId, accumTotal); } }); return totals; }, [openingFixedAssets, fixedAssetGroupMap]);
  const controlledTotalsByAccount = useMemo(() => { const totals = new Map<string, { debit: number; credit: number }>(); const merge = (source: Map<string, { debit: number; credit: number }>) => source.forEach((value, key) => { const current = totals.get(key) || { debit: 0, credit: 0 }; current.debit += value.debit; current.credit += value.credit; totals.set(key, current); }); merge(subledgerTotalsByAccount); merge(fixedAssetTotalsByAccount); return totals; }, [subledgerTotalsByAccount, fixedAssetTotalsByAccount]);
  const openingGeneralLines = useMemo(() => generalLines.filter(row => {
    const account = accountMap.get(row.accountId);
    return Boolean(account && openingAccountIds.has(row.accountId) && !controlledIds.has(row.accountId) && (Number(row.debit || 0) > 0 || Number(row.credit || 0) > 0));
  }), [generalLines, accountMap, openingAccountIds, controlledIds]);
  const previewDebit = openingGeneralLines.reduce((sum, row) => sum + Number(row.debit || 0), 0) + subledgers.filter(row => row.kind !== 'SUPPLIER').reduce((sum, row) => sum + subAmount(row), 0) + openingFixedAssets.reduce((sum, item) => sum + item.acquisitionCost, 0);
  const previewCredit = openingGeneralLines.reduce((sum, row) => sum + Number(row.credit || 0), 0) + subledgers.filter(row => row.kind === 'SUPPLIER').reduce((sum, row) => sum + subAmount(row), 0) + openingFixedAssets.reduce((sum, item) => sum + item.openingAccumulatedDepreciation, 0);
  const saveCoa = async (event: React.FormEvent) => { event.preventDefault(); if (!accountForm.code.trim() || !accountForm.name.trim() || (accountForm.level > 1 && !accountForm.parentId) || (accountForm.level === 4 && !accountForm.cashFlowClass)) return showError('Kode, nama, parent, dan Klasifikasi Arus Kas Level 4 wajib diisi.'); try { setSaving(true); const payload = { ...accountForm }; if (accountForm.id) await api.put(`/api/accounting/coa/${accountForm.id}`, payload); else await api.post('/api/accounting/coa', payload); setAccountForm(blankAccount()); await reloadAccounts(); flash(accountForm.id ? 'COA diperbarui.' : 'COA ditambahkan.'); } catch (err) { showError(apiError(err, 'COA gagal disimpan.')); } finally { setSaving(false); } };
  const editCoa = (item: Account) => { setAccountForm({ id: item.id, code: item.code, name: item.name, level: item.level ?? 4, parentId: item.parentId || '', group: item.group, normalBalance: item.normalBalance, cashFlowClass: item.cashFlowClass || 'NON_CASH', active: item.active !== false, systemKey: item.systemKey || '' }); window.requestAnimationFrame(() => coaFormRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })); };
  const deleteCoa = async (item: Account) => { if (!window.confirm(`Hapus ${item.code} - ${item.name}?`)) return; try { await api.delete(`/api/accounting/coa/${item.id}`); await reloadAccounts(); flash('COA dihapus.'); } catch (err) { showError(apiError(err, 'COA tidak dapat dihapus.')); } };
  const applyTemplate = async () => { if (!window.confirm('Terapkan Template COA Perkebunan Kelapa Sawit? Template menyusun hierarki dan memetakan akun sistem tanpa mengubah ID transaksi.')) return; try { setSaving(true); await api.post('/api/accounting/coa-template/plantation'); await reloadAccounts(); flash('Template COA Perkebunan diterapkan. Kode/nama tetap dapat diedit.'); } catch (err) { showError(apiError(err, 'Template COA gagal diterapkan.')); } finally { setSaving(false); } };
  const saveSettings = async (event: React.FormEvent) => { event.preventDefault(); try { setSaving(true); await api.put('/api/accounting/settings', { fiscalYear: Number(settingsForm.fiscalYear), fiscalYearStartMonth: Number(settingsForm.fiscalYearStartMonth), conversionDate: settingsForm.conversionDate }); await loadFoundation(); flash('Tahun buku, periode, dan cut-off diperbarui.'); } catch (err) { showError(apiError(err, 'Pengaturan tahun buku gagal disimpan.')); } finally { setSaving(false); } };
  const changePeriod = async (period: Period, status: Period['status']) => { try { await api.put(`/api/accounting/periods/${period.id}`, { status }); await loadFoundation(); flash(`Periode ${period.label} menjadi ${status}.`); } catch (err) { showError(apiError(err, 'Status periode gagal diperbarui.')); } };
  const saveOpening = async () => { try { setSaving(true); await api.put('/api/accounting/opening-balance', { generalLines: openingGeneralLines, subledgers }); await loadFoundation(); flash('Draft Saldo Awal disimpan.'); } catch (err) { showError(apiError(err, 'Saldo Awal gagal disimpan.')); } finally { setSaving(false); } };
  const postOpening = async () => { if (!window.confirm('Posting Saldo Awal? Setelah diposting saldo awal dikunci sebagai audit trail.')) return; try { setSaving(true); await api.post('/api/accounting/opening-balance/post'); await loadFoundation(); await reloadAccounts(); flash('Saldo Awal berhasil diposting dan dikunci.'); } catch (err) { showError(apiError(err, 'Saldo Awal gagal diposting.')); } finally { setSaving(false); } };
  const entityOptions = (kind: SubKind) => { if (kind === 'CASH_BANK') return data.accounts.map(item => ({ id: item.id, label: `${item.name} · ${item.type}` })); if (kind === 'PKS') return data.mills.map(item => ({ id: item.id, label: item.name })); if (kind === 'EMPLOYEE') return data.harvesters.map(item => ({ id: item.id, label: item.name })); if (kind === 'SUPPLIER') return data.suppliers.filter(item => item.active !== false).map(item => ({ id: item.id, label: `${item.code ? `${item.code} - ` : ''}${item.name}` })); return inventoryItems.filter(item => item.active !== false && groupMap.get(item.groupId)?.canStore).map(item => ({ id: item.id, label: `${item.code} - ${item.name}` })); };
  const subAccountName = (row: Subledger) => { if (row.kind === 'CASH_BANK') return accounts.find(item => item.systemKey === `CASH:${row.entityId}`)?.name || 'Akun Kas/Bank'; if (row.kind === 'PKS') return accounts.find(item => item.systemKey === 'AR_PKS')?.name || 'Piutang PKS'; if (row.kind === 'EMPLOYEE') return accounts.find(item => item.systemKey === 'AR_EMPLOYEE')?.name || 'Piutang Karyawan'; if (row.kind === 'SUPPLIER') return accounts.find(item => item.systemKey === 'AP_SUPPLIER')?.name || 'Hutang Supplier'; const item = inventoryItems.find(candidate => candidate.id === row.entityId); const group = item ? groupMap.get(item.groupId) : undefined; return accountMap.get(group?.inventoryAccountId || '')?.name || 'Persediaan'; };
  return <div className="stack">
    {!fixedSection && <section className="panel foundation-head"><div><span className="eyebrow dark">Fondasi Akuntansi</span><h3>COA · Saldo Awal · Periode</h3><p>Empat level COA bersifat fleksibel. Hanya Level 4 yang menerima jurnal.</p></div><div className="mode-tabs"><button className={activeSection === 'coa' ? 'active' : ''} onClick={() => changeSection('coa')}>COA 4 Level</button><button className={activeSection === 'opening' ? 'active' : ''} onClick={() => changeSection('opening')}>Saldo Awal</button><button className={activeSection === 'periods' ? 'active' : ''} onClick={() => changeSection('periods')}>Periode Akuntansi</button></div></section>}
    {activeSection === 'coa' && <><section className="panel template-callout"><div><strong>Template COA Perkebunan Kelapa Sawit</strong><span>Struktur awal mengacu pada contoh COA kebun yang diberikan dan dirapikan menjadi 4 level. Level 4 membawa default Operating, Investing, Financing, atau Non-Cash/N/A dan tetap bisa diedit.</span></div><button type="button" className="primary" disabled={saving} onClick={applyTemplate}>Terapkan Template</button></section><div className="grid-form-list"><section ref={coaFormRef} className="panel form-panel"><div className="panel-head"><div><h3>{accountForm.id ? 'Edit COA' : 'Tambah COA'}</h3><p>Kode tidak menentukan klasifikasi; klasifikasi disimpan sebagai field tersendiri.</p></div>{accountForm.id && <button className="text-btn" onClick={() => setAccountForm(blankAccount())}>Batal</button>}</div><form className="form" onSubmit={saveCoa}><div className="row-2"><Field label="Level"><select value={accountForm.level} disabled={Boolean(accountForm.systemKey)} onChange={e => changeCoaLevel(Number(e.target.value) as 1|2|3|4)}>{[1,2,3,4].map(level => <option key={level} value={level}>Level {level}{level === 4 ? ' · Akun Posting' : ' · Header'}</option>)}</select></Field><Field label="Klasifikasi"><select value={accountForm.group} disabled={Boolean(accountForm.systemKey)} onChange={e => changeCoaGroup(e.target.value as Group)}>{groups.map(group => <option key={group} value={group}>{groupLabel[group]}</option>)}</select></Field></div><div className="row-2"><Field label="Kode"><input value={accountForm.code} onChange={e => setAccountForm(v => ({ ...v, code: e.target.value }))} placeholder={accountForm.level > 1 && !accountForm.parentId ? 'Pilih parent untuk kode otomatis' : 'Kode otomatis / dapat diedit'} />{!accountForm.id && <small>{accountForm.level === 1 ? 'Mengikuti kode Level 1 terakhir.' : accountForm.parentId ? 'Mengikuti kode terakhir pada parent yang dipilih.' : 'Kode akan terisi otomatis setelah parent dipilih.'}</small>}</Field><Field label="Nama"><input value={accountForm.name} onChange={e => setAccountForm(v => ({ ...v, name: e.target.value }))} /></Field></div>{accountForm.level > 1 && <Field label={`Parent Level ${accountForm.level - 1}`}><select value={accountForm.parentId} onChange={e => changeCoaParent(e.target.value)}><option value="">Pilih parent</option>{parentOptions.map(item => <option key={item.id} value={item.id}>{item.code} - {item.name}</option>)}</select></Field>}{accountForm.level === 4 && <div className="row-2"><Field label="Saldo Normal"><select value={accountForm.normalBalance} disabled={Boolean(accountForm.systemKey)} onChange={e => setAccountForm(v => ({ ...v, normalBalance: e.target.value as NormalBalance }))}><option value="DEBIT">Debit</option><option value="CREDIT">Kredit</option></select></Field><Field label="Klasifikasi Arus Kas"><select value={accountForm.cashFlowClass} onChange={e => setAccountForm(v => ({ ...v, cashFlowClass: e.target.value as CashFlowClass }))}><option value="">Pilih klasifikasi</option><option value="OPERATING">Operating</option><option value="INVESTING">Investing</option><option value="FINANCING">Financing</option><option value="NON_CASH">Non-Cash / N/A</option></select></Field></div>}<label className="check-row"><input type="checkbox" checked={accountForm.active} disabled={Boolean(accountForm.systemKey)} onChange={e => setAccountForm(v => ({ ...v, active: e.target.checked }))} /><span>Aktif</span></label><button className="primary wide" disabled={saving}><Save size={16} /> Simpan COA</button></form></section><section className="panel list-panel"><div className="panel-head wrap"><div><h3>Hierarki COA</h3><p>{accounts.length} node. Disusun mengikuti parent: Level 1–3 sebagai header, Level 4 sebagai akun posting.</p></div><label className="search-input coa-list-search"><Search size={15} /><input value={coaSearch} onChange={e => setCoaSearch(e.target.value)} placeholder="Cari kode atau nama akun..." /></label></div><div className="table-wrap"><table className="coa-tree-table"><thead><tr><th>Level</th><th>Kode / Nama</th><th>Klasifikasi</th><th>Arus Kas</th><th>Status</th><th></th></tr></thead><tbody>{filteredAccounts.map(item => { const level = item.level ?? 4; return <tr key={item.id} className={`coa-row coa-row-level-${level}`}><td><span className={`level-badge l${level}`}>L{level}</span></td><td><div className={`coa-name coa-indent-${level}`}><strong>{item.code}</strong><span>{item.name}</span>{item.systemKey && <small>Akun sistem · ID jurnal tetap</small>}</div></td><td>{groupLabel[item.group]}</td><td>{level === 4 ? cashFlowLabel[item.cashFlowClass || 'NON_CASH'] : '-'}</td><td>{posting(item) ? 'POSTING' : 'HEADER'} · {item.active ? 'AKTIF' : 'NONAKTIF'}</td><td><div className="action-group"><button className="icon-btn" onClick={() => editCoa(item)}><Pencil size={15} /></button>{!item.systemKey && !item.locked && <button className="icon-btn danger" onClick={() => deleteCoa(item)}><Trash2 size={15} /></button>}</div></td></tr>; })}</tbody></table></div></section></div></>}
    {activeSection === 'periods' && <><section className="panel"><div className="panel-head"><div><h3>Pengaturan Tahun Buku & Cut-off</h3><p>Tanggal sebelum/hingga cut-off diwakili Saldo Awal dan tidak menerima transaksi detail baru.</p></div></div><form className="form" onSubmit={saveSettings}><div className="accounting-settings-grid"><Field label="Tahun Buku"><input type="number" min="2000" max="2200" value={settingsForm.fiscalYear} onChange={e => setSettingsForm(v => ({ ...v, fiscalYear: e.target.value }))} /></Field><Field label="Mulai Tahun Buku"><select value={settingsForm.fiscalYearStartMonth} onChange={e => setSettingsForm(v => ({ ...v, fiscalYearStartMonth: e.target.value }))}>{monthNames.map((name, index) => <option key={name} value={index + 1}>{name}</option>)}</select></Field><Field label="Tanggal Cut-off / Konversi"><input type="date" value={settingsForm.conversionDate} onChange={e => setSettingsForm(v => ({ ...v, conversionDate: e.target.value }))} /></Field></div><div className="notice">Saldo Awal menampilkan akun Neraca Level 4 dengan kode awal 1–3. Transaksi operasional baru dimulai setelah tanggal cut-off.</div><button className="primary" disabled={saving}><Save size={16} /> Simpan & Bentuk 12 Periode</button></form></section><section className="panel"><div className="panel-head"><div><h3>12 Periode Akuntansi</h3><p>OPEN menerima transaksi. CLOSED menolak perubahan. LOCKED hanya dapat dibuka kembali oleh Owner.</p></div></div>{periods.length === 0 ? <div className="empty"><span>Simpan pengaturan Tahun Buku terlebih dahulu.</span></div> : <div className="period-list">{periods.map(period => <div className="period-row" key={period.id}><div><strong>{period.label}</strong><span>{period.startDate} s.d. {period.endDate}</span></div><span className={`period-status ${period.status.toLowerCase()}`}>{period.status}</span><div className="period-actions"><button className="secondary small-btn" disabled={period.status === 'OPEN'} onClick={() => changePeriod(period, 'OPEN')}>Open</button><button className="secondary small-btn" disabled={period.status === 'CLOSED'} onClick={() => changePeriod(period, 'CLOSED')}>Close</button><button className="secondary small-btn" disabled={period.status === 'LOCKED'} onClick={() => changePeriod(period, 'LOCKED')}>Lock</button></div></div>)}</div>}</section></>}
    {activeSection === 'opening' && <><section className="panel"><div className="panel-head"><div><h3>Saldo Awal</h3><p>Cut-off: <strong>{settings?.conversionDate || 'belum diatur'}</strong>. Kas/Bank, PKS, Karyawan, Supplier, Persediaan, dan Aset Tetap mengikuti subledger masing-masing.</p></div><span className={`status ${opening?.status === 'POSTED' ? 'active' : ''}`}>{opening?.status || 'BELUM ADA'}</span></div>{!settings?.setupComplete && <div className="notice">Atur Tahun Buku dan tanggal cut-off dari kartu Periode Akuntansi terlebih dahulu.</div>}{opening?.status === 'POSTED' && <div className="notice">Saldo Awal sudah diposting dan dikunci. Journal opening menjadi bagian Buku Besar dan Neraca Saldo.</div>}<div className="opening-summary"><div><span>Total Debit</span><strong>{idr.format(previewDebit)}</strong></div><div><span>Total Kredit</span><strong>{idr.format(previewCredit)}</strong></div><div><span>Status</span><strong>{previewDebit > 0 && previewDebit === previewCredit ? 'SEIMBANG' : `SELISIH ${idr.format(previewDebit - previewCredit)}`}</strong></div></div></section><section className="panel">
      <div className="purchase-section-head">
        <div><strong>Akun Saldo Awal · Kode 1–3</strong><span>Semua akun posting Level 4 berkode awal 1, 2, dan 3 tampil otomatis sesuai urutan kode. Akun yang dikontrol subledger mengikuti Detail Subledger di bawah.</span></div>
        <label className="search-input coa-list-search"><Search size={15} /><input value={openingSearch} onChange={e => setOpeningSearch(e.target.value)} placeholder="Cari kode atau nama akun..." aria-label="Cari akun Saldo Awal" /></label>
      </div>
      {openingAccounts.length === 0 ? <div className="empty"><span>Belum ada akun posting Level 4 dengan kode awal 1–3.</span></div> : filteredOpeningAccounts.length === 0 ? <div className="empty"><span>Akun Saldo Awal tidak ditemukan untuk pencarian tersebut.</span></div> : <>
        <div className="opening-line-head"><span>Akun</span><span>Debit</span><span>Kredit</span><span>Catatan</span></div>
        <div className="opening-lines">{filteredOpeningAccounts.map(account => {
          const line = generalLineMap.get(account.id) || blankGeneral();
          const controlled = controlledIds.has(account.id);
          const controlledTotal = controlledTotalsByAccount.get(account.id) || { debit: 0, credit: 0 };
          const fixedAssetControlled = fixedAssetControlledIds.has(account.id);
          const disabled = opening?.status === 'POSTED' || controlled;
          return <div className={`opening-line ${controlled ? 'controlled' : ''}`} key={account.id}>
            <div className="opening-account-cell"><strong>{account.code}</strong><span>{account.name}</span>{controlled && <small>{fixedAssetControlled ? 'Nilai mengikuti Daftar Aset Tetap' : 'Nilai mengikuti Detail Subledger'}</small>}</div>
            <input className="cash-entry-cell-input cash-entry-money" disabled={disabled} inputMode="numeric" aria-label={`Debit ${account.code} ${account.name}`} placeholder="Debit" value={formatMoneyInput(controlled ? controlledTotal.debit || '' : line.debit)} onChange={e => { const debit = e.target.value.replace(/[^0-9]/g, ''); setGeneralAccount(account.id, { debit, credit: debit ? '' : line.credit }); }} />
            <input className="cash-entry-cell-input cash-entry-money" disabled={disabled} inputMode="numeric" aria-label={`Kredit ${account.code} ${account.name}`} placeholder="Kredit" value={formatMoneyInput(controlled ? controlledTotal.credit || '' : line.credit)} onChange={e => { const credit = e.target.value.replace(/[^0-9]/g, ''); setGeneralAccount(account.id, { credit, debit: credit ? '' : line.debit }); }} />
            {controlled ? <div className="opening-controlled-note">{fixedAssetControlled ? 'Daftar Aset Tetap' : 'Detail Subledger'}</div> : <input className="cash-entry-cell-input" disabled={opening?.status === 'POSTED'} placeholder="Catatan" value={line.note} onChange={e => setGeneralAccount(account.id, { note: e.target.value })} />}
          </div>;
        })}</div>
      </>}
    </section><section className="panel"><div className="purchase-section-head"><div><strong>Detail Aset Tetap</strong><span>Ditarik langsung dari Master Data → Daftar Aset Tetap. Akumulasi mengikuti perhitungan otomatis sampai cut-off atau Override Manual khusus migrasi.</span></div></div>{openingFixedAssets.length === 0 ? <div className="empty"><span>Belum ada aset yang masuk cut-off Saldo Awal.</span></div> : <div className="table-wrap"><table><thead><tr><th>Kode / Aset</th><th>Kelompok</th><th>Cost Center</th><th className="right">Harga Perolehan</th><th className="right">Akumulasi</th><th className="right">Nilai Buku Awal</th></tr></thead><tbody>{openingFixedAssets.map(asset => { const group = fixedAssetGroupMap.get(asset.groupId); const kebun = data.kebun.find(item => item.id === asset.kebunId); return <tr key={asset.id}><td><strong>{asset.code}</strong> · {asset.name}</td><td>{group?.name || '-'}</td><td>{asset.kebunId ? kebun?.name || '-' : 'Pusat / Umum'}</td><td className="right">{idr.format(asset.acquisitionCost)}</td><td className="right">{idr.format(asset.openingAccumulatedDepreciation)}</td><td className="right"><strong>{idr.format(Math.max(0, asset.acquisitionCost - asset.openingAccumulatedDepreciation))}</strong></td></tr>; })}</tbody></table></div>}</section><section className="panel opening-inventory-panel"><div className="purchase-section-head"><div><strong>Saldo Awal Persediaan</strong><span>Diisi per barang. Qty × Harga Rata-rata membentuk nilai persediaan dan akun GL mengikuti Kelompok Barang secara otomatis.</span></div>{opening?.status !== 'POSTED' && <button type="button" className="secondary small-btn" onClick={() => setSubledgers(rows => [...rows, blankInventorySub()])}><Plus size={14} /> Tambah Barang</button>}</div><div className="opening-inventory-summary"><div><span>Jumlah Baris</span><strong>{openingInventoryRows.length}</strong></div><div><span>Total Persediaan</span><strong>{idr.format(openingInventoryTotal)}</strong></div><div><span>Lokasi Stok Awal</span><strong>Gudang Utama</strong><small>Sinkron ke gudang default saat posting.</small></div></div>{openingInventoryRows.length === 0 ? <div className="empty"><span>Belum ada saldo awal persediaan.</span></div> : <div className="opening-inventory-list">{openingInventoryRows.map(({ row, index }) => { const item = inventoryItems.find(candidate => candidate.id === row.entityId); const group = item ? groupMap.get(item.groupId) : undefined; const unit = unitMap.get(item?.unitId || ''); const unitChoices = openingItemUnitChoices(item, inventoryUnits); const inputUnitId = row.inputUnitId || item?.unitId || ''; const inputUnit = unitChoices.find(choice => choice.unitId === inputUnitId) || unitChoices[0]; const selectedLabel = item ? `${item.code} - ${item.name}` : ''; const needle = (row.search || '').trim().toLowerCase(); const matches = storableInventoryItems.filter(candidate => !needle || `${candidate.code} ${candidate.name}`.toLowerCase().includes(needle)).slice(0, 30); return <div className="opening-inventory-row" key={index}><div className="opening-inventory-item"><span>Barang</span><div className="cash-account-picker"><input disabled={opening?.status === 'POSTED'} autoComplete="off" value={row.search ?? selectedLabel} placeholder="Ketik kode / nama barang..." onFocus={event => { setOpeningInventoryPicker(index); event.currentTarget.select(); }} onBlur={() => window.setTimeout(() => setOpeningInventoryPicker(current => current === index ? null : current), 120)} onChange={event => { setSub(index, { search: event.target.value, entityId: '' }); setOpeningInventoryPicker(index); }} onKeyDown={event => { if (event.key === 'Escape') setOpeningInventoryPicker(null); if (event.key === 'Enter' && openingInventoryPicker === index && matches[0]) { event.preventDefault(); selectOpeningInventoryItem(index, matches[0].id); setOpeningInventoryPicker(null); } }} />{openingInventoryPicker === index && <div className="cash-account-options">{matches.length === 0 ? <div className="cash-account-empty">Barang tidak ditemukan.</div> : matches.map(option => { const optionUnit = unitMap.get(option.unitId); const optionGroup = groupMap.get(option.groupId); return <button type="button" key={option.id} onMouseDown={event => event.preventDefault()} onClick={() => { selectOpeningInventoryItem(index, option.id); setOpeningInventoryPicker(null); }}><strong>{option.code}</strong><span>{option.name} · {optionUnit?.code || optionUnit?.name || '-'} · {optionGroup?.name || '-'}</span></button>; })}</div>}</div></div><label><span>Qty</span><input disabled={opening?.status === 'POSTED'} inputMode="decimal" value={row.inputQuantity ?? row.quantity} placeholder="0" onChange={e => setSub(index, { inputQuantity: e.target.value.replace(',', '.').replace(/[^0-9.]/g, '') })} /></label><label className="opening-inventory-unit"><span>Satuan</span><select disabled={opening?.status === 'POSTED' || !item} value={inputUnitId} onChange={e => setSub(index, { inputUnitId: e.target.value })}>{unitChoices.map(choice => <option key={choice.unitId} value={choice.unitId}>{choice.label}{choice.factor !== 1 ? ' · 1 ' + choice.label + ' = ' + choice.factor + ' ' + (unit?.code || unit?.name || 'dasar') : ' · Dasar'}</option>)}</select></label><label><span>Harga / Satuan</span><input disabled={opening?.status === 'POSTED'} inputMode="numeric" value={formatMoneyInput(row.inputUnitCost ?? row.unitCost)} placeholder="0" onChange={e => setSub(index, { inputUnitCost: e.target.value.replace(/[^0-9]/g, '') })} /><small>{inputUnit && inputUnit.factor !== 1 ? 'Setara ' + idr.format(Number((row.inputUnitCost ?? row.unitCost) || 0) / inputUnit.factor) + ' / ' + (unit?.code || unit?.name || 'dasar') : ''}</small></label><div className="opening-inventory-account"><span>Akun Persediaan</span><strong>{accountMap.get(group?.inventoryAccountId || '')?.code || '-'}</strong><small>{accountMap.get(group?.inventoryAccountId || '')?.name || 'Mengikuti Kelompok Barang'}</small></div><div className="opening-inventory-value"><span>Nilai</span><strong>{idr.format(subAmount(row))}</strong></div>{opening?.status !== 'POSTED' && <button type="button" className="icon-btn danger" aria-label="Hapus saldo awal persediaan" onClick={() => setSubledgers(rows => rows.filter((_, i) => i !== index))}><Trash2 size={15} /></button>}</div>; })}</div>}</section><section className="panel"><div className="purchase-section-head"><div><strong>Detail Subledger Lainnya</strong><span>Kas/Bank, Piutang PKS, Piutang Karyawan, dan Hutang Supplier. Persediaan diisi pada panel khusus di atas.</span></div>{opening?.status !== 'POSTED' && <button className="secondary small-btn" onClick={() => setSubledgers(rows => [...rows, blankSub()])}><Plus size={14} /> Detail</button>}</div>{openingDetailRows.length === 0 ? <div className="empty"><span>Belum ada detail subledger lainnya.</span></div> : <div className="subledger-lines">{openingDetailRows.map(({ row, index }) => { const options = entityOptions(row.kind); return <div className="subledger-line" key={index}><select disabled={opening?.status === 'POSTED'} value={row.kind} onChange={e => setSub(index, { kind: e.target.value as SubKind, entityId: '', amount: '', quantity: '', unitCost: '', search: '' })}><option value="CASH_BANK">Kas / Bank</option><option value="PKS">Piutang PKS</option><option value="EMPLOYEE">Piutang Karyawan</option><option value="SUPPLIER">Hutang Supplier</option></select><select disabled={opening?.status === 'POSTED'} value={row.entityId} onChange={e => setSub(index, { entityId: e.target.value })}><option value="">Pilih detail</option>{options.map(option => <option key={option.id} value={option.id}>{option.label}</option>)}</select><div className="subledger-account"><span>Akun</span><strong>{subAccountName(row)}</strong></div><input disabled={opening?.status === 'POSTED'} inputMode="numeric" placeholder="Nominal" value={formatMoneyInput(row.amount)} onChange={e => setSub(index, { amount: e.target.value.replace(/[^0-9]/g, '') })} /><input disabled={opening?.status === 'POSTED'} placeholder="Referensi / invoice / DO" value={row.reference} onChange={e => setSub(index, { reference: e.target.value })} />{opening?.status !== 'POSTED' && <button className="icon-btn danger" onClick={() => setSubledgers(rows => rows.filter((_, i) => i !== index))}><Trash2 size={14} /></button>}</div>; })}</div>}</section>{opening?.status !== 'POSTED' && <section className="panel opening-actions"><div><strong>Posting hanya jika Debit = Kredit</strong><span>Posting akan mengunci Saldo Awal Kas/Bank, Persediaan, serta harga perolehan dan akumulasi awal dari Daftar Aset Tetap.</span></div><div className="action-group"><button className="secondary" disabled={saving || !settings?.setupComplete} onClick={saveOpening}><Save size={16} /> Simpan Draft</button><button className="primary" disabled={saving || !settings?.setupComplete || previewDebit <= 0 || previewDebit !== previewCredit} onClick={postOpening}>Posting Saldo Awal</button></div></section>}</>}
  </div>;
}
function Field({ label, children }: { label: string; children: React.ReactNode }) { return <label className="field"><span>{label}</span>{children}</label>; }


/* v4.13 multi-unit opening */


/* v4.13.1 coa auto code */
