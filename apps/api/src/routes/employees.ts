import { Hono } from 'hono'
import { createEmployeeSchema, updateEmployeeSchema } from '@ponto/shared'
import type { Env } from '../lib/types'
import type { AuthContext } from '../middleware/auth'
import { authMiddleware, requireRole } from '../middleware/auth'

const employees = new Hono<{ Bindings: Env } & AuthContext>()

employees.use('*', authMiddleware)

function rowToEmployee(row: Record<string, unknown>) {
  return {
    id: row.id,
    companyId: row.company_id,
    name: row.name,
    role: row.role,
    cpf: row.cpf ?? null,
    admissionDate: row.admission_date,
    weekdayStart: row.weekday_start,
    weekdayEnd: row.weekday_end,
    saturdayStart: row.saturday_start,
    saturdayEnd: row.saturday_end,
    saturdayMode: row.saturday_mode ?? 'all',
    toleranceMinutes: row.tolerance_minutes,
    dailyHoursExpected: row.daily_hours_expected,
    active: row.active === 1,
    createdAt: row.created_at,
  }
}

// GET /employees
employees.get('/', async (c) => {
  const { companyId } = c.get('user')
  const includeInactive = c.req.query('includeInactive') === 'true'

  const rows = await c.env.DB
    .prepare(
      `SELECT * FROM employees WHERE company_id = ?${includeInactive ? '' : ' AND active = 1'} ORDER BY name ASC`
    )
    .bind(companyId)
    .all()

  return c.json({ data: rows.results.map(r => rowToEmployee(r as Record<string, unknown>)) })
})

// GET /employees/:id
employees.get('/:id', async (c) => {
  const { companyId } = c.get('user')
  const { id } = c.req.param()

  const row = await c.env.DB
    .prepare('SELECT * FROM employees WHERE id = ? AND company_id = ? LIMIT 1')
    .bind(id, companyId)
    .first()

  if (!row) return c.json({ error: 'Funcionário não encontrado', code: 'NOT_FOUND' }, 404)

  return c.json({ data: rowToEmployee(row as Record<string, unknown>) })
})

// POST /employees
employees.post('/', requireRole('admin', 'manager'), async (c) => {
  const body = await c.req.json().catch(() => null)
  const parsed = createEmployeeSchema.safeParse(body)

  if (!parsed.success) {
    return c.json({ error: 'Dados inválidos', code: 'VALIDATION_ERROR', details: parsed.error.flatten() }, 400)
  }

  const { companyId } = c.get('user')
  const d = parsed.data

  const id = crypto.randomUUID()
  await c.env.DB
    .prepare(
      `INSERT INTO employees
        (id, company_id, name, role, cpf, admission_date, weekday_start, weekday_end,
         saturday_start, saturday_end, saturday_mode, tolerance_minutes, daily_hours_expected)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .bind(
      id, companyId, d.name, d.role, d.cpf ?? null, d.admissionDate,
      d.weekdayStart, d.weekdayEnd,
      d.saturdayStart ?? null, d.saturdayEnd ?? null,
      d.saturdayMode,
      d.toleranceMinutes, d.dailyHoursExpected
    )
    .run()

  const row = await c.env.DB
    .prepare('SELECT * FROM employees WHERE id = ? LIMIT 1')
    .bind(id)
    .first()

  return c.json({ data: rowToEmployee(row as Record<string, unknown>) }, 201)
})

// PUT /employees/:id
employees.put('/:id', requireRole('admin', 'manager'), async (c) => {
  const body = await c.req.json().catch(() => null)
  const parsed = updateEmployeeSchema.safeParse(body)

  if (!parsed.success) {
    return c.json({ error: 'Dados inválidos', code: 'VALIDATION_ERROR', details: parsed.error.flatten() }, 400)
  }

  const { companyId } = c.get('user')
  const { id } = c.req.param()
  const d = parsed.data

  const existing = await c.env.DB
    .prepare('SELECT id FROM employees WHERE id = ? AND company_id = ? LIMIT 1')
    .bind(id, companyId)
    .first()

  if (!existing) return c.json({ error: 'Funcionário não encontrado', code: 'NOT_FOUND' }, 404)

  const fields: string[] = []
  const values: unknown[] = []

  if (d.name !== undefined) { fields.push('name = ?'); values.push(d.name) }
  if (d.role !== undefined) { fields.push('role = ?'); values.push(d.role) }
  if (d.cpf !== undefined) { fields.push('cpf = ?'); values.push(d.cpf ?? null) }
  if (d.admissionDate !== undefined) { fields.push('admission_date = ?'); values.push(d.admissionDate) }
  if (d.weekdayStart !== undefined) { fields.push('weekday_start = ?'); values.push(d.weekdayStart) }
  if (d.weekdayEnd !== undefined) { fields.push('weekday_end = ?'); values.push(d.weekdayEnd) }
  if (d.saturdayStart !== undefined) { fields.push('saturday_start = ?'); values.push(d.saturdayStart) }
  if (d.saturdayEnd !== undefined) { fields.push('saturday_end = ?'); values.push(d.saturdayEnd) }
  if (d.saturdayMode !== undefined) { fields.push('saturday_mode = ?'); values.push(d.saturdayMode) }
  if (d.toleranceMinutes !== undefined) { fields.push('tolerance_minutes = ?'); values.push(d.toleranceMinutes) }
  if (d.dailyHoursExpected !== undefined) { fields.push('daily_hours_expected = ?'); values.push(d.dailyHoursExpected) }

  if (fields.length === 0) return c.json({ error: 'Nenhum campo para atualizar', code: 'NO_FIELDS' }, 400)

  values.push(id)
  await c.env.DB
    .prepare(`UPDATE employees SET ${fields.join(', ')} WHERE id = ?`)
    .bind(...values)
    .run()

  const row = await c.env.DB.prepare('SELECT * FROM employees WHERE id = ? LIMIT 1').bind(id).first()
  return c.json({ data: rowToEmployee(row as Record<string, unknown>) })
})

// DELETE /employees/:id  (soft delete)
employees.delete('/:id', requireRole('admin'), async (c) => {
  const { companyId } = c.get('user')
  const { id } = c.req.param()

  const existing = await c.env.DB
    .prepare('SELECT id FROM employees WHERE id = ? AND company_id = ? LIMIT 1')
    .bind(id, companyId)
    .first()

  if (!existing) return c.json({ error: 'Funcionário não encontrado', code: 'NOT_FOUND' }, 404)

  await c.env.DB.prepare('UPDATE employees SET active = 0 WHERE id = ?').bind(id).run()

  return c.json({ data: { message: 'Funcionário desativado com sucesso' } })
})

export default employees
