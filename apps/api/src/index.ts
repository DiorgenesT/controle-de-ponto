import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { secureHeaders } from 'hono/secure-headers'
import type { Env } from './lib/types'
import authRoutes from './routes/auth'
import employeeRoutes from './routes/employees'
import timeEntryRoutes from './routes/timeEntries'
import reportRoutes from './routes/reports'
import companyRoutes from './routes/company'

const app = new Hono<{ Bindings: Env }>()

// ─── Security Headers ─────────────────────────────────────────────────────────
app.use('*', secureHeaders())

// ─── CORS ─────────────────────────────────────────────────────────────────────
app.use(
  '*',
  cors({
    origin: (origin) => {
      const allowed = [
        'http://localhost:5173',
        'https://controle-ponto.pages.dev',
        // Add your production domain here
      ]
      return allowed.includes(origin ?? '') ? origin : null
    },
    allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowHeaders: ['Content-Type', 'Authorization'],
    maxAge: 86400,
  })
)

// ─── Routes ───────────────────────────────────────────────────────────────────
app.route('/auth', authRoutes)
app.route('/employees', employeeRoutes)
app.route('/timeentries', timeEntryRoutes)
app.route('/reports', reportRoutes)
app.route('/company', companyRoutes)

// ─── Health Check ─────────────────────────────────────────────────────────────
app.get('/health', (c) => c.json({ status: 'ok', timestamp: new Date().toISOString() }))

// ─── 404 ──────────────────────────────────────────────────────────────────────
app.notFound((c) => c.json({ error: 'Rota não encontrada', code: 'NOT_FOUND' }, 404))

// ─── Error Handler ────────────────────────────────────────────────────────────
app.onError((err, c) => {
  console.error('[API Error]', err)
  return c.json({ error: 'Erro interno do servidor', code: 'INTERNAL_ERROR' }, 500)
})

export default app
