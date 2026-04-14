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

// A4 landscape usable width ≈ 841 − 2×28 = 785 pt
// Column widths must sum to exactly 785 for flush right edge
const COL = {
  dia:     22,
  sem:     52,
  entrada: 44,
  saidaA:  44,
  retorno: 44,
  saida:   44,
  htrab:   44,
  hextra:  44,
  hfalta:  44,
  obs:     403, // 785 − (22+52+44×7) = 785 − 382 = 403  → generous OBS
} as const

const s = StyleSheet.create({
  page: { padding: 28, fontSize: 8, fontFamily: 'Helvetica' },

  // ── Header ──────────────────────────────────────────────────────────────────
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 10,
  },
  companyName: { fontSize: 14, fontFamily: 'Helvetica-Bold' },
  title:       { fontSize: 12, fontFamily: 'Helvetica-Bold' },
  cnpj:        { fontSize: 8, textAlign: 'right' },
  addressLine: { fontSize: 7, textAlign: 'right', color: '#555' },

  // ── Employee info ────────────────────────────────────────────────────────────
  infoSection: { marginBottom: 4 },
  infoRow:     { flexDirection: 'row', marginBottom: 3 },
  infoLabel:   { fontFamily: 'Helvetica-Bold', width: 44 },
  infoValue:   { flex: 1 },
  infoBlock:   { width: 370, marginRight: 20 },   // left info column
  infoBlockB:  { flex: 1 },                        // right info column

  divider: { borderBottomWidth: 1, borderBottomColor: '#000', marginVertical: 6 },

  // ── Table ────────────────────────────────────────────────────────────────────
  table:    { marginTop: 4 },
  thead:    {
    flexDirection: 'row',
    backgroundColor: '#e8e8e8',
    borderTopWidth: 1,
    borderLeftWidth: 1,
    borderRightWidth: 1,
    borderBottomWidth: 1,
    borderColor: '#888',
  },
  trow:     {
    flexDirection: 'row',
    borderLeftWidth: 1,
    borderRightWidth: 1,
    borderBottomWidth: 0.5,
    borderColor: '#aaa',
  },
  rowAlt:   { backgroundColor: '#f9f9f9' },
  rowSat:   { backgroundColor: '#eff6ff' },
  rowSun:   { backgroundColor: '#f3f3f3' },

  // cell padding shared
  cell: { paddingHorizontal: 3, paddingVertical: 2 },
  thText: { fontFamily: 'Helvetica-Bold', fontSize: 7 },

  cDia:    { width: COL.dia,     paddingHorizontal: 3, paddingVertical: 2, textAlign: 'center' },
  cSem:    { width: COL.sem,     paddingHorizontal: 3, paddingVertical: 2 },
  cHora:   { width: COL.entrada, paddingHorizontal: 3, paddingVertical: 2, textAlign: 'center' },
  cObs:    { width: COL.obs,     paddingHorizontal: 3, paddingVertical: 2 },

  // ── Summary ──────────────────────────────────────────────────────────────────
  summary:      { marginTop: 10, paddingTop: 6, borderTopWidth: 1, borderTopColor: '#000' },
  summaryTitle: { fontFamily: 'Helvetica-Bold', fontSize: 9, marginBottom: 4 },
  summaryRow:   { flexDirection: 'row', marginBottom: 2 },
  summaryLabel: { fontFamily: 'Helvetica-Bold', width: 140, marginRight: 4 },
  summaryBlock: { width: 240, marginRight: 40 },

  // ── Signature ────────────────────────────────────────────────────────────────
  sigArea:  { marginTop: 18, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end' },
  sigLine:  { borderBottomWidth: 1, borderBottomColor: '#000', width: 220, marginTop: 20 },
  sigLabel: { fontSize: 7, color: '#555', marginTop: 2 },
  dateText: { fontSize: 8 },
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
