import { Hono } from 'hono'
import { compare, hash } from 'bcryptjs'
import { loginSchema, changePasswordSchema } from '@ponto/shared'
import type { Env } from '../lib/types'
import type { AuthContext } from '../middleware/auth'
import { signJwt } from '../lib/jwt'
import { authMiddleware } from '../middleware/auth'
import { loginRateLimit } from '../middleware/rateLimit'

const BCRYPT_ROUNDS = 12

const auth = new Hono<{ Bindings: Env } & AuthContext>()

// POST /auth/login
auth.post('/login', loginRateLimit, async (c) => {
  const body = await c.req.json().catch(() => null)
  const parsed = loginSchema.safeParse(body)

  if (!parsed.success) {
    return c.json({ error: 'Dados inválidos', code: 'VALIDATION_ERROR', details: parsed.error.flatten() }, 400)
  }

  const { email, password } = parsed.data

  const user = await c.env.DB
    .prepare('SELECT * FROM users WHERE email = ? AND active = 1 LIMIT 1')
    .bind(email.toLowerCase())
    .first<{ id: string; company_id: string; email: string; password_hash: string; name: string; role: string }>()

  // Constant-time comparison even when user not found (prevent timing attacks)
  const dummyHash = '$2a$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewdBPj4J7hD5GpTG'
  const passwordMatch = user
    ? await compare(password, user.password_hash)
    : await compare(password, dummyHash).then(() => false)

  if (!user || !passwordMatch) {
    return c.json({ error: 'E-mail ou senha incorretos', code: 'INVALID_CREDENTIALS' }, 401)
  }

  const token = await signJwt(
    { sub: user.id, email: user.email, role: user.role, companyId: user.company_id },
    c.env.JWT_SECRET
  )

  return c.json({
    data: {
      token,
      user: {
        id: user.id,
        companyId: user.company_id,
        email: user.email,
        name: user.name,
        role: user.role,
      },
    },
  })
})

// GET /auth/me
auth.get('/me', authMiddleware, async (c) => {
  const { sub } = c.get('user')

  const user = await c.env.DB
    .prepare('SELECT id, company_id, email, name, role, active, created_at FROM users WHERE id = ? LIMIT 1')
    .bind(sub)
    .first()

  if (!user) {
    return c.json({ error: 'Usuário não encontrado', code: 'NOT_FOUND' }, 404)
  }

  return c.json({ data: user })
})

// POST /auth/change-password
auth.post('/change-password', authMiddleware, async (c) => {
  const body = await c.req.json().catch(() => null)
  const parsed = changePasswordSchema.safeParse(body)

  if (!parsed.success) {
    return c.json({ error: 'Dados inválidos', code: 'VALIDATION_ERROR', details: parsed.error.flatten() }, 400)
  }

  const { sub } = c.get('user')
  const { currentPassword, newPassword } = parsed.data

  const user = await c.env.DB
    .prepare('SELECT password_hash FROM users WHERE id = ? LIMIT 1')
    .bind(sub)
    .first<{ password_hash: string }>()

  if (!user || !(await compare(currentPassword, user.password_hash))) {
    return c.json({ error: 'Senha atual incorreta', code: 'INVALID_CREDENTIALS' }, 401)
  }

  const newHash = await hash(newPassword, BCRYPT_ROUNDS)
  await c.env.DB
    .prepare('UPDATE users SET password_hash = ? WHERE id = ?')
    .bind(newHash, sub)
    .run()

  return c.json({ data: { message: 'Senha alterada com sucesso' } })
})

export default auth
