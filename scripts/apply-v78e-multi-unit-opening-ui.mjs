import fs from 'node:fs';

const path = 'src/AccountingFoundation.tsx';
let source = fs.readFileSync(path, 'utf8');
if (source.includes('/* v4.13 multi-unit opening */')) process.exit(0);

function replaceOnce(from, to, label) {
  if (!source.includes(from)) throw new Error(`Anchor not found: ${label}`);
  source = source.replace(from, to);
}

replaceOnce(
  `type Subledger = { kind: SubKind; accountId?: string; entityId: string; description: string; reference: string; amount: number | string; quantity: number | string; unitCost: number | string; debit?: number; credit?: number; search?: string }; // v73-opening-inventory`,
  `type Subledger = { kind: SubKind; accountId?: string; entityId: string; description: string; reference: string; amount: number | string; quantity: number | string; unitCost: number | string; inputQuantity?: number | string; inputUnitId?: string; inputUnit?: string; conversionFactor?: number; inputUnitCost?: number | string; debit?: number; credit?: number; search?: string }; // v73-opening-inventory`,
  'opening subledger input units',
);
replaceOnce(
  `type InventoryItem = { id: string; code: string; name: string; groupId: string; unitId: string; active: boolean };`,
  `type InventoryItemUnitConversion = { unitId: string; factor: number; defaultPurchase?: boolean; defaultUsage?: boolean };\ntype InventoryItem = { id: string; code: string; name: string; groupId: string; unitId: string; unitConversions?: InventoryItemUnitConversion[]; active: boolean };`,
  'opening inventory item conversion type',
);
replaceOnce(
  `function blankInventorySub(): Subledger { return { kind: 'INVENTORY', entityId: '', description: '', reference: '', amount: '', quantity: '', unitCost: '', search: '' }; }`,
  `function blankInventorySub(): Subledger { return { kind: 'INVENTORY', entityId: '', description: '', reference: '', amount: '', quantity: '', unitCost: '', inputQuantity: '', inputUnitId: '', inputUnitCost: '', search: '' }; }\nfunction openingItemUnitChoices(item: InventoryItem | undefined, units: InventoryUnit[]) {\n  if (!item) return [] as Array<{ unitId: string; label: string; factor: number }>;\n  const map = new Map(units.map(unit => [unit.id, unit]));\n  const base = map.get(item.unitId);\n  const rows = [{ unitId: item.unitId, label: base?.code || base?.name || '-', factor: 1 }];\n  for (const conversion of item.unitConversions || []) { const unit = map.get(conversion.unitId); if (unit && unit.active !== false && conversion.factor > 0) rows.push({ unitId: conversion.unitId, label: unit.code || unit.name, factor: conversion.factor }); }\n  return rows;\n}`, 
  'opening unit helper',
);

replaceOnce(
  `setSubledgers(payload.opening.subledgers?.length ? payload.opening.subledgers.map(line => ({ ...line, amount: line.amount || '', quantity: line.quantity || '', unitCost: line.unitCost || '' })) : [blankSub()]);`,
  `setSubledgers(payload.opening.subledgers?.length ? payload.opening.subledgers.map(line => ({ ...line, amount: line.amount || '', quantity: line.quantity || '', unitCost: line.unitCost || '', inputQuantity: (line.inputQuantity ?? line.quantity) || '', inputUnitId: line.inputUnitId || '', inputUnitCost: (line.inputUnitCost ?? line.unitCost) || '' })) : [blankSub()]);`,
  'load opening input unit metadata',
);

replaceOnce(
  `const subAmount = (row: Subledger) => row.kind === 'INVENTORY' ? Math.round(Number(row.quantity || 0) * Number(row.unitCost || 0)) : Number(row.amount || 0);`,
  `const subAmount = (row: Subledger) => row.kind === 'INVENTORY' ? Math.round(Number((row.inputQuantity ?? row.quantity) || 0) * Number((row.inputUnitCost ?? row.unitCost) || 0)) : Number(row.amount || 0);`,
  'opening inventory preview amount',
);
replaceOnce(
  `const selectOpeningInventoryItem = (index: number, itemId: string) => setSub(index, { entityId: itemId, search: '' });`,
  `const selectOpeningInventoryItem = (index: number, itemId: string) => { const item = inventoryItems.find(candidate => candidate.id === itemId); setSub(index, { entityId: itemId, inputUnitId: item?.unitId || '', inputQuantity: '', inputUnitCost: '', search: '' }); };`,
  'opening select item base unit',
);

replaceOnce(
  `const unit = unitMap.get(item?.unitId || ''); const selectedLabel = item ? \`${'${item.code} - ${item.name}'}\` : '';`,
  `const unit = unitMap.get(item?.unitId || ''); const unitChoices = openingItemUnitChoices(item, inventoryUnits); const inputUnitId = row.inputUnitId || item?.unitId || ''; const inputUnit = unitChoices.find(choice => choice.unitId === inputUnitId) || unitChoices[0]; const selectedLabel = item ? \`${'${item.code} - ${item.name}'}\` : '';`,
  'opening row unit choice',
);

replaceOnce(
  `<label><span>Qty</span><input disabled={opening?.status === 'POSTED'} inputMode="decimal" value={row.quantity} placeholder="0" onChange={e => setSub(index, { quantity: e.target.value.replace(',', '.').replace(/[^0-9.]/g, '') })} /></label><div className="opening-inventory-unit"><span>Satuan</span><strong>{unit?.code || unit?.name || '-'}</strong></div><label><span>Harga Rata-rata</span><input disabled={opening?.status === 'POSTED'} inputMode="numeric" value={formatMoneyInput(row.unitCost)} placeholder="0" onChange={e => setSub(index, { unitCost: e.target.value.replace(/[^0-9]/g, '') })} /></label>`,
  `<label><span>Qty</span><input disabled={opening?.status === 'POSTED'} inputMode="decimal" value={row.inputQuantity ?? row.quantity} placeholder="0" onChange={e => setSub(index, { inputQuantity: e.target.value.replace(',', '.').replace(/[^0-9.]/g, '') })} /></label><label className="opening-inventory-unit"><span>Satuan</span><select disabled={opening?.status === 'POSTED' || !item} value={inputUnitId} onChange={e => setSub(index, { inputUnitId: e.target.value })}>{unitChoices.map(choice => <option key={choice.unitId} value={choice.unitId}>{choice.label}{choice.factor !== 1 ? ' · 1 ' + choice.label + ' = ' + choice.factor + ' ' + (unit?.code || unit?.name || 'dasar') : ' · Dasar'}</option>)}</select></label><label><span>Harga / Satuan</span><input disabled={opening?.status === 'POSTED'} inputMode="numeric" value={formatMoneyInput(row.inputUnitCost ?? row.unitCost)} placeholder="0" onChange={e => setSub(index, { inputUnitCost: e.target.value.replace(/[^0-9]/g, '') })} /><small>{inputUnit && inputUnit.factor !== 1 ? 'Setara ' + idr.format(Number((row.inputUnitCost ?? row.unitCost) || 0) / inputUnit.factor) + ' / ' + (unit?.code || unit?.name || 'dasar') : ''}</small></label>`,
  'opening inventory qty unit price fields',
);

source += `\n\n/* v4.13 multi-unit opening */\n`;
fs.writeFileSync(path, source);
