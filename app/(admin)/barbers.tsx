import React, { useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { SegmentedButtons, Text } from 'react-native-paper';
import { BarberPerformanceTable } from '../../components/dashboard/BarberPerformanceTable';
import { EmptyState } from '../../components/ui/EmptyState';
import { LoadingState } from '../../components/ui/LoadingState';
import { Screen } from '../../components/ui/Screen';
import { SectionCard } from '../../components/ui/SectionCard';
import { Colors } from '../../constants/colors';
import { useAppData } from '../../context/AppDataContext';
import { useTransactions } from '../../hooks/useTransactions';
import { buildBarberPerformance, formatCurrency } from '../../utils/calculations';
import { buildRange } from '../../utils/dateUtils';
import type { RangePreset } from '../../utils/dateUtils';

/** Admin view of the staff list and how much each barber has earned. */
export default function BarbersScreen() {
  const { barbers } = useAppData();
  const [preset, setPreset] = useState<RangePreset>('MONTH');
  const range = useMemo(() => buildRange(preset), [preset]);
  const { transactions, loading, refresh } = useTransactions({ from: range.from, to: range.to });

  const performance = useMemo(() => buildBarberPerformance(transactions), [transactions]);

  if (loading && !transactions.length) return <LoadingState message="Loading barbers…" />;

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

      <SectionCard title={`Performance · ${range.label}`}>
        <BarberPerformanceTable rows={performance} />
      </SectionCard>

      <SectionCard title="Staff" subtitle="Accounts are created in Firebase Authentication.">
        {barbers.length === 0 ? (
          <EmptyState icon="💈" title="No barbers yet" message="Add barber accounts in Firebase, then add their profile in the users collection." />
        ) : (
          barbers.map((barber) => {
            const stats = performance.find((p) => p.barberId === barber.id);
            return (
              <View key={barber.id} style={styles.row}>
                <View style={styles.info}>
                  <Text variant="titleSmall" style={styles.name}>{barber.name}</Text>
                  <Text variant="bodySmall" style={styles.muted}>{barber.email}</Text>
                </View>
                <Text variant="titleSmall" style={styles.earnings}>
                  {formatCurrency(stats?.earnings ?? 0)}
                </Text>
              </View>
            );
          })
        )}
      </SectionCard>
    </Screen>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  info: { flex: 1 },
  name: { fontWeight: '700', color: Colors.text },
  muted: { color: Colors.textMuted },
  earnings: { fontWeight: '800', color: Colors.success },
});
