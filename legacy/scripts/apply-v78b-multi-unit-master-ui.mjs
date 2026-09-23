import fs from 'node:fs';

const appPath = 'src/InventoryMasters.tsx';
const cssPath = 'src/farm.css';
let app = fs.readFileSync(appPath, 'utf8');
let css = fs.readFileSync(cssPath, 'utf8');
if (app.includes('/* v4.13 multi-unit master */')) process.exit(0);

function replaceOnce(source, from, to, label) {
  if (!source.includes(from)) throw new Error(`Anchor not found: ${label}`);
  return source.replace(from, to);
}

app = replaceOnce(
  app,
  `type InventoryUnit = { id: string; code: string; name: string; active: boolean };\ntype InventoryItem = { id: string; code: string; name: string; groupId: string; unitId: string; openingQuantity: number; openingAverageCost: number; currentQuantity: number; averageCost: number; stockValue: number; active: boolean };`,
  `type InventoryUnit = { id: string; code: string; name: string; active: boolean };\ntype InventoryItemUnitConversion = { unitId: string; factor: number; defaultPurchase?: boolean; defaultUsage?: boolean };\ntype InventoryItem = { id: string; code: string; name: string; groupId: string; unitId: string; unitConversions?: InventoryItemUnitConversion[]; openingQuantity: number; openingAverageCost: number; currentQuantity: number; averageCost: number; stockValue: number; active: boolean };\ntype InventoryItemForm = { id: string; code: string; name: string; groupId: string; unitId: string; unitConversions: Array<{ unitId: string; factor: string; defaultPurchase: boolean; defaultUsage: boolean }>; active: boolean };`,
  'inventory item types',
);

app = replaceOnce(
  app,
  `function blankItem() { return { id: '', code: '', name: '', groupId: '', unitId: '', active: true }; }`,
  `function blankItem(): InventoryItemForm { return { id: '', code: '', name: '', groupId: '', unitId: '', unitConversions: [], active: true }; }`,
  'blank item form',
);

const mapAnchor = `  const unitMap = useMemo(() => new Map(units.map(item => [item.id, item])), [units]);`;
const mapAddition = `${mapAnchor}\n  const unitLabel = (unitId: string) => { const unit = unitMap.get(unitId); return unit?.code || unit?.name || '-'; };\n  const addItemUnitConversion = () => setItemForm(current => ({ ...current, unitConversions: [...current.unitConversions, { unitId: '', factor: '', defaultPurchase: false, defaultUsage: false }] }));\n  const updateItemUnitConversion = (index: number, patch: Partial<InventoryItemForm['unitConversions'][number]>) => setItemForm(current => {\n    const next = current.unitConversions.map((row, rowIndex) => rowIndex === index ? { ...row, ...patch } : row);\n    if (patch.defaultPurchase === true) next.forEach((row, rowIndex) => { if (rowIndex !== index) row.defaultPurchase = false; });\n    if (patch.defaultUsage === true) next.forEach((row, rowIndex) => { if (rowIndex !== index) row.defaultUsage = false; });\n    return { ...current, unitConversions: next };\n  });\n  const removeItemUnitConversion = (index: number) => setItemForm(current => ({ ...current, unitConversions: current.unitConversions.filter((_, rowIndex) => rowIndex !== index) }));\n  const itemUnitsSummary = (item: InventoryItem) => {\n    const base = unitLabel(item.unitId);\n    const alternate = (item.unitConversions || []).map(row => unitLabel(row.unitId) + ' = ' + qtyFormat.format(row.factor) + ' ' + base);\n    return [base, ...alternate].join(' · ');\n  };`;
app = replaceOnce(app, mapAnchor, mapAddition, 'unit conversion helpers');

app = replaceOnce(
  app,
  `      const payload = { ...itemForm };`,
  `      const duplicateUnits = new Set(itemForm.unitConversions.filter(row => row.unitId).map(row => row.unitId));\n      if (duplicateUnits.size !== itemForm.unitConversions.filter(row => row.unitId).length) return showError('Satuan alternatif pada barang tidak boleh duplikat.');\n      if (itemForm.unitConversions.some(row => !row.unitId || row.unitId === itemForm.unitId || !(Number(row.factor) > 0))) return showError('Setiap satuan alternatif wajib dipilih dan faktor konversinya harus lebih dari nol.');\n      const payload = { ...itemForm, unitConversions: itemForm.unitConversions.map(row => ({ ...row, factor: Number(row.factor) })) };`,
  'save item payload',
);

const oldUnitRow = `<div className="row-2"><Field label="Kelompok Barang"><select value={itemForm.groupId} onChange={event => setItemForm(value => ({ ...value, groupId: event.target.value }))}><option value="">Pilih kelompok</option>{groups.filter(item => item.active || item.id === itemForm.groupId).map(item => <option key={item.id} value={item.id}>{item.code} - {item.name}</option>)}</select></Field><Field label="Satuan"><select value={itemForm.unitId} onChange={event => setItemForm(value => ({ ...value, unitId: event.target.value }))}><option value="">Pilih satuan</option>{units.filter(item => item.active || item.id === itemForm.unitId).map(item => <option key={item.id} value={item.id}>{item.code} - {item.name}</option>)}</select></Field></div>`;
const newUnitRow = `<div className="row-2"><Field label="Kelompok Barang"><select value={itemForm.groupId} onChange={event => setItemForm(value => ({ ...value, groupId: event.target.value }))}><option value="">Pilih kelompok</option>{groups.filter(item => item.active || item.id === itemForm.groupId).map(item => <option key={item.id} value={item.id}>{item.code} - {item.name}</option>)}</select></Field><Field label="Satuan Dasar / Stok"><select value={itemForm.unitId} onChange={event => { const unitId = event.target.value; setItemForm(value => ({ ...value, unitId, unitConversions: value.unitConversions.filter(row => row.unitId !== unitId) })); }}><option value="">Pilih satuan dasar</option>{units.filter(item => item.active || item.id === itemForm.unitId).map(item => <option key={item.id} value={item.id}>{item.code} - {item.name}</option>)}</select></Field></div>\n            <div className="item-unit-conversion-box">\n              <div className="item-unit-conversion-head"><div><strong>Satuan Alternatif & Konversi</strong><span>Stok dan HPP selalu disimpan dalam satuan dasar. Konversi hanya berlaku untuk barang ini.</span></div><button type="button" className="secondary small-btn" disabled={!itemForm.unitId} onClick={addItemUnitConversion}>+ Tambah Satuan</button></div>\n              {itemForm.unitConversions.length === 0 ? <div className="item-unit-empty">Belum ada satuan alternatif. Barang hanya menggunakan {itemForm.unitId ? unitLabel(itemForm.unitId) : 'satuan dasar'}.</div> : <div className="item-unit-conversion-list">{itemForm.unitConversions.map((row, index) => <div className="item-unit-conversion-row" key={index}>\n                <Field label="Satuan Alternatif"><select value={row.unitId} onChange={event => updateItemUnitConversion(index, { unitId: event.target.value })}><option value="">Pilih satuan</option>{units.filter(unit => unit.id !== itemForm.unitId && (unit.active || unit.id === row.unitId) && !itemForm.unitConversions.some((other, otherIndex) => otherIndex !== index && other.unitId === unit.id)).map(unit => <option key={unit.id} value={unit.id}>{unit.code} - {unit.name}</option>)}</select></Field>\n                <Field label={'1 ' + (row.unitId ? unitLabel(row.unitId) : 'Satuan') + ' = berapa ' + (itemForm.unitId ? unitLabel(itemForm.unitId) : 'Satuan Dasar')}><input inputMode="decimal" value={row.factor} onChange={event => updateItemUnitConversion(index, { factor: event.target.value.replace(',', '.').replace(/[^0-9.]/g, '') })} placeholder="Contoh: 12" /></Field>\n                <div className="item-unit-defaults"><label><input type="checkbox" checked={row.defaultPurchase} onChange={event => updateItemUnitConversion(index, { defaultPurchase: event.target.checked })} /> Default Pembelian</label><label><input type="checkbox" checked={row.defaultUsage} onChange={event => updateItemUnitConversion(index, { defaultUsage: event.target.checked })} /> Default Pemakaian</label></div>\n                <button type="button" className="icon-btn danger" title="Hapus satuan alternatif" onClick={() => removeItemUnitConversion(index)}><Trash2 size={15} /></button>\n              </div>)}</div>}\n            </div>`;
app = replaceOnce(app, oldUnitRow, newUnitRow, 'master item unit UI');

app = replaceOnce(
  app,
  `onClick={() => setItemForm({ id: item.id, code: item.code, name: item.name, groupId: item.groupId, unitId: item.unitId, active: item.active !== false })}`,
  `onClick={() => setItemForm({ id: item.id, code: item.code, name: item.name, groupId: item.groupId, unitId: item.unitId, unitConversions: (item.unitConversions || []).map(row => ({ unitId: row.unitId, factor: String(row.factor), defaultPurchase: row.defaultPurchase === true, defaultUsage: row.defaultUsage === true })), active: item.active !== false })}`,
  'edit item conversions',
);

app = replaceOnce(
  app,
  `<td>{unitMap.get(item.unitId)?.code || unitMap.get(item.unitId)?.name || '-'}</td>`,
  `<td><strong>{unitLabel(item.unitId)}</strong>{(item.unitConversions || []).length > 0 && <small className="table-note">{itemUnitsSummary(item)}</small>}</td>`,
  'item list unit summary',
);

app += `\n\n/* v4.13 multi-unit master */\n`;

if (!css.includes('/* v4.13 multi-unit inventory */')) {
  css += `\n\n/* v4.13 multi-unit inventory */\n.item-unit-conversion-box { border: 1px solid #dfe6dd; background: #fafcf9; border-radius: 13px; padding: 14px; display: grid; gap: 12px; }\n.item-unit-conversion-head { display: flex; align-items: center; justify-content: space-between; gap: 12px; }\n.item-unit-conversion-head strong, .item-unit-conversion-head span { display: block; }\n.item-unit-conversion-head strong { font-size: 12px; color: #33453a; }\n.item-unit-conversion-head span { margin-top: 3px; color: #7c8b81; font-size: 10px; line-height: 1.45; }\n.item-unit-empty { padding: 10px 12px; border-radius: 9px; background: #f2f5f0; color: #7b897f; font-size: 10px; }\n.item-unit-conversion-list { display: grid; gap: 9px; }\n.item-unit-conversion-row { display: grid; grid-template-columns: minmax(160px,.8fr) minmax(200px,1fr) minmax(190px,.8fr) auto; gap: 10px; align-items: end; padding: 11px; border: 1px solid #e5eae3; border-radius: 11px; background: #fff; }\n.item-unit-defaults { min-height: 40px; display: flex; flex-wrap: wrap; align-items: center; gap: 10px; }\n.item-unit-defaults label { display: inline-flex; align-items: center; gap: 6px; color: #536259; font-size: 10px; font-weight: 700; }\n.item-unit-defaults input { width: auto; }\n@media (max-width: 900px) { .item-unit-conversion-row { grid-template-columns: 1fr 1fr; } .item-unit-conversion-row > .icon-btn { justify-self: end; } }\n@media (max-width: 620px) { .item-unit-conversion-head { align-items: flex-start; flex-direction: column; } .item-unit-conversion-row { grid-template-columns: 1fr; } }\n`;
}

fs.writeFileSync(appPath, app);
fs.writeFileSync(cssPath, css);
