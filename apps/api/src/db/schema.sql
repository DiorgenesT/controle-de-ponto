-- Controle de Ponto — D1 Schema
-- Run: wrangler d1 execute controle-ponto-db --file=src/db/schema.sql

PRAGMA journal_mode = WAL;
PRAGMA foreign_keys = ON;

-- ─── Companies ───────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS companies (
  id          TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  name        TEXT NOT NULL,
  cnpj        TEXT NOT NULL UNIQUE,
  address     TEXT,
  city        TEXT,
  created_at  TEXT NOT NULL DEFAULT (datetime('now'))
);

-- ─── Users ───────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS users (
  id            TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  company_id    TEXT NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  email         TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  name          TEXT NOT NULL,
  role          TEXT NOT NULL DEFAULT 'viewer'
                CHECK(role IN ('admin', 'manager', 'viewer')),
  active        INTEGER NOT NULL DEFAULT 1,
  created_at    TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_users_company ON users(company_id);
CREATE INDEX IF NOT EXISTS idx_users_email   ON users(email);

-- ─── Employees ───────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS employees (
  id                    TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  company_id            TEXT NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  name                  TEXT NOT NULL,
  role                  TEXT NOT NULL,
  admission_date        TEXT NOT NULL,
  weekday_start         TEXT NOT NULL DEFAULT '08:30',
  weekday_end           TEXT NOT NULL DEFAULT '18:00',
  saturday_start        TEXT DEFAULT '08:00',
  saturday_end          TEXT DEFAULT '12:00',
  works_saturday        INTEGER NOT NULL DEFAULT 1,
  tolerance_minutes     INTEGER NOT NULL DEFAULT 10,
  daily_hours_expected  REAL NOT NULL DEFAULT 8.0,
  active                INTEGER NOT NULL DEFAULT 1,
  created_at            TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_employees_company ON employees(company_id);

-- ─── Time Entries ─────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS time_entries (
  id               TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  employee_id      TEXT NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  entry_date       TEXT NOT NULL,
  clock_in         TEXT,
  lunch_out        TEXT,
  lunch_return     TEXT,
  clock_out        TEXT,
  day_type         TEXT NOT NULL DEFAULT 'normal'
                   CHECK(day_type IN ('normal','closed','holiday','absence','vacation')),
  notes            TEXT,
  worked_minutes   INTEGER,
  extra_minutes    INTEGER,
  missing_minutes  INTEGER,
  created_at       TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at       TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(employee_id, entry_date)
);

CREATE INDEX IF NOT EXISTS idx_time_entries_employee      ON time_entries(employee_id);
CREATE INDEX IF NOT EXISTS idx_time_entries_date          ON time_entries(entry_date);
CREATE INDEX IF NOT EXISTS idx_time_entries_employee_date ON time_entries(employee_id, entry_date);

-- ─── Hour Bank ────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS hour_bank (
  id                    TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  employee_id           TEXT NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  year                  INTEGER NOT NULL,
  month                 INTEGER NOT NULL,
  total_worked_minutes  INTEGER NOT NULL DEFAULT 0,
  total_extra_minutes   INTEGER NOT NULL DEFAULT 0,
  total_missing_minutes INTEGER NOT NULL DEFAULT 0,
  balance_minutes       INTEGER NOT NULL DEFAULT 0,
  accumulated_minutes   INTEGER NOT NULL DEFAULT 0,
  closed                INTEGER NOT NULL DEFAULT 0,
  closed_at             TEXT,
  created_at            TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at            TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(employee_id, year, month)
);

CREATE INDEX IF NOT EXISTS idx_hour_bank_employee ON hour_bank(employee_id);
