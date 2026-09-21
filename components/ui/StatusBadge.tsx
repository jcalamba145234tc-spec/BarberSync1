import React from 'react';
import { StyleSheet, View } from 'react-native';
import { Text } from 'react-native-paper';
import { Colors, StatusColors } from '../../constants/colors';

const LABELS: Record<string, string> = {
  COMPLETED: 'Completed',
  PENDING_GCASH: 'Pending GCash',
  CANCELLED: 'Cancelled',
  WAITING: 'Waiting',
  CALLED: 'Called',
  IN_SERVICE: 'In service',
  CASH: 'Cash',
  GCASH: 'GCash',
};

export function StatusBadge({ status }: { status: string }) {
  const color = StatusColors[status] ?? (status === 'GCASH' ? Colors.gcash : Colors.cash);
  return (
    <View style={[styles.badge, { backgroundColor: `${color}1A`, borderColor: color }]}>
      <Text variant="labelSmall" style={[styles.text, { color }]}>
        {LABELS[status] ?? status}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
    borderWidth: 1,
    alignSelf: 'flex-start',
  },
  text: { fontWeight: '700' },
});
