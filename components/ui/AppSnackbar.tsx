/**
 * Small reusable wrapper around react-native-paper's Snackbar for showing a
 * one-off success/error message after an action, used across most screens.
 */
import React from 'react';
import { Snackbar } from 'react-native-paper';

interface AppSnackbarProps {
  message: string | null;
  onDismiss: () => void;
}

export function AppSnackbar({ message, onDismiss }: AppSnackbarProps) {
  return (
    <Snackbar visible={Boolean(message)} onDismiss={onDismiss} duration={3500}>
      {message ?? ''}
    </Snackbar>
  );
}
