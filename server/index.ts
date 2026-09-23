import 'dotenv/config';
import express from 'express';
import cookieParser from 'cookie-parser';
import jwt from 'jsonwebtoken';
import crypto from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { handler } from '../backend/index';
import { initDb, type LocalUser } from '../backend/localSdk';

const app = express();
const port = Number(process.env.PORT || 3000);
const jwtSecret = process.env.JWT_SECRET || '';
const adminEmail = (process.env.ADMIN_EMAIL || '').trim().toLowerCase();
const adminPassword = process.env.ADMIN_PASSWORD || '';
const adminName = process.env.ADMIN_NAME || 'Owner';
const configuredUserId = (process.env.ADMIN_USER_ID || '').trim();
const cookieName = 'kebun_session';
const cookieSecure = String(process.env.COOKIE_SECURE || '').toLowerCase() === 'true';

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
  res.cookie(cookieName, issueToken(user), { httpOnly: true, sameSite: 'lax', secure: cookieSecure, maxAge: 12 * 60 * 60 * 1000 });
  res.json({ user });
});
app.get('/api/auth/me', (req, res) => {
  const user = (req as typeof req & { appUser?: LocalUser }).appUser;
  if (!user) { res.status(401).json({ error: 'Belum login.' }); return; }
  res.json({ user });
});
app.post('/api/auth/logout', (_req, res) => {
  res.clearCookie(cookieName, { httpOnly: true, sameSite: 'lax', secure: cookieSecure });
  res.json({ signedOut: true });
});

app.use(handler);

const storageDir = path.resolve(process.env.STORAGE_DIR || '/data/uploads');
app.use('/uploads', express.static(storageDir, { fallthrough: false, maxAge: '1h' }));

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const distDir = path.resolve(__dirname, '../dist');
app.use(express.static(distDir));
app.get('*', (_req, res) => res.sendFile(path.join(distDir, 'index.html')));

await initDb();
app.listen(port, '0.0.0.0', () => console.log(`Administrasi Perkebunan aktif di port ${port}`));
