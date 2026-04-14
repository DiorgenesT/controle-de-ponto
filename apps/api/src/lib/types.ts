import type { D1Database } from '@cloudflare/workers-types'

export interface Env {
  DB: D1Database
  JWT_SECRET: string
  ENVIRONMENT: string
}

export interface JwtPayload {
  sub: string        // user id
  email: string
  role: string
  companyId: string
  exp: number
}
