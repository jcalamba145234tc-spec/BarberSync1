import React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { Text } from 'react-native-paper';
import { Colors } from '../../constants/colors';
import { useAppData } from '../../context/AppDataContext';

const LABELS = {
  ONLINE: 'Online',
  OFFLINE: 'Offline',
  SYNCING: 'Syncing…',
  SYNCED: 'Synced',
};

const TONES = {
  ONLINE: Colors.success,
  OFFLINE: Colors.danger,
  SYNCING: Colors.warning,
  SYNCED: Colors.success,
};

/** Small pill in the header. Tapping it forces a sync attempt. */
export function ConnectionIndicator() {
  const { connection, pending, syncNow } = useAppData();
  const color = TONES[connection];
  return (
    <Pressable onPress={syncNow} style={styles.wrapper} accessibilityLabel="Connection status">
      <View style={[styles.dot, { backgroundColor: color }]} />
      <Text variant="labelSmall" style={styles.label}>
        {LABELS[connection]}
        {pending > 0 ? ` · ${pending}` : ''}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
    marginRight: 6,
    borderRadius: 999,
    backgroundColor: '#FFFFFF22',
  },
  dot: { width: 8, height: 8, borderRadius: 4 },
  label: { color: '#FFFFFF', fontWeight: '600' },
});
