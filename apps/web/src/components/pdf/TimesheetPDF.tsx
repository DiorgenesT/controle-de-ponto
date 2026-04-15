import { Document, Page, Text, View, StyleSheet } from '@react-pdf/renderer'
import { minutesToTime, getDayOfWeek, isSunday } from '@ponto/shared'
import type { MonthlyReport } from '@ponto/shared'
import { getDaysInMonth } from 'date-fns'

const MONTH_NAMES = [
  '', 'JANEIRO', 'FEVEREIRO', 'MARÇO', 'ABRIL', 'MAIO', 'JUNHO',
  'JULHO', 'AGOSTO', 'SETEMBRO', 'OUTUBRO', 'NOVEMBRO', 'DEZEMBRO',
]

const DAY_TYPE_LABELS: Record<string, string> = {
  worked:   '',
  closed:   'EMPRESA FECHADA',
  holiday:  'FERIADO',
  absence:  'FALTA',
  vacation: 'FÉRIAS',
  medical:  'ATESTADO',
}

// A4 landscape usable width: 841 − 2×18 = 805 pt
// Rows: até 31 dias + cabeçalho. Altura disponível: 595 − 2×18 = 559 pt
// Altura estimada por linha: ~9 pt → 32 linhas = 288 pt → sobram ~271 pt p/ resto
const COL = {
  dia:     20,
  sem:     46,
  entrada: 40,
  saidaA:  40,
  retorno: 40,
  saida:   40,
  htrab:   40,
  hextra:  40,
  hfalta:  40,
  obs:     419, // 805 − (20+46+40×7) = 805 − 346 = 459 → reservamos 419, margem interna
} as const

const s = StyleSheet.create({
  page: { padding: 18, fontSize: 7, fontFamily: 'Helvetica' },

  // ── Header ──────────────────────────────────────────────────────────────────
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 5,
  },
  companyName: { fontSize: 11, fontFamily: 'Helvetica-Bold' },
  title:       { fontSize: 10, fontFamily: 'Helvetica-Bold' },
  cnpj:        { fontSize: 7, textAlign: 'right' },
  addressLine: { fontSize: 6.5, textAlign: 'right', color: '#555' },

  // ── Employee info ────────────────────────────────────────────────────────────
  infoSection: { marginBottom: 2 },
  infoRow:     { flexDirection: 'row', marginBottom: 2 },
  infoLabel:   { fontFamily: 'Helvetica-Bold', width: 40 },
  infoValue:   { flex: 1 },
  infoBlock:   { width: 370, marginRight: 20 },
  infoBlockB:  { flex: 1 },

  divider: { borderBottomWidth: 0.75, borderBottomColor: '#000', marginVertical: 4 },

  // ── Table ────────────────────────────────────────────────────────────────────
  table:    { marginTop: 2 },
  thead:    {
    flexDirection: 'row',
    backgroundColor: '#e8e8e8',
    borderTopWidth: 0.75,
    borderLeftWidth: 0.75,
    borderRightWidth: 0.75,
    borderBottomWidth: 0.75,
    borderColor: '#888',
  },
  trow:     {
    flexDirection: 'row',
    borderLeftWidth: 0.75,
    borderRightWidth: 0.75,
    borderBottomWidth: 0.5,
    borderColor: '#aaa',
  },
  rowAlt:   { backgroundColor: '#f9f9f9' },
  rowSat:   { backgroundColor: '#eff6ff' },
  rowSun:   { backgroundColor: '#f3f3f3' },

  thText: { fontFamily: 'Helvetica-Bold', fontSize: 6.5 },

  cDia:    { width: COL.dia,     paddingHorizontal: 2, paddingVertical: 1.5, textAlign: 'center' },
  cSem:    { width: COL.sem,     paddingHorizontal: 2, paddingVertical: 1.5 },
  cHora:   { width: COL.entrada, paddingHorizontal: 2, paddingVertical: 1.5, textAlign: 'center' },
  cObs:    { width: COL.obs,     paddingHorizontal: 2, paddingVertical: 1.5 },

  // ── Summary ──────────────────────────────────────────────────────────────────
  summary:      { marginTop: 5, paddingTop: 4, borderTopWidth: 0.75, borderTopColor: '#000' },
  summaryTitle: { fontFamily: 'Helvetica-Bold', fontSize: 7.5, marginBottom: 3 },
  summaryRow:   { flexDirection: 'row', marginBottom: 1.5 },
  summaryLabel: { fontFamily: 'Helvetica-Bold', width: 130, marginRight: 4 },
  summaryBlock: { width: 230, marginRight: 40 },

  // ── Signature ────────────────────────────────────────────────────────────────
  sigArea:  { marginTop: 10, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end' },
  sigLine:  { borderBottomWidth: 0.75, borderBottomColor: '#000', width: 200, marginTop: 14 },
  sigLabel: { fontSize: 6.5, color: '#555', marginTop: 2 },
  dateText: { fontSize: 7 },
})

interface Props {
  report: MonthlyReport
}

export function TimesheetPDF({ report }: Props) {
  const { employee, company, year, month, entries } = report
  const daysInMonth = getDaysInMonth(new Date(year, month - 1))
  const monthName = MONTH_NAMES[month] ?? ''

  const rows = Array.from({ length: daysInMonth }, (_, i) => {
    const day = i + 1
    const date = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
    const dayOfWeek = getDayOfWeek(date)
    const entry = entries.find((e) => e.entryDate === date)
    return { day, date, dayOfWeek, isSunday: isSunday(date), entry }
  })

  return (
    <Document title={`Folha de Ponto — ${employee.name} — ${monthName} ${year}`}>
      <Page size="A4" orientation="landscape" style={s.page}>

        {/* ── Header ─────────────────────────────────────────────────────────── */}
        <View style={s.headerRow}>
          <Text style={s.companyName}>{company.name}</Text>
          <Text style={s.title}>FOLHA DE PONTO</Text>
          <View>
            <Text style={s.cnpj}>CNPJ: {company.cnpj}</Text>
            {company.address && <Text style={s.addressLine}>{company.address}</Text>}
            {company.city    && <Text style={s.addressLine}>{company.city}</Text>}
          </View>
        </View>

        <View style={s.divider} />

        {/* ── Employee info ───────────────────────────────────────────────────── */}
        <View style={[s.infoRow, { marginBottom: 3 }]}>
          <View style={s.infoBlock}>
            <View style={s.infoRow}>
              <Text style={s.infoLabel}>Nome:</Text>
              <Text style={s.infoValue}>{employee.name}</Text>
            </View>
          </View>
          <View style={s.infoBlockB}>
            <View style={s.infoRow}>
              <Text style={s.infoLabel}>Função:</Text>
              <Text style={s.infoValue}>{employee.role}</Text>
            </View>
          </View>
        </View>
        {employee.cpf && (
          <View style={[s.infoRow, { marginBottom: 3 }]}>
            <View style={s.infoBlock}>
              <View style={s.infoRow}>
                <Text style={s.infoLabel}>CPF:</Text>
                <Text style={s.infoValue}>{employee.cpf}</Text>
              </View>
            </View>
          </View>
        )}
        <View style={s.infoRow}>
          <View style={s.infoBlock}>
            <View style={s.infoRow}>
              <Text style={s.infoLabel}>Mês:</Text>
              <Text style={s.infoValue}>{monthName} / {year}</Text>
            </View>
          </View>
          <View style={s.infoBlockB}>
            <View style={s.infoRow}>
              <Text style={s.infoLabel}>Horário:</Text>
              <Text style={s.infoValue}>
                SEG A SEX {employee.weekdayStart} ÀS {employee.weekdayEnd}
                {employee.worksSaturday
                  ? `   |   SÁB ${employee.saturdayStart} ÀS ${employee.saturdayEnd}`
                  : ''}
              </Text>
            </View>
          </View>
        </View>

        <View style={s.divider} />

        {/* ── Table ──────────────────────────────────────────────────────────── */}
        <View style={s.table}>
          {/* Header row */}
          <View style={s.thead}>
            <Text style={[s.cDia,  s.thText]}>DIA</Text>
            <Text style={[s.cSem,  s.thText]}>DIA SEM.</Text>
            <Text style={[s.cHora, s.thText]}>ENTRADA</Text>
            <Text style={[s.cHora, s.thText]}>SAÍDA ALM.</Text>
            <Text style={[s.cHora, s.thText]}>RETORNO</Text>
            <Text style={[s.cHora, s.thText]}>SAÍDA</Text>
            <Text style={[s.cHora, s.thText]}>H. TRAB.</Text>
            <Text style={[s.cHora, s.thText]}>H. EXTRA</Text>
            <Text style={[s.cHora, s.thText]}>H. FALTA</Text>
            <Text style={[s.cObs,  s.thText]}>OBS.</Text>
          </View>

          {/* Data rows */}
          {rows.map(({ day, date, dayOfWeek, isSunday: sun, entry }) => {
            const isSat = dayOfWeek === 'SÁBADO'
            const rowBg = sun ? s.rowSun : isSat ? s.rowSat : day % 2 === 0 ? s.rowAlt : null
            const rowStyle = rowBg ? [s.trow, rowBg] : [s.trow]

            const obs = entry?.dayType && entry.dayType !== 'worked'
              ? DAY_TYPE_LABELS[entry.dayType] ?? ''
              : (entry?.notes ?? '')

            return (
              <View key={date} style={rowStyle}>
                <Text style={s.cDia}>{day}</Text>
                <Text style={s.cSem}>{dayOfWeek}</Text>

                {sun ? (
                  <>
                    <Text style={s.cHora} />
                    <Text style={s.cHora} />
                    <Text style={s.cHora} />
                    <Text style={s.cHora} />
                    <Text style={s.cHora} />
                    <Text style={s.cHora} />
                    <Text style={s.cHora} />
                    <Text style={[s.cObs, { color: '#999', fontSize: 7 }]}>Domingo — Folga</Text>
                  </>
                ) : (
                  <>
                    <Text style={s.cHora}>{entry?.clockIn   ?? ''}</Text>
                    <Text style={s.cHora}>{entry?.lunchOut  ?? ''}</Text>
                    <Text style={s.cHora}>{entry?.lunchReturn ?? ''}</Text>
                    <Text style={s.cHora}>{entry?.clockOut  ?? ''}</Text>
                    <Text style={s.cHora}>
                      {entry?.workedMinutes != null ? minutesToTime(entry.workedMinutes) : ''}
                    </Text>
                    <Text style={s.cHora}>
                      {entry?.extraMinutes  ? minutesToTime(entry.extraMinutes)  : ''}
                    </Text>
                    <Text style={s.cHora}>
                      {entry?.missingMinutes ? minutesToTime(entry.missingMinutes) : ''}
                    </Text>
                    <Text style={s.cObs}>{obs}</Text>
                  </>
                )}
              </View>
            )
          })}
        </View>

        {/* ── Summary ────────────────────────────────────────────────────────── */}
        <View style={s.summary}>
          <Text style={s.summaryTitle}>RESUMO GERAL</Text>
          <View style={{ flexDirection: 'row' }}>
            <View style={s.summaryBlock}>
              <View style={s.summaryRow}>
                <Text style={s.summaryLabel}>Horas Extras:</Text>
                <Text>{minutesToTime(report.totalExtraMinutes)}</Text>
              </View>
              <View style={s.summaryRow}>
                <Text style={s.summaryLabel}>Horas Faltas:</Text>
                <Text>{report.totalMissingMinutes > 0 ? '-' : ''}{minutesToTime(report.totalMissingMinutes)}</Text>
              </View>
              <View style={s.summaryRow}>
                <Text style={s.summaryLabel}>Saldo do Mês:</Text>
                <Text>{report.balanceMinutes >= 0 ? '+' : ''}{minutesToTime(report.balanceMinutes)}</Text>
              </View>
            </View>
            <View>
              <View style={s.summaryRow}>
                <Text style={s.summaryLabel}>Saldo Acumulado Anterior:</Text>
                <Text>{report.previousMonthAccumulated >= 0 ? '+' : ''}{minutesToTime(report.previousMonthAccumulated)}</Text>
              </View>
              <View style={s.summaryRow}>
                <Text style={s.summaryLabel}>Total Acumulado:</Text>
                <Text style={{ fontFamily: 'Helvetica-Bold' }}>
                  {report.accumulatedMinutes >= 0 ? '+' : ''}{minutesToTime(report.accumulatedMinutes)}
                </Text>
              </View>
            </View>
          </View>
        </View>

        {/* ── Signature ──────────────────────────────────────────────────────── */}
        <View style={s.sigArea}>
          <Text style={s.dateText}>
            Data: _______ de ___________________________ de ____________.
          </Text>
          <View>
            <View style={s.sigLine} />
            <Text style={s.sigLabel}>Assinatura do Empregado</Text>
          </View>
        </View>

      </Page>
    </Document>
  )
}
