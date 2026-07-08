import type { D1Database } from '@cloudflare/workers-types'

// Accumulated hour-bank balance for `employeeId` immediately before `year`/`month`
export async function getAccumulatedBeforeMonth(
  db: D1Database,
  employeeId: string,
  year: number,
  month: number
): Promise<number> {
  const startDate = `${year}-${String(month).padStart(2, '0')}-01`

  const [entriesBalance, adjustmentsBalance] = await Promise.all([
    db
      .prepare(
        `SELECT COALESCE(SUM(extra_minutes), 0) - COALESCE(SUM(missing_minutes), 0) AS balance
         FROM time_entries
         WHERE employee_id = ? AND entry_date < ?`
      )
      .bind(employeeId, startDate)
      .first<{ balance: number }>(),
    db
      .prepare(
        `SELECT COALESCE(SUM(adjustment_minutes), 0) AS total
         FROM hour_bank
         WHERE employee_id = ? AND (year < ? OR (year = ? AND month < ?))`
      )
      .bind(employeeId, year, year, month)
      .first<{ total: number }>(),
  ])

  return (entriesBalance?.balance ?? 0) + (adjustmentsBalance?.total ?? 0)
}

// Same as getAccumulatedBeforeMonth, batched for every employee of a company
export async function getAccumulatedBeforeMonthByCompany(
  db: D1Database,
  companyId: string,
  year: number,
  month: number
): Promise<Record<string, number>> {
  const startDate = `${year}-${String(month).padStart(2, '0')}-01`

  const [entriesResult, adjustmentsResult] = await Promise.all([
    db
      .prepare(
        `SELECT te.employee_id AS employeeId,
                COALESCE(SUM(te.extra_minutes), 0) - COALESCE(SUM(te.missing_minutes), 0) AS balance
         FROM time_entries te
         JOIN employees e ON e.id = te.employee_id
         WHERE e.company_id = ? AND te.entry_date < ?
         GROUP BY te.employee_id`
      )
      .bind(companyId, startDate)
      .all<{ employeeId: string; balance: number }>(),
    db
      .prepare(
        `SELECT hb.employee_id AS employeeId, COALESCE(SUM(hb.adjustment_minutes), 0) AS total
         FROM hour_bank hb
         JOIN employees e ON e.id = hb.employee_id
         WHERE e.company_id = ? AND (hb.year < ? OR (hb.year = ? AND hb.month < ?))
         GROUP BY hb.employee_id`
      )
      .bind(companyId, year, year, month)
      .all<{ employeeId: string; total: number }>(),
  ])

  const result: Record<string, number> = {}
  for (const row of entriesResult.results) {
    result[row.employeeId] = (result[row.employeeId] ?? 0) + row.balance
  }
  for (const row of adjustmentsResult.results) {
    result[row.employeeId] = (result[row.employeeId] ?? 0) + row.total
  }
  return result
}
