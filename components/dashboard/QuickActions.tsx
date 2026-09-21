import React from 'react';
import { StyleSheet, View } from 'react-native';
import { Button } from 'react-native-paper';
import { useRouter } from 'expo-router';
import type { Href } from 'expo-router';

export interface QuickAction {
  label: string;
  icon: string;
  href: Href;
}

export function QuickActions({ actions }: { actions: QuickAction[] }) {
  const router = useRouter();
  return (
    <View style={styles.grid}>
      {actions.map((action) => (
        <Button
          key={action.label}
          mode="contained-tonal"
          icon={action.icon}
          style={styles.button}
          onPress={() => router.push(action.href)}
        >
          {action.label}
        </Button>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  button: { flexGrow: 1, flexBasis: '47%', borderRadius: 12 },
});
