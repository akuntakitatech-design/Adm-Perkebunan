#!/usr/bin/env node
/**
 * Seed data dummy Administrasi Perkebunan melalui API (bukan tulis DB langsung),
 * sehingga seluruh aturan bisnis (COA otomatis, hutang armada, dsb.) tetap konsisten.
 *
 *   API_BASE=http://localhost:8001 ADMIN_EMAIL=admin@kebun.test ADMIN_PASSWORD=admin123 node scripts/seed-dummy.mjs
 *
 * Aman dijalankan pada database kosong. Jika data master dengan nama sama sudah ada,
 * script memakai data tersebut (idempoten untuk master), transaksi hanya dibuat bila belum ada.
 */
import 'dotenv/config';

const API_BASE = (process.env.API_BASE || 'http://localhost:8001').replace(/\/+$/, '');
const EMAIL = process.env.ADMIN_EMAIL || 'admin@kebun.test';
const PASSWORD = process.env.ADMIN_PASSWORD || 'admin123';

let cookie = '';
async function api(method, path, body) {
  const res = await fetch(`${API_BASE}${path}`, {
    method,
    headers: { 'Content-Type': 'application/json', ...(cookie ? { Cookie: cookie } : {}) },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const setCookie = res.headers.get('set-cookie');
  if (setCookie) cookie = setCookie.split(';')[0];
  const text = await res.text();
  let data; try { data = text ? JSON.parse(text) : null; } catch { data = text; }
  if (!res.ok) throw new Error(`${method} ${path} -> ${res.status}: ${data?.error || text}`);
  return data;
}
const log = (...args) => console.log('[seed]', ...args);

// Periode dummy: bulan berjalan (tanggal 1..20) agar dashboard bulan ini langsung terisi.
const today = new Date();
const Y = today.getFullYear();
const M = String(today.getMonth() + 1).padStart(2, '0');
const d = (day) => `${Y}-${M}-${String(day).padStart(2, '0')}`;
const firstOfMonth = d(1);

async function ensureMaster(list, matcher, create, label) {
  const found = list.find(matcher);
  if (found) { log(`${label}: sudah ada (${found.id})`); return found; }
  const created = await create();
  log(`${label}: dibuat (${created.id})`);
  return created;
}

async function main() {
  log(`Login ke ${API_BASE} sebagai ${EMAIL}`);
  await api('POST', '/api/auth/login', { email: EMAIL, password: PASSWORD });
  let boot = await api('GET', '/api/bootstrap');
  log(`Workspace aktif: ${boot.workspace.name} (${boot.workspace.id})`);

  // Profil perusahaan dummy
  await api('PUT', '/api/workspace/profile', {
    name: 'PT Sawit Makmur Sejahtera (Dummy)',
    shortName: 'SMS',
    businessType: 'Perkebunan Kelapa Sawit',
    address: 'Jl. Lintas Sumatera KM 12',
    city: 'Pekanbaru',
    province: 'Riau',
    phone: '0761-123456',
    email: 'admin@kebun.test',
    picName: 'Budi Santoso',
    picPosition: 'Manajer Kebun',
    reportName: 'PT Sawit Makmur Sejahtera',
  }).catch(err => log('Profil perusahaan dilewati:', err.message));

  // ---------------- Master: Kebun ----------------
  const kebunA = await ensureMaster(boot.kebun, k => k.code === 'KBN-A', () => api('POST', '/api/kebun', {
    code: 'KBN-A', name: 'Kebun Sei Rokan', owner: 'PT Sawit Makmur Sejahtera', location: 'Rokan Hulu, Riau', areaHa: 45.5, treeCount: 6200, status: 'AKTIF',
  }), 'Kebun A');
  const kebunB = await ensureMaster(boot.kebun, k => k.code === 'KBN-B', () => api('POST', '/api/kebun', {
    code: 'KBN-B', name: 'Kebun Tapung Hilir', owner: 'PT Sawit Makmur Sejahtera', location: 'Kampar, Riau', areaHa: 32, treeCount: 4300, status: 'AKTIF',
  }), 'Kebun B');

  // ---------------- Master: Kas & Bank ----------------
  const kas = await ensureMaster(boot.accounts, a => a.name === 'Kas Kebun', () => api('POST', '/api/accounts', {
    name: 'Kas Kebun', type: 'KAS', openingBalance: 25000000,
  }), 'Kas Kebun');
  const bank = await ensureMaster(boot.accounts, a => a.name === 'Bank BRI Operasional', () => api('POST', '/api/accounts', {
    name: 'Bank BRI Operasional', type: 'BANK', openingBalance: 150000000, bankName: 'BRI', accountNumber: '1234-01-000123-45-6',
  }), 'Bank BRI');

  // ---------------- Master: PKS, Tenaga Kerja, Armada, Supplier ----------------
  const mill = await ensureMaster(boot.mills, m => m.name === 'PKS Sinar Rokan', () => api('POST', '/api/tbs-master/mills', {
    name: 'PKS Sinar Rokan', location: 'Ujung Batu, Rokan Hulu', active: true,
  }), 'PKS');

  const workerNames = [
    ['Ahmad Fauzi', '0812-1111-2201'],
    ['Budi Hartono', '0812-1111-2202'],
    ['Cahyo Pratama', '0812-1111-2203'],
    ['Dedi Kurniawan', '0812-1111-2204'],
  ];
  const workers = [];
  for (const [name, phone] of workerNames) {
    workers.push(await ensureMaster(boot.harvesters, h => h.name === name, () => api('POST', '/api/tbs-master/harvesters', { name, phone, active: true }), `Pekerja ${name}`));
  }
  const [pekerjaA, pekerjaB, pekerjaC, pekerjaD] = workers;

  const suppliers = (await api('GET', '/api/bootstrap')).suppliers || [];
  const supplierArmada = await ensureMaster(suppliers, s => s.name === 'CV Angkutan Rokan Jaya', () => api('POST', '/api/suppliers', {
    code: 'SUP-ARM', name: 'CV Angkutan Rokan Jaya', contact: 'Pak Rusdi', phone: '0813-2222-3301', address: 'Ujung Batu', active: true,
  }), 'Supplier armada');
  const supplierPupuk = await ensureMaster(suppliers, s => s.name === 'Toko Tani Subur', () => api('POST', '/api/suppliers', {
    code: 'SUP-PPK', name: 'Toko Tani Subur', contact: 'Ibu Wati', phone: '0813-2222-3302', address: 'Pasir Pengaraian', active: true,
  }), 'Supplier pupuk');

  const truckOwn = await ensureMaster(boot.vehicles, v => v.plateNumber === 'BM 8123 TR', () => api('POST', '/api/tbs-master/vehicles', {
    plateNumber: 'BM 8123 TR', name: 'Truk Colt Diesel', owner: 'Milik Sendiri', ownershipType: 'OWN', rentMode: 'TRIP', defaultRate: 350000, active: true,
  }), 'Armada sendiri');
  const truckVendor = await ensureMaster(boot.vehicles, v => v.plateNumber === 'BM 9456 UK', () => api('POST', '/api/tbs-master/vehicles', {
    plateNumber: 'BM 9456 UK', name: 'Dump Truck Vendor', owner: 'CV Angkutan Rokan Jaya', ownershipType: 'VENDOR', supplierId: supplierArmada.id, rentMode: 'KG_PABRIK', defaultRate: 45, active: true,
  }), 'Armada vendor');

  // ---------------- Tarif TBS per kebun ----------------
  for (const [kebun, harvest, langsir] of [[kebunA, 180, 40], [kebunB, 200, 45]]) {
    await ensureMaster(boot.tbsRates, r => r.kebunId === kebun.id, () => api('POST', '/api/tbs-master/rates', {
      kebunId: kebun.id, effectiveDate: `${Y}-01-01`, harvestRatePerKg: harvest, harvestWeightBasis: 'LAPANGAN',
      weighingEnabled: true, weighingRatePerKg: 10, weighingWeightBasis: 'LAPANGAN',
      langsirEnabled: true, langsirRatePerKg: langsir, langsirWeightBasis: 'LAPANGAN',
    }), `Tarif TBS ${kebun.code}`);
  }

  // ---------------- Master pekerjaan & tarif ----------------
  boot = await api('GET', '/api/bootstrap');
  const wtNunas = await ensureMaster(boot.workTypes, w => w.name === 'Nunas (Pruning)', () => api('POST', '/api/work-types', { name: 'Nunas (Pruning)', unit: 'pohon', active: true }), 'Pekerjaan Nunas');
  const wtSemprot = await ensureMaster(boot.workTypes, w => w.name === 'Semprot Gawangan', () => api('POST', '/api/work-types', { name: 'Semprot Gawangan', unit: 'ha', active: true }), 'Pekerjaan Semprot');
  const wtPupuk = await ensureMaster(boot.workTypes, w => w.name === 'Tabur Pupuk', () => api('POST', '/api/work-types', { name: 'Tabur Pupuk', unit: 'kg', active: true }), 'Pekerjaan Pupuk');
  const rateSpecs = [
    [wtNunas, kebunA, 2000], [wtNunas, kebunB, 2500],
    [wtSemprot, kebunA, 120000], [wtSemprot, kebunB, 125000],
    [wtPupuk, kebunA, 350], [wtPupuk, kebunB, 375],
  ];
  for (const [wt, kebun, rate] of rateSpecs) {
    await ensureMaster(boot.workRates, r => r.workTypeId === wt.id && r.kebunId === kebun.id, () => api('POST', '/api/work-rates', {
      workTypeId: wt.id, kebunId: kebun.id, effectiveDate: `${Y}-01-01`, rate,
    }), `Tarif ${wt.name} @ ${kebun.code}`);
  }

  // ---------------- Pekerjaan kebun (work entries) ----------------
  boot = await api('GET', '/api/bootstrap');
  if ((boot.workEntries || []).length === 0) {
    const entries = [
      [d(2), kebunA, pekerjaA, wtNunas, 120, 'Blok A1-A3'],
      [d(3), kebunB, pekerjaA, wtNunas, 90, 'Blok B2'],
      [d(4), kebunA, pekerjaB, wtSemprot, 3.5, 'Gawangan blok A4'],
      [d(5), kebunA, pekerjaC, wtPupuk, 400, 'NPK 400 kg'],
      [d(8), kebunB, pekerjaD, wtPupuk, 350, 'NPK 350 kg'],
      [d(9), kebunB, pekerjaB, wtNunas, 60, 'Blok B5'],
    ];
    for (const [date, kebun, worker, wt, quantity, note] of entries) {
      await api('POST', '/api/work-entries', { date, kebunId: kebun.id, workerId: worker.id, workTypeId: wt.id, quantity, note });
    }
    log(`Pekerjaan kebun: ${entries.length} entri dibuat`);
  } else log('Pekerjaan kebun: sudah ada, dilewati');

  // ---------------- Panen & TBS ----------------
  boot = await api('GET', '/api/bootstrap');
  const rateFor = (kebun) => boot.tbsRates.find(r => r.kebunId === kebun.id);
  if ((boot.tbs || []).length === 0) {
    const tbsSpecs = [
      // [tanggal, DO, kebun, pemanen, armada, kg lapangan, timbang pabrik?]
      [d(3), 'DO-0001', kebunA, pekerjaA, truckOwn, 4850, { factoryDate: d(3), bruto: 12650, tara: 7900, deductionKg: 120, price: 2350 }],
      [d(6), 'DO-0002', kebunB, pekerjaB, truckVendor, 5200, { factoryDate: d(6), bruto: 13200, tara: 8100, deductionKg: 150, price: 2380 }],
      [d(10), 'DO-0003', kebunA, pekerjaC, truckOwn, 4600, { factoryDate: d(10), bruto: 12300, tara: 7800, deductionKg: 90, price: 2400 }],
      [d(14), 'DO-0004', kebunB, pekerjaD, truckVendor, 5050, { factoryDate: d(14), bruto: 13000, tara: 8050, deductionKg: 0, price: 2410 }],
      [d(18), 'DO-0005', kebunA, pekerjaA, truckOwn, 4700, null], // masih di lapangan
      [d(20), 'DO-0006', kebunB, pekerjaB, truckVendor, 4950, null],
    ];
    for (const [date, doNumber, kebun, harvester, vehicle, fieldKg, factory] of tbsSpecs) {
      const rate = rateFor(kebun) || {};
      const created = await api('POST', '/api/tbs', {
        date, doNumber, kebunId: kebun.id, millId: mill.id, harvesterId: harvester.id, vehicleId: vehicle.id,
        fieldWeightKg: fieldKg,
        harvestRatePerKg: rate.harvestRatePerKg, harvestWeightBasis: rate.harvestWeightBasis,
        weighingRatePerKg: rate.weighingRatePerKg, weighingWeightBasis: rate.weighingWeightBasis,
        langsirRatePerKg: rate.langsirRatePerKg, langsirWeightBasis: rate.langsirWeightBasis,
        transportMode: vehicle.rentMode, transportRate: vehicle.defaultRate,
        note: `Panen ${kebun.name}`,
      });
      if (factory) {
        await api('PUT', `/api/tbs/${created.id}/factory`, {
          factoryDate: factory.factoryDate,
          factoryBrutoWeightKg: factory.bruto,
          factoryTareWeightKg: factory.tara,
          factoryDeductionKg: factory.deductionKg,
          pricePerKg: factory.price,
          factoryTicketNumber: `TKT-${doNumber.slice(-4)}`,
        });
      }
      log(`TBS ${doNumber}: ${factory ? 'SELESAI (timbang pabrik)' : 'LAPANGAN'}`);
    }
  } else log('TBS: sudah ada, dilewati');

  // ---------------- Pembayaran TBS dari PKS (piutang -> bank) ----------------
  boot = await api('GET', '/api/bootstrap');
  if ((boot.tbsPayments || []).length === 0) {
    const paidRows = boot.tbs.filter(t => t.status === 'SELESAI' && t.netRevenue > 0).slice(0, 2);
    if (paidRows.length) {
      await api('POST', '/api/tbs-payments', {
        date: d(12), millId: mill.id, accountId: bank.id,
        amount: paidRows.reduce((s, t) => s + t.netRevenue, 0),
        reference: 'TRF PKS Sinar Rokan',
        note: 'Pembayaran TBS DO-0001 & DO-0002',
        allocations: paidRows.map(t => ({ tbsId: t.id, amount: t.netRevenue })),
      });
      log(`Pembayaran TBS: ${paidRows.length} DO dibayar PKS`);
    }
  } else log('Pembayaran TBS: sudah ada, dilewati');

  // ---------------- Transaksi Kas & Bank umum ----------------
  const coa = await api('GET', '/api/accounting/accounts');
  const posting = coa.accounts.filter(a => a.posting !== false && (a.level === 4 || a.level === undefined));
  const findAcc = (needle, group) => posting.find(a => a.name.toLowerCase().includes(needle) && (!group || a.group === group))
    || posting.find(a => !group || a.group === group);
  const bebanBBM = findAcc('bbm', 'EXPENSE') || findAcc('transport', 'EXPENSE') || findAcc('beban', 'EXPENSE');
  const bebanUmum = findAcc('umum', 'EXPENSE') || findAcc('administrasi', 'EXPENSE') || findAcc('beban', 'EXPENSE');
  const bebanPerawatan = findAcc('perawatan', 'EXPENSE') || findAcc('pemeliharaan', 'EXPENSE') || findAcc('beban', 'EXPENSE');
  const pendapatanLain = findAcc('lain', 'REVENUE') || findAcc('pendapatan', 'REVENUE');

  const page = await api('GET', '/api/transactions-page?limit=200');
  const normalTx = (page.items || page.transactions || []).filter(t => t.kind === 'NORMAL' && !t.sourceType);
  if (normalTx.length === 0 && bebanUmum) {
    const txs = [
      { date: d(2), accountId: kas.id, direction: 'OUT', description: 'Pembelian BBM truk BM 8123 TR', reference: 'NOTA-0102', allocations: [{ accountId: bebanBBM.id, kebunId: kebunA.id, amount: 750000, memo: 'Solar 60 liter' }] },
      { date: d(5), accountId: kas.id, direction: 'OUT', description: 'Perbaikan jalan produksi Blok A2', reference: 'NOTA-0105', allocations: [{ accountId: bebanPerawatan.id, kebunId: kebunA.id, amount: 1250000, memo: 'Material & upah harian' }] },
      { date: d(7), accountId: bank.id, direction: 'OUT', description: 'Biaya administrasi bank & ATK kantor', reference: 'BRI-0107', allocations: [{ accountId: bebanUmum.id, amount: 325000, memo: 'Admin bank & ATK' }] },
      { date: d(11), accountId: kas.id, direction: 'OUT', description: 'Servis rutin truk & ganti oli', reference: 'NOTA-0111', allocations: [{ accountId: bebanPerawatan.id, kebunId: kebunB.id, amount: 850000 }] },
    ];
    if (pendapatanLain) txs.push({ date: d(15), accountId: kas.id, direction: 'IN', description: 'Penjualan brondolan sisa panen', reference: 'KWT-0115', allocations: [{ accountId: pendapatanLain.id, kebunId: kebunB.id, amount: 600000 }] });
    for (const tx of txs) await api('POST', '/api/transactions', tx);
    log(`Transaksi Kas & Bank: ${txs.length} transaksi dibuat`);
  } else log('Transaksi Kas & Bank: sudah ada, dilewati');

  // ---------------- Persediaan: satuan, kelompok, barang, gudang, faktur pembelian ----------------
  try {
    let inv = await api('GET', '/api/inventory/master');
    const unitKg = await ensureMaster(inv.units || [], u => u.name === 'Kilogram', () => api('POST', '/api/inventory/units', { code: 'KG', name: 'Kilogram', active: true }), 'Satuan KG');
    const unitLtr = await ensureMaster(inv.units || [], u => u.name === 'Liter', () => api('POST', '/api/inventory/units', { code: 'LTR', name: 'Liter', active: true }), 'Satuan Liter');
    inv = await api('GET', '/api/inventory/master');
    const coaNow = (await api('GET', '/api/accounting/accounts')).accounts.filter(a => a.posting !== false && a.active !== false);
    const persediaanAcc = coaNow.find(a => a.group === 'ASSET' && /persediaan/i.test(a.name) && !String(a.systemKey || '').startsWith('CASH:'));
    const pembelianAcc = coaNow.find(a => a.group === 'EXPENSE' && /pupuk|pemupukan/i.test(a.name)) || coaNow.find(a => a.group === 'EXPENSE' && /perawatan|pemeliharaan/i.test(a.name)) || coaNow.find(a => a.group === 'EXPENSE');
    const grpPupuk = (inv.groups || []).find(g => g.name === 'Pupuk & Pestisida') || await api('POST', '/api/inventory/groups', {
      code: 'PPK', name: 'Pupuk & Pestisida', canPurchase: true, canStore: true, canSell: false, active: true,
      purchaseAccountId: pembelianAcc?.id, inventoryAccountId: persediaanAcc?.id,
    }).then(g => { log('Kelompok barang: dibuat'); return g; });
    inv = await api('GET', '/api/inventory/master');
    const gudang = (inv.warehouses || []).find(w => w.isDefault) || (inv.warehouses || [])[0] || await api('POST', '/api/inventory/warehouses', {
      code: 'GDG-A', name: 'Gudang Sei Rokan', kebunId: kebunA.id, manager: 'Pak Slamet', active: true, isDefault: true,
    });
    const itemNPK = await ensureMaster(inv.items || [], i => i.name === 'Pupuk NPK 13-6-27', () => api('POST', '/api/inventory/items', {
      code: 'BRG-NPK', name: 'Pupuk NPK 13-6-27', groupId: grpPupuk.id, unitId: unitKg.id, openingQuantity: 0, openingAverageCost: 0, active: true,
    }), 'Barang NPK');
    const itemHerb = await ensureMaster(inv.items || [], i => i.name === 'Herbisida Glifosat', () => api('POST', '/api/inventory/items', {
      code: 'BRG-HRB', name: 'Herbisida Glifosat', groupId: grpPupuk.id, unitId: unitLtr.id, openingQuantity: 0, openingAverageCost: 0, active: true,
    }), 'Barang Herbisida');

    const invoices = await api('GET', '/api/purchase-invoices');
    const invoiceRows = invoices.items || invoices.invoices || invoices || [];
    if (!Array.isArray(invoiceRows) || invoiceRows.length === 0) {
      await api('POST', '/api/purchase-invoices', {
        date: d(4), dueDate: d(28), supplierId: supplierPupuk.id, kebunId: kebunA.id, warehouseId: gudang?.id,
        invoiceNumber: 'INV-TTS-0904', paymentType: 'CREDIT', description: 'Pembelian pupuk & herbisida bulan ini',
        debitAccountId: grpPupuk.inventoryAccountId || grpPupuk.purchaseAccountId,
        lines: [
          { kind: 'INVENTORY', itemId: itemNPK.id, quantity: 1000, unitPrice: 9500, memo: 'NPK 20 sak @50kg' },
          { kind: 'INVENTORY', itemId: itemHerb.id, quantity: 40, unitPrice: 85000, memo: 'Glifosat 40 liter' },
        ],
      });
      log('Faktur pembelian kredit: dibuat');
    } else log('Faktur pembelian: sudah ada, dilewati');
  } catch (err) {
    log('Persediaan/pembelian dilewati:', err.message);
  }

  // ---------------- Piutang karyawan ----------------
  boot = await api('GET', '/api/bootstrap');
  if ((boot.employeeReceivables || []).length === 0) {
    await api('POST', '/api/employee-receivables', {
      date: d(1), workerId: pekerjaB.id, accountId: kas.id, description: 'Pinjaman biaya sekolah anak', totalAmount: 1500000, installmentCount: 3, note: 'Dipotong 3x dari payroll',
    });
    log('Piutang karyawan: dibuat');
  } else log('Piutang karyawan: sudah ada, dilewati');

  // ---------------- Payroll: proses 2 pekerja, bayar 1 ----------------
  boot = await api('GET', '/api/bootstrap');
  if ((boot.payrollRuns || []).length === 0) {
    const preview = await api('POST', '/api/payroll-preview', { periodStart: firstOfMonth, periodEnd: d(20) });
    const candidates = preview.workers || preview.candidates || preview.items || [];
    const pick = candidates.filter(c => [pekerjaA.id, pekerjaC.id].includes(c.workerId || c.id)).map(c => c.workerId || c.id);
    if (pick.length) {
      const runs = await api('POST', '/api/payroll-runs', { periodStart: firstOfMonth, periodEnd: d(20), workerIds: pick });
      const runList = Array.isArray(runs) ? runs : (runs.created || runs.runs || runs.items || []);
      log(`Payroll: ${runList.length || pick.length} pekerja diproses`);
      const first = runList[0];
      if (first?.id) {
        await api('POST', `/api/payroll-runs/${first.id}/pay`, { date: d(21), accountId: bank.id, reference: 'TRF GAJI', note: 'Pembayaran gaji periode 1-20' });
        log('Payroll: 1 pekerja dibayar via Bank BRI');
      }
    } else log('Payroll: kandidat tidak ditemukan, dilewati');
  } else log('Payroll: sudah ada, dilewati');

  boot = await api('GET', '/api/bootstrap');
  log('Ringkasan:', {
    kebun: boot.kebun.length, kasBank: boot.accounts.length, pks: boot.mills.length, pekerja: boot.harvesters.length,
    armada: boot.vehicles.length, tbs: boot.tbs.length, pekerjaanKebun: boot.workEntries.length,
    pembayaranTbs: boot.tbsPayments.length, payroll: boot.payrollRuns.length, piutangKaryawan: boot.employeeReceivables.length,
  });
  log('Selesai.');
}

main().catch(err => { console.error('[seed] GAGAL:', err.message); process.exit(1); });
