import type { HourBankAdjustment, BankTreatment, TimeEntry, DayType } from '@ponto/shared'

const BASE_URL = import.meta.env.VITE_API_URL ?? '/api'

function getToken(): string | null {
  return localStorage.getItem('ponto_token')
}

export function setToken(token: string) {
  localStorage.setItem('ponto_token', token)
}

export function clearToken() {
  localStorage.removeItem('ponto_token')
  localStorage.removeItem('ponto_user')
}

/** Field-level messages from a 400 VALIDATION_ERROR ({ details: { fieldErrors } }). */
export type FieldErrors = Record<string, string[] | undefined>

export class ApiError extends Error {
  status: number
  code: string
  fieldErrors: FieldErrors

  constructor(message: string, status: number, code: string, fieldErrors: FieldErrors = {}) {
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.code = code
    this.fieldErrors = fieldErrors
  }
}

let onUnauthorized: (() => void) | null = null

/** Registered once at startup (main.tsx): runs when an authenticated call gets 401. */
export function setUnauthorizedHandler(handler: () => void) {
  onUnauthorized = handler
}

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const token = getToken()

  const res = await fetch(`${BASE_URL}${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...init.headers,
    },
  })

  if (!res.ok) {
    const body = (await res.json().catch(() => null)) as {
      error?: string
      code?: string
      details?: { fieldErrors?: FieldErrors; formErrors?: string[] }
    } | null

    if (res.status === 401 && path !== '/auth/login') onUnauthorized?.()

    const fieldErrors = body?.details?.fieldErrors ?? {}
    // Prefer the specific field message over the generic "Dados inválidos"
    const firstFieldMessage =
      Object.values(fieldErrors).find((m) => m && m.length > 0)?.[0] ?? body?.details?.formErrors?.[0]
    const message = firstFieldMessage ?? body?.error ?? 'Erro desconhecido'
    throw new ApiError(message, res.status, body?.code ?? 'UNKNOWN', fieldErrors)
  }

  return res.json() as Promise<T>
}

// ─── Auth ─────────────────────────────────────────────────────────────────────

export const authApi = {
  login: (email: string, password: string) =>
    request<{ data: { token: string; user: { id: string; email: string; name: string; role: string; companyId: string } } }>(
      '/auth/login',
      { method: 'POST', body: JSON.stringify({ email, password }) }
    ),
  me: () => request<{ data: unknown }>('/auth/me'),
  changePassword: (currentPassword: string, newPassword: string, confirmPassword: string) =>
    request('/auth/change-password', {
      method: 'POST',
      body: JSON.stringify({ currentPassword, newPassword, confirmPassword }),
    }),
}

// ─── Company ──────────────────────────────────────────────────────────────────

export const companyApi = {
  get: () => request<{ data: unknown }>('/company'),
  update: (data: unknown) => request('/company', { method: 'PUT', body: JSON.stringify(data) }),
  updateSettings: (absenceTreatmentDefault: BankTreatment) =>
    request<{ data: unknown }>('/company/settings', {
      method: 'PATCH',
      body: JSON.stringify({ absenceTreatmentDefault }),
    }),
}

// ─── Employees ────────────────────────────────────────────────────────────────

export const employeesApi = {
  list: (includeInactive = false) =>
    request<{ data: unknown[] }>(`/employees${includeInactive ? '?includeInactive=true' : ''}`),
  get: (id: string) => request<{ data: unknown }>(`/employees/${id}`),
  create: (data: unknown) => request('/employees', { method: 'POST', body: JSON.stringify(data) }),
  update: (id: string, data: unknown) =>
    request(`/employees/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  deactivate: (id: string) => request(`/employees/${id}`, { method: 'DELETE' }),
}

// ─── Time Entries ─────────────────────────────────────────────────────────────

export const timeEntriesApi = {
  list: (employeeId: string, year: number, month: number) =>
    request<{ data: unknown[] }>(`/timeentries?employeeId=${employeeId}&year=${year}&month=${month}`),
  upsert: (data: unknown) =>
    request('/timeentries', { method: 'POST', body: JSON.stringify(data) }),
  delete: (id: string) => request(`/timeentries/${id}`, { method: 'DELETE' }),
  /** Re-applies the employee's current schedule/tolerance to every entry of the month. */
  recalculate: (employeeId: string, year: number, month: number) =>
    request<{ data: { updated: number } }>('/timeentries/recalculate', {
      method: 'POST',
      body: JSON.stringify({ employeeId, year, month }),
    }),
  setBankTreatment: (id: string, bankTreatment: BankTreatment) =>
    request<{ data: TimeEntry }>(`/timeentries/${id}/bank-treatment`, {
      method: 'PATCH',
      body: JSON.stringify({ bankTreatment }),
    }),
  bulkSetBankTreatment: (params: {
    employeeId: string
    year: number
    month: number
    bankTreatment: BankTreatment
    dayTypes?: Exclude<DayType, 'banco_horas'>[]
  }) =>
    request<{ data: { updated: number } }>('/timeentries/bank-treatment', {
      method: 'PATCH',
      body: JSON.stringify(params),
    }),
}

// ─── Reports ─────────────────────────────────────────────────────────────────

export const reportsApi = {
  monthly: (employeeId: string, year: number, month: number) =>
    request<{ data: unknown }>(`/reports/monthly?employeeId=${employeeId}&year=${year}&month=${month}`),
  hourBank: (employeeId: string) =>
    request<{ data: HourBankAdjustment[] }>(`/reports/hourbank?employeeId=${employeeId}`),
  dashboard: (year: number, month: number) =>
    request<{ data: unknown }>(`/reports/dashboard?year=${year}&month=${month}`),
  setAdjustment: (employeeId: string, year: number, month: number, adjustmentMinutes: number, note: string | null) =>
    request<{ data: HourBankAdjustment | null }>('/reports/hourbank/adjustment', {
      method: 'POST',
      body: JSON.stringify({ employeeId, year, month, adjustmentMinutes, note }),
    }),
}

// ─── Users ────────────────────────────────────────────────────────────────────

export const usersApi = {
  list: () => request<{ data: unknown[] }>('/users'),
  create: (data: unknown) => request('/users', { method: 'POST', body: JSON.stringify(data) }),
  update: (id: string, data: unknown) => request(`/users/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  deactivate: (id: string) => request(`/users/${id}`, { method: 'DELETE' }),
}
