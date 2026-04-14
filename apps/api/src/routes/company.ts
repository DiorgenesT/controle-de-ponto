import { Hono } from 'hono'
import { updateCompanySchema } from '@ponto/shared'
import type { Env } from '../lib/types'
import type { AuthContext } from '../middleware/auth'
import { authMiddleware, requireRole } from '../middleware/auth'

const company = new Hono<{ Bindings: Env } & AuthContext>()

company.use('*', authMiddleware)

// GET /company
company.get('/', async (c) => {
  const { companyId } = c.get('user')

  const row = await c.env.DB
    .prepare('SELECT * FROM companies WHERE id = ? LIMIT 1')
    .bind(companyId)
    .first()

  if (!row) return c.json({ error: 'Empresa não encontrada', code: 'NOT_FOUND' }, 404)

  return c.json({ data: row })
})

// PUT /company
company.put('/', requireRole('admin'), async (c) => {
  const body = await c.req.json().catch(() => null)
  const parsed = updateCompanySchema.safeParse(body)

  if (!parsed.success) {
    return c.json({ error: 'Dados inválidos', code: 'VALIDATION_ERROR', details: parsed.error.flatten() }, 400)
  }

  const { companyId } = c.get('user')
  const { name, cnpj, address, city } = parsed.data

  await c.env.DB
    .prepare('UPDATE companies SET name = ?, cnpj = ?, address = ?, city = ? WHERE id = ?')
    .bind(name, cnpj, address ?? null, city ?? null, companyId)
    .run()

  const row = await c.env.DB
    .prepare('SELECT * FROM companies WHERE id = ? LIMIT 1')
    .bind(companyId)
    .first()

  return c.json({ data: row })
})

export default company
