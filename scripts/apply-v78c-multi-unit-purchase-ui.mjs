import fs from 'node:fs';

const path = 'src/PurchaseInvoices.tsx';
let source = fs.readFileSync(path, 'utf8');
if (source.includes('/* v4.13 multi-unit purchase */')) process.exit(0);

function replaceOnce(from, to, label) {
  if (!source.includes(from)) throw new Error(`Anchor not found: ${label}`);
  source = source.replace(from, to);
}

replaceOnce(
  `type InventoryUnit = { id: string; code: string; name: string; active: boolean };\ntype InventoryItem = { id: string; code: string; name: string; groupId: string; unitId: string; currentQuantity: number; averageCost: number; active: boolean };`,
  `type InventoryUnit = { id: string; code: string; name: string; active: boolean };\ntype InventoryItemUnitConversion = { unitId: string; factor: number; defaultPurchase?: boolean; defaultUsage?: boolean };\ntype InventoryItem = { id: string; code: string; name: string; groupId: string; unitId: string; unitConversions?: InventoryItemUnitConversion[]; currentQuantity: number; averageCost: number; active: boolean };`,
  'inventory item type',
);

replaceOnce(
  `  quantity: number;\n  unit: string;\n  unitPrice: number;`,
  `  quantity: number;\n  unit: string;\n  unitId?: string;\n  conversionFactor?: number;\n  baseQuantity?: number;\n  baseUnit?: string;\n  unitPrice: number;`,
  'purchase line unit metadata type',
);

replaceOnce(
  `    quantity: '1',\n    unit: 'jasa',\n    unitPrice: '',`,
  `    quantity: '1',\n    unit: 'jasa',\n    unitId: '',\n    unitPrice: '',`,
  'blank purchase line unitId',
);

const helperAnchor = `function lineDiscountAmount(quantity: string | number, unitPrice: string | number, discountType: 'AMOUNT' | 'PERCENT', discountValue: string | number) {\n  const gross = Math.round((Number(quantity) || 0) * (Number(unitPrice) || 0));\n  const value = Math.max(0, Number(discountValue) || 0);\n  return discountType === 'PERCENT' ? Math.min(gross, Math.round(gross * Math.min(100, value) / 100)) : Math.min(gross, value);\n}`;
const helperAddition = `${helperAnchor}\nfunction itemUnitChoices(item: InventoryItem | undefined, units: InventoryUnit[]) {\n  if (!item) return [] as Array<{ unitId: string; label: string; factor: number; defaultPurchase: boolean; defaultUsage: boolean }>;\n  const unitMap = new Map(units.map(unit => [unit.id, unit]));\n  const base = unitMap.get(item.unitId);\n  const rows = [{ unitId: item.unitId, label: base?.code || base?.name || '-', factor: 1, defaultPurchase: false, defaultUsage: false }];\n  for (const conversion of item.unitConversions || []) {\n    const unit = unitMap.get(conversion.unitId);\n    if (!unit || unit.active === false || !(conversion.factor > 0)) continue;\n    rows.push({ unitId: conversion.unitId, label: unit.code || unit.name, factor: conversion.factor, defaultPurchase: conversion.defaultPurchase === true, defaultUsage: conversion.defaultUsage === true });\n  }\n  return rows;\n}\nfunction preferredPurchaseUnitId(item: InventoryItem | undefined, units: InventoryUnit[]) {\n  const rows = itemUnitChoices(item, units);\n  return rows.find(row => row.defaultPurchase)?.unitId || item?.unitId || '';\n}`;
replaceOnce(helperAnchor, helperAddition, 'purchase unit helpers');

replaceOnce(
  `  const selectInventoryItem = (index: number, itemId: string) => {\n    const item = inventoryItems.find(row => row.id === itemId);\n    const group = item ? inventoryGroups.find(row => row.id === item.groupId) : undefined;\n    const unit = item ? inventoryUnits.find(row => row.id === item.unitId) : undefined;\n    const debitAccountId = group ? (group.canStore ? group.inventoryAccountId : group.purchaseAccountId) : '';\n    setInvoiceLine(index, { itemId, description: item?.name || '', unit: unit?.code || unit?.name || '', debitAccountId, search: item ? \`${'${item.code} · ${item.name}'}\` : '' });\n    setActivePurchasePicker(null);\n  };`,
  `  const selectInventoryItem = (index: number, itemId: string) => {\n    const item = inventoryItems.find(row => row.id === itemId);\n    const group = item ? inventoryGroups.find(row => row.id === item.groupId) : undefined;\n    const unitId = preferredPurchaseUnitId(item, inventoryUnits);\n    const choice = itemUnitChoices(item, inventoryUnits).find(row => row.unitId === unitId);\n    const debitAccountId = group ? (group.canStore ? group.inventoryAccountId : group.purchaseAccountId) : '';\n    setInvoiceLine(index, { itemId, description: item?.name || '', unitId, unit: choice?.label || '', debitAccountId, search: item ? \`${'${item.code} · ${item.name}'}\` : '' });\n    setActivePurchasePicker(null);\n  };\n  const selectInventoryUnit = (index: number, item: InventoryItem | undefined, unitId: string) => {\n    const choice = itemUnitChoices(item, inventoryUnits).find(row => row.unitId === unitId);\n    setInvoiceLine(index, { unitId, unit: choice?.label || '' });\n  };`,
  'select inventory item unit',
);

replaceOnce(
  `onChange={event => setInvoiceLine(index, { kind: event.target.value as 'SERVICE' | 'INVENTORY', itemId: '', description: '', unit: event.target.value === 'SERVICE' ? 'jasa' : '', debitAccountId: '', search: '' })}`,
  `onChange={event => setInvoiceLine(index, { kind: event.target.value as 'SERVICE' | 'INVENTORY', itemId: '', description: '', unit: event.target.value === 'SERVICE' ? 'jasa' : '', unitId: '', debitAccountId: '', search: '' })}`,
  'clear unitId on kind change',
);

replaceOnce(
  `      unit: line.unit.trim(),\n      unitPrice: Number(line.unitPrice || 0),`,
  `      unit: line.unit.trim(),\n      unitId: line.kind === 'INVENTORY' ? line.unitId || '' : '',\n      unitPrice: Number(line.unitPrice || 0),`,
  'save purchase unitId',
);

replaceOnce(
  `          unit: line.unit,\n          unitPrice: String(line.unitPrice),`,
  `          unit: line.unit,\n          unitId: line.kind === 'INVENTORY' ? (line.unitId || selectedItem?.unitId || '') : '',\n          unitPrice: String(line.unitPrice),`,
  'edit purchase unitId',
);

const oldUnitField = `<Field label="Satuan"><input value={line.unit} disabled={line.kind === 'INVENTORY'} onChange={event => setInvoiceLine(index, { unit: event.target.value })} placeholder="unit" /></Field>`;
const newUnitField = `<Field label="Satuan">{line.kind === 'INVENTORY' && selectedItem ? <select value={line.unitId || selectedItem.unitId} onChange={event => selectInventoryUnit(index, selectedItem, event.target.value)}>{itemUnitChoices(selectedItem, inventoryUnits).map(choice => <option key={choice.unitId} value={choice.unitId}>{choice.label}{choice.factor !== 1 ? ' · 1 ' + choice.label + ' = ' + choice.factor + ' ' + (inventoryUnits.find(unit => unit.id === selectedItem.unitId)?.code || inventoryUnits.find(unit => unit.id === selectedItem.unitId)?.name || 'dasar') : ' · Satuan Dasar'}</option>)}</select> : <input value={line.unit} onChange={event => setInvoiceLine(index, { unit: event.target.value })} placeholder="unit" />}</Field>`;
replaceOnce(oldUnitField, newUnitField, 'purchase unit selector');

source += `\n\n/* v4.13 multi-unit purchase */\n`;
fs.writeFileSync(path, source);
