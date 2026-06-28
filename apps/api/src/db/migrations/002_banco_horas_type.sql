-- Migration 002: add 'banco_horas' to day_type CHECK constraint
-- SQLite does not support ALTER COLUMN, so we recreate the table.
-- Run: wrangler d1 execute controle-ponto-db --file=src/db/migrations/002_banco_horas_type.sql

PRAGMA foreign_keys = OFF;

CREATE TABLE time_entries_new (
  id               TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  employee_id      TEXT NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  entry_date       TEXT NOT NULL,
  clock_in         TEXT,
  lunch_out        TEXT,
  lunch_return     TEXT,
  clock_out        TEXT,
  day_type         TEXT NOT NULL DEFAULT 'worked'
                   CHECK(day_type IN ('worked','closed','holiday','absence','vacation','medical','banco_horas')),
  notes            TEXT,
  worked_minutes   INTEGER,
  extra_minutes    INTEGER,
  missing_minutes  INTEGER,
  created_at       TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at       TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(employee_id, entry_date)
);

INSERT INTO time_entries_new SELECT * FROM time_entries;

DROP TABLE time_entries;

ALTER TABLE time_entries_new RENAME TO time_entries;

CREATE INDEX IF NOT EXISTS idx_time_entries_employee      ON time_entries(employee_id);
CREATE INDEX IF NOT EXISTS idx_time_entries_date          ON time_entries(entry_date);
CREATE INDEX IF NOT EXISTS idx_time_entries_employee_date ON time_entries(employee_id, entry_date);

PRAGMA foreign_keys = ON;
