import 'dotenv/config';
import pg from 'pg';
import fs from 'node:fs/promises';

const file = process.argv[2];
if (!file) {
  console.error('Pemakaian: node scripts/import-records.mjs data-export.json');
  process.exit(1);
}
const payload = JSON.parse(await fs.readFile(file, 'utf8'));
if (!payload || typeof payload !== 'object' || !payload.tables || typeof payload.tables !== 'object') {
  throw new Error('Format harus { "tables": { "nama_tabel": [{"id":"...", ...record}] } }.');
}
const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
const client = await pool.connect();
try {
  await client.query('BEGIN');
  let count = 0;
  for (const [tableName, rows] of Object.entries(payload.tables)) {
    if (!Array.isArray(rows)) continue;
    for (const raw of rows) {
      if (!raw || typeof raw !== 'object' || !raw.id) throw new Error(`Record ${tableName} tidak memiliki id.`);
      const { id, ...record } = raw;
      await client.query(
        `INSERT INTO app_records(table_name,id,record) VALUES($1,$2,$3::jsonb)
         ON CONFLICT(table_name,id) DO UPDATE SET record=EXCLUDED.record, updated_at=NOW()`,
        [tableName, String(id), JSON.stringify(record)]
      );
      count += 1;
    }
  }
  await client.query('COMMIT');
  console.log(`Import selesai: ${count} record.`);
} catch (err) {
  await client.query('ROLLBACK');
  throw err;
} finally {
  client.release();
  await pool.end();
}
