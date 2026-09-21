import React from 'react';
import { RefreshControl, ScrollView, StyleSheet, View, ViewStyle } from 'react-native';
import { Colors } from '../../constants/colors';

interface ScreenProps {
  children: React.ReactNode;
  scroll?: boolean;
  refreshing?: boolean;
  onRefresh?: () => void;
  style?: ViewStyle;
}

/** Standard padded page container used by every screen. */
export function Screen({ children, scroll = true, refreshing, onRefresh, style }: ScreenProps) {
  if (!scroll) {
    return <View style={[styles.container, style]}>{children}</View>;
  }
  return (
    <ScrollView
      style={styles.flex}
      contentContainerStyle={[styles.container, style]}
      keyboardShouldPersistTaps="handled"
      refreshControl={
        onRefresh ? (
          <RefreshControl refreshing={Boolean(refreshing)} onRefresh={onRefresh} tintColor={Colors.primary} />
        ) : undefined
      }
    >
      {children}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: Colors.background },
  container: {
    flexGrow: 1,
    backgroundColor: Colors.background,
    padding: 16,
    paddingBottom: 96,
    gap: 12,
  },
});
