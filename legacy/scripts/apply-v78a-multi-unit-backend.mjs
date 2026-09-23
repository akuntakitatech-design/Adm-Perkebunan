import fs from 'node:fs';

const path = 'backend/index.ts';
let source = fs.readFileSync(path, 'utf8');
if (source.includes('/* v4.13 multi-unit backend */')) process.exit(0);

function mustReplace(from, to, label) {
  if (!source.includes(from)) throw new Error(`Anchor not found: ${label}`);
  source = source.replace(from, to);
}
function patchSection(startMarker, endMarker, transform, label) {
  const start = source.indexOf(startMarker);
  const end = source.indexOf(endMarker, start + startMarker.length);
  if (start < 0 || end < 0) throw new Error(`Section not found: ${label}`);
  const before = source.slice(0, start);
  const section = source.slice(start, end);
  const after = source.slice(end);
  const next = transform(section);
  if (next === section) throw new Error(`Section unchanged: ${label}`);
  source = before + next + after;
}

mustReplace(
`type PurchaseInvoiceLineRecord = {
  kind: PurchaseItemKind;
  itemId?: string;
  tracksStock?: boolean;
  kebunId?: string;
  warehouseId?: string;
  description: string;
  quantity: number;
  unit: string;
  unitPrice: number;`,
`type PurchaseInvoiceLineRecord = {
  kind: PurchaseItemKind;
  itemId?: string;
  tracksStock?: boolean;
  kebunId?: string;
  warehouseId?: string;
  description: string;
  quantity: number;
  unit: string;
  unitId?: string;
  conversionFactor?: number;
  baseQuantity?: number;
  baseUnit?: string;
  unitPrice: number;`,
'purchase line type',
);

mustReplace(
`type InventoryUnitRecord = {
  code: string;
  name: string;
  active: boolean;
  createdBy: string;
  updatedBy: string;
  createdAt: string;
  updatedAt: string;
};
type InventoryItemRecord = {`,
`type InventoryUnitRecord = {
  code: string;
  name: string;
  active: boolean;
  createdBy: string;
  updatedBy: string;
  createdAt: string;
  updatedAt: string;
};
type InventoryItemUnitConversionRecord = {
  unitId: string;
  factor: number;
  defaultPurchase?: boolean;
  defaultUsage?: boolean;
};
type InventoryItemRecord = {`,
'inventory conversion type',
);

mustReplace(
`  groupId: string;
  unitId: string;
  openingQuantity: number;`,
`  groupId: string;
  unitId: string;
  unitConversions?: InventoryItemUnitConversionRecord[];
  openingQuantity: number;`,
'item conversions field',
);

mustReplace(
`type InventoryUsageLineRecord = { itemId: string; warehouseId?: string; kebunId: string; debitAccountId: string; inventoryAccountId: string; quantity: number; unit: string; unitCost: number; amount: number; memo: string };`,
`type InventoryUsageLineRecord = { itemId: string; warehouseId?: string; kebunId: string; debitAccountId: string; inventoryAccountId: string; quantity: number; unit: string; inputQuantity?: number; inputUnitId?: string; inputUnit?: string; conversionFactor?: number; unitCost: number; amount: number; memo: string };`,
'usage line type',
);

mustReplace(
`type InventoryTransferLineRecord = { itemId: string; quantity: number; unit: string; unitCost: number; amount: number };`,
`type InventoryTransferLineRecord = { itemId: string; quantity: number; unit: string; inputQuantity?: number; inputUnitId?: string; inputUnit?: string; conversionFactor?: number; unitCost: number; amount: number };`,
'transfer line type',
);

mustReplace(
`  amount: number;
  quantity: number;
  unitCost: number;
  debit: number;`,
`  amount: number;
  quantity: number;
  unitCost: number;
  inputQuantity?: number;
  inputUnitId?: string;
  inputUnit?: string;
  conversionFactor?: number;
  inputUnitCost?: number;
  debit: number;`,
'opening subledger unit fields',
);

mustReplace(
`async function inventoryWarehouseLocked(workspaceId: string, warehouseId: string, excludeStocktakeId = '') {`,
`function normalizeInventoryItemUnitConversions(baseUnitId: string, raw: unknown, units: Array<InventoryUnitRecord & { id: string }>) {
  const rows = Array.isArray(raw) ? raw.slice(0, 20) : [];
  const unitMap = new Map(units.map(item => [item.id, item]));
  const seen = new Set<string>();
  const result: InventoryItemUnitConversionRecord[] = [];
  let purchaseTaken = false;
  let usageTaken = false;
  for (const value of rows) {
    const row = objectBody(value);
    const unitId = text(row.unitId);
    if (!unitId || unitId === baseUnitId || seen.has(unitId)) continue;
    const unit = unitMap.get(unitId);
    const factor = Number(row.factor);
    if (!unit || unit.active === false) throw new Error('Satuan alternatif harus berasal dari Master Satuan yang aktif.');
    if (!Number.isFinite(factor) || factor <= 0) throw new Error('Faktor konversi satuan harus lebih dari nol.');
    const defaultPurchase = row.defaultPurchase === true && !purchaseTaken;
    const defaultUsage = row.defaultUsage === true && !usageTaken;
    if (defaultPurchase) purchaseTaken = true;
    if (defaultUsage) usageTaken = true;
    seen.add(unitId);
    result.push({ unitId, factor: Number(factor.toFixed(6)), defaultPurchase, defaultUsage });
  }
  return result;
}
function inventoryItemUnitChoice(item: InventoryItemRecord & { id?: string }, units: Array<InventoryUnitRecord & { id: string }>, requestedUnitId = '', preferred: 'PURCHASE' | 'USAGE' | 'NONE' = 'NONE') {
  const unitMap = new Map(units.map(unit => [unit.id, unit]));
  const baseUnit = unitMap.get(item.unitId);
  if (!baseUnit || baseUnit.active === false) throw new Error('Satuan dasar barang tidak ditemukan atau nonaktif.');
  const conversions = item.unitConversions || [];
  let unitId = requestedUnitId;
  if (!unitId && preferred === 'PURCHASE') unitId = conversions.find(row => row.defaultPurchase)?.unitId || item.unitId;
  if (!unitId && preferred === 'USAGE') unitId = conversions.find(row => row.defaultUsage)?.unitId || item.unitId;
  if (!unitId) unitId = item.unitId;
  if (unitId === item.unitId) return { unitId, factor: 1, label: baseUnit.code || baseUnit.name, baseLabel: baseUnit.code || baseUnit.name };
  const conversion = conversions.find(row => row.unitId === unitId);
  const unit = unitMap.get(unitId);
  if (!conversion || !unit || unit.active === false || !Number.isFinite(conversion.factor) || conversion.factor <= 0) throw new Error('Satuan transaksi tidak valid untuk barang yang dipilih.');
  return { unitId, factor: conversion.factor, label: unit.code || unit.name, baseLabel: baseUnit.code || baseUnit.name };
}

async function inventoryWarehouseLocked(workspaceId: string, warehouseId: string, excludeStocktakeId = '') {`,
'multi-unit helpers',
);

patchSection(
  `function parsePurchaseLines(`,
  `function purchaseNetLineAmounts(`,
  section => {
    let next = section;
    next = next.replace(
      `      const unit = item ? unitMap.get(item.unitId) : undefined;`,
      `      const unit = item ? unitMap.get(item.unitId) : undefined;`,
    );
    next = next.replace(
      `      return { kind, itemId, tracksStock: group.canStore, kebunId, warehouseId: group.canStore ? warehouseId : '', description: item.name.slice(0, 240), quantity, unit: (unit.code || unit.name).slice(0, 40), unitPrice, debitAccountId, discountType, discountValue, discountAmount, lineTotal, netTotal };`,
      `      const choice = inventoryItemUnitChoice(item, master.units, text(row.unitId), 'PURCHASE');
      const baseQuantity = Number((quantity * choice.factor).toFixed(6));
      return { kind, itemId, tracksStock: group.canStore, kebunId, warehouseId: group.canStore ? warehouseId : '', description: item.name.slice(0, 240), quantity, unit: choice.label.slice(0, 40), unitId: choice.unitId, conversionFactor: choice.factor, baseQuantity, baseUnit: choice.baseLabel.slice(0, 40), unitPrice, debitAccountId, discountType, discountValue, discountAmount, lineTotal, netTotal };`,
    );
    return next;
  },
  'purchase unit conversion',
);

source = source.replace(`current.quantity += line.quantity;`, `current.quantity += line.baseQuantity ?? line.quantity;`);
source = source.replace(`current.quantity += line.quantity;`, `current.quantity += line.baseQuantity ?? line.quantity;`);

patchSection(
  `async function prepareInventoryUsage(`,
  `function purchaseTotals(`,
  section => {
    let next = section;
    next = next.replace(`const quantity = Number(row.quantity);`, `const inputQuantity = Number(row.quantity);`);
    next = next.replace(`if (!Number.isFinite(quantity) || quantity <= 0) throw new Error(\`Jumlah pemakaian \${item.name} harus lebih dari nol.\`);`, `if (!Number.isFinite(inputQuantity) || inputQuantity <= 0) throw new Error(\`Jumlah pemakaian \${item.name} harus lebih dari nol.\`);`);
    next = next.replace(
      `return { itemId, warehouseId, kebunId, debitAccountId, inventoryAccountId: group.inventoryAccountId, quantity, unit: (unit.code || unit.name).slice(0, 40), memo: '' };`,
      `const choice = inventoryItemUnitChoice(item, master.units, text(row.unitId), 'USAGE'); const quantity = Number((inputQuantity * choice.factor).toFixed(6)); return { itemId, warehouseId, kebunId, debitAccountId, inventoryAccountId: group.inventoryAccountId, quantity, unit: (unit.code || unit.name).slice(0, 40), inputQuantity, inputUnitId: choice.unitId, inputUnit: choice.label.slice(0, 40), conversionFactor: choice.factor, memo: '' };`,
    );
    return next;
  },
  'usage unit conversion',
);

patchSection(
  `  'POST /api/inventory-transfers': [`,
  `  'POST /api/inventory-transfers/:id/reverse': [`,
  section => {
    let next = section;
    const oldRequested = `      const rawLines = Array.isArray(body.lines) ? body.lines.slice(0, 100) : []; if (!rawLines.length) return error('Minimal satu barang wajib dimutasi.', 400); const requested = new Map<string, number>(); for (const raw of rawLines) { const row = objectBody(raw); const itemId = text(row.itemId); const quantity = Number(row.quantity); if (!itemId || !Number.isFinite(quantity) || quantity <= 0) return error('Barang dan jumlah mutasi wajib valid.', 400); requested.set(itemId, (requested.get(itemId) || 0) + quantity); }`;
    const newRequested = `      const rawLines = Array.isArray(body.lines) ? body.lines.slice(0, 100) : []; if (!rawLines.length) return error('Minimal satu barang wajib dimutasi.', 400); const itemMap = new Map(master.items.map(item => [item.id, item])); const requested = new Map<string, { quantity: number; inputQuantity: number; inputUnitId: string; inputUnit: string; conversionFactor: number }>(); for (const raw of rawLines) { const row = objectBody(raw); const itemId = text(row.itemId); const inputQuantity = Number(row.quantity); const item = itemMap.get(itemId); if (!item || !Number.isFinite(inputQuantity) || inputQuantity <= 0) return error('Barang dan jumlah mutasi wajib valid.', 400); if (requested.has(itemId)) return error('Barang yang sama cukup satu baris pada Mutasi Gudang.', 400); const choice = inventoryItemUnitChoice(item, master.units, text(row.unitId), 'USAGE'); requested.set(itemId, { quantity: Number((inputQuantity * choice.factor).toFixed(6)), inputQuantity, inputUnitId: choice.unitId, inputUnit: choice.label.slice(0, 40), conversionFactor: choice.factor }); }`;
    if (!next.includes(oldRequested)) throw new Error('Transfer request anchor not found');
    next = next.replace(oldRequested, newRequested);
    next = next.replace(`const itemMap = new Map(master.items.map(item => [item.id, item])); const unitMap`, `const unitMap`);
    next = next.replace(`for (const [itemId, quantity] of requested) { const item = itemMap.get(itemId);`, `for (const [itemId, request] of requested) { const quantity = request.quantity; const item = itemMap.get(itemId);`);
    next = next.replace(`lines.push({ itemId, quantity, unit: unit?.code || unit?.name || '', unitCost: Number(unitCost.toFixed(6)), amount });`, `lines.push({ itemId, quantity, unit: unit?.code || unit?.name || '', inputQuantity: request.inputQuantity, inputUnitId: request.inputUnitId, inputUnit: request.inputUnit, conversionFactor: request.conversionFactor, unitCost: Number(unitCost.toFixed(6)), amount });`);
    return next;
  },
  'transfer unit conversion',
);

patchSection(
  `async function normalizeOpeningDraft(`,
  `async function postOpeningOperationalBalances(`,
  section => {
    const oldInventory = `else { const item = master.items.find(candidate => candidate.id === entityId); const group = item ? master.groups.find(candidate => candidate.id === item.groupId) : undefined; if (!item || !group || !group.canStore || !group.inventoryAccountId) throw new Error('Barang saldo awal harus berasal dari kelompok yang Disimpan.'); quantity = Math.max(0, Number(row.quantity) || 0); unitCost = money(row.unitCost); if (quantity <= 0) throw new Error(\`Qty saldo awal \${item.name} harus lebih dari nol.\`); amount = Math.round(quantity * unitCost); accountId = group.inventoryAccountId; debit = amount; }`;
    const newInventory = `else { const item = master.items.find(candidate => candidate.id === entityId); const group = item ? master.groups.find(candidate => candidate.id === item.groupId) : undefined; if (!item || !group || !group.canStore || !group.inventoryAccountId) throw new Error('Barang saldo awal harus berasal dari kelompok yang Disimpan.'); const inputQuantity = Math.max(0, Number(row.inputQuantity ?? row.quantity) || 0); const choice = inventoryItemUnitChoice(item, master.units, text(row.inputUnitId || row.unitId), 'NONE'); const inputUnitCost = money(row.inputUnitCost ?? row.unitCost); quantity = Number((inputQuantity * choice.factor).toFixed(6)); unitCost = choice.factor > 0 ? Number((inputUnitCost / choice.factor).toFixed(6)) : 0; if (quantity <= 0) throw new Error(\`Qty saldo awal \${item.name} harus lebih dari nol.\`); amount = Math.round(inputQuantity * inputUnitCost); accountId = group.inventoryAccountId; debit = amount; row.inputQuantity = inputQuantity; row.inputUnitId = choice.unitId; row.inputUnit = choice.label; row.conversionFactor = choice.factor; row.inputUnitCost = inputUnitCost; }`;
    if (!section.includes(oldInventory)) throw new Error('Opening inventory anchor not found');
    let next = section.replace(oldInventory, newInventory);
    next = next.replace(
      `return [{ kind, accountId, entityId, description: text(row.description).slice(0, 200), reference: text(row.reference).slice(0, 120), amount, quantity, unitCost, debit, credit }];`,
      `return [{ kind, accountId, entityId, description: text(row.description).slice(0, 200), reference: text(row.reference).slice(0, 120), amount, quantity, unitCost, inputQuantity: kind === 'INVENTORY' ? Number(row.inputQuantity || quantity) : undefined, inputUnitId: kind === 'INVENTORY' ? text(row.inputUnitId) : undefined, inputUnit: kind === 'INVENTORY' ? text(row.inputUnit) : undefined, conversionFactor: kind === 'INVENTORY' ? Number(row.conversionFactor || 1) : undefined, inputUnitCost: kind === 'INVENTORY' ? money(row.inputUnitCost ?? unitCost) : undefined, debit, credit }];`,
    );
    return next;
  },
  'opening inventory conversion',
);

patchSection(
  `  'POST /api/inventory/items': [`,
  `  'GET /api/purchase-invoices': [`,
  section => {
    let next = section;
    next = next.replace(
      `      const stockValue = Math.round(openingQuantity * openingAverageCost);\n      const record: InventoryItemRecord = { code, name, groupId, unitId, openingQuantity: 0, openingAverageCost: 0, currentQuantity: 0, averageCost: 0, stockValue: 0, active: body.active !== false, createdBy: actor, updatedBy: actor, createdAt: stamp, updatedAt: stamp };`,
      `      const stockValue = Math.round(openingQuantity * openingAverageCost);\n      let unitConversions: InventoryItemUnitConversionRecord[];\n      try { unitConversions = normalizeInventoryItemUnitConversions(unitId, body.unitConversions, master.units); } catch (err) { return error(err instanceof Error ? err.message : 'Konversi satuan barang tidak valid.', 400); }\n      const record: InventoryItemRecord = { code, name, groupId, unitId, unitConversions, openingQuantity: 0, openingAverageCost: 0, currentQuantity: 0, averageCost: 0, stockValue: 0, active: body.active !== false, createdBy: actor, updatedBy: actor, createdAt: stamp, updatedAt: stamp };`,
    );
    next = next.replace(
      `      const record: InventoryItemRecord = { ...existing, code, name, groupId, unitId, active: body.active !== false, updatedBy: ctx.user!.email || ctx.user!.userId, updatedAt: now() };`,
      `      if (existing.unitId !== unitId && (Math.abs(Number(existing.currentQuantity || 0)) > 0.000001 || Math.abs(Number(existing.stockValue || 0)) > 1)) return error('Satuan dasar tidak dapat diubah setelah barang memiliki stok. Kosongkan/koreksi stok terlebih dahulu.', 409);\n      let unitConversions: InventoryItemUnitConversionRecord[];\n      try { unitConversions = normalizeInventoryItemUnitConversions(unitId, body.unitConversions, master.units); } catch (err) { return error(err instanceof Error ? err.message : 'Konversi satuan barang tidak valid.', 400); }\n      const record: InventoryItemRecord = { ...existing, code, name, groupId, unitId, unitConversions, active: body.active !== false, updatedBy: ctx.user!.email || ctx.user!.userId, updatedAt: now() };`,
    );
    return next;
  },
  'item unit conversion CRUD',
);

source += `\n\n/* v4.13 multi-unit backend */\n`;
fs.writeFileSync(path, source);
