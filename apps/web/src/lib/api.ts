const BASE_URL = '/api'

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
    const err = await res.json().catch(() => ({ error: 'Erro desconhecido', code: 'UNKNOWN' }))
    throw Object.assign(new Error((err as { error: string }).error), { status: res.status, code: (err as { code: string }).code })
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
}

// ─── Reports ─────────────────────────────────────────────────────────────────

export const reportsApi = {
  monthly: (employeeId: string, year: number, month: number) =>
    request<{ data: unknown }>(`/reports/monthly?employeeId=${employeeId}&year=${year}&month=${month}`),
  hourBank: (employeeId: string) =>
    request<{ data: unknown[] }>(`/reports/hourbank?employeeId=${employeeId}`),
}
