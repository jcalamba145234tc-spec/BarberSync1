/**
 * Admin financial report screen: pick a date range, see revenue/expenses/net
 * and per-barber performance. Backed by hooks/useReport.ts.
 */
import React, { useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { Button, Chip, Divider, SegmentedButtons, Text } from 'react-native-paper';
import { AppSnackbar } from '../../components/ui/AppSnackbar';
import { BarberPerformanceTable } from '../../components/dashboard/BarberPerformanceTable';
import { EmptyState } from '../../components/ui/EmptyState';
import { LoadingState } from '../../components/ui/LoadingState';
import { RangeCalendar } from '../../components/reports/RangeCalendar';
import { ReportSummary } from '../../components/reports/ReportSummary';
import { Screen } from '../../components/ui/Screen';
import { SectionCard } from '../../components/ui/SectionCard';
import { Colors } from '../../constants/colors';
import { useAppData } from '../../context/AppDataContext';
import { useReport } from '../../hooks/useReport';
import { AUTO_MONTHLY_EXPENSE_PREFIX } from '../../services/reportService';
import { PaymentMethod } from '../../types/transaction';
import { ReportFilters } from '../../types/report';
import { formatCurrency } from '../../utils/calculations';
import { buildRange, customRange, formatDate } from '../../utils/dateUtils';
import type { RangePreset } from '../../utils/dateUtils';
import { exportTransactionsCsv } from '../../utils/csvExport';
import { exportReportPdf } from '../../utils/pdfExport';

type Preset = RangePreset | 'CUSTOM';

const daysAgo = (count: number): Date => {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), now.getDate() - count);
};

const QUICK_RANGES: { label: string; get: () => [Date, Date] }[] = [
  { label: 'Yesterday', get: () => [daysAgo(1), daysAgo(1)] },
  { label: 'Last 7 days', get: () => [daysAgo(6), daysAgo(0)] },
  { label: 'Last 30 days', get: () => [daysAgo(29), daysAgo(0)] },
  {
    label: 'Last month',
    get: () => {
      const now = new Date();
      return [new Date(now.getFullYear(), now.getMonth() - 1, 1), new Date(now.getFullYear(), now.getMonth(), 0)];
    },
  },
];

export default function ReportsScreen() {
  const { settings, barbers } = useAppData();
  const [preset, setPreset] = useState<Preset>('TODAY');
  const [customFrom, setCustomFrom] = useState<Date | null>(null);
  const [customTo, setCustomTo] = useState<Date | null>(null);
  const [jumpKey, setJumpKey] = useState(0);
  const [payment, setPayment] = useState<PaymentMethod | null>(null);
  const [barberId, setBarberId] = useState<string | null>(null);
  const [exporting, setExporting] = useState<'PDF' | 'CSV' | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const range = useMemo(() => {
    if (preset === 'CUSTOM') {
      if (customFrom && customTo && customFrom <= customTo) return customRange(customFrom, customTo);
      return buildRange('TODAY');
    }
    return buildRange(preset);
  }, [preset, customFrom, customTo]);

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

  const listedExpenseTotal = useMemo(
    () => expenses.reduce((sum, expense) => sum + expense.amount, 0),
    [expenses]
  );

  const handlePreset = (value: string) => {
    if (value === 'CUSTOM' && !customFrom) {
      // Start on today so the calendar and the report agree.
      const today = new Date();
      setCustomFrom(today);
      setCustomTo(today);
    }
    setPreset(value as Preset);
  };

  const applyQuickRange = (from: Date, to: Date) => {
    setCustomFrom(from);
    setCustomTo(to);
    setJumpKey((key) => key + 1);
  };

  const handlePdf = async () => {
    if (!report) return;
    setExporting('PDF');
    try {
      const fileUri = await exportReportPdf(report, transactions, settings.shopName, {
        shopAddress: settings.shopAddress,
        shopContact: settings.shopContact,
        expenses,
        monthlyFixedExpense: settings.monthlyFixedExpense,
        paymentMethod: payment ?? undefined,
        barberName: barbers.find((barber) => barber.id === barberId)?.name,
        barberNames: barbers.map((barber) => barber.name),
      });
      setMessage(
        fileUri
          ? 'PDF is ready to share.'
          : 'Print dialog opened. Choose Save as PDF to save the report.'
      );
    } catch (error) {
      console.error('[BarberSync] Could not export the sales report PDF.', error);
      setMessage(
        `Could not export the PDF. ${error instanceof Error ? error.message : 'Please try again.'}`
      );
    } finally {
      setExporting(null);
    }
  };

  const handleCsv = async () => {
    setExporting('CSV');
    try {
      await exportTransactionsCsv(transactions);
      setMessage('CSV exported or shared successfully.');
    } catch (error) {
      console.error('[BarberSync] Could not export the sales report CSV.', error);
      setMessage(
        `Could not export the CSV. ${error instanceof Error ? error.message : 'Please try again.'}`
      );
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
            onValueChange={handlePreset}
            buttons={[
              { value: 'TODAY', label: 'Today' },
              { value: 'WEEK', label: 'Week' },
              { value: 'MONTH', label: 'Month' },
              { value: 'CUSTOM', label: 'Custom' },
            ]}
          />

          {preset === 'CUSTOM' && (
            <View style={styles.customBox}>
              <Text variant="labelLarge" style={styles.customTitle}>Quick ranges</Text>
              <View style={styles.chips}>
                {QUICK_RANGES.map((quick) => (
                  <Chip
                    key={quick.label}
                    onPress={() => {
                      const [from, to] = quick.get();
                      applyQuickRange(from, to);
                    }}
                  >
                    {quick.label}
                  </Chip>
                ))}
              </View>

              <Text variant="labelLarge" style={styles.customTitle}>Pick from the calendar</Text>
              <RangeCalendar
                from={customFrom}
                to={customTo}
                jumpKey={jumpKey}
                onSelect={(from, to) => {
                  setCustomFrom(from);
                  setCustomTo(to);
                }}
              />
            </View>
          )}

          <Divider style={styles.divider} />

          <Text variant="labelLarge" style={styles.filterLabel}>Payment method</Text>
          <View style={styles.chips}>
            <Chip selected={payment === 'CASH'} onPress={() => setPayment(payment === 'CASH' ? null : 'CASH')}>
              Cash
            </Chip>
            <Chip selected={payment === 'GCASH'} onPress={() => setPayment(payment === 'GCASH' ? null : 'GCASH')}>
              GCash
            </Chip>
          </View>

          {barbers.length > 0 && (
            <>
              <Text variant="labelLarge" style={styles.filterLabel}>Barber</Text>
              <View style={styles.chips}>
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
            </>
          )}

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

              <SectionCard
                title="Expenses in this period"
                subtitle={`Monthly fixed cost: ${formatCurrency(settings.monthlyFixedExpense)} (deducted automatically on full-month reports)`}
              >
                {expenses.length === 0 ? (
                  <EmptyState icon="🧮" title="No expenses recorded" message="Add expenses to see net income." />
                ) : (
                  <>
                    {expenses.map((expense) => {
                      const automatic = expense.id.startsWith(AUTO_MONTHLY_EXPENSE_PREFIX);
                      return (
                        <View key={expense.id} style={styles.expenseRow}>
                          <View style={styles.expenseInfo}>
                            <Text variant="bodyMedium">{expense.name}</Text>
                            {automatic && (
                              <Text variant="bodySmall" style={styles.muted}>
                                Added automatically from Settings
                              </Text>
                            )}
                          </View>
                          <Text variant="bodyMedium" style={styles.expenseAmount}>
                            {formatCurrency(expense.amount)}
                          </Text>
                        </View>
                      );
                    })}
                    <Divider style={styles.divider} />
                    <View style={styles.expenseRow}>
                      <Text variant="titleSmall" style={styles.totalLabel}>Total</Text>
                      <Text variant="titleSmall" style={styles.expenseAmount}>
                        {formatCurrency(listedExpenseTotal)}
                      </Text>
                    </View>
                  </>
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
  customBox: {
    marginTop: 12,
    padding: 12,
    gap: 10,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.background,
  },
  customTitle: { color: Colors.text, fontWeight: '700' },
  divider: { marginVertical: 6 },
  filterLabel: { color: Colors.textMuted, marginTop: 4 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  muted: { color: Colors.textMuted, marginTop: 2 },
  expenseRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 12, paddingVertical: 4 },
  expenseInfo: { flex: 1 },
  expenseAmount: { fontWeight: '700', color: Colors.danger },
  totalLabel: { fontWeight: '700', color: Colors.text },
  exportRow: { flexDirection: 'row', gap: 10 },
  exportButton: { flex: 1, borderRadius: 12 },
});
