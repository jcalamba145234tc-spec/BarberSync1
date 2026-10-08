/**
 * Ranked list of the top barbers for a period (rank badge, name, customers
 * served, revenue). Replaces the old row of StatCards, whose narrow tiles cut
 * off text like "24 Customers" - a list row has the full width to work with.
 */
import React from 'react';
import { StyleSheet, View } from 'react-native';
import { Text } from 'react-native-paper';
import { Colors } from '../../constants/colors';
import { BarberPerformance } from '../../types/report';
import { formatCurrency } from '../../utils/calculations';
import { EmptyState } from '../ui/EmptyState';

const RANK_COLORS = [Colors.accent, Colors.textMuted, Colors.border];

export function TopBarbersList({ rows }: { rows: BarberPerformance[] }) {
  if (!rows.length) {
    return (
      <EmptyState
        icon="💈"
        title="No completed services this month"
        message="Top barbers will appear after completed transactions are recorded."
      />
    );
  }

  return (
    <View style={styles.list}>
      {rows.map((barber, index) => (
        <View key={barber.barberId} style={[styles.row, index > 0 && styles.rowDivider]}>
          <View style={[styles.badge, { backgroundColor: RANK_COLORS[index] ?? Colors.border }]}>
            <Text style={styles.badgeText}>{index + 1}</Text>
          </View>
          <View style={styles.info}>
            <Text variant="titleSmall" style={styles.name} numberOfLines={1}>
              {barber.barberName}
            </Text>
            <Text variant="bodySmall" style={styles.muted}>
              {barber.serviceCount} {barber.serviceCount === 1 ? 'customer' : 'customers'}
            </Text>
          </View>
          <Text variant="titleSmall" style={styles.revenue}>
            {formatCurrency(barber.revenue)}
          </Text>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  list: { gap: 0 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 10 },
  rowDivider: { borderTopWidth: 1, borderTopColor: Colors.border },
  badge: { width: 30, height: 30, borderRadius: 15, alignItems: 'center', justifyContent: 'center' },
  badgeText: { color: '#FFFFFF', fontWeight: '800' },
  info: { flex: 1 },
  name: { fontWeight: '700', color: Colors.text },
  muted: { color: Colors.textMuted },
  revenue: { fontWeight: '800', color: Colors.success },
});
