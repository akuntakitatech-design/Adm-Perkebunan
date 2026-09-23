import 'dotenv/config';
import express from 'express';
import cookieParser from 'cookie-parser';
import jwt from 'jsonwebtoken';
import crypto from 'node:crypto';
import path from 'node:path';
import { handler } from '../backend/index';
import { initDb, storageMode, type LocalUser } from '../backend/localSdk';

/**
 * Entry Express — Administrasi Perkebunan API.
 *
 * Mode deploy:
 *  - Coolify (Docker)      : PORT=3000, Nginx frontend mem-proxy /api ke container ini,
 *                            atau domain terpisah dengan CORS_ORIGIN.
 *  - Live Preview Emergent : NODE_PORT=8002, diproksi oleh FastAPI gateway (server.py).
 */

const app = express();
const port = Number(process.env.NODE_PORT || process.env.PORT || 3000);
const host = process.env.HOST || '0.0.0.0';
const jwtSecret = process.env.JWT_SECRET || '';
const adminEmail = (process.env.ADMIN_EMAIL || '').trim().toLowerCase();
const adminPassword = process.env.ADMIN_PASSWORD || '';
const adminName = process.env.ADMIN_NAME || 'Owner';
const configuredUserId = (process.env.ADMIN_USER_ID || '').trim();
const cookieName = 'kebun_session';
const cookieSecure = String(process.env.COOKIE_SECURE || '').toLowerCase() === 'true';
const corsOrigins = (process.env.CORS_ORIGIN || '')
  .split(',')
  .map(item => item.trim().replace(/\/+$/, ''))
  .filter(Boolean);
// Jika frontend & backend berbeda domain (CORS aktif), cookie harus SameSite=None + Secure.
const cookieSameSite: 'lax' | 'none' = corsOrigins.length > 0 && cookieSecure ? 'none' : 'lax';

if (!jwtSecret || jwtSecret.length < 32) throw new Error('JWT_SECRET wajib diisi minimal 32 karakter.');
if (!adminEmail || !adminPassword) throw new Error('ADMIN_EMAIL dan ADMIN_PASSWORD wajib diisi.');

function userIdForEmail(email: string) {
  if (configuredUserId) return configuredUserId;
  return crypto.createHash('sha256').update(email).digest('hex').slice(0, 32);
}
function safeEqual(left: string, right: string) {
  const a = Buffer.from(left);
  const b = Buffer.from(right);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}
function issueToken(user: LocalUser) {
  return jwt.sign(user, jwtSecret, { expiresIn: '12h' });
}

app.disable('x-powered-by');
app.set('trust proxy', true);

// CORS (opsional) — hanya aktif jika CORS_ORIGIN diisi.
if (corsOrigins.length > 0) {
  app.use((req, res, next) => {
    const origin = String(req.headers.origin || '').replace(/\/+$/, '');
    if (origin && (corsOrigins.includes('*') || corsOrigins.includes(origin))) {
      res.setHeader('Access-Control-Allow-Origin', origin);
      res.setHeader('Access-Control-Allow-Credentials', 'true');
      res.setHeader('Vary', 'Origin');
      res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,PATCH,DELETE,OPTIONS');
      res.setHeader('Access-Control-Allow-Headers', req.headers['access-control-request-headers'] || 'Content-Type, Authorization');
      res.setHeader('Access-Control-Max-Age', '600');
    }
    if (req.method === 'OPTIONS') { res.status(204).end(); return; }
    next();
  });
}

app.use(express.json({ limit: '6mb' }));
app.use(cookieParser());
app.use((req, _res, next) => {
  const token = req.cookies?.[cookieName];
  if (token) {
    try { (req as typeof req & { appUser?: LocalUser }).appUser = jwt.verify(token, jwtSecret) as LocalUser; }
    catch { /* expired/invalid token -> anonymous */ }
  }
  next();
});

app.post('/api/auth/login', (req, res) => {
  const email = String(req.body?.email || '').trim().toLowerCase();
  const password = String(req.body?.password || '');
  if (!safeEqual(email, adminEmail) || !safeEqual(password, adminPassword)) {
    res.status(401).json({ error: 'Email atau password tidak sesuai.' });
    return;
  }
  const user: LocalUser = { userId: userIdForEmail(email), email, name: adminName };
  res.cookie(cookieName, issueToken(user), { httpOnly: true, sameSite: cookieSameSite, secure: cookieSecure, maxAge: 12 * 60 * 60 * 1000, path: '/' });
  res.json({ user });
});
app.get('/api/auth/me', (req, res) => {
  const user = (req as typeof req & { appUser?: LocalUser }).appUser;
  if (!user) { res.status(401).json({ error: 'Belum login.' }); return; }
  res.json({ user });
});
app.post('/api/auth/logout', (_req, res) => {
  res.clearCookie(cookieName, { httpOnly: true, sameSite: cookieSameSite, secure: cookieSecure, path: '/' });
  res.json({ signedOut: true });
});

app.get('/api/_system', (_req, res) => {
  res.json({ ok: true, storage: storageMode, version: process.env.APP_VERSION || '70.0.0', uptimeSec: Math.round(process.uptime()) });
});

app.use(handler);

// Static uploads hanya dipakai pada mode storage lokal (tanpa R2).
if (storageMode === 'local') {
  const storageDir = path.resolve(process.env.STORAGE_DIR || '/data/uploads');
  app.use('/uploads', express.static(storageDir, { fallthrough: false, maxAge: '1h' }));
}

app.use((req, res) => {
  res.status(404).json({ error: `Rute tidak ditemukan: ${req.method} ${req.path}` });
});

await initDb();
app.listen(port, host, () => console.log(`Administrasi Perkebunan API aktif di ${host}:${port} (storage: ${storageMode})`));
