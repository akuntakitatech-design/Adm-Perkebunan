import fs from 'node:fs';

const path = 'src/InventoryUsage.tsx';
let source = fs.readFileSync(path, 'utf8');
if (source.includes('/* v4.13 multi-unit stocktake */')) process.exit(0);

function replaceOnce(from, to, label) {
  if (!source.includes(from)) throw new Error(`Anchor not found: ${label}`);
  source = source.replace(from, to);
}

replaceOnce(
  `<StocktakePanel role={role} canEdit={canEdit} warehouses={warehouses} items={items} flash={flash} showError={showError} reload={load} />`,
  `<StocktakePanel role={role} canEdit={canEdit} warehouses={warehouses} items={items} units={units} flash={flash} showError={showError} reload={load} />`,
  'stocktake caller units',
);

replaceOnce(
  `function StocktakePanel({ role, canEdit, warehouses, items, flash, showError, reload }: { role: Role; canEdit: boolean; warehouses: Warehouse[]; items: InventoryItem[]; flash: (text: string) => void; showError: (text: string) => void; reload: () => Promise<void> }) {`,
  `function StocktakePanel({ role, canEdit, warehouses, items, units, flash, showError, reload }: { role: Role; canEdit: boolean; warehouses: Warehouse[]; items: InventoryItem[]; units: InventoryUnit[]; flash: (text: string) => void; showError: (text: string) => void; reload: () => Promise<void> }) {`,
  'stocktake signature units',
);

const draftType = `Record<string, { physicalQuantity: string; valuationCost: string; note: string }>`;
const nextDraftType = `Record<string, { physicalQuantity: string; physicalUnitId: string; valuationCost: string; note: string }>`;
if ((source.match(new RegExp(draftType.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g')) || []).length < 2) throw new Error('Stocktake draft type anchors not found');
source = source.split(draftType).join(nextDraftType);

replaceOnce(
  `item.lines.forEach(line => { next[line.itemId] = { physicalQuantity: line.physicalQuantity == null ? '' : String(line.physicalQuantity), valuationCost: line.unitCost > 0 ? String(line.unitCost) : '', note: line.note || '' }; });`,
  `item.lines.forEach(line => { const masterItem = itemMap.get(line.itemId); next[line.itemId] = { physicalQuantity: line.physicalQuantity == null ? '' : String(line.physicalQuantity), physicalUnitId: masterItem?.unitId || '', valuationCost: line.unitCost > 0 ? String(line.unitCost) : '', note: line.note || '' }; });`,
  'stocktake open base unit',
);

replaceOnce(
  `lines: selected.lines.map(line => ({ itemId: line.itemId, physicalQuantity: draft[line.itemId]?.physicalQuantity ?? '', valuationCost: Number(draft[line.itemId]?.valuationCost || 0), note: draft[line.itemId]?.note || '' }))`,
  `lines: selected.lines.map(line => { const masterItem = itemMap.get(line.itemId); const choice = unitChoice(masterItem, units, draft[line.itemId]?.physicalUnitId || masterItem?.unitId || ''); const factor = choice?.factor || 1; const inputQty = draft[line.itemId]?.physicalQuantity ?? ''; return { itemId: line.itemId, physicalQuantity: inputQty === '' ? '' : Number(inputQty) * factor, valuationCost: Number(draft[line.itemId]?.valuationCost || 0) / factor, note: draft[line.itemId]?.note || '' }; })`,
  'stocktake save converted base quantity',
);

replaceOnce(
  `<th>Barang</th><th className="right">Stok Sistem</th><th className="right">Qty Fisik</th><th className="right">Selisih</th><th className="right">HPP</th><th className="right">Nilai Selisih</th><th>Keterangan</th>`,
  `<th>Barang</th><th className="right">Stok Sistem</th><th className="right">Qty Fisik</th><th>Satuan Hitung</th><th className="right">Selisih Dasar</th><th className="right">HPP / Satuan</th><th className="right">Nilai Selisih</th><th>Keterangan</th>`,
  'stocktake table headers',
);

replaceOnce(
  `const physical = draft[line.itemId]?.physicalQuantity === '' || draft[line.itemId]?.physicalQuantity == null ? null : Number(draft[line.itemId]?.physicalQuantity); const variance = physical == null ? 0 : physical - line.systemQuantity; const cost = line.unitCost > 0 ? line.unitCost : Number(draft[line.itemId]?.valuationCost || 0);`,
  `const masterItem = itemMap.get(line.itemId); const choice = unitChoice(masterItem, units, draft[line.itemId]?.physicalUnitId || masterItem?.unitId || ''); const factor = choice?.factor || 1; const physicalInput = draft[line.itemId]?.physicalQuantity === '' || draft[line.itemId]?.physicalQuantity == null ? null : Number(draft[line.itemId]?.physicalQuantity); const physical = physicalInput == null ? null : physicalInput * factor; const variance = physical == null ? 0 : physical - line.systemQuantity; const cost = line.unitCost > 0 ? line.unitCost : Number(draft[line.itemId]?.valuationCost || 0) / factor;`,
  'stocktake conversion calculations',
);

replaceOnce(
  `<td className="right"><input inputMode="decimal" value={draft[line.itemId]?.physicalQuantity || ''} onChange={event => setDraft(current => ({ ...current, [line.itemId]: { ...(current[line.itemId] || { valuationCost: '', note: '' }), physicalQuantity: event.target.value.replace(',', '.').replace(/[^0-9.]/g, '') } }))} style={{maxWidth:100}} /></td><td className="right">{physical == null ? '-' : qtyFormat.format(variance)}</td>`,
  `<td className="right"><input inputMode="decimal" value={draft[line.itemId]?.physicalQuantity || ''} onChange={event => setDraft(current => ({ ...current, [line.itemId]: { ...(current[line.itemId] || { physicalUnitId: masterItem?.unitId || '', valuationCost: '', note: '' }), physicalQuantity: event.target.value.replace(',', '.').replace(/[^0-9.]/g, '') } }))} style={{maxWidth:100}} /></td><td><select value={draft[line.itemId]?.physicalUnitId || masterItem?.unitId || ''} onChange={event => setDraft(current => ({ ...current, [line.itemId]: { ...(current[line.itemId] || { physicalQuantity: '', valuationCost: '', note: '' }), physicalUnitId: event.target.value } }))}>{itemUnitChoices(masterItem, units).map(option => <option key={option.unitId} value={option.unitId}>{option.label}{option.factor !== 1 ? ' · x' + option.factor : ' · Dasar'}</option>)}</select></td><td className="right">{physical == null ? '-' : qtyFormat.format(variance)} {line.unit}</td>`,
  'stocktake physical qty and unit',
);

replaceOnce(
  `<td className="right">{line.unitCost > 0 ? idr.format(line.unitCost) : variance > 0 ? <input inputMode="numeric" value={draft[line.itemId]?.valuationCost || ''} onChange={event => setDraft(current => ({ ...current, [line.itemId]: { ...(current[line.itemId] || { physicalQuantity: '', note: '' }), valuationCost: event.target.value.replace(/[^0-9]/g, '') } }))} placeholder="Harga nilai" style={{maxWidth:120}} /> : idr.format(0)}</td>`,
  `<td className="right">{line.unitCost > 0 ? idr.format(line.unitCost * factor) : variance > 0 ? <input inputMode="numeric" value={draft[line.itemId]?.valuationCost || ''} onChange={event => setDraft(current => ({ ...current, [line.itemId]: { ...(current[line.itemId] || { physicalQuantity: '', physicalUnitId: masterItem?.unitId || '', note: '' }), valuationCost: event.target.value.replace(/[^0-9]/g, '') } }))} placeholder={'Harga / ' + (choice?.label || '')} style={{maxWidth:120}} /> : idr.format(0)}</td>`,
  'stocktake valuation selected unit',
);

replaceOnce(
  `{ ...(current[line.itemId] || { physicalQuantity: '', valuationCost: '' }), note: event.target.value }`,
  `{ ...(current[line.itemId] || { physicalQuantity: '', physicalUnitId: masterItem?.unitId || '', valuationCost: '' }), note: event.target.value }`,
  'stocktake note draft shape',
);

source += `\n\n/* v4.13 multi-unit stocktake */\n`;
fs.writeFileSync(path, source);
