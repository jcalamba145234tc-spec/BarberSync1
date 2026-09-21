import React from 'react';
import { StyleSheet, View } from 'react-native';
import { Card, Text } from 'react-native-paper';
import { Colors } from '../../constants/colors';

interface SectionCardProps {
  title?: string;
  subtitle?: string;
  right?: React.ReactNode;
  children: React.ReactNode;
}

export function SectionCard({ title, subtitle, right, children }: SectionCardProps) {
  return (
    <Card style={styles.card} mode="elevated">
      <Card.Content style={styles.content}>
        {(title || right) && (
          <View style={styles.header}>
            <View style={styles.headerText}>
              {!!title && (
                <Text variant="titleMedium" style={styles.title}>
                  {title}
                </Text>
              )}
              {!!subtitle && (
                <Text variant="bodySmall" style={styles.subtitle}>
                  {subtitle}
                </Text>
              )}
            </View>
            {right}
          </View>
        )}
        {children}
      </Card.Content>
    </Card>
  );
}

const styles = StyleSheet.create({
  card: { backgroundColor: Colors.surface, borderRadius: 16 },
  content: { gap: 10, paddingVertical: 14 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  headerText: { flex: 1 },
  title: { fontWeight: '700', color: Colors.text },
  subtitle: { color: Colors.textMuted, marginTop: 2 },
});
