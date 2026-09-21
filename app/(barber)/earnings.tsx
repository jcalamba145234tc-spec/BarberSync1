import React, { useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { SegmentedButtons, Text } from 'react-native-paper';
import { EmptyState } from '../../components/ui/EmptyState';
import { LoadingState } from '../../components/ui/LoadingState';
import { Screen } from '../../components/ui/Screen';
import { SectionCard } from '../../components/ui/SectionCard';
import { StatCard, StatGrid } from '../../components/ui/StatCard';
import { Colors } from '../../constants/colors';
import { useAppData } from '../../context/AppDataContext';
import { useAuth } from '../../hooks/useAuth';
import { useTransactions } from '../../hooks/useTransactions';
import { formatCurrency, sum } from '../../utils/calculations';
import { buildRange, formatDate } from '../../utils/dateUtils';
import type { RangePreset } from '../../utils/dateUtils';

/** Personal earnings only — no shop revenue, no other barbers. */
export default function BarberEarnings() {
  const { user } = useAuth();
  const { settings } = useAppData();
  const [preset, setPreset] = useState<RangePreset>('WEEK');
  const range = useMemo(() => buildRange(preset), [preset]);
  const { transactions, loading, refresh } = useTransactions({
    from: range.from,
    to: range.to,
    barberId: user?.id,
  });

  const completed = useMemo(() => transactions.filter((t) => t.status !== 'CANCELLED'), [transactions]);
  const earnings = useMemo(() => sum(completed.map((t) => t.barberShare)), [completed]);
  const cash = useMemo(
    () => sum(completed.filter((t) => t.paymentMethod === 'CASH').map((t) => t.barberShare)),
    [completed]
  );
  const gcash = useMemo(
    () => sum(completed.filter((t) => t.paymentMethod === 'GCASH').map((t) => t.barberShare)),
    [completed]
  );

  const byDay = useMemo(() => {
    const map = new Map<string, number>();
    completed.forEach((t) => {
      const day = t.createdAt.slice(0, 10);
      map.set(day, (map.get(day) ?? 0) + t.barberShare);
    });
    return Array.from(map.entries()).sort((a, b) => (a[0] < b[0] ? 1 : -1));
  }, [completed]);

  if (loading && !transactions.length) return <LoadingState message="Adding up your earnings…" />;

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

      <StatGrid>
        <StatCard label={`${range.label} earnings`} value={formatCurrency(earnings)} tone="success" />
        <StatCard label="Services" value={String(completed.length)} />
        <StatCard label="From cash" value={formatCurrency(cash)} />
        <StatCard label="From GCash" value={formatCurrency(gcash)} />
      </StatGrid>

      <SectionCard
        title="Daily breakdown"
        subtitle={`Your share is ${Math.round(settings.barberPercentage * 100)}% of every service.`}
      >
        {byDay.length === 0 ? (
          <EmptyState icon="💵" title="No earnings in this period" message="Log a service to start earning." />
        ) : (
          byDay.map(([day, value]) => (
            <View key={day} style={styles.row}>
              <Text variant="bodyMedium">{formatDate(day)}</Text>
              <Text variant="bodyMedium" style={styles.value}>{formatCurrency(value)}</Text>
            </View>
          ))
        )}
      </SectionCard>
    </Screen>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 6,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  value: { fontWeight: '700', color: Colors.success },
});
