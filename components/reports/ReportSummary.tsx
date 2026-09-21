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

export function ReportSummary({ report }: { report: FinancialReport }) {
  return (
    <View style={styles.container}>
      <Row label="Gross Revenue" value={formatCurrency(report.grossRevenue)} />
      <Row label="Shop Share" value={formatCurrency(report.shopShare)} />
      <Row label="Barber Share (payout)" value={formatCurrency(report.barberShare)} />
      <Divider style={styles.divider} />
      <Row label="Cash Revenue" value={formatCurrency(report.cashRevenue)} />
      <Row label="GCash Revenue" value={formatCurrency(report.gcashRevenue)} />
      <Row label="Transactions" value={String(report.transactionCount)} />
      <Divider style={styles.divider} />
      <Row label="Expenses" value={formatCurrency(report.expenses)} tone={Colors.danger} />
      <Row
        label="Net Income"
        value={formatCurrency(report.netIncome)}
        bold
        tone={report.netIncome >= 0 ? Colors.success : Colors.danger}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { gap: 6 },
  row: { flexDirection: 'row', justifyContent: 'space-between' },
  label: { color: Colors.textMuted },
  value: { color: Colors.text, fontWeight: '600' },
  bold: { fontWeight: '800', color: Colors.text },
  divider: { marginVertical: 6 },
});
