// ─── Domain Types ────────────────────────────────────────────────────────────

export type UserRole = 'admin' | 'manager' | 'viewer'

export interface User {
  id: string
  companyId: string
  email: string
  name: string
  role: UserRole
  active: boolean
  createdAt: string
}

export interface Company {
  id: string
  name: string
  cnpj: string
  address: string | null
  city: string | null
  createdAt: string
}

export type SaturdayMode = 'all' | 'first_two' | 'none'

export interface Employee {
  id: string
  companyId: string
  name: string
  role: string
  cpf: string | null
  admissionDate: string         // ISO date 'YYYY-MM-DD'
  weekdayStart: string          // 'HH:MM'
  weekdayEnd: string            // 'HH:MM'
  saturdayStart: string | null  // 'HH:MM'
  saturdayEnd: string | null    // 'HH:MM'
  saturdayMode: SaturdayMode    // 'all' | 'first_two' | 'none'
  toleranceMinutes: number
  dailyHoursExpected: number    // liquid hours per weekday
  active: boolean
  createdAt: string
}

export type DayType = 'worked' | 'closed' | 'holiday' | 'absence' | 'vacation' | 'medical' | 'banco_horas'

export interface TimeEntry {
  id: string
  employeeId: string
  entryDate: string      // 'YYYY-MM-DD'
  clockIn: string | null    // 'HH:MM'
  lunchOut: string | null   // 'HH:MM'
  lunchReturn: string | null // 'HH:MM'
  clockOut: string | null   // 'HH:MM'
  dayType: DayType
  notes: string | null
  workedMinutes: number | null
  extraMinutes: number | null
  missingMinutes: number | null
  createdAt: string
  updatedAt: string
}

export interface HourBankAdjustment {
  id: string
  employeeId: string
  year: number
  month: number
  adjustmentMinutes: number  // manual delta applied to that month's accumulated balance
  note: string | null
  createdAt: string
  updatedAt: string
}

// ─── API Response Types ───────────────────────────────────────────────────────

export interface ApiResponse<T> {
  data: T
}

export interface ApiError {
  error: string
  code: string
}

export interface PaginatedResponse<T> {
  data: T[]
  total: number
  page: number
  pageSize: number
}

// ─── Auth Types ───────────────────────────────────────────────────────────────

export interface LoginRequest {
  email: string
  password: string
}

export interface AuthResponse {
  token: string
  user: User
}

// ─── Calculation Types ────────────────────────────────────────────────────────

export interface DailyCalculation {
  workedMinutes: number
  expectedMinutes: number
  extraMinutes: number
  missingMinutes: number
  isComplete: boolean  // has all 4 time fields
}

export interface MonthlyReport {
  employee: Employee
  company: Company
  year: number
  month: number
  entries: TimeEntry[]
  totalWorkedMinutes: number
  totalExtraMinutes: number
  totalMissingMinutes: number
  balanceMinutes: number
  accumulatedMinutes: number
  previousMonthAccumulated: number
}
