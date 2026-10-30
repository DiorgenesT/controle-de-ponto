import { Hono } from 'hono'
import {
  upsertTimeEntrySchema, monthQuerySchema, calculateDay, resolveBankTreatment, setBankTreatmentSchema, bulkBankTreatmentSchema,
} from '@ponto/shared'
import type { Employee, SaturdayMode, BankTreatment, DayType } from '@ponto/shared'
import type { Env } from '../lib/types'
import type { AuthContext } from '../middleware/auth'
import { rowToEntry } from '../lib/rows'
import { authMiddleware, requireRole } from '../middleware/auth'

const timeEntries = new Hono<{ Bindings: Env } & AuthContext>()

timeEntries.use('*', authMiddleware)

// GET /timeentries?employeeId=&year=&month=
timeEntries.get('/', async (c) => {
  const parsed = monthQuerySchema.safeParse({
    employeeId: c.req.query('employeeId'),
    year: c.req.query('year'),
    month: c.req.query('month'),
  })

  if (!parsed.success) {
    return c.json({ error: 'Parâmetros inválidos', code: 'VALIDATION_ERROR', details: parsed.error.flatten() }, 400)
  }

  const { employeeId, year, month } = parsed.data
  const { companyId } = c.get('user')

  // Verify employee belongs to company
  const employee = await c.env.DB
    .prepare('SELECT id FROM employees WHERE id = ? AND company_id = ? LIMIT 1')
    .bind(employeeId, companyId)
    .first()

  if (!employee) return c.json({ error: 'Funcionário não encontrado', code: 'NOT_FOUND' }, 404)

  const startDate = `${year}-${String(month).padStart(2, '0')}-01`
  const endDate   = `${year}-${String(month).padStart(2, '0')}-31`

  const rows = await c.env.DB
    .prepare(
      `SELECT * FROM time_entries
       WHERE employee_id = ? AND entry_date >= ? AND entry_date <= ?
       ORDER BY entry_date ASC`
    )
    .bind(employeeId, startDate, endDate)
    .all()

  return c.json({ data: rows.results.map(r => rowToEntry(r as Record<string, unknown>)) })
})

// POST /timeentries  (upsert by employee_id + entry_date)
timeEntries.post('/', requireRole('admin', 'manager'), async (c) => {
  const body = await c.req.json().catch(() => null)
  const parsed = upsertTimeEntrySchema.safeParse(body)

  if (!parsed.success) {
    return c.json({ error: 'Dados inválidos', code: 'VALIDATION_ERROR', details: parsed.error.flatten() }, 400)
  }

  const { companyId } = c.get('user')
  const d = parsed.data

  // Verify employee belongs to company
  const employeeRow = await c.env.DB
    .prepare('SELECT * FROM employees WHERE id = ? AND company_id = ? LIMIT 1')
    .bind(d.employeeId, companyId)
    .first()

  if (!employeeRow) return c.json({ error: 'Funcionário não encontrado', code: 'NOT_FOUND' }, 404)
  if (employeeRow.active !== 1) {
    return c.json({ error: 'Funcionário desativado não recebe lançamentos', code: 'EMPLOYEE_INACTIVE' }, 400)
  }

  const emp: Pick<Employee, 'toleranceMinutes' | 'dailyHoursExpected' | 'saturdayMode' | 'saturdayStart' | 'saturdayEnd'> = {
    toleranceMinutes: employeeRow.tolerance_minutes as number,
    dailyHoursExpected: employeeRow.daily_hours_expected as number,
    saturdayMode: ((employeeRow.saturday_mode as string | null) ?? 'all') as SaturdayMode,
    saturdayStart: (employeeRow.saturday_start as string | null) ?? null,
    saturdayEnd: (employeeRow.saturday_end as string | null) ?? null,
  }

  // Calculate hours
  const calc = calculateDay(
    {
      clockIn: d.clockIn ?? null,
      lunchOut: d.lunchOut ?? null,
      lunchReturn: d.lunchReturn ?? null,
      clockOut: d.clockOut ?? null,
      dayType: d.dayType,
      entryDate: d.entryDate,
    },
    emp
  )

  const [existingRow, companyRow] = await Promise.all([
    c.env.DB
      .prepare('SELECT day_type, bank_treatment FROM time_entries WHERE employee_id = ? AND entry_date = ? LIMIT 1')
      .bind(d.employeeId, d.entryDate)
      .first<{ day_type: DayType; bank_treatment: BankTreatment }>(),
    c.env.DB
      .prepare('SELECT absence_treatment_default FROM companies WHERE id = ? LIMIT 1')
      .bind(companyId)
      .first<{ absence_treatment_default: BankTreatment }>(),
  ])

  const bankTreatment = resolveBankTreatment({
    dayType: d.dayType,
    requested: d.bankTreatment,
    canDecide: true,  // route already restricted to admin/manager
    existing: existingRow ? { dayType: existingRow.day_type, bankTreatment: existingRow.bank_treatment } : null,
    absenceDefault: companyRow?.absence_treatment_default ?? 'bank',
  })

  const now = new Date().toISOString()
  const id = crypto.randomUUID()

  await c.env.DB
    .prepare(
      `INSERT INTO time_entries
        (id, employee_id, entry_date, clock_in, lunch_out, lunch_return, clock_out,
         day_type, notes, worked_minutes, extra_minutes, missing_minutes, bank_treatment, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(employee_id, entry_date) DO UPDATE SET
         clock_in         = excluded.clock_in,
         lunch_out        = excluded.lunch_out,
         lunch_return     = excluded.lunch_return,
         clock_out        = excluded.clock_out,
         day_type         = excluded.day_type,
         notes            = excluded.notes,
         worked_minutes   = excluded.worked_minutes,
         extra_minutes    = excluded.extra_minutes,
         missing_minutes  = excluded.missing_minutes,
         bank_treatment   = excluded.bank_treatment,
         updated_at       = excluded.updated_at`
    )
    .bind(
      id, d.employeeId, d.entryDate,
      d.clockIn ?? null, d.lunchOut ?? null, d.lunchReturn ?? null, d.clockOut ?? null,
      d.dayType, d.notes ?? null,
      calc.workedMinutes, calc.extraMinutes, calc.missingMinutes, bankTreatment,
      now, now
    )
    .run()

  const row = await c.env.DB
    .prepare('SELECT * FROM time_entries WHERE employee_id = ? AND entry_date = ? LIMIT 1')
    .bind(d.employeeId, d.entryDate)
    .first()

  return c.json({ data: rowToEntry(row as Record<string, unknown>) }, 201)
})

// POST /timeentries/recalculate  (re-applies the employee's current schedule/tolerance to a month)
timeEntries.post('/recalculate', requireRole('admin', 'manager'), async (c) => {
  const body = await c.req.json().catch(() => null)
  const parsed = monthQuerySchema.safeParse(body)
  if (!parsed.success) {
    return c.json({ error: 'Dados inválidos', code: 'VALIDATION_ERROR', details: parsed.error.flatten() }, 400)
  }

  const { employeeId, year, month } = parsed.data
  const { companyId } = c.get('user')

  const employeeRow = await c.env.DB
    .prepare('SELECT * FROM employees WHERE id = ? AND company_id = ? LIMIT 1')
    .bind(employeeId, companyId)
    .first()
  if (!employeeRow) return c.json({ error: 'Funcionário não encontrado', code: 'NOT_FOUND' }, 404)

  const emp: Pick<Employee, 'toleranceMinutes' | 'dailyHoursExpected' | 'saturdayMode' | 'saturdayStart' | 'saturdayEnd'> = {
    toleranceMinutes: employeeRow.tolerance_minutes as number,
    dailyHoursExpected: employeeRow.daily_hours_expected as number,
    saturdayMode: ((employeeRow.saturday_mode as string | null) ?? 'all') as SaturdayMode,
    saturdayStart: (employeeRow.saturday_start as string | null) ?? null,
    saturdayEnd: (employeeRow.saturday_end as string | null) ?? null,
  }

  const startDate = `${year}-${String(month).padStart(2, '0')}-01`
  const endDate   = `${year}-${String(month).padStart(2, '0')}-31`
  const rows = await c.env.DB
    .prepare('SELECT * FROM time_entries WHERE employee_id = ? AND entry_date >= ? AND entry_date <= ?')
    .bind(employeeId, startDate, endDate)
    .all()

  const now = new Date().toISOString()
  const updates = rows.results
    .map((r) => rowToEntry(r as Record<string, unknown>))
    .map((entry) => ({ entry, calc: calculateDay(entry, emp) }))
    .filter(({ entry, calc }) =>
      entry.workedMinutes !== calc.workedMinutes ||
      entry.extraMinutes !== calc.extraMinutes ||
      entry.missingMinutes !== calc.missingMinutes
    )
    .map(({ entry, calc }) =>
      c.env.DB
        .prepare('UPDATE time_entries SET worked_minutes = ?, extra_minutes = ?, missing_minutes = ?, updated_at = ? WHERE id = ?')
        .bind(calc.workedMinutes, calc.extraMinutes, calc.missingMinutes, now, entry.id)
    )

  if (updates.length > 0) await c.env.DB.batch(updates)

  return c.json({ data: { updated: updates.length } })
})

// PATCH /timeentries/bank-treatment  (bulk: reclassify a month's entries of the given day types)
timeEntries.patch('/bank-treatment', requireRole('admin', 'manager'), async (c) => {
  const body = await c.req.json().catch(() => null)
  const parsed = bulkBankTreatmentSchema.safeParse(body)
  if (!parsed.success) {
    return c.json({ error: 'Dados inválidos', code: 'VALIDATION_ERROR', details: parsed.error.flatten() }, 400)
  }

  const { employeeId, year, month, dayTypes, bankTreatment } = parsed.data
  const { companyId } = c.get('user')

  const employee = await c.env.DB
    .prepare('SELECT id FROM employees WHERE id = ? AND company_id = ? LIMIT 1')
    .bind(employeeId, companyId)
    .first()
  if (!employee) return c.json({ error: 'Funcionário não encontrado', code: 'NOT_FOUND' }, 404)

  const startDate = `${year}-${String(month).padStart(2, '0')}-01`
  const endDate   = `${year}-${String(month).padStart(2, '0')}-31`
  const placeholders = dayTypes.map(() => '?').join(', ')

  const result = await c.env.DB
    .prepare(
      `UPDATE time_entries SET bank_treatment = ?, updated_at = ?
       WHERE employee_id = ? AND entry_date >= ? AND entry_date <= ?
         AND day_type IN (${placeholders}) AND bank_treatment <> ?`
    )
    .bind(bankTreatment, new Date().toISOString(), employeeId, startDate, endDate, ...dayTypes, bankTreatment)
    .run()

  return c.json({ data: { updated: result.meta.changes ?? 0 } })
})

// PATCH /timeentries/:id/bank-treatment
timeEntries.patch('/:id/bank-treatment', requireRole('admin', 'manager'), async (c) => {
  const body = await c.req.json().catch(() => null)
  const parsed = setBankTreatmentSchema.safeParse(body)
  if (!parsed.success) {
    return c.json({ error: 'Dados inválidos', code: 'VALIDATION_ERROR', details: parsed.error.flatten() }, 400)
  }

  const { companyId } = c.get('user')
  const { id } = c.req.param()

  const row = await c.env.DB
    .prepare(
      `SELECT te.day_type FROM time_entries te
       JOIN employees e ON e.id = te.employee_id
       WHERE te.id = ? AND e.company_id = ? LIMIT 1`
    )
    .bind(id, companyId)
    .first<{ day_type: DayType }>()

  if (!row) return c.json({ error: 'Registro não encontrado', code: 'NOT_FOUND' }, 404)
  if (row.day_type === 'banco_horas') {
    return c.json({ error: 'Folga de banco de horas sempre debita o banco', code: 'INVALID_TREATMENT' }, 400)
  }

  await c.env.DB
    .prepare('UPDATE time_entries SET bank_treatment = ?, updated_at = ? WHERE id = ?')
    .bind(parsed.data.bankTreatment, new Date().toISOString(), id)
    .run()

  const updated = await c.env.DB.prepare('SELECT * FROM time_entries WHERE id = ? LIMIT 1').bind(id).first()
  return c.json({ data: rowToEntry(updated as Record<string, unknown>) })
})

// DELETE /timeentries/:id
timeEntries.delete('/:id', requireRole('admin', 'manager'), async (c) => {
  const { companyId } = c.get('user')
  const { id } = c.req.param()

  const row = await c.env.DB
    .prepare(
      `SELECT te.id FROM time_entries te
       JOIN employees e ON e.id = te.employee_id
       WHERE te.id = ? AND e.company_id = ? LIMIT 1`
    )
    .bind(id, companyId)
    .first()

  if (!row) return c.json({ error: 'Registro não encontrado', code: 'NOT_FOUND' }, 404)

  await c.env.DB.prepare('DELETE FROM time_entries WHERE id = ?').bind(id).run()

  return c.json({ data: { message: 'Registro excluído' } })
})

export default timeEntries
