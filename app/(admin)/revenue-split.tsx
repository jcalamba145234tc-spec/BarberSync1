import React, { useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { SegmentedButtons, Text } from 'react-native-paper';
import { useFocusEffect } from 'expo-router';
import { EmptyState } from '../../components/ui/EmptyState';
import { LoadingState } from '../../components/ui/LoadingState';
import { Screen } from '../../components/ui/Screen';
import { SectionCard } from '../../components/ui/SectionCard';
import { Colors } from '../../constants/colors';
import { useAppData } from '../../context/AppDataContext';
import { useTransactions } from '../../hooks/useTransactions';
import { buildFinancialReport, formatCurrency } from '../../utils/calculations';
import { buildRange, formatTime } from '../../utils/dateUtils';
import type { RangePreset } from '../../utils/dateUtils';

/** Admin-only breakdown of the shop/barber split, transaction by transaction. */
export default function RevenueSplitScreen() {
  const { settings } = useAppData();
  const [preset, setPreset] = useState<RangePreset>('TODAY');
  const range = useMemo(() => buildRange(preset), [preset]);
  const { transactions, loading, refresh } = useTransactions({ from: range.from, to: range.to });

  useFocusEffect(React.useCallback(() => { refresh(); }, [refresh]));

  const report = useMemo(() => buildFinancialReport(transactions, [], range), [transactions, range]);
  const completed = useMemo(() => transactions.filter((t) => t.status === 'COMPLETED'), [transactions]);

  if (loading && !transactions.length) return <LoadingState message="Calculating the split…" />;

  return (
    <Screen refreshing={loading} onRefresh={refresh}>
      <SegmentedButtons
        value={preset}
        onValueChange={(value) => setPreset(value as RangePreset)}
        buttons={[
          { value: 'TODAY', label: 'Today' },
          { value: 'WEEK', label: 'Week' },
          { value: 'MONTH', label: 'Month' },
        ]}
      />

      <SectionCard
        title="Transactions"
        subtitle={`Split ${Math.round(settings.shopPercentage * 100)}% shop / ${Math.round(
          settings.barberPercentage * 100
        )}% barber`}
      >
        {completed.length === 0 ? (
          <EmptyState icon="💸" title="No completed transactions" message="Nothing to split for this period yet." />
        ) : (
          completed.map((transaction) => (
            <View key={transaction.id} style={styles.row}>
              <View style={styles.left}>
                <Text variant="titleSmall" style={styles.name}>{transaction.serviceName}</Text>
                <Text variant="bodySmall" style={styles.muted}>
                  {transaction.barberName} · {formatTime(transaction.createdAt)}
                </Text>
              </View>
              <View style={styles.right}>
                <Text variant="titleSmall" style={styles.total}>{formatCurrency(transaction.amount)}</Text>
                <Text variant="bodySmall" style={styles.muted}>
                  Shop {formatCurrency(transaction.shopShare)} · Barber {formatCurrency(transaction.barberShare)}
                </Text>
              </View>
            </View>
          ))
        )}
      </SectionCard>

      <SectionCard title={`${range.label} totals`}>
        <View style={styles.totalsRow}>
          <Text variant="bodyMedium" style={styles.muted}>Total revenue</Text>
          <Text variant="titleMedium" style={styles.total}>{formatCurrency(report.grossRevenue)}</Text>
        </View>
        <View style={styles.totalsRow}>
          <Text variant="bodyMedium" style={styles.muted}>Shop share</Text>
          <Text variant="titleMedium" style={[styles.total, { color: Colors.success }]}>
            {formatCurrency(report.shopShare)}
          </Text>
        </View>
        <View style={styles.totalsRow}>
          <Text variant="bodyMedium" style={styles.muted}>Barber share</Text>
          <Text variant="titleMedium" style={[styles.total, { color: Colors.info }]}>
            {formatCurrency(report.barberShare)}
          </Text>
        </View>
      </SectionCard>
    </Screen>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  left: { flex: 1 },
  right: { alignItems: 'flex-end' },
  name: { fontWeight: '700', color: Colors.text },
  muted: { color: Colors.textMuted },
  total: { fontWeight: '800', color: Colors.text },
  totalsRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
});
