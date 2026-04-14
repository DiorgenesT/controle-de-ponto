import { Hono } from 'hono'
import { upsertTimeEntrySchema, monthQuerySchema, calculateDay } from '@ponto/shared'
import type { Employee, TimeEntry } from '@ponto/shared'
import type { Env } from '../lib/types'
import type { AuthContext } from '../middleware/auth'
import { authMiddleware } from '../middleware/auth'

const timeEntries = new Hono<{ Bindings: Env } & AuthContext>()

timeEntries.use('*', authMiddleware)

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
timeEntries.post('/', async (c) => {
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

  const emp: Pick<Employee, 'toleranceMinutes' | 'dailyHoursExpected' | 'worksSaturday'> = {
    toleranceMinutes: employeeRow.tolerance_minutes as number,
    dailyHoursExpected: employeeRow.daily_hours_expected as number,
    worksSaturday: employeeRow.works_saturday === 1,
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

  const now = new Date().toISOString()
  const id = crypto.randomUUID()

  await c.env.DB
    .prepare(
      `INSERT INTO time_entries
        (id, employee_id, entry_date, clock_in, lunch_out, lunch_return, clock_out,
         day_type, notes, worked_minutes, extra_minutes, missing_minutes, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
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
         updated_at       = excluded.updated_at`
    )
    .bind(
      id, d.employeeId, d.entryDate,
      d.clockIn ?? null, d.lunchOut ?? null, d.lunchReturn ?? null, d.clockOut ?? null,
      d.dayType, d.notes ?? null,
      calc.workedMinutes, calc.extraMinutes, calc.missingMinutes,
      now, now
    )
    .run()

  const row = await c.env.DB
    .prepare('SELECT * FROM time_entries WHERE employee_id = ? AND entry_date = ? LIMIT 1')
    .bind(d.employeeId, d.entryDate)
    .first()

  return c.json({ data: rowToEntry(row as Record<string, unknown>) }, 201)
})

// DELETE /timeentries/:id
timeEntries.delete('/:id', async (c) => {
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
