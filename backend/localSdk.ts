import express, { type RequestHandler, type Router as ExpressRouter } from 'express';
import pg from 'pg';
import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';

const { Pool } = pg;
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

export type LocalUser = { userId: string; email?: string; name?: string; picture?: string };
export type LocalContext = {
  body: unknown;
  query: Record<string, unknown>;
  params: Record<string, string>;
  user?: LocalUser;
};

type LocalResult = { __localResponse: true; status: number; body: unknown };
type LocalHandler = (ctx: LocalContext) => Promise<LocalResult | void> | LocalResult | void;

export async function initDb() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS app_records (
      table_name TEXT NOT NULL,
      id TEXT NOT NULL,
      record JSONB NOT NULL DEFAULT '{}'::jsonb,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      PRIMARY KEY (table_name, id)
    );
    CREATE INDEX IF NOT EXISTS app_records_table_created_idx
      ON app_records(table_name, created_at, id);
  `);
}

function withId<T>(row: { id: string; record: T }) {
  return { id: row.id, ...(row.record as object) } as T & { id: string };
}

function tokenToOffset(token?: string) {
  if (!token) return 0;
  try {
    const parsed = Number(Buffer.from(token, 'base64url').toString('utf8'));
    return Number.isFinite(parsed) && parsed >= 0 ? Math.floor(parsed) : 0;
  } catch { return 0; }
}
function offsetToToken(offset: number) { return Buffer.from(String(offset), 'utf8').toString('base64url'); }

export const db = {
  async list<T>(table: string, options: { limit?: number; nextToken?: string } = {}) {
    const limit = Math.min(1000, Math.max(1, Number(options.limit) || 100));
    const offset = tokenToOffset(options.nextToken);
    const result = await pool.query<{ id: string; record: T }>(
      `SELECT id, record FROM app_records WHERE table_name = $1 ORDER BY created_at ASC, id ASC LIMIT $2 OFFSET $3`,
      [table, limit + 1, offset]
    );
    const hasMore = result.rows.length > limit;
    const rows = result.rows.slice(0, limit);
    return { items: rows.map(withId), nextToken: hasMore ? offsetToToken(offset + limit) : undefined };
  },

  async get<T>(table: string, ids: string[]) {
    if (!ids.length) return [] as Array<(T & { id: string }) | undefined>;
    const result = await pool.query<{ id: string; record: T }>(
      `SELECT id, record FROM app_records WHERE table_name = $1 AND id = ANY($2::text[])`,
      [table, ids]
    );
    const map = new Map(result.rows.map(row => [row.id, withId(row)]));
    return ids.map(id => map.get(id));
  },

  async add<T>(table: string, records: T[]) {
    if (!records.length) return [] as string[];
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const ids: string[] = [];
      for (const record of records) {
        const result = await client.query<{ id: string }>(
          `INSERT INTO app_records(table_name, id, record) VALUES ($1, $2, $3::jsonb) RETURNING id`,
          [table, crypto.randomUUID(), JSON.stringify(record)]
        );
        ids.push(result.rows[0]?.id || '');
      }
      await client.query('COMMIT');
      return ids;
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally { client.release(); }
  },

  async update<T>(table: string, rows: Array<{ id: string; record: T }>) {
    if (!rows.length) return [] as boolean[];
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const results: boolean[] = [];
      for (const row of rows) {
        const result = await client.query(
          `UPDATE app_records SET record = $3::jsonb, updated_at = NOW() WHERE table_name = $1 AND id = $2`,
          [table, row.id, JSON.stringify(row.record)]
        );
        results.push(result.rowCount === 1);
      }
      await client.query('COMMIT');
      return results;
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally { client.release(); }
  },

  async delete(table: string, ids: string[]) {
    if (!ids.length) return [] as boolean[];
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const results: boolean[] = [];
      for (const id of ids) {
        const result = await client.query(`DELETE FROM app_records WHERE table_name = $1 AND id = $2`, [table, id]);
        results.push(result.rowCount === 1);
      }
      await client.query('COMMIT');
      return results;
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally { client.release(); }
  },
};

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

const storageRoot = path.resolve(process.env.STORAGE_DIR || '/data/uploads');
function safeStoragePath(relative: string) {
  const normalized = relative.replace(/\\/g, '/').replace(/^\/+/, '');
  const resolved = path.resolve(storageRoot, normalized);
  if (!resolved.startsWith(storageRoot + path.sep) && resolved !== storageRoot) throw new Error('Path storage tidak valid.');
  return { normalized, resolved };
}

export async function backupAndDeleteWorkspace(
  workspaceId: string,
  details: { workspaceName: string; deletedBy: string }
) {
  const normalizedId = workspaceId.trim();
  if (!/^[A-Za-z0-9._-]{1,160}$/.test(normalizedId)) throw new Error('Workspace ID tidak valid.');
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const rows = await client.query<{ table_name: string; id: string; record: unknown; created_at: Date; updated_at: Date }>(
      `SELECT table_name, id, record, created_at, updated_at
       FROM app_records
       WHERE RIGHT(table_name, LENGTH($1) + 1) = ':' || $1
          OR record->>'workspaceId' = $1
          OR record->>'activeWorkspaceId' = $1
       FOR UPDATE`,
      [normalizedId]
    );

    const backupDir = path.join(storageRoot, 'workspace-deletions');
    await fs.mkdir(backupDir, { recursive: true });
    const stamp = new Date().toISOString().replace(/[:.]/g, '-');
    const fileName = `${stamp}-${normalizedId}.json`;
    const backupPayload = {
      version: 1,
      workspaceId: normalizedId,
      workspaceName: details.workspaceName,
      deletedBy: details.deletedBy,
      deletedAt: new Date().toISOString(),
      rows: rows.rows,
    };
    await fs.writeFile(path.join(backupDir, fileName), JSON.stringify(backupPayload));

    const deleted = await client.query(
      `DELETE FROM app_records
       WHERE RIGHT(table_name, LENGTH($1) + 1) = ':' || $1
          OR record->>'workspaceId' = $1
          OR record->>'activeWorkspaceId' = $1`,
      [normalizedId]
    );
    await client.query('COMMIT');
    return { deletedCount: deleted.rowCount || 0, backupPath: `workspace-deletions/${fileName}` };
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

/* v4.15 company deletion */

export const storage = {
  async write(entries: Array<{ path: string; content: string; contentType?: string }>) {
    const results: boolean[] = [];
    for (const entry of entries) {
      try {
        const target = safeStoragePath(entry.path);
        await fs.mkdir(path.dirname(target.resolved), { recursive: true });
        await fs.writeFile(target.resolved, Buffer.from(entry.content, 'base64'));
        results.push(true);
      } catch { results.push(false); }
    }
    return results;
  },
  async delete(paths: string[]) {
    const results: boolean[] = [];
    for (const item of paths) {
      try {
        const target = safeStoragePath(item);
        await fs.rm(target.resolved, { force: true });
        results.push(true);
      } catch { results.push(false); }
    }
    return results;
  },
  async url(paths: string[]) {
    return paths.map(item => {
      const target = safeStoragePath(item);
      const encoded = target.normalized.split('/').map(encodeURIComponent).join('/');
      return { url: `/uploads/${encoded}` };
    });
  },
};
