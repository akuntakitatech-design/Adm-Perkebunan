import { useEffect, useMemo, useState } from 'react';
import { api } from './lib/client';
import { Save } from 'lucide-react';
import AccountSearchPicker from './AccountSearchPicker';
import type { AccountingAccount, AccountingGroup } from './AccountingModule';

type Role = 'OWNER' | 'ADMIN_PUSAT' | 'FINANCE' | 'ADMIN_KEBUN' | 'VIEWER';
type Definition = { key: string; label: string; section: string; group: AccountingGroup; description: string };
type Props = { accounts: AccountingAccount[]; mappingIds: Record<string, string>; role: Role; flash: (text: string) => void; showError: (text: string) => void; onSaved: () => Promise<void> };

const definitions: Definition[] = [
  { key: 'AR_PKS', label: 'Piutang Usaha - PKS', section: 'Piutang & Kewajiban', group: 'ASSET', description: 'Penjualan TBS secara kredit dan penerimaan pembayaran PKS.' },
  { key: 'AR_EMPLOYEE', label: 'Piutang Karyawan', section: 'Piutang & Kewajiban', group: 'ASSET', description: 'Pencairan dan potongan Piutang Karyawan melalui Payroll.' },
  { key: 'AP_SUPPLIER', label: 'Hutang Usaha', section: 'Piutang & Kewajiban', group: 'LIABILITY', description: 'Invoice Pembelian kredit, tagihan vendor, dan pembayaran supplier.' },
  { key: 'PAYROLL_PAYABLE', label: 'Hutang Gaji / Upah', section: 'Piutang & Kewajiban', group: 'LIABILITY', description: 'Upah yang sudah diakui tetapi belum dibayarkan.' },
  { key: 'PAYROLL_DEDUCTION', label: 'Potongan Payroll Belum Diselesaikan', section: 'Piutang & Kewajiban', group: 'LIABILITY', description: 'Potongan payroll yang masih menjadi kewajiban.' },
  { key: 'OTHER_PAYABLE', label: 'Hutang Lainnya', section: 'Piutang & Kewajiban', group: 'LIABILITY', description: 'Kewajiban lain yang tidak berasal dari supplier utama.' },
  { key: 'CAPITAL', label: 'Modal Disetor', section: 'Ekuitas & Closing', group: 'EQUITY', description: 'Setoran modal pemilik/pemegang saham.' },
  { key: 'RETAINED_EARNINGS', label: 'Laba Ditahan', section: 'Ekuitas & Closing', group: 'EQUITY', description: 'Tujuan saldo laba tahun-tahun sebelumnya saat proses closing.' },
  { key: 'CURRENT_YEAR_PROFIT', label: 'Laba Tahun Berjalan', section: 'Ekuitas & Closing', group: 'EQUITY', description: 'Akun reserved untuk proses tutup buku; laba berjalan tetap dihitung derived sebelum closing.' },
  { key: 'HISTORICAL_BALANCING', label: 'Historical Balancing', section: 'Ekuitas & Closing', group: 'EQUITY', description: 'Khusus kebutuhan migrasi dan penyeimbang historis yang terdokumentasi.' },
  { key: 'VAT_INPUT', label: 'PPN Masukan', section: 'Pajak & Pendapatan', group: 'ASSET', description: 'PPN pada Invoice Pembelian yang memenuhi mapping pajak masukan.' },
  { key: 'REVENUE_TBS', label: 'Penjualan TBS', section: 'Pajak & Pendapatan', group: 'REVENUE', description: 'Pendapatan TBS dari hasil Timbangan Pabrik.' },
  { key: 'REVENUE_OTHER', label: 'Pendapatan Lainnya', section: 'Pajak & Pendapatan', group: 'REVENUE', description: 'Fallback pendapatan otomatis yang belum mempunyai modul khusus.' },
  { key: 'EXP_HARVEST', label: 'Beban Upah Panen', section: 'Beban Otomatis', group: 'EXPENSE', description: 'Pengakuan upah panen dari transaksi TBS.' },
  { key: 'EXP_WEIGH', label: 'Beban Upah Timbang', section: 'Beban Otomatis', group: 'EXPENSE', description: 'Pengakuan upah timbang dari transaksi TBS.' },
  { key: 'EXP_LANGSIR', label: 'Beban Upah Langsir', section: 'Beban Otomatis', group: 'EXPENSE', description: 'Pengakuan upah langsir dari transaksi TBS.' },
  { key: 'EXP_WORK', label: 'Beban Pekerjaan Kebun', section: 'Beban Otomatis', group: 'EXPENSE', description: 'Pengakuan pekerjaan kebun yang masuk Payroll.' },
  { key: 'EXP_TRANSPORT', label: 'Beban Transportasi / Armada', section: 'Beban Otomatis', group: 'EXPENSE', description: 'Fallback tagihan armada/transport yang tidak membawa akun debit khusus.' },
  { key: 'EXP_FERTILIZER', label: 'Beban Pupuk', section: 'Beban Otomatis', group: 'EXPENSE', description: 'Fallback beban pupuk non-persediaan.' },
  { key: 'EXP_HERBICIDE', label: 'Beban Racun & Herbisida', section: 'Beban Otomatis', group: 'EXPENSE', description: 'Fallback beban racun/herbisida non-persediaan.' },
  { key: 'EXP_MAINTENANCE', label: 'Beban Perawatan', section: 'Beban Otomatis', group: 'EXPENSE', description: 'Fallback beban perawatan kebun.' },
  { key: 'EXP_FUEL', label: 'Beban BBM', section: 'Beban Otomatis', group: 'EXPENSE', description: 'Fallback beban BBM.' },
  { key: 'EXP_TOOLS', label: 'Beban Peralatan & Suku Cadang', section: 'Beban Otomatis', group: 'EXPENSE', description: 'Fallback beban peralatan/suku cadang non-persediaan.' },
  { key: 'EXP_ADMIN', label: 'Beban Administrasi', section: 'Beban Otomatis', group: 'EXPENSE', description: 'Fallback beban administrasi.' },
  { key: 'EXP_OTHER', label: 'Beban Lainnya', section: 'Beban Otomatis', group: 'EXPENSE', description: 'Fallback beban otomatis yang belum mempunyai mapping khusus.' },
];
const sectionOrder = ['Piutang & Kewajiban', 'Ekuitas & Closing', 'Pajak & Pendapatan', 'Beban Otomatis'];
const groupLabel: Record<AccountingGroup, string> = { ASSET: 'Aset', LIABILITY: 'Liabilitas', EQUITY: 'Ekuitas', REVENUE: 'Pendapatan', EXPENSE: 'Beban' };
function apiError(err: unknown, fallback: string) { const response = (err as { response?: { data?: { error?: string; message?: string } } })?.response?.data; return response?.error || response?.message || fallback; }

export default function SystemAccounts({ accounts, mappingIds, role, flash, showError, onSaved }: Props) {
  const [draft, setDraft] = useState<Record<string, string>>(mappingIds);
  const [saving, setSaving] = useState(false);
  const canEdit = role === 'OWNER' || role === 'ADMIN_PUSAT';
  useEffect(() => setDraft(mappingIds), [mappingIds]);
  const changed = useMemo(() => definitions.some(item => (draft[item.key] || '') !== (mappingIds[item.key] || '')), [draft, mappingIds]);
  const eligible = (definition: Definition) => {
    const rows = accounts.filter(item => item.active && (item.level ?? 4) === 4 && item.posting !== false && item.group === definition.group && (!item.systemKey || item.systemKey === definition.key));
    const selected = accounts.find(item => item.id === draft[definition.key]);
    return selected && !rows.some(item => item.id === selected.id) ? [...rows, selected] : rows;
  };
  const save = async () => {
    const missing = definitions.find(item => !draft[item.key]);
    if (missing) return showError(`Pilih akun untuk ${missing.label} terlebih dahulu.`);
    if (!window.confirm('Simpan Setup Akun Penting? Mapping ini menjadi sumber jurnal otomatis untuk transaksi berikutnya.')) return;
    try {
      setSaving(true);
      await api.put('/api/accounting/system-accounts', { mappings: definitions.map(item => ({ key: item.key, accountId: draft[item.key] })) });
      await onSaved();
      flash('Setup Akun Penting berhasil disimpan.');
    } catch (err) {
      showError(apiError(err, 'Setup Akun Penting gagal disimpan.'));
    } finally {
      setSaving(false);
    }
  };

  return <div className="stack">
    <section className="panel">
      <div className="panel-head"><div><h3>Setup Akun Penting</h3><p>Mapping akun yang menjadi penghubung jurnal otomatis antar modul. Sistem membaca fungsi akun, bukan nama/kode semata.</p></div></div>
      <div className="notice">Kas/Bank, Persediaan/Kelompok Barang, dan Aset Tetap tidak ditampilkan di sini karena mapping akunnya sudah melekat pada master masing-masing. Mapping Akun Penting sebaiknya diselesaikan sebelum transaksi dimulai; setelah transaksi operasional atau Saldo Awal diposting, perubahan mapping dikunci agar jurnal historis tidak berpindah akun.</div>
    </section>
    {sectionOrder.map(section => <section className="panel" key={section}>
      <div className="panel-head"><div><h3>{section}</h3><p>Pilih akun posting Level 4 sesuai klasifikasi yang diwajibkan.</p></div></div>
      <div className="mini-form">
        {definitions.filter(item => item.section === section).map(definition => <div className="row-2" key={definition.key}>
          <label className="field"><span>{definition.label}</span><AccountSearchPicker accounts={eligible(definition)} value={draft[definition.key] || ''} onChange={accountId => setDraft(value => ({ ...value, [definition.key]: accountId }))} disabled={!canEdit || saving} placeholder={`Cari akun ${groupLabel[definition.group].toLowerCase()}...`} ariaLabel={`Cari akun ${definition.label}`} /></label>
          <div className="opening-account-cell"><strong>{groupLabel[definition.group]}</strong><span>{definition.description}</span></div>
        </div>)}
      </div>
    </section>)}
    <section className="panel opening-actions"><div><strong>Satu sumber mapping untuk jurnal otomatis</strong><span>Perubahan tidak mengubah mapping Kelompok Barang maupun Kelompok Aset Tetap.</span></div><button type="button" className="primary" disabled={!canEdit || saving || !changed} onClick={save}><Save size={16} /> Simpan Setup Akun Penting</button></section>
  </div>;
}
