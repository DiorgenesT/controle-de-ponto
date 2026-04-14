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

  await next()

  // Only count failed attempts (4xx responses)
  if (c.res.status >= 400 && c.res.status < 500) {
    const existing = attempts.get(ip)
    if (existing && now <= existing.resetAt) {
      existing.count++
    } else {
      attempts.set(ip, { count: 1, resetAt: now + WINDOW_MS })
    }
  } else {
    // Successful login: clear attempts
    attempts.delete(ip)
  }
}
