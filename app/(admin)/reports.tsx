import React, { useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { Button, Chip, HelperText, SegmentedButtons, Text, TextInput } from 'react-native-paper';
import { AppSnackbar } from '../../components/ui/AppSnackbar';
import { BarberPerformanceTable } from '../../components/dashboard/BarberPerformanceTable';
import { EmptyState } from '../../components/ui/EmptyState';
import { LoadingState } from '../../components/ui/LoadingState';
import { ReportSummary } from '../../components/reports/ReportSummary';
import { Screen } from '../../components/ui/Screen';
import { SectionCard } from '../../components/ui/SectionCard';
import { Colors } from '../../constants/colors';
import { useAppData } from '../../context/AppDataContext';
import { useReport } from '../../hooks/useReport';
import { PaymentMethod } from '../../types/transaction';
import { ReportFilters } from '../../types/report';
import { formatCurrency } from '../../utils/calculations';
import { buildRange, customRange, formatDate, parseInputDate } from '../../utils/dateUtils';
import type { RangePreset } from '../../utils/dateUtils';
import { exportTransactionsCsv } from '../../utils/csvExport';
import { exportReportPdf } from '../../utils/pdfExport';

type Preset = RangePreset | 'CUSTOM';

export default function ReportsScreen() {
  const { settings, barbers } = useAppData();
  const [preset, setPreset] = useState<Preset>('TODAY');
  const [fromText, setFromText] = useState('');
  const [toText, setToText] = useState('');
  const [customError, setCustomError] = useState<string | null>(null);
  const [payment, setPayment] = useState<PaymentMethod | null>(null);
  const [barberId, setBarberId] = useState<string | null>(null);
  const [exporting, setExporting] = useState<'PDF' | 'CSV' | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const range = useMemo(() => {
    if (preset === 'CUSTOM') {
      const from = parseInputDate(fromText);
      const to = parseInputDate(toText);
      if (from && to && from <= to) return customRange(from, to);
      return buildRange('TODAY');
    }
    return buildRange(preset);
  }, [preset, fromText, toText]);

  const filters: ReportFilters = useMemo(
    () => ({
      from: range.from,
      to: range.to,
      label: range.label,
      paymentMethod: payment ?? undefined,
      barberId: barberId ?? undefined,
    }),
    [range, payment, barberId]
  );

  const { report, transactions, expenses, loading, error, refresh } = useReport(filters, settings);

  const applyCustom = () => {
    const from = parseInputDate(fromText);
    const to = parseInputDate(toText);
    if (!from || !to) {
      setCustomError('Use the format YYYY-MM-DD for both dates.');
      return;
    }
    if (from > to) {
      setCustomError('The start date must come before the end date.');
      return;
    }
    setCustomError(null);
    setPreset('CUSTOM');
  };

  const handlePdf = async () => {
    if (!report) return;
    setExporting('PDF');
    try {
      await exportReportPdf(report, transactions, settings.shopName);
      setMessage('PDF report generated.');
    } catch {
      setMessage('Could not generate the PDF.');
    } finally {
      setExporting(null);
    }
  };

  const handleCsv = async () => {
    setExporting('CSV');
    try {
      await exportTransactionsCsv(transactions);
      setMessage('CSV exported.');
    } catch {
      setMessage('Could not export the CSV.');
    } finally {
      setExporting(null);
    }
  };

  return (
    <>
      <Screen refreshing={loading} onRefresh={refresh}>
        <SectionCard title="Period" subtitle={`${range.label} · ${formatDate(range.from)} – ${formatDate(range.to)}`}>
          <SegmentedButtons
            value={preset === 'CUSTOM' ? 'CUSTOM' : preset}
            onValueChange={(value) => setPreset(value as Preset)}
            buttons={[
              { value: 'TODAY', label: 'Today' },
              { value: 'WEEK', label: 'Week' },
              { value: 'MONTH', label: 'Month' },
              { value: 'CUSTOM', label: 'Custom' },
            ]}
          />
          {preset === 'CUSTOM' && (
            <View style={styles.customRow}>
              <TextInput
                label="From (YYYY-MM-DD)"
                mode="outlined"
                dense
                style={styles.dateInput}
                value={fromText}
                onChangeText={setFromText}
              />
              <TextInput
                label="To (YYYY-MM-DD)"
                mode="outlined"
                dense
                style={styles.dateInput}
                value={toText}
                onChangeText={setToText}
              />
              <Button mode="contained-tonal" onPress={applyCustom}>Apply</Button>
            </View>
          )}
          <HelperText type="error" visible={!!customError}>{customError}</HelperText>

          <View style={styles.chips}>
            <Chip selected={payment === 'CASH'} onPress={() => setPayment(payment === 'CASH' ? null : 'CASH')}>
              Cash
            </Chip>
            <Chip selected={payment === 'GCASH'} onPress={() => setPayment(payment === 'GCASH' ? null : 'GCASH')}>
              GCash
            </Chip>
            {barbers.map((barber) => (
              <Chip
                key={barber.id}
                selected={barberId === barber.id}
                onPress={() => setBarberId(barberId === barber.id ? null : barber.id)}
              >
                {barber.name}
              </Chip>
            ))}
          </View>
          {(payment || barberId) && (
            <Text variant="bodySmall" style={styles.muted}>
              Filtered view: shop-wide expenses are excluded from net income.
            </Text>
          )}
        </SectionCard>

        {loading && !report ? (
          <LoadingState message="Generating report…" />
        ) : error ? (
          <EmptyState icon="⚠️" title="Report unavailable" message={error} actionLabel="Retry" onAction={refresh} />
        ) : report && report.transactionCount === 0 ? (
          <EmptyState icon="📊" title="No reports available for this period" message="Try a different date range." />
        ) : (
          report && (
            <>
              <SectionCard title={`${range.label} summary`}>
                <ReportSummary report={report} />
              </SectionCard>

              <SectionCard title="Barber performance">
                <BarberPerformanceTable rows={report.barbers} />
              </SectionCard>

              <SectionCard title="Expenses in this period" subtitle={`Monthly fixed cost: ${formatCurrency(settings.monthlyFixedExpense)}`}>
                {expenses.length === 0 ? (
                  <EmptyState icon="🧮" title="No expenses recorded" message="Add expenses to see net income." />
                ) : (
                  expenses.map((expense) => (
                    <View key={expense.id} style={styles.expenseRow}>
                      <Text variant="bodyMedium">{expense.name}</Text>
                      <Text variant="bodyMedium" style={styles.expenseAmount}>
                        {formatCurrency(expense.amount)}
                      </Text>
                    </View>
                  ))
                )}
              </SectionCard>

              <View style={styles.exportRow}>
                <Button
                  mode="contained"
                  icon="file-pdf-box"
                  onPress={handlePdf}
                  loading={exporting === 'PDF'}
                  disabled={exporting !== null}
                  style={styles.exportButton}
                >
                  {exporting === 'PDF' ? 'Generating…' : 'Export PDF'}
                </Button>
                <Button
                  mode="contained-tonal"
                  icon="file-delimited"
                  onPress={handleCsv}
                  loading={exporting === 'CSV'}
                  disabled={exporting !== null}
                  style={styles.exportButton}
                >
                  Export CSV
                </Button>
              </View>
            </>
          )
        )}
      </Screen>
      <AppSnackbar message={message} onDismiss={() => setMessage(null)} />
    </>
  );
}

const styles = StyleSheet.create({
  customRow: { flexDirection: 'row', gap: 8, alignItems: 'center', marginTop: 10, flexWrap: 'wrap' },
  dateInput: { flexGrow: 1, minWidth: 140, backgroundColor: Colors.surface },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 6 },
  muted: { color: Colors.textMuted, marginTop: 6 },
  expenseRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 4 },
  expenseAmount: { fontWeight: '700', color: Colors.danger },
  exportRow: { flexDirection: 'row', gap: 10 },
  exportButton: { flex: 1, borderRadius: 12 },
});
