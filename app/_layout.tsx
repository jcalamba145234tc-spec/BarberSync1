import React, { useEffect } from 'react';
import { StatusBar } from 'expo-status-bar';
import { Slot } from 'expo-router';
import { MD3LightTheme, PaperProvider } from 'react-native-paper';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { Colors } from '../constants/colors';
import { DEMO_MODE } from '../constants/config';
import { AuthProvider } from '../context/AuthContext';
import { AppDataProvider } from '../context/AppDataContext';
import { seedDemoData } from '../services/demoData';
import { initNotifications } from '../services/notificationService';

const theme = {
  ...MD3LightTheme,
  colors: {
    ...MD3LightTheme.colors,
    primary: Colors.primary,
    secondary: Colors.accent,
    background: Colors.background,
    surface: Colors.surface,
    error: Colors.danger,
  },
};

export default function RootLayout() {
  useEffect(() => {
    // Demo data is only seeded when EXPO_PUBLIC_DEMO_MODE=true.
    if (DEMO_MODE) seedDemoData().catch(() => undefined);
    initNotifications().catch(() => undefined);
  }, []);

  return (
    <SafeAreaProvider>
      <PaperProvider theme={theme}>
        <AuthProvider>
          <AppDataProvider>
            <StatusBar style="light" />
            <Slot />
          </AppDataProvider>
        </AuthProvider>
      </PaperProvider>
    </SafeAreaProvider>
  );
}
