# Banco de Horas — saldo acumulado ao vivo, aviso de saldo e ajustes manuais

## Contexto

O app já suporta lançar um dia como `banco_horas` (folga compensada por saldo
acumulado) e fechar meses manualmente em `hour_bank` para consolidar o saldo.
Dois problemas motivam esta mudança:

1. Ao marcar um dia como `banco_horas`, nada indica se o funcionário tem
   saldo suficiente — o sistema simplesmente debita as horas esperadas do
   dia, podendo levar o saldo a ficar negativo sem aviso.
2. O sistema começou a ser usado recentemente. Existem meses anteriores ao
   início do uso com saldo de banco de horas apurado manualmente (planilha /
   sistema anterior) que não têm `time_entries` no banco — não há como
   registrar esse saldo inicial hoje.

Durante o design, ficou definido que o saldo acumulado deve propagar
automaticamente mês a mês **sem depender de uma ação manual de "fechar
mês"** — o que elimina a necessidade da tabela `hour_bank` como snapshot de
fechamento e simplifica o cálculo para ser sempre derivado ao vivo dos
`time_entries`.

## Objetivo

- Ao marcar um dia como `banco_horas` na tela de lançamento, mostrar
  (sem bloquear) um aviso quando o saldo acumulado disponível até aquele
  dia for insuficiente para cobrir as horas esperadas do dia.
- Permitir que admin/manager lancem um **ajuste manual** de saldo (positivo
  ou negativo, com observação) para qualquer mês de qualquer funcionário —
  usado principalmente para injetar o saldo histórico de meses anteriores
  ao uso do sistema, mas também serve para correções pontuais.
- Saldo acumulado passa a ser sempre calculado ao vivo, a partir de
  `time_entries` + ajustes manuais — nunca depende de uma etapa de
  "fechamento" de mês.

## Fora de escopo

- Qualquer trava/lock de edição em meses passados (não existe hoje e não é
  adicionada agora).
- Alterar a semântica do dia `banco_horas` no cálculo diário
  (`calculateDay` em `packages/shared/src/calculations.ts`) — o dia
  continua debitando `expectedMinutes` como hoje.
- Relatórios de auditoria de quem lançou cada ajuste (guardamos apenas a
  nota livre, sem `created_by`).

## Modelo de dados

### Migration `003_hour_bank_adjustments.sql`

A tabela `hour_bank` deixa de ser um snapshot de fechamento mensal (campos
`total_worked_minutes`, `total_extra_minutes`, `total_missing_minutes`,
`balance_minutes`, `accumulated_minutes`, `closed`, `closed_at`) e passa a
armazenar **apenas ajustes manuais**. Os campos removidos são descartáveis
porque passam a ser 100% recalculáveis a partir de `time_entries`; nenhuma
informação nova se perde.

```sql
PRAGMA foreign_keys = OFF;

CREATE TABLE hour_bank_new (
  id                  TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  employee_id         TEXT NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  year                INTEGER NOT NULL,
  month               INTEGER NOT NULL,
  adjustment_minutes  INTEGER NOT NULL DEFAULT 0,
  note                TEXT,
  created_at          TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at          TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(employee_id, year, month)
);

DROP TABLE hour_bank;
ALTER TABLE hour_bank_new RENAME TO hour_bank;

CREATE INDEX IF NOT EXISTS idx_hour_bank_employee ON hour_bank(employee_id);

PRAGMA foreign_keys = ON;
```

Só existe uma linha por `(employee_id, year, month)` quando há um ajuste
manual real. Um ajuste zerado (0 minutos, sem nota) é removido, não
persistido como linha vazia.

### `packages/shared/src/types.ts`

Substituir a interface `HourBank` (não usada fora de `types.ts` hoje) por:

```ts
export interface HourBankAdjustment {
  id: string
  employeeId: string
  year: number
  month: number
  adjustmentMinutes: number
  note: string | null
  createdAt: string
  updatedAt: string
}
```

## Cálculo do saldo acumulado

Nova função auxiliar no backend (`apps/api/src/lib/hourBank.ts` ou similar),
usada por todos os pontos que hoje precisam de saldo acumulado:

```ts
async function getAccumulatedBeforeMonth(
  db: D1Database,
  employeeId: string,
  year: number,
  month: number
): Promise<number> {
  const startDate = `${year}-${String(month).padStart(2, '0')}-01`

  const [entriesBalance, adjustmentsBalance] = await Promise.all([
    db.prepare(
      `SELECT COALESCE(SUM(extra_minutes), 0) - COALESCE(SUM(missing_minutes), 0) AS balance
       FROM time_entries
       WHERE employee_id = ? AND entry_date < ?`
    ).bind(employeeId, startDate).first<{ balance: number }>(),
    db.prepare(
      `SELECT COALESCE(SUM(adjustment_minutes), 0) AS total
       FROM hour_bank
       WHERE employee_id = ? AND (year < ? OR (year = ? AND month < ?))`
    ).bind(employeeId, year, year, month).first<{ total: number }>(),
  ])

  return (entriesBalance?.balance ?? 0) + (adjustmentsBalance?.total ?? 0)
}
```

O acumulado **do próprio mês** (usado em relatórios) soma também o ajuste
lançado para aquele mês específico, se existir:

```
accumulatedMinutes(mês) =
    getAccumulatedBeforeMonth(mês)
  + balanceMinutes(mês)                 // extra - missing, calculado dos time_entries do mês
  + adjustmentMinutes(mês, se existir)  // ajuste lançado diretamente nesse mês
```

Isso cobre tanto meses históricos sem `time_entries` (balance = 0, acumulado
= acumulado anterior + ajuste) quanto correções pontuais em meses com
lançamentos reais.

## Backend — mudanças em `apps/api/src/routes/reports.ts`

- **Remove** `POST /reports/hourbank/close`.
- **`GET /reports/hourbank?employeeId=`** — passa a retornar a lista de
  ajustes (`HourBankAdjustment[]`) do funcionário, ordenada por
  `year DESC, month DESC`. Acessível a qualquer role autenticado (mesmo
  padrão de leitura dos outros relatórios).
- **Novo `POST /reports/hourbank/adjustment`** (`admin`/`manager`, mesmo
  padrão de `requireRole` usado hoje):
  - Body: `{ employeeId, year, month, adjustmentMinutes, note? }`
    (schema zod novo em `packages/shared/src/schemas.ts`).
  - Se `adjustmentMinutes === 0` e não há nota: `DELETE` da linha
    `(employee_id, year, month)` se existir; responde com o estado
    removido.
  - Caso contrário: `INSERT ... ON CONFLICT DO UPDATE` (mesmo padrão já
    usado em `hourbank/close` hoje) setando `adjustment_minutes`, `note`,
    `updated_at`.
  - Responde com a linha resultante.
- **`GET /reports/monthly`**: troca a query que lê `accumulated_minutes` da
  última linha fechada pela chamada a `getAccumulatedBeforeMonth` +
  soma do ajuste do próprio mês (se existir uma linha `hour_bank` para
  `year`/`month`).
- **`GET /reports/dashboard`**: mesma troca — para cada funcionário ativo,
  `prevAccumulated` passa a vir de `getAccumulatedBeforeMonth` em vez da
  leitura de linhas de `hour_bank` anteriores. Dado que hoje já é uma
  query em lote por `companyId`, ajustar para uma query agregada por
  `employee_id` (`GROUP BY`) equivalente à função acima, evitando N+1.

## Frontend

### `apps/web/src/lib/api.ts`

```ts
export const reportsApi = {
  monthly: (...) => ...,           // inalterado
  hourBank: (employeeId: string) => // agora retorna ajustes
    request<{ data: HourBankAdjustment[] }>(`/reports/hourbank?employeeId=${employeeId}`),
  dashboard: (...) => ...,         // inalterado
  setAdjustment: (employeeId: string, year: number, month: number, adjustmentMinutes: number, note: string | null) =>
    request('/reports/hourbank/adjustment', {
      method: 'POST',
      body: JSON.stringify({ employeeId, year, month, adjustmentMinutes, note }),
    }),
}
```

Remove `closeMonth`.

### `apps/web/src/pages/reports/ReportsPage.tsx`

- Remove o card "Fechar Mês" (botão, badge "Fechado", `closeMutation`,
  `currentMonthBank?.closed`).
- Novo card "Ajuste de Banco de Horas" (visível só para `canClose`
  — renomear a variável para `canAdjust`):
  - Input de horas (aceita `+`/`-`, formato `HH:MM`, convertido para
    minutos) pré-preenchido com o ajuste existente do mês navegado, se
    houver.
  - Campo de observação (texto livre).
  - Botão "Salvar Ajuste" chamando `reportsApi.setAdjustment` para o
    `(currentYear, currentMonth)` navegado.
  - Lista "Histórico" abaixo mostra apenas os ajustes existentes
    (`hourBankRecords`), com mês, valor do ajuste e nota — sem os campos
    de totais/fechamento que não existem mais.

### `apps/web/src/pages/timesheet/TimesheetPage.tsx`

- Busca em paralelo `reportsApi.monthly(selectedEmployeeId, currentYear, currentMonth)`
  (mesma query já usada pela ReportsPage) só para ler
  `previousMonthAccumulated` — não precisa dos outros campos do payload.
- Ao editar uma linha (`isEditing`) com `fd.dayType === 'banco_horas'`:
  - Calcula `saldoAntes = previousMonthAccumulated + soma(extraMinutes - missingMinutes das outras entries do mês, excluindo o dia em edição)`.
  - Calcula `consumoDoDia = preview.missingMinutes` (horas esperadas do
    dia, já calculadas pelo `calculateDay` existente).
  - Se `saldoAntes < consumoDoDia`, mostra um aviso inline na linha (ex.:
    ícone + texto abaixo do seletor de tipo): "Saldo insuficiente:
    disponível `minutesToTime(saldoAntes)`, este dia consome
    `minutesToTime(consumoDoDia)`. Saldo ficará
    `minutesToTime(saldoAntes - consumoDoDia)`." Não bloqueia o botão
    salvar.

## Casos de borda

- Mês histórico sem nenhum `time_entry`: `balanceMinutes = 0`,
  `accumulatedMinutes = acumulado anterior + adjustmentMinutes`.
- Editar um `time_entry` de um mês passado: o acumulado de todos os meses
  seguintes reflete a mudança automaticamente na próxima leitura (nada para
  recalcular/cascatear, pois é sempre somado ao vivo).
- Re-lançar um ajuste no mesmo mês sobrescreve o valor anterior (não
  acumula) — comportamento de upsert simples.
- Zerar um ajuste (0 minutos, sem nota) remove a linha, mantendo a tabela
  só com ajustes reais.
- Funcionário sem nenhum ajuste e sem `time_entries` anteriores: saldo
  acumulado antes do mês = 0 (comportamento atual preservado).

## Testes

- `packages/shared`: sem mudança de lógica em `calculateDay` — não precisa
  de novos testes ali.
- `apps/api`: testes de integração para `getAccumulatedBeforeMonth`
  cobrindo (a) sem entries nem ajustes, (b) só entries, (c) só ajustes,
  (d) combinação; testes para `POST /reports/hourbank/adjustment`
  (upsert, delete ao zerar, autorização `admin`/`manager` apenas).
- Verificação manual na UI: lançar um ajuste num mês antigo sem entries e
  conferir que o saldo acumulado do mês seguinte (com entries reais) reflete
  o ajuste; marcar um dia como `banco_horas` sem saldo suficiente e conferir
  o aviso inline.
