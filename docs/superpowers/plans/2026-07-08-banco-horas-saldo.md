# Banco de Horas — saldo acumulado ao vivo, aviso de saldo e ajustes manuais — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the hour-bank balance always accumulate live from `time_entries` (no manual "fechar mês" step), warn (without blocking) when marking a day as `banco_horas` with insufficient balance, and let admin/manager inject manual balance adjustments for any month — mainly to seed balance for months before the app was used.

**Architecture:** `hour_bank` is repurposed from a monthly "closed snapshot" table into a pure manual-adjustment ledger (one row per employee/month, only when a real adjustment exists). A new backend helper (`getAccumulatedBeforeMonth`) computes the accumulated balance before any given month by summing all `time_entries` (`extra_minutes - missing_minutes`) plus all `hour_bank.adjustment_minutes` dated before that month — this replaces every place that used to read the "last closed" `hour_bank` row. The frontend gets a small "Ajuste de Banco de Horas" form (replacing "Fechar Mês") on the Reports page, and an inline, non-blocking balance warning on the Timesheet page when a day is set to `banco_horas`.

**Tech Stack:** Cloudflare Workers + Hono + D1 (SQLite) API, React + TanStack Query + Vite frontend, Zod validation shared via `@ponto/shared`, pnpm workspace monorepo.

**Reference spec:** `docs/superpowers/specs/2026-07-08-banco-horas-saldo-design.md`

**No automated test framework exists in this repo today** (empty `test` scripts, no vitest/jest config). Per project convention, this plan verifies changes with `tsc --noEmit`/`tsc -b` type-checks, `wrangler dev` + `curl` for the API, and manual browser testing for the UI — no new test infra is introduced.

**Known environment caveat:** in this sandbox, `wrangler d1 execute --local` fails on the schema's leading `PRAGMA journal_mode = WAL;` with `not authorized: SQLITE_AUTH`. This is pre-existing and unrelated to this feature — if you hit it while running `pnpm db:migrate` locally, it's a sandbox/wrangler-version quirk, not a bug in the migration SQL (the SQL itself was verified independently with Node's built-in `node:sqlite`).

---

### Task 1: Database — repurpose `hour_bank` as an adjustment ledger

**Files:**
- Create: `apps/api/src/db/migrations/003_hour_bank_adjustments.sql`
- Modify: `apps/api/src/db/schema.sql:83-102`

- [ ] **Step 1: Write the migration file**

Create `apps/api/src/db/migrations/003_hour_bank_adjustments.sql`:

```sql
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
```

- [ ] **Step 2: Update the canonical schema for fresh installs**

In `apps/api/src/db/schema.sql`, replace lines 83-102 (the `-- ─── Hour Bank ───` section) with:

```sql
-- ─── Hour Bank Adjustments ─────────────────────────────────────────────────────
-- Manual balance adjustments only. The running accumulated balance is always
-- computed live from time_entries + these adjustments (see getAccumulatedBeforeMonth
-- in apps/api/src/lib/hourBank.ts) — there is no "closed month" snapshot anymore.

CREATE TABLE IF NOT EXISTS hour_bank (
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

CREATE INDEX IF NOT EXISTS idx_hour_bank_employee ON hour_bank(employee_id);
```

- [ ] **Step 3: Apply the schema to the local D1 database**

Run from `apps/api/`:
```bash
pnpm db:migrate
```
Expected: command completes (if you hit the `PRAGMA journal_mode` / `SQLITE_AUTH` caveat noted above, that's the pre-existing sandbox issue — skip to Step 4 and verify with a direct `--command` call instead, which does not touch that pragma).

- [ ] **Step 4: Verify the table shape**

```bash
npx wrangler d1 execute controle-ponto-db --local --command "PRAGMA table_info(hour_bank);"
```
Expected: 8 columns — `id, employee_id, year, month, adjustment_minutes, note, created_at, updated_at`. No `total_worked_minutes`, `balance_minutes`, `accumulated_minutes`, or `closed` columns.

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/db/migrations/003_hour_bank_adjustments.sql apps/api/src/db/schema.sql
git commit -m "feat: repurpose hour_bank as manual adjustment ledger"
```

---

### Task 2: Shared types and validation schema

**Files:**
- Modify: `packages/shared/src/types.ts:63-77`
- Modify: `packages/shared/src/schemas.ts:123-129` (end of file)

- [ ] **Step 1: Replace the `HourBank` interface**

In `packages/shared/src/types.ts`, replace lines 63-77:

```ts
export interface HourBank {
  id: string
  employeeId: string
  year: number
  month: number
  totalWorkedMinutes: number
  totalExtraMinutes: number
  totalMissingMinutes: number
  balanceMinutes: number      // extra - missing for the month
  accumulatedMinutes: number  // running total including prior months
  closed: boolean
  closedAt: string | null
  createdAt: string
  updatedAt: string
}
```

with:

```ts
export interface HourBankAdjustment {
  id: string
  employeeId: string
  year: number
  month: number
  adjustmentMinutes: number  // manual delta applied to that month's accumulated balance
  note: string | null
  createdAt: string
  updatedAt: string
}
```

- [ ] **Step 2: Add the adjustment request schema**

Append to `packages/shared/src/schemas.ts` (after `monthQuerySchema`):

```ts

export const hourBankAdjustmentSchema = z.object({
  employeeId: z.string().uuid(),
  year: z.coerce.number().int().min(2020).max(2100),
  month: z.coerce.number().int().min(1).max(12),
  adjustmentMinutes: z.coerce.number().int().min(-100000).max(100000),
  note: z.string().max(500).nullable().optional(),
})
```

- [ ] **Step 3: Type-check**

Run from repo root:
```bash
./node_modules/.bin/tsc --noEmit -p apps/api/tsconfig.json
```
Expected: no errors (nothing consumes `HourBank` outside `types.ts` yet, so this should be clean — confirmed by `grep -rn "HourBank\b" packages apps` returning only the type declaration itself).

- [ ] **Step 4: Commit**

```bash
git add packages/shared/src/types.ts packages/shared/src/schemas.ts
git commit -m "feat: add HourBankAdjustment type and validation schema"
```

---

### Task 3: Backend — live accumulated-balance helper

**Files:**
- Create: `apps/api/src/lib/hourBank.ts`

- [ ] **Step 1: Write the helper**

Create `apps/api/src/lib/hourBank.ts`:

```ts
import type { D1Database } from '@cloudflare/workers-types'

/**
 * Accumulated hour-bank balance for `employeeId` immediately before
 * `year`/`month`, summing every time_entries balance and every manual
 * adjustment dated earlier — never depends on a "closed month" snapshot.
 */
export async function getAccumulatedBeforeMonth(
  db: D1Database,
  employeeId: string,
  year: number,
  month: number
): Promise<number> {
  const startDate = `${year}-${String(month).padStart(2, '0')}-01`

  const [entriesBalance, adjustmentsBalance] = await Promise.all([
    db
      .prepare(
        `SELECT COALESCE(SUM(extra_minutes), 0) - COALESCE(SUM(missing_minutes), 0) AS balance
         FROM time_entries
         WHERE employee_id = ? AND entry_date < ?`
      )
      .bind(employeeId, startDate)
      .first<{ balance: number }>(),
    db
      .prepare(
        `SELECT COALESCE(SUM(adjustment_minutes), 0) AS total
         FROM hour_bank
         WHERE employee_id = ? AND (year < ? OR (year = ? AND month < ?))`
      )
      .bind(employeeId, year, year, month)
      .first<{ total: number }>(),
  ])

  return (entriesBalance?.balance ?? 0) + (adjustmentsBalance?.total ?? 0)
}

/**
 * Same as getAccumulatedBeforeMonth, batched for every employee of a company —
 * used by the dashboard to avoid one query per employee.
 */
export async function getAccumulatedBeforeMonthByCompany(
  db: D1Database,
  companyId: string,
  year: number,
  month: number
): Promise<Record<string, number>> {
  const startDate = `${year}-${String(month).padStart(2, '0')}-01`

  const [entriesResult, adjustmentsResult] = await Promise.all([
    db
      .prepare(
        `SELECT te.employee_id AS employeeId,
                COALESCE(SUM(te.extra_minutes), 0) - COALESCE(SUM(te.missing_minutes), 0) AS balance
         FROM time_entries te
         JOIN employees e ON e.id = te.employee_id
         WHERE e.company_id = ? AND te.entry_date < ?
         GROUP BY te.employee_id`
      )
      .bind(companyId, startDate)
      .all<{ employeeId: string; balance: number }>(),
    db
      .prepare(
        `SELECT hb.employee_id AS employeeId, COALESCE(SUM(hb.adjustment_minutes), 0) AS total
         FROM hour_bank hb
         JOIN employees e ON e.id = hb.employee_id
         WHERE e.company_id = ? AND (hb.year < ? OR (hb.year = ? AND hb.month < ?))
         GROUP BY hb.employee_id`
      )
      .bind(companyId, year, year, month)
      .all<{ employeeId: string; total: number }>(),
  ])

  const result: Record<string, number> = {}
  for (const row of entriesResult.results) {
    result[row.employeeId] = (result[row.employeeId] ?? 0) + row.balance
  }
  for (const row of adjustmentsResult.results) {
    result[row.employeeId] = (result[row.employeeId] ?? 0) + row.total
  }
  return result
}
```

- [ ] **Step 2: Type-check**

```bash
./node_modules/.bin/tsc --noEmit -p apps/api/tsconfig.json
```
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add apps/api/src/lib/hourBank.ts
git commit -m "feat: add live accumulated-balance helper for hour bank"
```

---

### Task 4: Backend — rewrite `/reports` hour-bank endpoints

**Files:**
- Modify: `apps/api/src/routes/reports.ts` (full file)

This task replaces the whole file. The changes: `/monthly` and `/dashboard` use the new helper instead of reading the last "closed" `hour_bank` row; `GET /reports/hourbank` returns adjustments instead of snapshots; `POST /reports/hourbank/close` is removed; `POST /reports/hourbank/adjustment` is added.

- [ ] **Step 1: Replace the imports and add the adjustment row mapper**

Replace lines 1-29 of `apps/api/src/routes/reports.ts`:

```ts
import { Hono } from 'hono'
import { monthQuerySchema, hourBankAdjustmentSchema, calculateMonthlySummary } from '@ponto/shared'
import type { TimeEntry, HourBankAdjustment } from '@ponto/shared'
import type { Env } from '../lib/types'
import type { AuthContext } from '../middleware/auth'
import { authMiddleware, requireRole } from '../middleware/auth'
import { getAccumulatedBeforeMonth, getAccumulatedBeforeMonthByCompany } from '../lib/hourBank'

const reports = new Hono<{ Bindings: Env } & AuthContext>()

reports.use('*', authMiddleware)

function rowToEntry(row: Record<string, unknown>): TimeEntry {
  return {
    id: row.id as string,
    employeeId: row.employee_id as string,
    entryDate: row.entry_date as string,
    clockIn: row.clock_in as string | null,
    lunchOut: row.lunch_out as string | null,
    lunchReturn: row.lunch_return as string | null,
    clockOut: row.clock_out as string | null,
    dayType: row.day_type as TimeEntry['dayType'],
    notes: row.notes as string | null,
    workedMinutes: row.worked_minutes as number | null,
    extraMinutes: row.extra_minutes as number | null,
    missingMinutes: row.missing_minutes as number | null,
    createdAt: row.created_at as string,
    updatedAt: row.updated_at as string,
  }
}

function rowToAdjustment(row: Record<string, unknown>): HourBankAdjustment {
  return {
    id: row.id as string,
    employeeId: row.employee_id as string,
    year: row.year as number,
    month: row.month as number,
    adjustmentMinutes: row.adjustment_minutes as number,
    note: row.note as string | null,
    createdAt: row.created_at as string,
    updatedAt: row.updated_at as string,
  }
}
```

- [ ] **Step 2: Replace everything from `// GET /reports/monthly` to the end of the file**

The original file has, in order: the `/monthly` handler (lines 31-121), the `/hourbank` GET handler (123-143), the `/dashboard` handler (145-262), the `/hourbank/close` POST handler (264-335), and `export default reports` (337). Because these regions sit back-to-back, replace **all of it at once** — from line 31 (`// GET /reports/monthly`) through the end of the file — with the block below, which keeps the same order but updates `/monthly` and `/dashboard` to use the live-balance helper, updates `/hourbank` GET to return adjustments, and swaps `/hourbank/close` for `/hourbank/adjustment`:

```ts
// GET /reports/monthly?employeeId=&year=&month=
reports.get('/monthly', async (c) => {
  const parsed = monthQuerySchema.safeParse({
    employeeId: c.req.query('employeeId'),
    year: c.req.query('year'),
    month: c.req.query('month'),
  })

  if (!parsed.success) {
    return c.json({ error: 'Parâmetros inválidos', code: 'VALIDATION_ERROR' }, 400)
  }

  const { employeeId, year, month } = parsed.data
  const { companyId } = c.get('user')

  const [employeeRow, companyRow] = await Promise.all([
    c.env.DB
      .prepare('SELECT * FROM employees WHERE id = ? AND company_id = ? LIMIT 1')
      .bind(employeeId, companyId)
      .first(),
    c.env.DB
      .prepare('SELECT * FROM companies WHERE id = ? LIMIT 1')
      .bind(companyId)
      .first(),
  ])

  if (!employeeRow) return c.json({ error: 'Funcionário não encontrado', code: 'NOT_FOUND' }, 404)

  const startDate = `${year}-${String(month).padStart(2, '0')}-01`
  const endDate   = `${year}-${String(month).padStart(2, '0')}-31`

  const [entriesResult, previousAccumulated, currentAdjustmentRow] = await Promise.all([
    c.env.DB
      .prepare(
        `SELECT * FROM time_entries
         WHERE employee_id = ? AND entry_date >= ? AND entry_date <= ?
         ORDER BY entry_date ASC`
      )
      .bind(employeeId, startDate, endDate)
      .all(),
    getAccumulatedBeforeMonth(c.env.DB, employeeId, year, month),
    c.env.DB
      .prepare('SELECT adjustment_minutes FROM hour_bank WHERE employee_id = ? AND year = ? AND month = ? LIMIT 1')
      .bind(employeeId, year, month)
      .first<{ adjustment_minutes: number }>(),
  ])

  const entries = entriesResult.results.map(r => rowToEntry(r as Record<string, unknown>))
  const summary = calculateMonthlySummary(entries)
  const currentAdjustment = currentAdjustmentRow?.adjustment_minutes ?? 0
  const accumulatedMinutes = previousAccumulated + summary.balanceMinutes + currentAdjustment

  return c.json({
    data: {
      employee: {
        id: employeeRow.id,
        companyId: employeeRow.company_id,
        name: employeeRow.name,
        role: employeeRow.role,
        cpf: employeeRow.cpf ?? null,
        admissionDate: employeeRow.admission_date,
        weekdayStart: employeeRow.weekday_start,
        weekdayEnd: employeeRow.weekday_end,
        saturdayStart: employeeRow.saturday_start,
        saturdayEnd: employeeRow.saturday_end,
        saturdayMode: (employeeRow.saturday_mode as string | null) ?? 'all',
        toleranceMinutes: employeeRow.tolerance_minutes,
        dailyHoursExpected: employeeRow.daily_hours_expected,
        active: employeeRow.active === 1,
        createdAt: employeeRow.created_at,
      },
      company: {
        id: companyRow?.id,
        name: companyRow?.name,
        cnpj: companyRow?.cnpj,
        address: companyRow?.address,
        city: companyRow?.city,
      },
      year,
      month,
      entries,
      ...summary,
      accumulatedMinutes,
      previousMonthAccumulated: previousAccumulated,
    },
  })
})

// GET /reports/hourbank?employeeId=
reports.get('/hourbank', async (c) => {
  const employeeId = c.req.query('employeeId')
  if (!employeeId) return c.json({ error: 'employeeId é obrigatório', code: 'VALIDATION_ERROR' }, 400)

  const { companyId } = c.get('user')

  const employee = await c.env.DB
    .prepare('SELECT id FROM employees WHERE id = ? AND company_id = ? LIMIT 1')
    .bind(employeeId, companyId)
    .first()

  if (!employee) return c.json({ error: 'Funcionário não encontrado', code: 'NOT_FOUND' }, 404)

  const rows = await c.env.DB
    .prepare('SELECT * FROM hour_bank WHERE employee_id = ? ORDER BY year DESC, month DESC')
    .bind(employeeId)
    .all()

  return c.json({ data: rows.results.map(r => rowToAdjustment(r as Record<string, unknown>)) })
})

// POST /reports/hourbank/adjustment
reports.post('/hourbank/adjustment', requireRole('admin', 'manager'), async (c) => {
  const body = await c.req.json().catch(() => null)
  const parsed = hourBankAdjustmentSchema.safeParse(body)
  if (!parsed.success) {
    return c.json({ error: 'Dados inválidos', code: 'VALIDATION_ERROR' }, 400)
  }

  const { employeeId, year, month, adjustmentMinutes, note } = parsed.data
  const { companyId } = c.get('user')

  const employee = await c.env.DB
    .prepare('SELECT id FROM employees WHERE id = ? AND company_id = ? LIMIT 1')
    .bind(employeeId, companyId)
    .first()

  if (!employee) return c.json({ error: 'Funcionário não encontrado', code: 'NOT_FOUND' }, 404)

  if (adjustmentMinutes === 0 && !note) {
    await c.env.DB
      .prepare('DELETE FROM hour_bank WHERE employee_id = ? AND year = ? AND month = ?')
      .bind(employeeId, year, month)
      .run()
    return c.json({ data: null })
  }

  await c.env.DB
    .prepare(
      `INSERT INTO hour_bank (id, employee_id, year, month, adjustment_minutes, note, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, datetime('now'))
       ON CONFLICT(employee_id, year, month) DO UPDATE SET
         adjustment_minutes = excluded.adjustment_minutes,
         note               = excluded.note,
         updated_at         = datetime('now')`
    )
    .bind(crypto.randomUUID(), employeeId, year, month, adjustmentMinutes, note ?? null)
    .run()

  const row = await c.env.DB
    .prepare('SELECT * FROM hour_bank WHERE employee_id = ? AND year = ? AND month = ? LIMIT 1')
    .bind(employeeId, year, month)
    .first()

  return c.json({ data: rowToAdjustment(row as Record<string, unknown>) })
})

// GET /reports/dashboard?year=&month=
reports.get('/dashboard', async (c) => {
  const year  = parseInt(c.req.query('year')  ?? String(new Date().getFullYear()))
  const month = parseInt(c.req.query('month') ?? String(new Date().getMonth() + 1))
  const { companyId } = c.get('user')

  const startDate = `${year}-${String(month).padStart(2, '0')}-01`
  const endDate   = `${year}-${String(month).padStart(2, '0')}-31`

  type EmpRow   = { id: string; name: string; role: string; cpf: string | null; admission_date: string }
  type EntryRow = { employee_id: string; day_type: string; worked_minutes: number | null; extra_minutes: number | null; missing_minutes: number | null }

  const [employeesResult, entriesResult, accumulatedBeforeMonth, currentAdjustmentsResult] = await Promise.all([
    c.env.DB
      .prepare('SELECT id, name, role, cpf, admission_date FROM employees WHERE company_id = ? AND active = 1 ORDER BY name ASC')
      .bind(companyId)
      .all(),
    c.env.DB
      .prepare(
        `SELECT te.employee_id, te.day_type, te.worked_minutes, te.extra_minutes, te.missing_minutes
         FROM time_entries te
         JOIN employees e ON e.id = te.employee_id
         WHERE e.company_id = ? AND te.entry_date >= ? AND te.entry_date <= ?`
      )
      .bind(companyId, startDate, endDate)
      .all(),
    getAccumulatedBeforeMonthByCompany(c.env.DB, companyId, year, month),
    c.env.DB
      .prepare(
        `SELECT hb.employee_id, hb.adjustment_minutes
         FROM hour_bank hb
         JOIN employees e ON e.id = hb.employee_id
         WHERE e.company_id = ? AND hb.year = ? AND hb.month = ?`
      )
      .bind(companyId, year, month)
      .all(),
  ])

  const employees = employeesResult.results as EmpRow[]
  const entries   = entriesResult.results as EntryRow[]

  const currentAdjustments: Record<string, number> = {}
  for (const row of currentAdjustmentsResult.results as { employee_id: string; adjustment_minutes: number }[]) {
    currentAdjustments[row.employee_id] = row.adjustment_minutes
  }

  type Stats = {
    workedDays: number
    workedMinutes: number
    extraMinutes: number
    missingMinutes: number
    absences: number        // faltas sem justificativa
    medicalDays: number     // atestados
    vacationDays: number    // férias
    holidays: number        // feriados
    bancoHorasDays: number  // dias de folga por banco de horas
    prevAccumulated: number
  }

  const stats: Record<string, Stats> = {}
  for (const emp of employees) {
    stats[emp.id] = {
      workedDays: 0, workedMinutes: 0, extraMinutes: 0, missingMinutes: 0,
      absences: 0, medicalDays: 0, vacationDays: 0, holidays: 0, bancoHorasDays: 0,
      prevAccumulated: accumulatedBeforeMonth[emp.id] ?? 0,
    }
  }

  for (const e of entries) {
    const s = stats[e.employee_id]
    if (!s) continue
    s.workedMinutes  += e.worked_minutes  ?? 0
    s.extraMinutes   += e.extra_minutes   ?? 0
    s.missingMinutes += e.missing_minutes ?? 0
    if (e.day_type === 'worked')      s.workedDays++
    if (e.day_type === 'absence')     s.absences++
    if (e.day_type === 'medical')     s.medicalDays++
    if (e.day_type === 'vacation')    s.vacationDays++
    if (e.day_type === 'holiday')     s.holidays++
    if (e.day_type === 'banco_horas') s.bancoHorasDays++
  }

  return c.json({
    data: {
      year, month,
      totalEmployees: employees.length,
      employees: employees.map(emp => {
        const s = stats[emp.id]!
        const monthBalance = s.extraMinutes - s.missingMinutes
        return {
          id: emp.id,
          name: emp.name,
          role: emp.role,
          cpf: emp.cpf,
          admissionDate: emp.admission_date,
          workedDays: s.workedDays,
          workedMinutes: s.workedMinutes,
          extraMinutes: s.extraMinutes,
          missingMinutes: s.missingMinutes,
          absences: s.absences,
          medicalDays: s.medicalDays,
          vacationDays: s.vacationDays,
          holidays: s.holidays,
          bancoHorasDays: s.bancoHorasDays,
          monthBalance,
          accumulatedBalance: s.prevAccumulated + monthBalance + (currentAdjustments[emp.id] ?? 0),
        }
      }),
    },
  })
})

export default reports
```

- [ ] **Step 3: Type-check**

```bash
./node_modules/.bin/tsc --noEmit -p apps/api/tsconfig.json
```
Expected: no errors.

- [ ] **Step 4: Manual smoke test against local D1**

Start the API (in `apps/api/`):
```bash
pnpm dev
```
In another terminal, log in and probe the new endpoint (uses the seeded admin from `apps/api/src/db/seed.sql` — run `pnpm db:seed` first if you haven't):
```bash
TOKEN=$(curl -s -X POST http://localhost:8787/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"email":"admin@alexandremotos.com.br","password":"Admin@123"}' | jq -r '.data.token')

curl -s -X POST http://localhost:8787/reports/hourbank/adjustment \
  -H "Authorization: Bearer $TOKEN" -H 'Content-Type: application/json' \
  -d '{"employeeId":"emp001","year":2026,"month":1,"adjustmentMinutes":150,"note":"saldo migrado do controle anterior"}'
```
Expected: `{"data":{"id":"...","employeeId":"emp001","year":2026,"month":1,"adjustmentMinutes":150,"note":"saldo migrado do controle anterior",...}}`.

```bash
curl -s "http://localhost:8787/reports/monthly?employeeId=emp001&year=2026&month=2" -H "Authorization: Bearer $TOKEN" | jq '.data.previousMonthAccumulated'
```
Expected: `150` (the January adjustment flows into February automatically, no "close" step involved).

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/routes/reports.ts
git commit -m "feat: compute hour-bank balance live and add manual adjustment endpoint"
```

---

### Task 5: Frontend — `reportsApi` client

**Files:**
- Modify: `apps/web/src/lib/api.ts:1` (imports) and `:82-92` (`reportsApi`)

- [ ] **Step 1: Import the shared type**

At the top of `apps/web/src/lib/api.ts`, add:

```ts
import type { HourBankAdjustment } from '@ponto/shared'
```

- [ ] **Step 2: Replace the `reportsApi` object**

Replace lines 82-92:

```ts
export const reportsApi = {
  monthly: (employeeId: string, year: number, month: number) =>
    request<{ data: unknown }>(`/reports/monthly?employeeId=${employeeId}&year=${year}&month=${month}`),
  hourBank: (employeeId: string) =>
    request<{ data: HourBankAdjustment[] }>(`/reports/hourbank?employeeId=${employeeId}`),
  dashboard: (year: number, month: number) =>
    request<{ data: unknown }>(`/reports/dashboard?year=${year}&month=${month}`),
  setAdjustment: (employeeId: string, year: number, month: number, adjustmentMinutes: number, note: string | null) =>
    request<{ data: HourBankAdjustment | null }>('/reports/hourbank/adjustment', {
      method: 'POST',
      body: JSON.stringify({ employeeId, year, month, adjustmentMinutes, note }),
    }),
}
```

- [ ] **Step 3: Type-check**

Run from `apps/web/`:
```bash
./node_modules/.bin/tsc -b .
```
Expected: fails at this point — `ReportsPage.tsx` still calls `reportsApi.closeMonth` (Task 6 fixes this). Confirm the *only* error is about `closeMonth` not existing on `reportsApi`.

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/lib/api.ts
git commit -m "feat: update reportsApi client for hour-bank adjustments"
```

---

### Task 6: Frontend — ReportsPage: replace "Fechar Mês" with "Ajuste de Banco de Horas"

**Files:**
- Modify: `apps/web/src/pages/reports/ReportsPage.tsx` (full file)

- [ ] **Step 1: Update imports and remove the old `HourBankRecord` interface**

Replace lines 1-28:

```tsx
import { useEffect, useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { PDFDownloadLink } from '@react-pdf/renderer'
import { format } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { employeesApi, reportsApi } from '@/lib/api'
import type { Employee, MonthlyReport, HourBankAdjustment } from '@ponto/shared'
import { minutesToTime } from '@ponto/shared'
import { useAuthStore } from '@/store/auth'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { TimesheetPDF } from '@/components/pdf/TimesheetPDF'
import { toast } from '@/hooks/use-toast'
import { FileDown, ChevronLeft, ChevronRight, AlertCircle, History } from 'lucide-react'

function parseHoursInput(input: string): number | null {
  const trimmed = input.trim()
  if (trimmed === '') return 0
  const match = /^([+-]?)(\d{1,3}):(\d{2})$/.exec(trimmed)
  if (!match) return null
  const sign = match[1] === '-' ? -1 : 1
  const hours = Number(match[2])
  const minutes = Number(match[3])
  return sign * (hours * 60 + minutes)
}
```

- [ ] **Step 2: Replace `canClose`/state setup and the `closeMutation`**

Replace lines 30-71 (component body through the end of `closeMutation`):

```tsx
export function ReportsPage() {
  const { user } = useAuthStore()
  const queryClient = useQueryClient()
  const canAdjust = user?.role === 'admin' || user?.role === 'manager'

  const [selectedEmployeeId, setSelectedEmployeeId] = useState('')
  const [currentYear, setCurrentYear] = useState(new Date().getFullYear())
  const [currentMonth, setCurrentMonth] = useState(new Date().getMonth() + 1)
  const [adjustmentInput, setAdjustmentInput] = useState('')
  const [adjustmentNote, setAdjustmentNote] = useState('')

  const { data: employeesData } = useQuery({
    queryKey: ['employees'],
    queryFn: () => employeesApi.list(),
  })

  const employees = (employeesData?.data ?? []) as Employee[]

  const { data: reportData, isLoading } = useQuery({
    queryKey: ['reports', 'monthly', selectedEmployeeId, currentYear, currentMonth],
    queryFn: () => reportsApi.monthly(selectedEmployeeId, currentYear, currentMonth),
    enabled: Boolean(selectedEmployeeId),
  })

  const report = reportData?.data as MonthlyReport | undefined

  const { data: hourBankData } = useQuery({
    queryKey: ['reports', 'hourbank', selectedEmployeeId],
    queryFn: () => reportsApi.hourBank(selectedEmployeeId),
    enabled: Boolean(selectedEmployeeId),
  })

  const hourBankRecords = (hourBankData?.data ?? []) as HourBankAdjustment[]
  const currentMonthBank = hourBankRecords.find(r => r.year === currentYear && r.month === currentMonth)

  useEffect(() => {
    const minutes = currentMonthBank?.adjustmentMinutes ?? 0
    setAdjustmentInput(minutes === 0 ? '' : (minutes > 0 ? '+' : '') + minutesToTime(minutes))
    setAdjustmentNote(currentMonthBank?.note ?? '')
  }, [selectedEmployeeId, currentYear, currentMonth, currentMonthBank])

  const adjustMutation = useMutation({
    mutationFn: () => {
      const minutes = parseHoursInput(adjustmentInput)
      if (minutes === null) throw new Error('Formato inválido. Use +HH:MM ou -HH:MM')
      return reportsApi.setAdjustment(selectedEmployeeId, currentYear, currentMonth, minutes, adjustmentNote || null)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['reports', 'hourbank', selectedEmployeeId] })
      queryClient.invalidateQueries({ queryKey: ['reports', 'monthly', selectedEmployeeId] })
      toast({ title: 'Ajuste salvo!', variant: 'success' })
    },
    onError: (err: Error) => toast({ title: err.message, variant: 'destructive' }),
  })
```

- [ ] **Step 3: Remove the "Fechado" badge from the PDF export card**

Find (originally around lines 190-203):

```tsx
                <Badge variant="outline">{report.entries.length} registros</Badge>
                {currentMonthBank?.closed === 1 && (
                  <Badge variant="outline" className="text-success border-success/40">
                    <Lock className="h-3 w-3 mr-1" />
                    Fechado
                  </Badge>
                )}
              </div>
```

Replace with:

```tsx
                <Badge variant="outline">{report.entries.length} registros</Badge>
              </div>
```

- [ ] **Step 4: Replace the "Fechar Mês" card with "Ajuste de Banco de Horas"**

Replace the whole card block (originally lines 207-261, from `{/* Fechar Mês */}` through its closing `)}`):

```tsx
          {/* Ajuste de Banco de Horas */}
          {canAdjust && (
            <Card>
              <CardHeader className="py-4">
                <CardTitle className="text-base">Ajuste de Banco de Horas</CardTitle>
                <p className="text-sm text-muted-foreground mt-0.5 capitalize">
                  Lança um ajuste manual de saldo para {monthLabel} — use para injetar saldo de meses
                  anteriores ao uso do sistema ou corrigir divergências.
                </p>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex flex-wrap items-end gap-3">
                  <div>
                    <label className="text-xs text-muted-foreground block mb-1" htmlFor="adjustment-minutes">
                      Horas (±HH:MM)
                    </label>
                    <Input
                      id="adjustment-minutes"
                      className="h-9 w-32 font-mono"
                      placeholder="+02:30"
                      value={adjustmentInput}
                      onChange={(e) => setAdjustmentInput(e.target.value)}
                    />
                  </div>
                  <div className="flex-1 min-w-48">
                    <label className="text-xs text-muted-foreground block mb-1" htmlFor="adjustment-note">
                      Observação
                    </label>
                    <Input
                      id="adjustment-note"
                      className="h-9"
                      placeholder="Ex: saldo migrado do controle anterior"
                      value={adjustmentNote}
                      onChange={(e) => setAdjustmentNote(e.target.value)}
                    />
                  </div>
                  <Button size="sm" onClick={() => adjustMutation.mutate()} disabled={adjustMutation.isPending}>
                    {adjustMutation.isPending ? 'Salvando...' : 'Salvar Ajuste'}
                  </Button>
                </div>

                {hourBankRecords.length > 0 && (
                  <div>
                    <div className="flex items-center gap-2 mb-3">
                      <History className="h-4 w-4 text-muted-foreground" />
                      <span className="text-sm font-medium">Histórico de Ajustes</span>
                    </div>
                    <div className="space-y-1">
                      {hourBankRecords.slice(0, 12).map((r) => {
                        const monthName = new Date(r.year, r.month - 1).toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })
                        return (
                          <div key={r.id} className="flex items-center justify-between py-1.5 text-sm border-b last:border-0">
                            <span className="capitalize text-muted-foreground">{monthName}</span>
                            <div className="flex items-center gap-4">
                              {r.note && <span className="text-xs text-muted-foreground italic">{r.note}</span>}
                              <span className={`font-mono font-medium text-xs w-16 text-right ${r.adjustmentMinutes >= 0 ? 'text-success' : 'text-destructive'}`}>
                                {r.adjustmentMinutes >= 0 ? '+' : ''}{minutesToTime(r.adjustmentMinutes)}
                              </span>
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          )}
```

- [ ] **Step 5: Type-check**

```bash
cd apps/web && ./node_modules/.bin/tsc -b .
```
Expected: no errors.

- [ ] **Step 6: Manual browser verification**

With `pnpm dev` running for both `apps/api` and `apps/web`:
1. Log in, go to **Relatórios**, pick a funcionário, navigate to Janeiro/2026.
2. In "Ajuste de Banco de Horas", enter `+02:30`, a note, click **Salvar Ajuste** — toast "Ajuste salvo!" appears, "Histórico de Ajustes" shows the new row.
3. Navigate to Fevereiro/2026 — confirm "Saldo Acumulado" in the summary cards already reflects the January adjustment, without clicking anything else.
4. Clear the hours field back to empty and click **Salvar Ajuste** again on Janeiro — confirm the row disappears from "Histórico de Ajustes" and February's accumulated balance drops back accordingly.

- [ ] **Step 7: Commit**

```bash
git add apps/web/src/pages/reports/ReportsPage.tsx
git commit -m "feat: replace month closing with manual hour-bank adjustments in ReportsPage"
```

---

### Task 7: Frontend — TimesheetPage: inline balance warning for `banco_horas`

**Files:**
- Modify: `apps/web/src/pages/timesheet/TimesheetPage.tsx` (full file)

- [ ] **Step 1: Add imports**

Replace lines 1-16:

```tsx
import { Fragment, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { format, getDaysInMonth } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { employeesApi, timeEntriesApi, reportsApi } from '@/lib/api'
import { calculateDay, getDayOfWeek, isSunday, isWorkingSaturday, minutesToTime } from '@ponto/shared'
import type { Employee, TimeEntry, DayType, MonthlyReport } from '@ponto/shared'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { ChevronLeft, ChevronRight, Save, AlertCircle } from 'lucide-react'
import { cn } from '@/lib/utils'
import { toast } from '@/hooks/use-toast'
```

- [ ] **Step 2: Fetch the previous accumulated balance**

After the existing `entries` query (originally lines 53-60, right after `const entries = (entriesData?.data ?? []) as TimeEntry[]`), add:

```tsx
  const { data: monthlyReportData } = useQuery({
    queryKey: ['reports', 'monthly', selectedEmployeeId, currentYear, currentMonth],
    queryFn: () => reportsApi.monthly(selectedEmployeeId, currentYear, currentMonth),
    enabled: Boolean(selectedEmployeeId),
  })

  const previousMonthAccumulated = (monthlyReportData?.data as MonthlyReport | undefined)?.previousMonthAccumulated ?? 0
```

- [ ] **Step 3: Compute the warning inside the row map and render it**

In the `rows.map((row) => { ... })` block, right after the existing `preview` computation (`const preview = isEditing && fd && selectedEmployee ? calculateDay(...) : null`), add:

```tsx
                      const bancoHorasWarning = isEditing && fd?.dayType === 'banco_horas' && preview
                        ? (() => {
                            const otherEntriesBalance = entries
                              .filter((e) => e.entryDate !== row.date)
                              .reduce((sum, e) => sum + (e.extraMinutes ?? 0) - (e.missingMinutes ?? 0), 0)
                            const saldoAntes = previousMonthAccumulated + otherEntriesBalance
                            const consumo = preview.missingMinutes
                            return saldoAntes < consumo
                              ? { saldoAntes, consumo, saldoDepois: saldoAntes - consumo }
                              : null
                          })()
                        : null
```

Then change the row's `return (` to wrap the `<tr>` in a `Fragment` and add the warning row right after it. Replace:

```tsx
                      return (
                        <tr
                          key={row.date}
```

with:

```tsx
                      return (
                        <Fragment key={row.date}>
                        <tr
```

And replace the closing of that `<tr>` block:

```tsx
                        </tr>
                      )
                    })}
```

with:

```tsx
                        </tr>
                        {bancoHorasWarning && (
                          <tr className="bg-destructive/5">
                            <td colSpan={11} className="px-4 py-1.5 text-xs text-destructive">
                              <span className="inline-flex items-center gap-1.5">
                                <AlertCircle className="h-3.5 w-3.5 shrink-0" />
                                Saldo insuficiente: disponível {minutesToTime(bancoHorasWarning.saldoAntes)}, este dia consome{' '}
                                {minutesToTime(bancoHorasWarning.consumo)}. Saldo ficará{' '}
                                {bancoHorasWarning.saldoDepois >= 0 ? '+' : ''}{minutesToTime(bancoHorasWarning.saldoDepois)}.
                              </span>
                            </td>
                          </tr>
                        )}
                        </Fragment>
                      )
                    })}
```

- [ ] **Step 4: Type-check**

```bash
cd apps/web && ./node_modules/.bin/tsc -b .
```
Expected: no errors.

- [ ] **Step 5: Manual browser verification**

1. Go to **Lançamento de Ponto**, pick the same funcionário used in Task 6 (with the `+02:30` January adjustment restored, if you cleared it — re-add it via Reports first), select Fevereiro/2026.
2. Edit any day, change "Tipo" to "Banco de Horas".
3. If the employee has < 8h available before that day, confirm the red inline warning row appears below, showing "Saldo insuficiente: disponível ..., este dia consome ..., Saldo ficará ...", and that clicking the save (✓) button still works (not blocked).
4. Change "Tipo" back to "Dia Trabalhado" — confirm the warning row disappears immediately.

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/pages/timesheet/TimesheetPage.tsx
git commit -m "feat: warn inline when banco_horas balance is insufficient"
```

---

### Task 8: Final verification and production migration note

**Files:** none (verification only)

- [ ] **Step 1: Full type-check**

```bash
./node_modules/.bin/tsc --noEmit -p apps/api/tsconfig.json
cd apps/web && ./node_modules/.bin/tsc -b . && cd ../..
```
Expected: no errors in either.

- [ ] **Step 2: Confirm no leftover references to removed API surface**

```bash
grep -rn "closeMonth\|hourbank/close\|\.closed\b" apps/web/src apps/api/src
```
Expected: no matches (aside from unrelated hits, inspect any and confirm they're unrelated to hour-bank closing).

- [ ] **Step 3: End-to-end manual walkthrough**

With `pnpm dev` running for `apps/api` and `apps/web`:
1. Reports → pick a funcionário with no adjustments and no entries in, say, Março/2025 → set an adjustment of `-01:00` with note "ajuste teste" → save.
2. Navigate forward to a month that already has real `time_entries` for that employee → confirm "Saldo Acumulado" is exactly `1:00` lower than it was before the adjustment.
3. Timesheet → mark a day as "Banco de Horas" for an employee whose accumulated balance is known to be less than a full day → confirm the inline warning shows correct numbers and the entry still saves.
4. Dashboard → confirm the employee's "saldo acumulado" card matches the same figure shown in Reports for the current month.

- [ ] **Step 4: Note for the user (do not run without explicit approval)**

Migration `003_hour_bank_adjustments.sql` must be applied to the **production** D1 database before this deploys, since it drops and recreates `hour_bank`:
```bash
cd apps/api && pnpm db:migrate:prod
```
This is a destructive, hard-to-reverse action against the production database — flag it to the user and only run it with their explicit go-ahead, after this branch is merged/deployed.
