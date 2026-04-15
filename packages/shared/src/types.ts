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
  worksSaturday: boolean
  toleranceMinutes: number
  dailyHoursExpected: number    // liquid hours per weekday
  active: boolean
  createdAt: string
}

export type DayType = 'worked' | 'closed' | 'holiday' | 'absence' | 'vacation' | 'medical'

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

export interface HourBank {
  id: string
  employeeId: string
  year: number
  month: number
  totalWorkedMinutes: number
  totalExtraMinutes: number
  totalMissingMinutes: number
  balanceMinutes: number      // extra - missing for the month
  accumulatedMinutes: number  // running total including prior months
  closed: boolean
  closedAt: string | null
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
