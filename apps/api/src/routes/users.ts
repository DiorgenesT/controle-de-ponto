import { Hono } from 'hono'
import { hash } from 'bcryptjs'
import { createUserSchema } from '@ponto/shared'
import type { Env } from '../lib/types'
import type { AuthContext } from '../middleware/auth'
import { authMiddleware, requireRole } from '../middleware/auth'

const BCRYPT_ROUNDS = 12

const users = new Hono<{ Bindings: Env } & AuthContext>()

users.use('*', authMiddleware)

// GET /users
users.get('/', requireRole('admin'), async (c) => {
  const { companyId } = c.get('user')

  const rows = await c.env.DB
    .prepare(
      `SELECT id, name, email, role, active, created_at
       FROM users WHERE company_id = ? ORDER BY name ASC`
    )
    .bind(companyId)
    .all()

  return c.json({ data: rows.results })
})

// POST /users
users.post('/', requireRole('admin'), async (c) => {
  const body = await c.req.json().catch(() => null)
  const parsed = createUserSchema.safeParse(body)

  if (!parsed.success) {
    return c.json({ error: 'Dados inválidos', code: 'VALIDATION_ERROR', details: parsed.error.flatten() }, 400)
  }

  const { companyId } = c.get('user')
  const { email, password, name, role } = parsed.data

  const existing = await c.env.DB
    .prepare('SELECT id FROM users WHERE email = ? LIMIT 1')
    .bind(email.toLowerCase())
    .first()

  if (existing) {
    return c.json({ error: 'E-mail já cadastrado', code: 'EMAIL_TAKEN' }, 409)
  }

  const passwordHash = await hash(password, BCRYPT_ROUNDS)
  const id = crypto.randomUUID()

  await c.env.DB
    .prepare(
      `INSERT INTO users (id, company_id, email, password_hash, name, role)
       VALUES (?, ?, ?, ?, ?, ?)`
    )
    .bind(id, companyId, email.toLowerCase(), passwordHash, name, role)
    .run()

  const row = await c.env.DB
    .prepare('SELECT id, name, email, role, active, created_at FROM users WHERE id = ? LIMIT 1')
    .bind(id)
    .first()

  return c.json({ data: row }, 201)
})

// PUT /users/:id
users.put('/:id', requireRole('admin'), async (c) => {
  const { companyId } = c.get('user')
  const { id } = c.req.param()
  const body = await c.req.json().catch(() => null)

  const schema = createUserSchema.pick({ name: true, role: true }).partial()
  const parsed = schema.safeParse(body)

  if (!parsed.success) {
    return c.json({ error: 'Dados inválidos', code: 'VALIDATION_ERROR', details: parsed.error.flatten() }, 400)
  }

  const existing = await c.env.DB
    .prepare('SELECT id FROM users WHERE id = ? AND company_id = ? LIMIT 1')
    .bind(id, companyId)
    .first()

  if (!existing) return c.json({ error: 'Usuário não encontrado', code: 'NOT_FOUND' }, 404)

  const { name, role } = parsed.data
  const fields: string[] = []
  const values: unknown[] = []

  if (name !== undefined) { fields.push('name = ?'); values.push(name) }
  if (role !== undefined) { fields.push('role = ?'); values.push(role) }

  if (fields.length === 0) return c.json({ error: 'Nenhum campo para atualizar', code: 'NO_FIELDS' }, 400)

  values.push(id)
  await c.env.DB
    .prepare(`UPDATE users SET ${fields.join(', ')} WHERE id = ?`)
    .bind(...values)
    .run()

  const row = await c.env.DB
    .prepare('SELECT id, name, email, role, active, created_at FROM users WHERE id = ? LIMIT 1')
    .bind(id)
    .first()

  return c.json({ data: row })
})

// DELETE /users/:id  (soft delete — cannot deactivate yourself)
users.delete('/:id', requireRole('admin'), async (c) => {
  const { companyId, sub } = c.get('user')
  const { id } = c.req.param()

  if (id === sub) {
    return c.json({ error: 'Não é possível desativar sua própria conta', code: 'SELF_DEACTIVATE' }, 400)
  }

  const existing = await c.env.DB
    .prepare('SELECT id FROM users WHERE id = ? AND company_id = ? LIMIT 1')
    .bind(id, companyId)
    .first()

  if (!existing) return c.json({ error: 'Usuário não encontrado', code: 'NOT_FOUND' }, 404)

  await c.env.DB
    .prepare('UPDATE users SET active = 0 WHERE id = ?')
    .bind(id)
    .run()

  return c.json({ data: { message: 'Usuário desativado com sucesso' } })
})

export default users
