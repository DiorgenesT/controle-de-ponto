import { useEffect, useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { PDFDownloadLink } from '@react-pdf/renderer'
import { format } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { employeesApi, reportsApi } from '@/lib/api'
import type { Employee, MonthlyReport, HourBankAdjustment } from '@ponto/shared'
import { minutesToTime } from '@ponto/shared'
import { useAuthStore } from '@/store/auth'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { TimesheetPDF } from '@/components/pdf/TimesheetPDF'
import { toast } from '@/hooks/use-toast'
import { FileDown, ChevronLeft, ChevronRight, AlertCircle, History } from 'lucide-react'

function parseHoursInput(input: string): number | null {
  const trimmed = input.trim()
  if (trimmed === '') return 0
  const match = /^([+-]?)(\d{1,3}):(\d{2})$/.exec(trimmed)
  if (!match) return null
  const sign = match[1] === '-' ? -1 : 1
  const hours = Number(match[2])
  const minutes = Number(match[3])
  return sign * (hours * 60 + minutes)
}

export function ReportsPage() {
  const { user } = useAuthStore()
  const queryClient = useQueryClient()
  const canAdjust = user?.role === 'admin' || user?.role === 'manager'

  const [selectedEmployeeId, setSelectedEmployeeId] = useState('')
  const [currentYear, setCurrentYear] = useState(new Date().getFullYear())
  const [currentMonth, setCurrentMonth] = useState(new Date().getMonth() + 1)
  const [adjustmentInput, setAdjustmentInput] = useState('')
  const [adjustmentNote, setAdjustmentNote] = useState('')

  const { data: employeesData } = useQuery({
    queryKey: ['employees'],
    queryFn: () => employeesApi.list(),
  })

  const employees = (employeesData?.data ?? []) as Employee[]

  const { data: reportData, isLoading } = useQuery({
    queryKey: ['reports', 'monthly', selectedEmployeeId, currentYear, currentMonth],
    queryFn: () => reportsApi.monthly(selectedEmployeeId, currentYear, currentMonth),
    enabled: Boolean(selectedEmployeeId),
  })

  const report = reportData?.data as MonthlyReport | undefined

  const { data: hourBankData } = useQuery({
    queryKey: ['reports', 'hourbank', selectedEmployeeId],
    queryFn: () => reportsApi.hourBank(selectedEmployeeId),
    enabled: Boolean(selectedEmployeeId),
  })

  const hourBankRecords = (hourBankData?.data ?? []) as HourBankAdjustment[]
  const currentMonthBank = hourBankRecords.find(r => r.year === currentYear && r.month === currentMonth)

  useEffect(() => {
    const minutes = currentMonthBank?.adjustmentMinutes ?? 0
    setAdjustmentInput(minutes === 0 ? '' : (minutes > 0 ? '+' : '') + minutesToTime(minutes))
    setAdjustmentNote(currentMonthBank?.note ?? '')
  }, [selectedEmployeeId, currentYear, currentMonth, currentMonthBank])

  const adjustMutation = useMutation({
    mutationFn: () => {
      const minutes = parseHoursInput(adjustmentInput)
      if (minutes === null) throw new Error('Formato inválido. Use +HH:MM ou -HH:MM')
      return reportsApi.setAdjustment(selectedEmployeeId, currentYear, currentMonth, minutes, adjustmentNote || null)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['reports', 'hourbank', selectedEmployeeId] })
      queryClient.invalidateQueries({ queryKey: ['reports', 'monthly', selectedEmployeeId] })
      toast({ title: 'Ajuste salvo!', variant: 'success' })
    },
    onError: (err: Error) => toast({ title: err.message, variant: 'destructive' }),
  })

  function navigate(dir: -1 | 1) {
    let y = currentYear
    let m = currentMonth + dir
    if (m < 1) { m = 12; y-- }
    if (m > 12) { m = 1; y++ }
    setCurrentYear(y)
    setCurrentMonth(m)
  }

  const monthLabel = format(new Date(currentYear, currentMonth - 1), 'MMMM yyyy', { locale: ptBR })

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Relatórios</h1>
        <p className="text-muted-foreground">Visualize e exporte a folha de ponto em PDF</p>
      </div>

      {/* Controls */}
      <div className="flex flex-wrap items-center gap-3">
        <select
          className="h-9 rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm"
          value={selectedEmployeeId}
          onChange={(e) => setSelectedEmployeeId(e.target.value)}
        >
          <option value="">Selecione um funcionário</option>
          {employees.map((e) => (
            <option key={e.id} value={e.id}>{e.name}</option>
          ))}
        </select>

        <div className="flex items-center gap-2 ml-auto">
          <Button variant="outline" size="icon" onClick={() => navigate(-1)}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <span className="text-sm font-medium capitalize min-w-32 text-center">{monthLabel}</span>
          <Button variant="outline" size="icon" onClick={() => navigate(1)}>
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {!selectedEmployeeId ? (
        <Card>
          <CardContent className="py-16 text-center text-muted-foreground">
            <AlertCircle className="h-8 w-8 mx-auto mb-2 opacity-40" />
            <p>Selecione um funcionário para gerar o relatório</p>
          </CardContent>
        </Card>
      ) : isLoading ? (
        <Card>
          <CardContent className="py-16 text-center text-muted-foreground text-sm">
            Carregando relatório...
          </CardContent>
        </Card>
      ) : !report ? (
        <Card>
          <CardContent className="py-16 text-center text-muted-foreground">
            <p>Nenhum dado para este período</p>
          </CardContent>
        </Card>
      ) : (
        <>
          {/* Summary Cards */}
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Card>
              <CardContent className="pt-6">
                <p className="text-xs text-muted-foreground mb-1">H. Extras</p>
                <p className="text-2xl font-bold text-success">+{minutesToTime(report.totalExtraMinutes)}</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <p className="text-xs text-muted-foreground mb-1">H. Faltas</p>
                <p className="text-2xl font-bold text-destructive">-{minutesToTime(report.totalMissingMinutes)}</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <p className="text-xs text-muted-foreground mb-1">Saldo do Mês</p>
                <p className={`text-2xl font-bold ${report.balanceMinutes >= 0 ? 'text-success' : 'text-destructive'}`}>
                  {report.balanceMinutes >= 0 ? '+' : ''}{minutesToTime(report.balanceMinutes)}
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <p className="text-xs text-muted-foreground mb-1">Saldo Acumulado</p>
                <p className={`text-2xl font-bold ${report.accumulatedMinutes >= 0 ? 'text-success' : 'text-destructive'}`}>
                  {report.accumulatedMinutes >= 0 ? '+' : ''}{minutesToTime(report.accumulatedMinutes)}
                </p>
              </CardContent>
            </Card>
          </div>

          {/* PDF Export Card */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle className="text-base capitalize">
                  Folha de Ponto — {report.employee.name}
                </CardTitle>
                <p className="text-sm text-muted-foreground capitalize mt-1">{monthLabel}</p>
              </div>
              <PDFDownloadLink
                document={<TimesheetPDF report={report} />}
                fileName={`folha-ponto-${report.employee.name.toLowerCase().replace(/\s+/g, '-')}-${currentYear}-${String(currentMonth).padStart(2, '0')}.pdf`}
              >
                {({ loading }) => (
                  <Button disabled={loading}>
                    <FileDown className="h-4 w-4" />
                    {loading ? 'Gerando PDF...' : 'Baixar PDF'}
                  </Button>
                )}
              </PDFDownloadLink>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-2">
                <Badge variant="secondary">{report.employee.name}</Badge>
                <Badge variant="secondary">{report.employee.role}</Badge>
                <Badge variant="secondary">
                  {report.employee.weekdayStart}–{report.employee.weekdayEnd}
                </Badge>
                <Badge variant="outline">{report.entries.length} registros</Badge>
              </div>
            </CardContent>
          </Card>

          {/* Ajuste de Banco de Horas */}
          {canAdjust && (
            <Card>
              <CardHeader className="py-4">
                <CardTitle className="text-base">Ajuste de Banco de Horas</CardTitle>
                <p className="text-sm text-muted-foreground mt-0.5 capitalize">
                  Lança um ajuste manual de saldo para {monthLabel} — use para injetar saldo de meses
                  anteriores ao uso do sistema ou corrigir divergências.
                </p>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex flex-wrap items-end gap-3">
                  <div>
                    <label className="text-xs text-muted-foreground block mb-1" htmlFor="adjustment-minutes">
                      Horas (±HH:MM)
                    </label>
                    <Input
                      id="adjustment-minutes"
                      className="h-9 w-32 font-mono"
                      placeholder="+02:30"
                      value={adjustmentInput}
                      onChange={(e) => setAdjustmentInput(e.target.value)}
                    />
                  </div>
                  <div className="flex-1 min-w-48">
                    <label className="text-xs text-muted-foreground block mb-1" htmlFor="adjustment-note">
                      Observação
                    </label>
                    <Input
                      id="adjustment-note"
                      className="h-9"
                      placeholder="Ex: saldo migrado do controle anterior"
                      value={adjustmentNote}
                      onChange={(e) => setAdjustmentNote(e.target.value)}
                    />
                  </div>
                  <Button size="sm" onClick={() => adjustMutation.mutate()} disabled={adjustMutation.isPending}>
                    {adjustMutation.isPending ? 'Salvando...' : 'Salvar Ajuste'}
                  </Button>
                </div>

                {hourBankRecords.length > 0 && (
                  <div>
                    <div className="flex items-center gap-2 mb-3">
                      <History className="h-4 w-4 text-muted-foreground" />
                      <span className="text-sm font-medium">Histórico de Ajustes</span>
                    </div>
                    <div className="space-y-1">
                      {hourBankRecords.slice(0, 12).map((r) => {
                        const monthName = new Date(r.year, r.month - 1).toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })
                        return (
                          <div key={r.id} className="flex items-center justify-between py-1.5 text-sm border-b last:border-0">
                            <span className="capitalize text-muted-foreground">{monthName}</span>
                            <div className="flex items-center gap-4">
                              {r.note && <span className="text-xs text-muted-foreground italic">{r.note}</span>}
                              <span className={`font-mono font-medium text-xs w-16 text-right ${r.adjustmentMinutes >= 0 ? 'text-success' : 'text-destructive'}`}>
                                {r.adjustmentMinutes >= 0 ? '+' : ''}{minutesToTime(r.adjustmentMinutes)}
                              </span>
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          )}
        </>
      )}
    </div>
  )
}
