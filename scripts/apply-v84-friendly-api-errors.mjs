import fs from 'node:fs';

const file = 'src/lib/client.ts';
let source = fs.readFileSync(file, 'utf8');
const marker = '// v84-friendly-api-errors';

if (source.includes(marker)) {
  console.log('v84 friendly API errors already applied');
  process.exit(0);
}

const anchor = "type ApiError = Error & {\n  response?: { status: number; data: { error?: string; message?: string } };\n  code?: string;\n};";
if (!source.includes(anchor)) throw new Error('client.ts ApiError anchor not found');
source = source.replace(anchor, `${anchor}\n\n${marker}\nfunction friendlyHttpError(status: number, rawText = '') {\n  const text = rawText.trim();\n  const looksHtml = /<!doctype html|<html|<body|<pre/i.test(text);\n  if (!looksHtml && text && text.length <= 300) return text;\n  if (status === 401) return 'Sesi login Anda sudah berakhir. Silakan login kembali lalu ulangi proses.';\n  if (status === 403) return 'Anda tidak memiliki akses untuk melakukan proses ini.';\n  if (status === 404) return 'Layanan yang diminta belum tersedia. Silakan muat ulang halaman dan coba lagi.';\n  if (status === 409) return 'Data belum dapat diproses karena ada kondisi yang perlu diperiksa terlebih dahulu.';\n  if (status >= 500) return 'Server sedang mengalami gangguan. Perubahan terakhir mungkin belum tersimpan. Silakan coba lagi beberapa saat.';\n  return 'Permintaan belum berhasil diproses. Perubahan terakhir mungkin belum tersimpan. Silakan coba lagi.';\n}`);

const oldBlock = `  const contentType = response.headers.get('content-type') || '';\n  const data = contentType.includes('application/json') ? await response.json() : await response.text();\n  if (!response.ok) {\n    const err = new Error((data && typeof data === 'object' && ('error' in data || 'message' in data))\n      ? String((data as { error?: string; message?: string }).error || (data as { error?: string; message?: string }).message)\n      : \`HTTP \${response.status}\`) as ApiError;\n    err.response = { status: response.status, data: typeof data === 'object' && data ? data as { error?: string; message?: string } : { error: String(data) } };\n    throw err;\n  }\n  return { data: data as T, status: response.status };`;

const newBlock = `  const contentType = response.headers.get('content-type') || '';\n  const isJson = contentType.includes('application/json');\n  const data = isJson ? await response.json() : await response.text();\n  if (!response.ok) {\n    const serverMessage = data && typeof data === 'object' && ('error' in data || 'message' in data)\n      ? String((data as { error?: string; message?: string }).error || (data as { error?: string; message?: string }).message || '')\n      : '';\n    const message = serverMessage || friendlyHttpError(response.status, typeof data === 'string' ? data : '');\n    const err = new Error(message) as ApiError;\n    err.response = { status: response.status, data: { error: message } };\n    throw err;\n  }\n  return { data: data as T, status: response.status };`;

if (!source.includes(oldBlock)) throw new Error('client.ts request error block not found');
source = source.replace(oldBlock, newBlock);

fs.writeFileSync(file, source);
console.log('Applied v84 friendly API errors');
