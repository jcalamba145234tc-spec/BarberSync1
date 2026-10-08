/**
 * Renders the computed FinancialReport totals (revenue, expenses, net,
 * barber payouts) as a readable breakdown on the admin Reports screen.
 */
import React from 'react';
import { StyleSheet, View } from 'react-native';
import { Divider, Text } from 'react-native-paper';
import { Colors } from '../../constants/colors';
import { FinancialReport } from '../../types/report';
import { formatCurrency } from '../../utils/calculations';

function Row({ label, value, bold, tone }: { label: string; value: string; bold?: boolean; tone?: string }) {
  return (
    <View style={styles.row}>
      <Text variant="bodyMedium" style={[styles.label, bold && styles.bold]}>
        {label}
      </Text>
      <Text variant="bodyMedium" style={[styles.value, bold && styles.bold, tone ? { color: tone } : null]}>
        {value}
      </Text>
    </View>
  );
}

function Group({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={styles.group}>
      <Text variant="labelSmall" style={styles.groupTitle}>
        {title.toUpperCase()}
      </Text>
      <Divider />
      <View style={styles.groupBody}>{children}</View>
    </View>
  );
}

export function ReportSummary({ report }: { report: FinancialReport }) {
  const netTone = report.netIncome >= 0 ? Colors.success : Colors.danger;

  return (
    <View style={styles.container}>
      <View style={styles.hero}>
        <Text variant="labelSmall" style={styles.heroLabel}>
          NET INCOME
        </Text>
        <Text
          variant="headlineMedium"
          style={[styles.heroValue, { color: netTone }]}
          numberOfLines={1}
          adjustsFontSizeToFit
          minimumFontScale={0.6}
        >
          {formatCurrency(report.netIncome)}
        </Text>
        <Text variant="bodySmall" style={styles.heroHint}>
          {formatCurrency(report.grossRevenue)} revenue - {formatCurrency(report.expenses)} expenses
        </Text>
      </View>

      <Group title="Revenue split">
        <Row label="Gross Revenue" value={formatCurrency(report.grossRevenue)} bold />
        <Row label="Shop Share" value={formatCurrency(report.shopShare)} />
        <Row label="Barber Share (payout)" value={formatCurrency(report.barberShare)} />
        <Row label="Tips (100% to barbers)" value={formatCurrency(report.tips)} />
      </Group>

      <Group title="Payments">
        <Row label="Cash Revenue" value={formatCurrency(report.cashRevenue)} />
        <Row label="GCash Revenue" value={formatCurrency(report.gcashRevenue)} />
        <Row label="Transactions" value={String(report.transactionCount)} />
      </Group>

      <Group title="Bottom line">
        <Row label="Expenses" value={formatCurrency(report.expenses)} tone={Colors.danger} />
        <Row label="Net Income" value={formatCurrency(report.netIncome)} bold tone={netTone} />
      </Group>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { gap: 12 },
  hero: {
    backgroundColor: Colors.background,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: Colors.border,
    paddingVertical: 14,
    paddingHorizontal: 16,
    alignItems: 'center',
  },
  heroLabel: { color: Colors.textMuted, letterSpacing: 0.8 },
  heroValue: { fontWeight: '800', marginTop: 4 },
  heroHint: { color: Colors.textMuted, marginTop: 2 },
  group: {
    borderRadius: 14,
    borderWidth: 1,
    borderColor: Colors.border,
    overflow: 'hidden',
  },
  groupTitle: {
    color: Colors.textMuted,
    letterSpacing: 0.8,
    paddingHorizontal: 14,
    paddingVertical: 8,
    backgroundColor: Colors.background,
  },
  groupBody: { paddingHorizontal: 14, paddingVertical: 10, gap: 8 },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 12 },
  label: { color: Colors.textMuted, flexShrink: 1 },
  value: { color: Colors.text, fontWeight: '600' },
  bold: { fontWeight: '800', color: Colors.text },
});
