import React from 'react';
import { StyleSheet, View } from 'react-native';
import { Button, Text } from 'react-native-paper';
import { Colors } from '../../constants/colors';

interface EmptyStateProps {
  icon?: string;
  title: string;
  message?: string;
  actionLabel?: string;
  onAction?: () => void;
}

export function EmptyState({ icon = '✂️', title, message, actionLabel, onAction }: EmptyStateProps) {
  return (
    <View style={styles.container}>
      <Text style={styles.icon}>{icon}</Text>
      <Text variant="titleMedium" style={styles.title}>
        {title}
      </Text>
      {!!message && (
        <Text variant="bodyMedium" style={styles.message}>
          {message}
        </Text>
      )}
      {!!actionLabel && !!onAction && (
        <Button mode="contained-tonal" onPress={onAction} style={styles.button}>
          {actionLabel}
        </Button>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { alignItems: 'center', paddingVertical: 32, gap: 6 },
  icon: { fontSize: 34 },
  title: { fontWeight: '700', color: Colors.text },
  message: { color: Colors.textMuted, textAlign: 'center', paddingHorizontal: 16 },
  button: { marginTop: 10 },
});
