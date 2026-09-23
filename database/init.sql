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
