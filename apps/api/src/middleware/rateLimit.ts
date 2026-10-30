import type { Context, Next } from 'hono'

// Simple in-memory rate limiter for login endpoint
// For production, use Cloudflare KV or Durable Objects
const attempts = new Map<string, { count: number; resetAt: number }>()

const MAX_ATTEMPTS = 5
const WINDOW_MS = 60 * 1000 // 1 minute

export async function loginRateLimit(c: Context, next: Next) {
  const ip = c.req.header('CF-Connecting-IP') ?? c.req.header('X-Forwarded-For') ?? 'unknown'
  const now = Date.now()
  const record = attempts.get(ip)

  if (record) {
    if (now > record.resetAt) {
      attempts.delete(ip)
    } else if (record.count >= MAX_ATTEMPTS) {
      return c.json(
        { error: 'Muitas tentativas de login. Tente novamente em 1 minuto.', code: 'RATE_LIMITED' },
        429
      )
    }
  }

  // Count before checking the password: parallel requests would otherwise all pass
  // the check while bcrypt runs.
  const current = attempts.get(ip)
  if (current && now <= current.resetAt) {
    current.count++
  } else {
    attempts.set(ip, { count: 1, resetAt: now + WINDOW_MS })
  }

  await next()

  if (c.res.status < 400) attempts.delete(ip)
}
