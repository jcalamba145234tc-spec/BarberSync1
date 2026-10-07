import React, { useRef, useState } from 'react';
import { StyleProp, StyleSheet, View, ViewStyle } from 'react-native';
import { ActivityIndicator, Button, Dialog, Portal, Text } from 'react-native-paper';
import { Colors } from '../../constants/colors';
import { useAuth } from '../../hooks/useAuth';

export function LogoutButton({ style }: { style?: StyleProp<ViewStyle> }) {
  const { logout } = useAuth();
  const [confirmationVisible, setConfirmationVisible] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const logoutInProgress = useRef(false);

  const handleLogout = async () => {
    if (logoutInProgress.current) return;

    logoutInProgress.current = true;
    setLoggingOut(true);
    setError(null);
    try {
      await logout();
      setConfirmationVisible(false);
    } catch {
      setError('Could not log out. Please try again.');
    } finally {
      logoutInProgress.current = false;
      setLoggingOut(false);
    }
  };

  return (
    <>
      <Button
        mode="outlined"
        icon="logout"
        textColor={Colors.danger}
        onPress={() => {
          setError(null);
          setConfirmationVisible(true);
        }}
        style={style}
      >
        Log out
      </Button>

      <Portal>
        <Dialog
          visible={confirmationVisible}
          onDismiss={() => {
            if (!loggingOut) setConfirmationVisible(false);
          }}
        >
          <Dialog.Title>Log out?</Dialog.Title>
          <Dialog.Content>
            <Text variant="bodyMedium">Are you sure you want to log out?</Text>
            {!!error && <Text style={styles.error}>{error}</Text>}
          </Dialog.Content>
          <Dialog.Actions>
            <Button disabled={loggingOut} onPress={() => setConfirmationVisible(false)}>
              Stay
            </Button>
            <Button
              textColor={Colors.danger}
              disabled={loggingOut}
              onPress={handleLogout}
            >
              Log out
            </Button>
          </Dialog.Actions>
        </Dialog>

        {loggingOut && (
          <View style={styles.loadingOverlay}>
            <ActivityIndicator animating size="large" color={Colors.primary} />
            <Text variant="bodyMedium" style={styles.loadingText}>
              Signing out...
            </Text>
          </View>
        )}
      </Portal>
    </>
  );
}

const styles = StyleSheet.create({
  error: { color: Colors.danger, marginTop: 8 },
  loadingOverlay: {
    ...StyleSheet.absoluteFill,
    zIndex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    backgroundColor: 'rgba(0, 0, 0, 0.45)',
  },
  loadingText: { color: '#FFFFFF' },
});
