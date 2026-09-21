import React from 'react';
import { StyleSheet, View } from 'react-native';
import { Text } from 'react-native-paper';
import { Colors } from '../../constants/colors';

interface StatCardProps {
  label: string;
  value: string;
  hint?: string;
  tone?: 'default' | 'accent' | 'success' | 'warning' | 'danger';
}

const TONES: Record<string, string> = {
  default: Colors.text,
  accent: Colors.accent,
  success: Colors.success,
  warning: Colors.warning,
  danger: Colors.danger,
};

export function StatCard({ label, value, hint, tone = 'default' }: StatCardProps) {
  return (
    <View style={styles.card}>
      <Text variant="labelSmall" style={styles.label}>
        {label.toUpperCase()}
      </Text>
      <Text variant="titleLarge" style={[styles.value, { color: TONES[tone] }]} numberOfLines={1}>
        {value}
      </Text>
      {!!hint && (
        <Text variant="bodySmall" style={styles.hint}>
          {hint}
        </Text>
      )}
    </View>
  );
}

export function StatGrid({ children }: { children: React.ReactNode }) {
  return <View style={styles.grid}>{children}</View>;
}

const styles = StyleSheet.create({
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  card: {
    flexGrow: 1,
    flexBasis: '47%',
    backgroundColor: Colors.surface,
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  label: { color: Colors.textMuted, letterSpacing: 0.6 },
  value: { fontWeight: '800', marginTop: 6 },
  hint: { color: Colors.textMuted, marginTop: 2 },
});
