import fs from 'node:fs';

const path = 'src/InventoryUsage.tsx';
const cssPath = 'src/farm.css';
let source = fs.readFileSync(path, 'utf8');
let css = fs.readFileSync(cssPath, 'utf8');
if (source.includes('/* v4.13 multi-unit usage-transfer */')) process.exit(0);

function replaceOnce(from, to, label) {
  if (!source.includes(from)) throw new Error(`Anchor not found: ${label}`);
  source = source.replace(from, to);
}

replaceOnce(
  `type InventoryUnit = { id: string; code: string; name: string; active: boolean };\ntype InventoryItem = { id: string; code: string; name: string; groupId: string; unitId: string; currentQuantity: number; averageCost: number; stockValue: number; active: boolean };`,
  `type InventoryUnit = { id: string; code: string; name: string; active: boolean };\ntype InventoryItemUnitConversion = { unitId: string; factor: number; defaultPurchase?: boolean; defaultUsage?: boolean };\ntype InventoryItem = { id: string; code: string; name: string; groupId: string; unitId: string; unitConversions?: InventoryItemUnitConversion[]; currentQuantity: number; averageCost: number; stockValue: number; active: boolean };`,
  'inventory item conversion type',
);

replaceOnce(
  `type UsageLine = { itemId: string; warehouseId?: string; kebunId: string; debitAccountId: string; inventoryAccountId: string; quantity: number; unit: string; unitCost: number; amount: number; memo: string };`,
  `type UsageLine = { itemId: string; warehouseId?: string; kebunId: string; debitAccountId: string; inventoryAccountId: string; quantity: number; unit: string; inputQuantity?: number; inputUnitId?: string; inputUnit?: string; conversionFactor?: number; unitCost: number; amount: number; memo: string };`,
  'usage line metadata',
);
replaceOnce(
  `type TransferLine = { itemId: string; quantity: number; unit: string; unitCost: number; amount: number };`,
  `type TransferLine = { itemId: string; quantity: number; unit: string; inputQuantity?: number; inputUnitId?: string; inputUnit?: string; conversionFactor?: number; unitCost: number; amount: number };`,
  'transfer line metadata',
);
replaceOnce(
  `type LineForm = { itemId: string; search: string; debitAccountId: string; kebunId: string; quantity: string };`,
  `type LineForm = { itemId: string; search: string; debitAccountId: string; kebunId: string; quantity: string; unitId: string };`,
  'usage form unitId',
);
replaceOnce(
  `function blankLine(defaultKebunId = ''): LineForm { return { itemId: '', search: '', debitAccountId: '', kebunId: defaultKebunId, quantity: '' }; }`,
  `function blankLine(defaultKebunId = ''): LineForm { return { itemId: '', search: '', debitAccountId: '', kebunId: defaultKebunId, quantity: '', unitId: '' }; }\nfunction itemUnitChoices(item: InventoryItem | undefined, units: InventoryUnit[]) {\n  if (!item) return [] as Array<{ unitId: string; label: string; factor: number; defaultUsage: boolean }>;\n  const unitMap = new Map(units.map(unit => [unit.id, unit]));\n  const base = unitMap.get(item.unitId);\n  const rows = [{ unitId: item.unitId, label: base?.code || base?.name || '-', factor: 1, defaultUsage: false }];\n  for (const conversion of item.unitConversions || []) {\n    const unit = unitMap.get(conversion.unitId);\n    if (!unit || unit.active === false || !(conversion.factor > 0)) continue;\n    rows.push({ unitId: conversion.unitId, label: unit.code || unit.name, factor: conversion.factor, defaultUsage: conversion.defaultUsage === true });\n  }\n  return rows;\n}\nfunction preferredUsageUnitId(item: InventoryItem | undefined, units: InventoryUnit[]) {\n  const rows = itemUnitChoices(item, units);\n  return rows.find(row => row.defaultUsage)?.unitId || item?.unitId || '';\n}\nfunction unitChoice(item: InventoryItem | undefined, units: InventoryUnit[], unitId: string) { return itemUnitChoices(item, units).find(row => row.unitId === unitId) || itemUnitChoices(item, units)[0]; }`,
  'usage unit helpers',
);

replaceOnce(
  `  const selectItem = (index: number, itemId: string) => {\n    const item = itemMap.get(itemId);\n    setLine(index, { itemId, search: item ? \`${'${item.code} · ${item.name}'}\` : '' });\n    setActivePicker(null);\n  };`,
  `  const selectItem = (index: number, itemId: string) => {\n    const item = itemMap.get(itemId);\n    setLine(index, { itemId, unitId: preferredUsageUnitId(item, units), search: item ? \`${'${item.code} · ${item.name}'}\` : '' });\n    setActivePicker(null);\n  };`,
  'usage select item',
);

replaceOnce(
  `    const quantity = Math.max(0, Number(line.quantity || 0));\n    if (!item || !balance || quantity <= 0) return 0;\n    if (Math.abs(quantity - Number(balance.quantity || 0)) <= 0.000001) return Math.max(0, Math.round(balance.stockValue || 0));\n    return Math.max(0, Math.round(quantity * Number(balance.averageCost || 0)));`,
  `    const inputQuantity = Math.max(0, Number(line.quantity || 0));\n    const choice = unitChoice(item, units, line.unitId || item?.unitId || '');\n    const quantity = inputQuantity * (choice?.factor || 1);\n    if (!item || !balance || quantity <= 0) return 0;\n    if (Math.abs(quantity - Number(balance.quantity || 0)) <= 0.000001) return Math.max(0, Math.round(balance.stockValue || 0));\n    return Math.max(0, Math.round(quantity * Number(balance.averageCost || 0)));`,
  'usage preview conversion',
);

replaceOnce(
  `lines: lines.map(line => ({ itemId: line.itemId, warehouseId, debitAccountId: line.debitAccountId, kebunId: line.kebunId, quantity: Number(line.quantity || 0) }))`,
  `lines: lines.map(line => ({ itemId: line.itemId, warehouseId, debitAccountId: line.debitAccountId, kebunId: line.kebunId, quantity: Number(line.quantity || 0), unitId: line.unitId }))`,
  'usage save unitId',
);

replaceOnce(
  `onChange={event => { setLine(index, { search: event.target.value, itemId: '' }); setActivePicker(index); }}`,
  `onChange={event => { setLine(index, { search: event.target.value, itemId: '', unitId: '' }); setActivePicker(index); }}`,
  'usage clear unit on search',
);

replaceOnce(
  `          const selectedUnit = selectedItem ? unitMap.get(selectedItem.unitId) : undefined;\n          const selectedLabel = selectedItem ? \`${'${selectedItem.code} · ${selectedItem.name}'}\` : '';`,
  `          const selectedUnit = selectedItem ? unitMap.get(selectedItem.unitId) : undefined;\n          const selectedUnitChoice = unitChoice(selectedItem, units, line.unitId || selectedItem?.unitId || '');\n          const selectedLabel = selectedItem ? \`${'${selectedItem.code} · ${selectedItem.name}'}\` : '';`,
  'usage selected unit choice',
);

replaceOnce(
  `<Field label="Satuan"><input value={selectedUnit?.code || selectedUnit?.name || ''} disabled placeholder="-" /></Field>`,
  `<Field label="Satuan">{selectedItem ? <select value={line.unitId || selectedItem.unitId} onChange={event => setLine(index, { unitId: event.target.value })}>{itemUnitChoices(selectedItem, units).map(choice => <option key={choice.unitId} value={choice.unitId}>{choice.label}{choice.factor !== 1 ? ' · 1 ' + choice.label + ' = ' + choice.factor + ' ' + (selectedUnit?.code || selectedUnit?.name || 'dasar') : ' · Satuan Dasar'}</option>)}</select> : <input disabled value="" placeholder="-" />}</Field>`,
  'usage unit selector',
);

replaceOnce(
  `<Field label="HPP Average"><input className="cash-entry-money" value={selectedItem ? idr.format(balanceFor(selectedItem.id)?.averageCost || 0) : ''} disabled placeholder="Rp 0" /></Field>`,
  `<Field label="HPP Average / Satuan"><input className="cash-entry-money" value={selectedItem ? idr.format((balanceFor(selectedItem.id)?.averageCost || 0) * (selectedUnitChoice?.factor || 1)) : ''} disabled placeholder="Rp 0" /></Field>`,
  'usage HPP selected unit',
);

replaceOnce(
  `<div className="purchase-line-total"><span>Total</span><strong>{idr.format(linePreview(line))}</strong><small>{selectedItem ? \`Stok ${'${selectedWarehouse?.name || \'gudang\'}'} ${'${qtyFormat.format(balanceFor(selectedItem.id)?.quantity || 0)}'}\` : ''}</small></div>`,
  `<div className="purchase-line-total"><span>Total</span><strong>{idr.format(linePreview(line))}</strong><small>{selectedItem ? 'Stok ' + (selectedWarehouse?.name || 'gudang') + ' ' + qtyFormat.format((balanceFor(selectedItem.id)?.quantity || 0) / (selectedUnitChoice?.factor || 1)) + ' ' + (selectedUnitChoice?.label || '') : ''}</small></div>`,
  'usage stock display selected unit',
);

replaceOnce(
  `<td className="right">{qtyFormat.format(line.quantity)}</td><td>{line.unit}</td><td className="right">{idr.format(line.unitCost)}</td>`,
  `<td className="right">{qtyFormat.format(line.inputQuantity ?? line.quantity)}</td><td>{line.inputUnit || line.unit}</td><td className="right">{idr.format(line.unitCost * (line.conversionFactor || 1))}</td>`,
  'usage history input unit',
);

// Transfer lines: selected unit per item, converted by backend.
replaceOnce(
  `const [lines, setLines] = useState<Array<{ itemId: string; quantity: string }>>([{ itemId: '', quantity: '' }]);`,
  `const [lines, setLines] = useState<Array<{ itemId: string; quantity: string; unitId: string }>>([{ itemId: '', quantity: '', unitId: '' }]);`,
  'transfer line state',
);
replaceOnce(
  `lines: lines.map(line => ({ itemId: line.itemId, quantity: Number(line.quantity) }))`,
  `lines: lines.map(line => ({ itemId: line.itemId, quantity: Number(line.quantity), unitId: line.unitId }))`,
  'transfer save unitId',
);
replaceOnce(
  `setLines([{ itemId: '', quantity: '' }]);`,
  `setLines([{ itemId: '', quantity: '', unitId: '' }]);`,
  'transfer reset line',
);
replaceOnce(
  `onClick={() => setLines(current => [...current, { itemId: '', quantity: '' }])}`,
  `onClick={() => setLines(current => [...current, { itemId: '', quantity: '', unitId: '' }])}`,
  'transfer add line',
);

const oldTransferRow = `<div className="row-2"><Field label="Barang"><select value={line.itemId} onChange={event => setLines(current => current.map((row, rowIndex) => rowIndex === index ? { ...row, itemId: event.target.value } : row))}><option value="">Pilih barang</option>{items.map(item => <option key={item.id} value={item.id}>{item.code} - {item.name}</option>)}</select></Field><Field label={\`Qty (${'${selected ? unitMap.get(selected.unitId)?.code || \'\' : \'\'}'}) · Tersedia ${'${qtyFormat.format(stock?.quantity || 0)}'}\`}><input inputMode="decimal" value={line.quantity} onChange={event => setLines(current => current.map((row, rowIndex) => rowIndex === index ? { ...row, quantity: event.target.value.replace(',', '.').replace(/[^0-9.]/g, '') } : row))} /></Field></div>`;
const newTransferRow = `<div className="inventory-transfer-line-grid"><Field label="Barang"><select value={line.itemId} onChange={event => { const itemId = event.target.value; const nextItem = items.find(item => item.id === itemId); setLines(current => current.map((row, rowIndex) => rowIndex === index ? { ...row, itemId, unitId: preferredUsageUnitId(nextItem, units) } : row)); }}><option value="">Pilih barang</option>{items.map(item => <option key={item.id} value={item.id}>{item.code} - {item.name}</option>)}</select></Field><Field label="Satuan">{selected ? <select value={line.unitId || selected.unitId} onChange={event => setLines(current => current.map((row, rowIndex) => rowIndex === index ? { ...row, unitId: event.target.value } : row))}>{itemUnitChoices(selected, units).map(choice => <option key={choice.unitId} value={choice.unitId}>{choice.label}{choice.factor !== 1 ? ' · x' + choice.factor + ' ' + (unitMap.get(selected.unitId)?.code || unitMap.get(selected.unitId)?.name || 'dasar') : ' · Dasar'}</option>)}</select> : <select disabled><option>-</option></select>}</Field><Field label={'Qty · Tersedia ' + qtyFormat.format((stock?.quantity || 0) / (unitChoice(selected, units, line.unitId || selected?.unitId || '')?.factor || 1)) + ' ' + (unitChoice(selected, units, line.unitId || selected?.unitId || '')?.label || '')}><input inputMode="decimal" value={line.quantity} onChange={event => setLines(current => current.map((row, rowIndex) => rowIndex === index ? { ...row, quantity: event.target.value.replace(',', '.').replace(/[^0-9.]/g, '') } : row))} /></Field></div>`;
replaceOnce(oldTransferRow, newTransferRow, 'transfer unit selector');

source += `\n\n/* v4.13 multi-unit usage-transfer */\n`;
if (!css.includes('.inventory-transfer-line-grid')) css += `\n.inventory-transfer-line-grid { display:grid; grid-template-columns: 1.35fr .8fr 1fr; gap:12px; align-items:end; }\n@media (max-width:760px){ .inventory-transfer-line-grid { grid-template-columns:1fr; } }\n`;
fs.writeFileSync(path, source);
fs.writeFileSync(cssPath, css);
