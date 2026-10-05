/**
 * Custom back button that only renders when there's actually somewhere to go
 * back to (see NavigationHistoryContext), so screens with no history don't
 * show a dead-end back arrow.
 */
import React from 'react';
import { Pressable, StyleSheet } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Href, useRouter } from 'expo-router';
import { useNavigationHistory } from '../../context/NavigationHistoryContext';

/** A header back control that stays hidden for entry points with no history. */
export function HeaderBackButton() {
  const router = useRouter();
  const { previousPath } = useNavigationHistory();

  if (!previousPath) return null;

  const goBack = () => {
    // Use the recorded screen rather than the tab navigator's stack. The
    // latter may point at a tab default instead of the interface just shown.
    router.replace(previousPath as Href);
  };

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="Go back"
      hitSlop={10}
      onPress={goBack}
      style={styles.button}
    >
      <MaterialCommunityIcons name="arrow-left" size={26} color="#FFFFFF" />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: { marginLeft: 12, marginRight: 4, padding: 2 },
});
