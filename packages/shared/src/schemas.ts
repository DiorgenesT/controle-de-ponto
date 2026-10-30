import { z } from 'zod'

// ─── Helpers ──────────────────────────────────────────────────────────────────

const timeHHMM = z
  .string()
  .regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Horário inválido. Use HH:MM (00:00–23:59)')

// Rejects impossible dates like 2025-02-30 or 2024-13-45 (they would leak into the
// hour-bank balance without ever showing up in a month view)
const isoDate = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'Formato inválido. Use YYYY-MM-DD')
  .refine((value) => {
    const date = new Date(`${value}T00:00:00Z`)
    return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value
  }, 'Data inexistente')

// Employee/entity ids: UUIDs for new rows, but legacy rows may use other formats
const entityId = z.string().min(1).max(40)

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

const cpfSchema = z
  .string()
  .regex(/^\d{3}\.\d{3}\.\d{3}-\d{2}$/, 'CPF inválido. Formato: 000.000.000-00')
  .refine((cpf) => {
    const d = cpf.replace(/\D/g, '')
    if (/^(\d)\1+$/.test(d)) return false
    let s = 0
    for (let i = 0; i < 9; i++) s += +d[i]! * (10 - i)
    let r = (s * 10) % 11
    if (r === 10 || r === 11) r = 0
    if (r !== +d[9]!) return false
    s = 0
    for (let i = 0; i < 10; i++) s += +d[i]! * (11 - i)
    r = (s * 10) % 11
    if (r === 10 || r === 11) r = 0
    return r === +d[10]!
  }, 'CPF inválido')
  .nullable()
  .optional()

export const createEmployeeSchema = z.object({
  name: z.string().min(2, 'Nome deve ter no mínimo 2 caracteres').max(120),
  role: z.string().min(2, 'Função deve ter no mínimo 2 caracteres').max(80),
  cpf: cpfSchema,
  admissionDate: isoDate,
  weekdayStart: timeHHMM.default('08:30'),
  weekdayEnd: timeHHMM.default('18:00'),
  saturdayStart: timeHHMM.nullable().optional().default('08:00'),
  saturdayEnd: timeHHMM.nullable().optional().default('12:00'),
  saturdayMode: z.enum(['all', 'first_two', 'none']).default('all'),
  toleranceMinutes: z.number().int().min(0).max(30).default(10),
  dailyHoursExpected: z.number().min(1).max(24).default(8),
})

export const updateEmployeeSchema = createEmployeeSchema.partial()

// ─── Time Entry ───────────────────────────────────────────────────────────────

export const dayTypeSchema = z.enum(['worked', 'closed', 'holiday', 'absence', 'vacation', 'medical', 'banco_horas'])

export const bankTreatmentSchema = z.enum(['bank', 'payroll'])

export const upsertTimeEntrySchema = z
  .object({
    employeeId: entityId,
    entryDate: isoDate,
    clockIn: timeHHMM.nullable().optional(),
    lunchOut: timeHHMM.nullable().optional(),
    lunchReturn: timeHHMM.nullable().optional(),
    clockOut: timeHHMM.nullable().optional(),
    dayType: dayTypeSchema.default('worked'),
    notes: z.string().max(500).nullable().optional(),
    bankTreatment: bankTreatmentSchema.optional(),
  })
  .superRefine((data, ctx) => {
    const { clockIn, lunchOut, lunchReturn, clockOut } = data

    if (data.dayType === 'worked' && (!clockIn || !clockOut)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Dia trabalhado exige entrada e saída. Para ausência, use "Falta".',
        path: [clockIn ? 'clockOut' : 'clockIn'],
      })
      return
    }
    if (Boolean(clockIn) !== Boolean(clockOut)) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Informe entrada e saída juntas', path: ['clockOut'] })
      return
    }
    if (Boolean(lunchOut) !== Boolean(lunchReturn)) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Informe saída e retorno do almoço juntos', path: ['lunchReturn'] })
      return
    }
    if (lunchOut && !clockIn) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Almoço exige entrada e saída', path: ['lunchOut'] })
      return
    }
    // 'HH:MM' strings compare correctly as text
    if (clockIn && clockOut && clockOut <= clockIn) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Saída deve ser depois da entrada', path: ['clockOut'] })
    }
    if (clockIn && clockOut && lunchOut && lunchReturn) {
      if (lunchReturn < lunchOut) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Retorno do almoço antes da saída para o almoço', path: ['lunchReturn'] })
      } else if (lunchOut < clockIn || lunchReturn > clockOut) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Almoço deve estar dentro do expediente', path: ['lunchOut'] })
      }
    }
  })

export const companySettingsSchema = z.object({
  absenceTreatmentDefault: bankTreatmentSchema,
})

export const setBankTreatmentSchema = z.object({
  bankTreatment: bankTreatmentSchema,
})

export const bulkBankTreatmentSchema = z.object({
  employeeId: entityId,
  year: z.number().int().min(2020).max(2100),
  month: z.number().int().min(1).max(12),
  dayTypes: z.array(dayTypeSchema.exclude(['banco_horas'])).min(1).default(['absence']),
  bankTreatment: bankTreatmentSchema,
})

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

export const yearMonthQuerySchema = z.object({
  year: z.coerce.number().int().min(2020).max(2100),
  month: z.coerce.number().int().min(1).max(12),
})

export const monthQuerySchema = z.object({
  employeeId: entityId,
  year: z.coerce.number().int().min(2020).max(2100),
  month: z.coerce.number().int().min(1).max(12),
})

export const hourBankAdjustmentSchema = z.object({
  employeeId: entityId,
  year: z.coerce.number().int().min(2020).max(2100),
  month: z.coerce.number().int().min(1).max(12),
  adjustmentMinutes: z.coerce.number().int().min(-100000).max(100000),
  note: z.string().max(500).nullable().optional(),
})
