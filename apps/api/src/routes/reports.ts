import { Hono } from 'hono'
import { monthQuerySchema, calculateMonthlySummary } from '@ponto/shared'
import type { TimeEntry } from '@ponto/shared'
import type { Env } from '../lib/types'
import type { AuthContext } from '../middleware/auth'
import { authMiddleware, requireRole } from '../middleware/auth'

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

  const [entriesResult, prevBankRow] = await Promise.all([
    c.env.DB
      .prepare(
        `SELECT * FROM time_entries
         WHERE employee_id = ? AND entry_date >= ? AND entry_date <= ?
         ORDER BY entry_date ASC`
      )
      .bind(employeeId, startDate, endDate)
      .all(),
    // Previous month's accumulated balance
    c.env.DB
      .prepare(
        `SELECT accumulated_minutes FROM hour_bank
         WHERE employee_id = ? AND (year < ? OR (year = ? AND month < ?))
         ORDER BY year DESC, month DESC LIMIT 1`
      )
      .bind(employeeId, year, year, month)
      .first<{ accumulated_minutes: number }>(),
  ])

  const entries = entriesResult.results.map(r => rowToEntry(r as Record<string, unknown>))
  const summary = calculateMonthlySummary(entries)
  const previousAccumulated = prevBankRow?.accumulated_minutes ?? 0
  const accumulatedMinutes = previousAccumulated + summary.balanceMinutes

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

  return c.json({ data: rows.results })
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
  type BankRow  = { employee_id: string; balance_minutes: number; accumulated_minutes: number }

  const [employeesResult, entriesResult, bankResult] = await Promise.all([
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
    // Saldo acumulado até o mês anterior (banco de horas fechado)
    c.env.DB
      .prepare(
        `SELECT hb.employee_id, hb.balance_minutes, hb.accumulated_minutes
         FROM hour_bank hb
         JOIN employees e ON e.id = hb.employee_id
         WHERE e.company_id = ?
           AND (hb.year < ? OR (hb.year = ? AND hb.month < ?))
         ORDER BY hb.year DESC, hb.month DESC`
      )
      .bind(companyId, year, year, month)
      .all(),
  ])

  const employees = employeesResult.results as EmpRow[]
  const entries   = entriesResult.results as EntryRow[]
  const bankRows  = bankResult.results as BankRow[]

  // Pega o acumulado anterior mais recente por funcionário
  const prevAccumulated: Record<string, number> = {}
  for (const b of bankRows) {
    if (prevAccumulated[b.employee_id] === undefined) {
      prevAccumulated[b.employee_id] = b.accumulated_minutes
    }
  }

  type Stats = {
    workedDays: number
    workedMinutes: number
    extraMinutes: number
    missingMinutes: number
    absences: number      // faltas sem justificativa
    medicalDays: number   // atestados
    vacationDays: number  // férias
    holidays: number      // feriados
    prevAccumulated: number
  }

  const stats: Record<string, Stats> = {}
  for (const emp of employees) {
    stats[emp.id] = {
      workedDays: 0, workedMinutes: 0, extraMinutes: 0, missingMinutes: 0,
      absences: 0, medicalDays: 0, vacationDays: 0, holidays: 0,
      prevAccumulated: prevAccumulated[emp.id] ?? 0,
    }
  }

  for (const e of entries) {
    const s = stats[e.employee_id]
    if (!s) continue
    s.workedMinutes  += e.worked_minutes  ?? 0
    s.extraMinutes   += e.extra_minutes   ?? 0
    s.missingMinutes += e.missing_minutes ?? 0
    if (e.day_type === 'worked')   s.workedDays++
    if (e.day_type === 'absence')  s.absences++
    if (e.day_type === 'medical')  s.medicalDays++
    if (e.day_type === 'vacation') s.vacationDays++
    if (e.day_type === 'holiday')  s.holidays++
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
          monthBalance,
          accumulatedBalance: s.prevAccumulated + monthBalance,
        }
      }),
    },
  })
})

// POST /reports/hourbank/close
reports.post('/hourbank/close', requireRole('admin', 'manager'), async (c) => {
  const body = await c.req.json().catch(() => null)
  const parsed = monthQuerySchema.safeParse(body)
  if (!parsed.success) {
    return c.json({ error: 'Dados inválidos', code: 'VALIDATION_ERROR' }, 400)
  }

  const { employeeId, year, month } = parsed.data
  const { companyId } = c.get('user')

  const employee = await c.env.DB
    .prepare('SELECT id FROM employees WHERE id = ? AND company_id = ? LIMIT 1')
    .bind(employeeId, companyId)
    .first()

  if (!employee) return c.json({ error: 'Funcionário não encontrado', code: 'NOT_FOUND' }, 404)

  const startDate = `${year}-${String(month).padStart(2, '0')}-01`
  const endDate   = `${year}-${String(month).padStart(2, '0')}-31`

  const [entriesResult, prevBankRow] = await Promise.all([
    c.env.DB
      .prepare('SELECT * FROM time_entries WHERE employee_id = ? AND entry_date >= ? AND entry_date <= ?')
      .bind(employeeId, startDate, endDate)
      .all(),
    c.env.DB
      .prepare(
        `SELECT accumulated_minutes FROM hour_bank
         WHERE employee_id = ? AND (year < ? OR (year = ? AND month < ?))
         ORDER BY year DESC, month DESC LIMIT 1`
      )
      .bind(employeeId, year, year, month)
      .first<{ accumulated_minutes: number }>(),
  ])

  const entries = entriesResult.results.map(r => rowToEntry(r as Record<string, unknown>))
  const summary = calculateMonthlySummary(entries)
  const prevAccumulated = prevBankRow?.accumulated_minutes ?? 0
  const balanceMinutes = summary.totalExtraMinutes - summary.totalMissingMinutes
  const accumulatedMinutes = prevAccumulated + balanceMinutes

  await c.env.DB
    .prepare(
      `INSERT INTO hour_bank
         (id, employee_id, year, month, total_worked_minutes, total_extra_minutes,
          total_missing_minutes, balance_minutes, accumulated_minutes, closed, closed_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 1, datetime('now'), datetime('now'))
       ON CONFLICT(employee_id, year, month) DO UPDATE SET
         total_worked_minutes  = excluded.total_worked_minutes,
         total_extra_minutes   = excluded.total_extra_minutes,
         total_missing_minutes = excluded.total_missing_minutes,
         balance_minutes       = excluded.balance_minutes,
         accumulated_minutes   = excluded.accumulated_minutes,
         closed                = 1,
         closed_at             = datetime('now'),
         updated_at            = datetime('now')`
    )
    .bind(
      crypto.randomUUID(), employeeId, year, month,
      summary.totalWorkedMinutes, summary.totalExtraMinutes,
      summary.totalMissingMinutes, balanceMinutes, accumulatedMinutes
    )
    .run()

  const row = await c.env.DB
    .prepare('SELECT * FROM hour_bank WHERE employee_id = ? AND year = ? AND month = ? LIMIT 1')
    .bind(employeeId, year, month)
    .first()

  return c.json({ data: row })
})

export default reports
