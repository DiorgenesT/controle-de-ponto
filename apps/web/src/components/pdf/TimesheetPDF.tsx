import { Document, Page, Text, View, StyleSheet } from '@react-pdf/renderer'
import { minutesToTime, getDayOfWeek, isSunday } from '@ponto/shared'
import type { MonthlyReport } from '@ponto/shared'
import { getDaysInMonth } from 'date-fns'

const MONTH_NAMES = [
  '', 'JANEIRO', 'FEVEREIRO', 'MARÇO', 'ABRIL', 'MAIO', 'JUNHO',
  'JULHO', 'AGOSTO', 'SETEMBRO', 'OUTUBRO', 'NOVEMBRO', 'DEZEMBRO',
]

const DAY_TYPE_LABELS: Record<string, string> = {
  normal: '',
  closed: 'FECHADO',
  holiday: 'FERIADO',
  absence: 'FALTA',
  vacation: 'FÉRIAS',
}

const s = StyleSheet.create({
  page: { padding: 28, fontSize: 8, fontFamily: 'Helvetica' },
  header: { marginBottom: 10 },
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  companyName: { fontSize: 14, fontFamily: 'Helvetica-Bold' },
  title: { fontSize: 12, fontFamily: 'Helvetica-Bold', textAlign: 'center' },
  cnpj: { fontSize: 8, textAlign: 'right' },
  addressLine: { fontSize: 7, textAlign: 'right', color: '#555' },

  infoRow: { flexDirection: 'row', marginBottom: 3 },
  infoLabel: { fontFamily: 'Helvetica-Bold', marginRight: 4 },
  infoValue: { flex: 1 },

  divider: { borderBottomWidth: 1, borderBottomColor: '#000', marginVertical: 6 },

  // Table
  table: { marginTop: 6 },
  tableHead: { flexDirection: 'row', backgroundColor: '#f0f0f0', borderWidth: 1, borderColor: '#999' },
  tableRow: { flexDirection: 'row', borderBottomWidth: 0.5, borderLeftWidth: 1, borderRightWidth: 1, borderColor: '#999' },
  tableRowAlt: { backgroundColor: '#fafafa' },
  tableRowSat: { backgroundColor: '#eff6ff' },
  tableRowSun: { backgroundColor: '#f5f5f5' },

  col0: { width: 22, paddingHorizontal: 3, paddingVertical: 2, textAlign: 'center' }, // DIA
  col1: { width: 50, paddingHorizontal: 3, paddingVertical: 2 },  // DIA SEM
  col2: { width: 38, paddingHorizontal: 3, paddingVertical: 2, textAlign: 'center' }, // ENTRADA
  col3: { width: 38, paddingHorizontal: 3, paddingVertical: 2, textAlign: 'center' }, // SAÍDA ALM
  col4: { width: 38, paddingHorizontal: 3, paddingVertical: 2, textAlign: 'center' }, // RETORNO
  col5: { width: 38, paddingHorizontal: 3, paddingVertical: 2, textAlign: 'center' }, // SAÍDA
  col6: { width: 38, paddingHorizontal: 3, paddingVertical: 2, textAlign: 'center' }, // H TRAB
  col7: { width: 38, paddingHorizontal: 3, paddingVertical: 2, textAlign: 'center' }, // EXTRA
  col8: { width: 38, paddingHorizontal: 3, paddingVertical: 2, textAlign: 'center' }, // FALTA
  col9: { flex: 1, paddingHorizontal: 3, paddingVertical: 2 }, // OBS

  thText: { fontFamily: 'Helvetica-Bold', fontSize: 7 },

  summary: { marginTop: 10, paddingTop: 6, borderTopWidth: 1, borderTopColor: '#000' },
  summaryTitle: { fontFamily: 'Helvetica-Bold', fontSize: 9, marginBottom: 4 },
  summaryRow: { flexDirection: 'row', marginBottom: 2 },
  summaryLabel: { fontFamily: 'Helvetica-Bold', marginRight: 4, width: 120 },

  signatureArea: { marginTop: 20, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end' },
  signatureLine: { borderBottomWidth: 1, borderBottomColor: '#000', width: 220, marginTop: 20 },
  signatureLabel: { fontSize: 7, color: '#555', marginTop: 2 },
  dateArea: { fontSize: 8 },
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
        {/* Header */}
        <View style={s.header}>
          <View style={s.headerRow}>
            <Text style={s.companyName}>{company.name}</Text>
            <Text style={s.title}>FOLHA DE PONTO</Text>
            <View>
              <Text style={s.cnpj}>CNPJ: {company.cnpj}</Text>
              {company.address && <Text style={s.addressLine}>{company.address}</Text>}
              {company.city && <Text style={s.addressLine}>{company.city}</Text>}
            </View>
          </View>
        </View>

        <View style={s.divider} />

        {/* Employee info */}
        <View style={{ flexDirection: 'row', gap: 20, marginBottom: 6 }}>
          <View style={s.infoRow}>
            <Text style={s.infoLabel}>Nome:</Text>
            <Text style={s.infoValue}>{employee.name}</Text>
          </View>
          <View style={s.infoRow}>
            <Text style={s.infoLabel}>Função:</Text>
            <Text style={s.infoValue}>{employee.role}</Text>
          </View>
        </View>
        <View style={{ flexDirection: 'row', gap: 20, marginBottom: 4 }}>
          <View style={s.infoRow}>
            <Text style={s.infoLabel}>Mês:</Text>
            <Text style={s.infoValue}>{monthName} / {year}</Text>
          </View>
          <View style={s.infoRow}>
            <Text style={s.infoLabel}>Horário:</Text>
            <Text style={s.infoValue}>
              SEG A SEX {employee.weekdayStart} ÀS {employee.weekdayEnd}
              {employee.worksSaturday ? `  |  SÁB ${employee.saturdayStart} ÀS ${employee.saturdayEnd}` : ''}
            </Text>
          </View>
        </View>

        <View style={s.divider} />

        {/* Table */}
        <View style={s.table}>
          {/* Header */}
          <View style={s.tableHead}>
            <Text style={[s.col0, s.thText]}>DIA</Text>
            <Text style={[s.col1, s.thText]}>DIA SEM.</Text>
            <Text style={[s.col2, s.thText]}>ENTRADA</Text>
            <Text style={[s.col3, s.thText]}>SAÍDA ALM.</Text>
            <Text style={[s.col4, s.thText]}>RETORNO</Text>
            <Text style={[s.col5, s.thText]}>SAÍDA</Text>
            <Text style={[s.col6, s.thText]}>H. TRAB.</Text>
            <Text style={[s.col7, s.thText]}>H. EXTRA</Text>
            <Text style={[s.col8, s.thText]}>H. FALTA</Text>
            <Text style={[s.col9, s.thText]}>OBS.</Text>
          </View>

          {/* Rows */}
          {rows.map(({ day, date, dayOfWeek, isSunday: sun, entry }) => {
            const isSat = dayOfWeek === 'SÁBADO'
            const rowStyle = [
              s.tableRow,
              ...(sun ? [s.tableRowSun] : isSat ? [s.tableRowSat] : day % 2 === 0 ? [s.tableRowAlt] : []),
            ]
            const obs = entry?.dayType && entry.dayType !== 'normal'
              ? DAY_TYPE_LABELS[entry.dayType]
              : (entry?.notes ?? '')

            return (
              <View key={date} style={rowStyle}>
                <Text style={s.col0}>{day}</Text>
                <Text style={s.col1}>{dayOfWeek}</Text>
                <Text style={s.col2}>{sun ? '' : (entry?.clockIn ?? '')}</Text>
                <Text style={s.col3}>{sun ? '' : (entry?.lunchOut ?? '')}</Text>
                <Text style={s.col4}>{sun ? '' : (entry?.lunchReturn ?? '')}</Text>
                <Text style={s.col5}>{sun ? '' : (entry?.clockOut ?? '')}</Text>
                <Text style={s.col6}>{entry?.workedMinutes != null ? minutesToTime(entry.workedMinutes) : ''}</Text>
                <Text style={s.col7}>{entry?.extraMinutes ? minutesToTime(entry.extraMinutes) : ''}</Text>
                <Text style={s.col8}>{entry?.missingMinutes ? minutesToTime(entry.missingMinutes) : ''}</Text>
                <Text style={s.col9}>{obs}</Text>
              </View>
            )
          })}
        </View>

        {/* Summary */}
        <View style={s.summary}>
          <Text style={s.summaryTitle}>RESUMO GERAL</Text>
          <View style={{ flexDirection: 'row', gap: 40 }}>
            <View>
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
                <Text style={{ fontFamily: 'Helvetica-Bold' }}>{report.accumulatedMinutes >= 0 ? '+' : ''}{minutesToTime(report.accumulatedMinutes)}</Text>
              </View>
            </View>
          </View>
        </View>

        {/* Signature */}
        <View style={s.signatureArea}>
          <Text style={s.dateArea}>
            Data: _______ de ___________________________ de ____________.
          </Text>
          <View>
            <View style={s.signatureLine} />
            <Text style={s.signatureLabel}>Assinatura do Empregado</Text>
          </View>
        </View>
      </Page>
    </Document>
  )
}
