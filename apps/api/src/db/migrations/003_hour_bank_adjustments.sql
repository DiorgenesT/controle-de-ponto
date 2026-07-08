-- Migration 003: repurpose hour_bank as a manual-adjustment ledger.
-- The old snapshot fields (totals, balance, accumulated, closed) are dropped —
-- balance is now always computed live from time_entries + adjustment_minutes,
-- so nothing of value is lost.
-- Run: wrangler d1 execute controle-ponto-db --file=src/db/migrations/003_hour_bank_adjustments.sql

PRAGMA foreign_keys = OFF;

CREATE TABLE hour_bank_new (
  id                  TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  employee_id         TEXT NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  year                INTEGER NOT NULL,
  month               INTEGER NOT NULL,
  adjustment_minutes  INTEGER NOT NULL DEFAULT 0,
  note                TEXT,
  created_at          TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at          TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(employee_id, year, month)
);

DROP TABLE hour_bank;

ALTER TABLE hour_bank_new RENAME TO hour_bank;

CREATE INDEX IF NOT EXISTS idx_hour_bank_employee ON hour_bank(employee_id);

PRAGMA foreign_keys = ON;
