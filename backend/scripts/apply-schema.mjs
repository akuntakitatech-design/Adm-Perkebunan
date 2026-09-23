#!/usr/bin/env node
/**
 * Menerapkan database/schema.sql ke MariaDB secara manual.
 *   DATABASE_URL=mysql://user:pass@host:3306/db node scripts/apply-schema.mjs
 */
import 'dotenv/config';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import mysql from 'mysql2/promise';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const url = new URL(process.env.DATABASE_URL || '');
const conn = await mysql.createConnection({
  host: url.hostname,
  port: Number(url.port || 3306),
  user: decodeURIComponent(url.username),
  password: decodeURIComponent(url.password),
  database: decodeURIComponent(url.pathname.replace(/^\//, '')),
  multipleStatements: false,
});
const sql = await fs.readFile(path.resolve(__dirname, '../database/schema.sql'), 'utf8');
const statements = sql
  .split(/;\s*(?:\r?\n|$)/)
  .map(part => part.split('\n').filter(line => !line.trim().startsWith('--')).join('\n').trim())
  .filter(Boolean);
for (const statement of statements) await conn.query(statement);
console.log(`Skema diterapkan: ${statements.length} statement.`);
await conn.end();
