/**
 * Tab layout for barber-only screens (Dashboard, Queue, Earnings,
 * Profile), wrapped in RoleGuard so an admin account routes
 * elsewhere and a signed-out user can't reach these tabs at all.
 */
import React from 'react';
import { Tabs } from 'expo-router';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Colors } from '../../constants/colors';
import { ConnectionIndicator } from '../../components/ui/ConnectionIndicator';
import { RoleGuard } from '../../components/ui/RoleGuard';

function icon(name: keyof typeof MaterialCommunityIcons.glyphMap) {
  return ({ color, size }: { color: any; size: number }) => (
    <MaterialCommunityIcons name={name} color={color} size={size} />
  );
}

/**
 * Barber navigation is read-only for money: no logging of services (the
 * admin/owner does that at the counter), no reports, expenses or shop-wide
 * financials.
 */
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
        <Tabs.Screen
          name="dashboard"
          options={{
            title: 'Dashboard',
            tabBarIcon: icon('view-dashboard-outline'),
          }}
        />

        <Tabs.Screen
          name="queue"
          options={{
            title: 'Queue',
            tabBarIcon: icon('account-group'),
          }}
        />

        <Tabs.Screen
          name="earnings"
          options={{
            title: 'Earnings',
            tabBarIcon: icon('cash-multiple'),
          }}
        />

        <Tabs.Screen
          name="profile"
          options={{
            title: 'Profile',
            tabBarIcon: icon('account-circle-outline'),
          }}
        />
      </Tabs>
    </RoleGuard>
  );
}