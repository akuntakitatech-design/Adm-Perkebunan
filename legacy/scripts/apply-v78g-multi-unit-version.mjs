import fs from 'node:fs';

const path = 'src/FarmApp.tsx';
let source = fs.readFileSync(path, 'utf8');

const versionMatch = source.match(/Perkebunan · v(\d+)\.(\d+)\.(\d+)/);
if (!versionMatch) throw new Error('Current app version not found');

const current = versionMatch.slice(1).map(Number);
const atLeast413 = current[0] > 4 ||
  (current[0] === 4 && current[1] > 13) ||
  (current[0] === 4 && current[1] === 13 && current[2] >= 0);

// Migration ini hanya menaikkan versi lama v4.12.2 ke v4.13.0.
// Jika source sudah v4.13.x / v4.14.x atau lebih baru, anggap sudah diterapkan.
if (atLeast413 || source.includes('/* v4.13 multi-unit inventory */')) process.exit(0);

if (!source.includes('Perkebunan · v4.12.2')) {
  throw new Error(`Unsupported version for v78g migration: v${current.join('.')}`);
}

source = source.replace('Perkebunan · v4.12.2', 'Perkebunan · v4.13.0');
source += '\n/* v4.13 multi-unit inventory */\n';
fs.writeFileSync(path, source);
