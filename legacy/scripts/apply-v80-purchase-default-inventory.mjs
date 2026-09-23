import fs from 'node:fs';

const purchasePath = 'src/PurchaseInvoices.tsx';
const appPath = 'src/FarmApp.tsx';
let purchase = fs.readFileSync(purchasePath, 'utf8');
let app = fs.readFileSync(appPath, 'utf8');
const marker = '/* v4.13.2 default purchase inventory */';

if (!purchase.includes(marker)) {
  const oldBlank = `function blankPurchaseLine(kebunId = '') {\n  return {\n    kind: 'SERVICE' as 'SERVICE' | 'INVENTORY',\n    itemId: '',\n    kebunId,\n    description: '',\n    quantity: '1',\n    unit: 'jasa',\n    unitId: '',`;
  const newBlank = `function blankPurchaseLine(kebunId = '') {\n  return {\n    kind: 'INVENTORY' as 'SERVICE' | 'INVENTORY',\n    itemId: '',\n    kebunId,\n    description: '',\n    quantity: '1',\n    unit: '',\n    unitId: '',`;
  if (!purchase.includes(oldBlank)) throw new Error('blankPurchaseLine anchor not found');
  purchase = purchase.replace(oldBlank, newBlank);
  purchase += `\n\n${marker}\n`;
  fs.writeFileSync(purchasePath, purchase);
}

if (app.includes('Perkebunan · v4.13.1')) {
  app = app.replace('Perkebunan · v4.13.1', 'Perkebunan · v4.13.2');
  fs.writeFileSync(appPath, app);
}
