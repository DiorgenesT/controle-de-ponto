import { z } from 'zod'

// ─── Helpers ──────────────────────────────────────────────────────────────────

const timeHHMM = z
  .string()
  .regex(/^\d{2}:\d{2}$/, 'Formato inválido. Use HH:MM')

const isoDate = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'Formato inválido. Use YYYY-MM-DD')

// ─── Auth ─────────────────────────────────────────────────────────────────────

export const loginSchema = z.object({
  email: z.string().email('E-mail inválido'),
  password: z.string().min(8, 'Senha deve ter no mínimo 8 caracteres'),
})

// ─── Company ──────────────────────────────────────────────────────────────────

export const updateCompanySchema = z.object({
  name: z.string().min(2, 'Nome deve ter no mínimo 2 caracteres').max(120),
  cnpj: z
    .string()
    .regex(/^\d{2}\.\d{3}\.\d{3}\/\d{4}-\d{2}$/, 'CNPJ inválido. Formato: XX.XXX.XXX/XXXX-XX'),
  address: z.string().max(200).nullable().optional(),
  city: z.string().max(100).nullable().optional(),
})

// ─── Employee ─────────────────────────────────────────────────────────────────

export const createEmployeeSchema = z.object({
  name: z.string().min(2, 'Nome deve ter no mínimo 2 caracteres').max(120),
  role: z.string().min(2, 'Função deve ter no mínimo 2 caracteres').max(80),
  admissionDate: isoDate,
  weekdayStart: timeHHMM.default('08:30'),
  weekdayEnd: timeHHMM.default('18:00'),
  saturdayStart: timeHHMM.nullable().optional().default('08:00'),
  saturdayEnd: timeHHMM.nullable().optional().default('12:00'),
  worksSaturday: z.boolean().default(true),
  toleranceMinutes: z.number().int().min(0).max(30).default(10),
  dailyHoursExpected: z.number().min(1).max(24).default(8),
})

export const updateEmployeeSchema = createEmployeeSchema.partial()

// ─── Time Entry ───────────────────────────────────────────────────────────────

export const dayTypeSchema = z.enum(['worked', 'closed', 'holiday', 'absence', 'vacation', 'medical'])

export const upsertTimeEntrySchema = z
  .object({
    employeeId: z.string().min(1).max(40),
    entryDate: isoDate,
    clockIn: timeHHMM.nullable().optional(),
    lunchOut: timeHHMM.nullable().optional(),
    lunchReturn: timeHHMM.nullable().optional(),
    clockOut: timeHHMM.nullable().optional(),
    dayType: dayTypeSchema.default('worked'),
    notes: z.string().max(500).nullable().optional(),
  })
  .refine(
    (data) => {
      // For non-worked days, times are optional
      if (data.dayType !== 'worked') return true
      // If clock_in is set, clock_out must be set too
      if (data.clockIn && !data.clockOut) return false
      return true
    },
    { message: 'Se entrada for preenchida, saída é obrigatória', path: ['clockOut'] }
  )

// ─── User ─────────────────────────────────────────────────────────────────────

export const createUserSchema = z.object({
  email: z.string().email('E-mail inválido'),
  password: z
    .string()
    .min(8, 'Senha deve ter no mínimo 8 caracteres')
    .regex(/[A-Z]/, 'Deve conter ao menos uma letra maiúscula')
    .regex(/[0-9]/, 'Deve conter ao menos um número'),
  name: z.string().min(2).max(120),
  role: z.enum(['admin', 'manager', 'viewer']).default('viewer'),
})

export const changePasswordSchema = z
  .object({
    currentPassword: z.string().min(1),
    newPassword: z
      .string()
      .min(8, 'Senha deve ter no mínimo 8 caracteres')
      .regex(/[A-Z]/, 'Deve conter ao menos uma letra maiúscula')
      .regex(/[0-9]/, 'Deve conter ao menos um número'),
    confirmPassword: z.string(),
  })
  .refine((d) => d.newPassword === d.confirmPassword, {
    message: 'As senhas não coincidem',
    path: ['confirmPassword'],
  })

// ─── Query Params ─────────────────────────────────────────────────────────────

export const monthQuerySchema = z.object({
  employeeId: z.string().uuid(),
  year: z.coerce.number().int().min(2020).max(2100),
  month: z.coerce.number().int().min(1).max(12),
})
