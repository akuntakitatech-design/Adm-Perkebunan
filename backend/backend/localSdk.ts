import express, { type RequestHandler, type Router as ExpressRouter } from 'express';
import mysql, { type Pool, type PoolConnection, type RowDataPacket } from 'mysql2/promise';
import { S3Client, PutObjectCommand, DeleteObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

/**
 * Compatibility layer (menggantikan @appdeploy/sdk).
 *
 * - Database : MariaDB / MySQL via mysql2. Semua entitas disimpan di tabel
 *              `app_records` (dokumen JSON). Skema + VIEW ada di database/schema.sql
 *              dan diterapkan otomatis saat startup (idempoten).
 * - Storage  : Cloudflare R2 (S3-compatible) jika env R2_* terisi; jika tidak,
 *              fallback ke disk lokal (STORAGE_DIR).
 */

// ---------------------------------------------------------------------------
// Database
// ---------------------------------------------------------------------------

const databaseUrl = process.env.DATABASE_URL || '';
if (!databaseUrl) throw new Error('DATABASE_URL wajib diisi (contoh: mysql://user:pass@host:3306/nama_db).');

function createPool(): Pool {
  const url = new URL(databaseUrl);
  const useSsl = ['1', 'true', 'require'].includes(String(process.env.DATABASE_SSL || url.searchParams.get('ssl') || '').toLowerCase());
  return mysql.createPool({
    host: url.hostname,
    port: Number(url.port || 3306),
    user: decodeURIComponent(url.username),
    password: decodeURIComponent(url.password),
    database: decodeURIComponent(url.pathname.replace(/^\//, '')),
    waitForConnections: true,
    connectionLimit: Number(process.env.DATABASE_POOL_SIZE || 10),
    charset: 'utf8mb4',
    timezone: 'Z',
    dateStrings: false,
    supportBigNumbers: true,
    ssl: useSsl ? { rejectUnauthorized: false } : undefined,
  });
}

const pool = createPool();

export type LocalUser = { userId: string; email?: string; name?: string; picture?: string };
export type LocalContext = {
  body: unknown;
  query: Record<string, unknown>;
  params: Record<string, string>;
  user?: LocalUser;
};

type LocalResult = { __localResponse: true; status: number; body: unknown };
type LocalHandler = (ctx: LocalContext) => Promise<LocalResult | void> | LocalResult | void;

type RecordRow = RowDataPacket & { id: string; record: string | Record<string, unknown> };

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/** Menjalankan database/schema.sql (CREATE TABLE IF NOT EXISTS + CREATE OR REPLACE VIEW). */
export async function applySchema() {
  const schemaPath = path.resolve(__dirname, '../database/schema.sql');
  const sql = await fs.readFile(schemaPath, 'utf8');
  const statements = sql
    .split(/;\s*(?:\r?\n|$)/)
    .map(part => part.split('\n').filter(line => !line.trim().startsWith('--')).join('\n').trim())
    .filter(Boolean);
  const conn = await pool.getConnection();
  try {
    for (const statement of statements) await conn.query(statement);
  } finally {
    conn.release();
  }
  return statements.length;
}

export async function initDb() {
  const conn = await pool.getConnection();
  try {
    await conn.ping();
  } finally {
    conn.release();
  }
  if (String(process.env.DB_AUTO_SCHEMA || 'true').toLowerCase() !== 'false') {
    const count = await applySchema();
    console.log(`Skema MariaDB diterapkan (${count} statement).`);
  }
}

export async function closeDb() {
  await pool.end();
}

function parseRecord<T>(value: string | Record<string, unknown>): T {
  if (typeof value === 'string') return JSON.parse(value) as T;
  return value as unknown as T;
}

function withId<T>(row: { id: string; record: string | Record<string, unknown> }) {
  return { id: row.id, ...(parseRecord<object>(row.record)) } as T & { id: string };
}

function serialize(record: unknown) {
  // Sama seperti JSONB: undefined dibuang, Date -> ISO string.
  return JSON.stringify(record ?? {});
}

function tokenToOffset(token?: string) {
  if (!token) return 0;
  try {
    const parsed = Number(Buffer.from(token, 'base64url').toString('utf8'));
    return Number.isFinite(parsed) && parsed >= 0 ? Math.floor(parsed) : 0;
  } catch { return 0; }
}
function offsetToToken(offset: number) { return Buffer.from(String(offset), 'utf8').toString('base64url'); }

async function withTransaction<T>(work: (conn: PoolConnection) => Promise<T>): Promise<T> {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const result = await work(conn);
    await conn.commit();
    return result;
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }
}

export const db = {
  async list<T>(table: string, options: { limit?: number; nextToken?: string } = {}) {
    const limit = Math.min(1000, Math.max(1, Number(options.limit) || 100));
    const offset = tokenToOffset(options.nextToken);
    const [rows] = await pool.query<RecordRow[]>(
      'SELECT id, record FROM app_records WHERE table_name = ? ORDER BY created_at ASC, id ASC LIMIT ? OFFSET ?',
      [table, limit + 1, offset]
    );
    const hasMore = rows.length > limit;
    const page = rows.slice(0, limit);
    return { items: page.map(row => withId<T>(row)), nextToken: hasMore ? offsetToToken(offset + limit) : undefined };
  },

  async get<T>(table: string, ids: string[]) {
    if (!ids.length) return [] as Array<(T & { id: string }) | undefined>;
    const [rows] = await pool.query<RecordRow[]>(
      'SELECT id, record FROM app_records WHERE table_name = ? AND id IN (?)',
      [table, ids]
    );
    const map = new Map(rows.map(row => [row.id, withId<T>(row)]));
    return ids.map(id => map.get(id));
  },

  async add<T>(table: string, records: T[]) {
    if (!records.length) return [] as string[];
    return withTransaction(async conn => {
      const ids: string[] = [];
      const base = Date.now();
      let index = 0;
      for (const record of records) {
        const id = crypto.randomUUID();
        // Offset mikro-detik agar urutan insert dalam satu batch tetap deterministik.
        const stamp = new Date(base + index);
        await conn.query(
          'INSERT INTO app_records (table_name, id, record, created_at, updated_at) VALUES (?, ?, ?, ?, ?)',
          [table, id, serialize(record), stamp, stamp]
        );
        ids.push(id);
        index += 1;
      }
      return ids;
    });
  },

  async update<T>(table: string, rows: Array<{ id: string; record: T }>) {
    if (!rows.length) return [] as boolean[];
    return withTransaction(async conn => {
      const results: boolean[] = [];
      for (const row of rows) {
        const [result] = await conn.query<mysql.ResultSetHeader>(
          'UPDATE app_records SET record = ?, updated_at = NOW(6) WHERE table_name = ? AND id = ?',
          [serialize(row.record), table, row.id]
        );
        results.push(result.affectedRows === 1);
      }
      return results;
    });
  },

  async delete(table: string, ids: string[]) {
    if (!ids.length) return [] as boolean[];
    return withTransaction(async conn => {
      const results: boolean[] = [];
      for (const id of ids) {
        const [result] = await conn.query<mysql.ResultSetHeader>(
          'DELETE FROM app_records WHERE table_name = ? AND id = ?',
          [table, id]
        );
        results.push(result.affectedRows === 1);
      }
      return results;
    });
  },
};

// ---------------------------------------------------------------------------
// Router helpers
// ---------------------------------------------------------------------------

export function json(body: unknown, status = 200): LocalResult { return { __localResponse: true, status, body }; }
export function error(message: string, status = 400): LocalResult { return json({ error: message }, status); }

export function requireAuth(): LocalHandler {
  return async ctx => ctx.user ? undefined : error('Sesi login tidak tersedia.', 401);
}

function isResult(value: unknown): value is LocalResult {
  return Boolean(value && typeof value === 'object' && (value as LocalResult).__localResponse === true);
}

export function router(routes: Record<string, LocalHandler[]>): ExpressRouter {
  const result = express.Router();
  for (const [signature, handlers] of Object.entries(routes)) {
    const space = signature.indexOf(' ');
    const method = signature.slice(0, space).toLowerCase();
    const routePath = signature.slice(space + 1);
    const register = (result as unknown as Record<string, (path: string, handler: RequestHandler) => void>)[method];
    if (!register) throw new Error(`HTTP method tidak didukung: ${signature}`);
    register.call(result, routePath, async (req, res) => {
      const ctx: LocalContext = {
        body: req.body,
        query: req.query as Record<string, unknown>,
        params: req.params as Record<string, string>,
        user: (req as typeof req & { appUser?: LocalUser }).appUser,
      };
      try {
        for (const handler of handlers) {
          const output = await handler(ctx);
          if (isResult(output)) {
            res.status(output.status).json(output.body);
            return;
          }
        }
        if (!res.headersSent) res.status(204).end();
      } catch (err) {
        console.error(err);
        if (!res.headersSent) res.status(500).json({ error: err instanceof Error ? err.message : 'Internal server error.' });
      }
    });
  }
  return result;
}

// ---------------------------------------------------------------------------
// Storage (Cloudflare R2 / S3-compatible, fallback disk lokal)
// ---------------------------------------------------------------------------

const storageRoot = path.resolve(process.env.STORAGE_DIR || '/data/uploads');
function safeStoragePath(relative: string) {
  const normalized = relative.replace(/\\/g, '/').replace(/^\/+/, '');
  const resolved = path.resolve(storageRoot, normalized);
  if (!resolved.startsWith(storageRoot + path.sep) && resolved !== storageRoot) throw new Error('Path storage tidak valid.');
  if (normalized.split('/').some(segment => segment === '..')) throw new Error('Path storage tidak valid.');
  return { normalized, resolved };
}

const r2Config = {
  endpoint: process.env.R2_ENDPOINT || (process.env.R2_ACCOUNT_ID ? `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com` : ''),
  accessKeyId: process.env.R2_ACCESS_KEY_ID || '',
  secretAccessKey: process.env.R2_SECRET_ACCESS_KEY || '',
  bucket: process.env.R2_BUCKET || '',
  publicUrl: (process.env.R2_PUBLIC_URL || '').replace(/\/+$/, ''),
  prefix: (process.env.R2_PREFIX || '').replace(/^\/+|\/+$/g, ''),
  signedUrlTtl: Math.max(60, Number(process.env.R2_SIGNED_URL_TTL || 3600)),
};
export const storageMode: 'r2' | 'local' = r2Config.endpoint && r2Config.accessKeyId && r2Config.secretAccessKey && r2Config.bucket ? 'r2' : 'local';

const s3 = storageMode === 'r2'
  ? new S3Client({
      region: 'auto',
      endpoint: r2Config.endpoint,
      credentials: { accessKeyId: r2Config.accessKeyId, secretAccessKey: r2Config.secretAccessKey },
      forcePathStyle: true,
    })
  : null;

function objectKey(normalized: string) {
  return r2Config.prefix ? `${r2Config.prefix}/${normalized}` : normalized;
}

export const storage = {
  async write(entries: Array<{ path: string; content: string; contentType?: string }>) {
    const results: boolean[] = [];
    for (const entry of entries) {
      try {
        const target = safeStoragePath(entry.path);
        const body = Buffer.from(entry.content, 'base64');
        if (s3) {
          await s3.send(new PutObjectCommand({
            Bucket: r2Config.bucket,
            Key: objectKey(target.normalized),
            Body: body,
            ContentType: entry.contentType || 'application/octet-stream',
          }));
        } else {
          await fs.mkdir(path.dirname(target.resolved), { recursive: true });
          await fs.writeFile(target.resolved, body);
        }
        results.push(true);
      } catch (err) {
        console.error('storage.write gagal:', err);
        results.push(false);
      }
    }
    return results;
  },
  async delete(paths: string[]) {
    const results: boolean[] = [];
    for (const item of paths) {
      try {
        const target = safeStoragePath(item);
        if (s3) {
          await s3.send(new DeleteObjectCommand({ Bucket: r2Config.bucket, Key: objectKey(target.normalized) }));
        } else {
          await fs.rm(target.resolved, { force: true });
        }
        results.push(true);
      } catch (err) {
        console.error('storage.delete gagal:', err);
        results.push(false);
      }
    }
    return results;
  },
  async url(paths: string[]) {
    const results: Array<{ url: string }> = [];
    for (const item of paths) {
      const target = safeStoragePath(item);
      const encoded = target.normalized.split('/').map(encodeURIComponent).join('/');
      if (s3) {
        if (r2Config.publicUrl) {
          results.push({ url: `${r2Config.publicUrl}/${r2Config.prefix ? `${r2Config.prefix}/` : ''}${encoded}` });
        } else {
          const signed = await getSignedUrl(
            s3,
            new GetObjectCommand({ Bucket: r2Config.bucket, Key: objectKey(target.normalized) }),
            { expiresIn: r2Config.signedUrlTtl }
          );
          results.push({ url: signed });
        }
      } else {
        results.push({ url: `/uploads/${encoded}` });
      }
    }
    return results;
  },
};

// ---------------------------------------------------------------------------
// Hapus workspace (dengan backup JSON ke storage)
// ---------------------------------------------------------------------------

export async function backupAndDeleteWorkspace(
  workspaceId: string,
  details: { workspaceName: string; deletedBy: string }
) {
  const normalizedId = workspaceId.trim();
  if (!/^[A-Za-z0-9._-]{1,160}$/.test(normalizedId)) throw new Error('Workspace ID tidak valid.');

  const where = `workspace_id = ?
       OR JSON_UNQUOTE(JSON_EXTRACT(record, '$.workspaceId')) = ?
       OR JSON_UNQUOTE(JSON_EXTRACT(record, '$.activeWorkspaceId')) = ?`;
  const params = [normalizedId, normalizedId, normalizedId];

  return withTransaction(async conn => {
    const [rows] = await conn.query<RowDataPacket[]>(
      `SELECT table_name, id, record, created_at, updated_at FROM app_records WHERE ${where} FOR UPDATE`,
      params
    );
    const backupRows = rows.map(row => ({
      table_name: row.table_name,
      id: row.id,
      record: parseRecord<Record<string, unknown>>(row.record),
      created_at: row.created_at,
      updated_at: row.updated_at,
    }));

    const stamp = new Date().toISOString().replace(/[:.]/g, '-');
    const relativePath = `workspace-deletions/${stamp}-${normalizedId}.json`;
    const backupPayload = {
      version: 1,
      workspaceId: normalizedId,
      workspaceName: details.workspaceName,
      deletedBy: details.deletedBy,
      deletedAt: new Date().toISOString(),
      rows: backupRows,
    };
    const [saved] = await storage.write([{
      path: relativePath,
      content: Buffer.from(JSON.stringify(backupPayload), 'utf8').toString('base64'),
      contentType: 'application/json',
    }]);
    if (!saved) throw new Error('Backup data perusahaan gagal disimpan. Penghapusan dibatalkan.');

    const [deleted] = await conn.query<mysql.ResultSetHeader>(`DELETE FROM app_records WHERE ${where}`, params);
    return { deletedCount: deleted.affectedRows || 0, backupPath: relativePath };
  });
}

/* v4.15 company deletion */
