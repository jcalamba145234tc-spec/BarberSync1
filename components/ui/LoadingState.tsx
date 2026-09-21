import React from 'react';
import { StyleSheet, View } from 'react-native';
import { ActivityIndicator, Text } from 'react-native-paper';
import { Colors } from '../../constants/colors';

export function LoadingState({ message = 'Loading…' }: { message?: string }) {
  return (
    <View style={styles.container}>
      <ActivityIndicator animating color={Colors.primary} />
      <Text variant="bodyMedium" style={styles.text}>
        {message}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { alignItems: 'center', justifyContent: 'center', padding: 28, gap: 10, flexGrow: 1 },
  text: { color: Colors.textMuted },
});
