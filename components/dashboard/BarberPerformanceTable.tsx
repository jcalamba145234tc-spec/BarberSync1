import React from 'react';
import { StyleSheet, View } from 'react-native';
import { Text } from 'react-native-paper';
import { Colors } from '../../constants/colors';
import { BarberPerformance } from '../../types/report';
import { formatCurrency } from '../../utils/calculations';
import { EmptyState } from '../ui/EmptyState';

/** Admin-only view of how each barber is performing. */
export function BarberPerformanceTable({ rows }: { rows: BarberPerformance[] }) {
  if (!rows.length) {
    return <EmptyState icon="💈" title="No barber activity yet" message="Completed services will appear here." />;
  }
  return (
    <View style={styles.table}>
      <View style={[styles.row, styles.headerRow]}>
        <Text variant="labelSmall" style={[styles.cell, styles.nameCell, styles.headerText]}>BARBER</Text>
        <Text variant="labelSmall" style={[styles.cell, styles.headerText, styles.num]}>SVC</Text>
        <Text variant="labelSmall" style={[styles.cell, styles.headerText, styles.num]}>REVENUE</Text>
        <Text variant="labelSmall" style={[styles.cell, styles.headerText, styles.num]}>EARNINGS</Text>
      </View>
      {rows.map((row) => (
        <View key={row.barberId} style={styles.row}>
          <Text variant="bodySmall" style={[styles.cell, styles.nameCell, styles.name]} numberOfLines={1}>
            {row.barberName}
          </Text>
          <Text variant="bodySmall" style={[styles.cell, styles.num]}>{row.serviceCount}</Text>
          <Text variant="bodySmall" style={[styles.cell, styles.num]}>{formatCurrency(row.revenue)}</Text>
          <Text variant="bodySmall" style={[styles.cell, styles.num, styles.earnings]}>
            {formatCurrency(row.earnings)}
          </Text>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  table: { gap: 2 },
  row: { flexDirection: 'row', alignItems: 'center', paddingVertical: 7 },
  headerRow: { borderBottomWidth: 1, borderBottomColor: Colors.border },
  cell: { flex: 1, color: Colors.text },
  nameCell: { flex: 1.6 },
  headerText: { color: Colors.textMuted, letterSpacing: 0.5 },
  name: { fontWeight: '700' },
  num: { textAlign: 'right' },
  earnings: { fontWeight: '700', color: Colors.success },
});
