import React from 'react';
import { StyleSheet, View } from 'react-native';
import { Button, Text } from 'react-native-paper';
import { Colors } from '../../constants/colors';
import { QueueEntry, QueueStatus } from '../../types/queue';
import { formatTime } from '../../utils/dateUtils';
import { StatusBadge } from '../ui/StatusBadge';

interface QueueCardProps {
  entry: QueueEntry;
  position: number;
  busy: boolean;
  onStatusChange: (status: QueueStatus) => void;
}

export function QueueCard({ entry, position, busy, onStatusChange }: QueueCardProps) {
  return (
    <View style={styles.card}>
      <View style={styles.header}>
        <View style={styles.position}>
          <Text style={styles.positionText}>#{position}</Text>
        </View>
        <View style={styles.info}>
          <Text variant="titleSmall" style={styles.name}>
            {entry.customerName}
          </Text>
          <Text variant="bodySmall" style={styles.muted}>
            {entry.serviceName}
            {entry.barberName ? ` · ${entry.barberName}` : ''}
          </Text>
          <Text variant="bodySmall" style={styles.muted}>
            Arrived {formatTime(entry.arrivalTime)}
            {entry.status === 'WAITING' ? ` · Est. wait: ${entry.estimatedWaitTime} min` : ''}
          </Text>
        </View>
        <StatusBadge status={entry.status} />
      </View>

      <View style={styles.actions}>
        {entry.status === 'WAITING' && (
          <Button mode="contained-tonal" compact disabled={busy} onPress={() => onStatusChange('CALLED')}>
            Call
          </Button>
        )}
        {(entry.status === 'WAITING' || entry.status === 'CALLED') && (
          <Button mode="contained" compact disabled={busy} onPress={() => onStatusChange('IN_SERVICE')}>
            Start
          </Button>
        )}
        {entry.status === 'IN_SERVICE' && (
          <Button mode="contained" compact disabled={busy} onPress={() => onStatusChange('COMPLETED')}>
            Complete
          </Button>
        )}
        <Button
          mode="text"
          compact
          textColor={Colors.danger}
          disabled={busy}
          onPress={() => onStatusChange('CANCELLED')}
        >
          Cancel
        </Button>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: Colors.surface,
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: Colors.border,
    gap: 10,
  },
  header: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  position: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  positionText: { color: '#FFFFFF', fontWeight: '800' },
  info: { flex: 1, gap: 2 },
  name: { fontWeight: '700', color: Colors.text },
  muted: { color: Colors.textMuted },
  actions: { flexDirection: 'row', gap: 8, flexWrap: 'wrap', justifyContent: 'flex-end' },
});
