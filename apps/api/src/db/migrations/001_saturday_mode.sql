-- Migration 001: replace works_saturday (INTEGER) with saturday_mode (TEXT)
-- Run: wrangler d1 execute controle-ponto-db --file=src/db/migrations/001_saturday_mode.sql

ALTER TABLE employees ADD COLUMN saturday_mode TEXT NOT NULL DEFAULT 'all'
  CHECK(saturday_mode IN ('all','first_two','none'));

UPDATE employees SET saturday_mode = CASE works_saturday WHEN 1 THEN 'all' ELSE 'none' END;

-- works_saturday is kept for now (SQLite drop column requires 3.35+)
-- Safe to drop manually once the migration is confirmed:
-- ALTER TABLE employees DROP COLUMN works_saturday;
