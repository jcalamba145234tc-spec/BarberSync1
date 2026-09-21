import React from 'react';
import { Tabs } from 'expo-router';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Colors } from '../../constants/colors';
import { ConnectionIndicator } from '../../components/ui/ConnectionIndicator';
import { RoleGuard } from '../../components/ui/RoleGuard';

function icon(name: keyof typeof MaterialCommunityIcons.glyphMap) {
  return ({ color, size }: { color: string; size: number }) => (
    <MaterialCommunityIcons name={name} color={color} size={size} />
  );
}

/** Barber navigation: no reports, expenses, services or shop-wide financials. */
export default function BarberLayout() {
  return (
    <RoleGuard role="BARBER">
      <Tabs
        screenOptions={{
          headerStyle: { backgroundColor: Colors.primary },
          headerTintColor: '#FFFFFF',
          headerTitleStyle: { fontWeight: '700' },
          headerRight: () => <ConnectionIndicator />,
          tabBarActiveTintColor: Colors.primary,
          tabBarInactiveTintColor: Colors.textMuted,
          tabBarStyle: { height: 62, paddingBottom: 8, paddingTop: 6 },
        }}
      >
        <Tabs.Screen name="dashboard" options={{ title: 'Dashboard', tabBarIcon: icon('view-dashboard') }} />
        <Tabs.Screen name="transactions" options={{ title: 'My Services', tabBarIcon: icon('receipt') }} />
        <Tabs.Screen name="queue" options={{ title: 'Queue', tabBarIcon: icon('account-clock') }} />
        <Tabs.Screen name="earnings" options={{ title: 'Earnings', tabBarIcon: icon('cash') }} />
        <Tabs.Screen name="profile" options={{ title: 'Profile', tabBarIcon: icon('account') }} />

        <Tabs.Screen name="transaction-entry" options={{ title: 'Log Service', href: null }} />
      </Tabs>
    </RoleGuard>
  );
}
