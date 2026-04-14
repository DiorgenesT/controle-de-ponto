import type { Context, Next } from 'hono'
import type { Env, JwtPayload } from '../lib/types'
import { verifyJwt } from '../lib/jwt'

export type AuthContext = {
  Variables: {
    user: JwtPayload
  }
}

export async function authMiddleware(c: Context<{ Bindings: Env } & AuthContext>, next: Next) {
  const authorization = c.req.header('Authorization')

  if (!authorization?.startsWith('Bearer ')) {
    return c.json({ error: 'Token de acesso requerido', code: 'UNAUTHORIZED' }, 401)
  }

  const token = authorization.slice(7)
  const payload = await verifyJwt(token, c.env.JWT_SECRET)

  if (!payload) {
    return c.json({ error: 'Token inválido ou expirado', code: 'INVALID_TOKEN' }, 401)
  }

  c.set('user', payload)
  await next()
}

export function requireRole(...roles: string[]) {
  return async (c: Context<{ Bindings: Env } & AuthContext>, next: Next) => {
    const user = c.get('user')
    if (!roles.includes(user.role)) {
      return c.json({ error: 'Acesso não autorizado', code: 'FORBIDDEN' }, 403)
    }
    await next()
  }
}
