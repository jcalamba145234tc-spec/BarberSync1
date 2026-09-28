import React from 'react';
import { Tabs } from 'expo-router';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Colors } from '../../constants/colors';
import { ConnectionIndicator } from '../../components/ui/ConnectionIndicator';
import { HeaderBackButton } from '../../components/ui/HeaderBackButton';
import { RoleGuard } from '../../components/ui/RoleGuard';

function icon(name: keyof typeof MaterialCommunityIcons.glyphMap) {
  return ({ color, size }: { color: string; size: number }) => (
    <MaterialCommunityIcons name={name} color={color} size={size} />
  );
}

/** Admin-only tab navigation. Extra screens use href: null so they stay off the tab bar. */
export default function AdminLayout() {
  return (
    <RoleGuard role="ADMIN">
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
          name="transactions"
          options={{
            title: 'Transactions',
            tabBarIcon: icon('cash-register'),
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
          name="reports"
          options={{
            title: 'Reports',
            tabBarIcon: icon('chart-line'),
          }}
        />

        <Tabs.Screen
          name="attendance"
          options={{
            title: 'Attendance',
            tabBarIcon: icon('clipboard-check-outline'),
          }}
        />

        <Tabs.Screen
          name="settings"
          options={{
            title: 'Settings',
            tabBarIcon: icon('cog-outline'),
          }}
        />

        <Tabs.Screen
          name="transaction-entry"
          options={{
            title: 'New Transaction',
            href: null,
            headerLeft: () => <HeaderBackButton />,
          }}
        />

        <Tabs.Screen
          name="revenue-split"
          options={{
            title: 'Revenue Split',
            href: null,
            headerLeft: () => <HeaderBackButton />,
          }}
        />

        <Tabs.Screen
          name="services"
          options={{
            title: 'Services',
            href: null,
            headerLeft: () => <HeaderBackButton />,
          }}
        />

        <Tabs.Screen
          name="expenses"
          options={{
            title: 'Expenses',
            href: null,
            headerLeft: () => <HeaderBackButton />,
          }}
        />

        <Tabs.Screen
          name="barbers"
          options={{
            title: 'Barbers',
            href: null,
            headerLeft: () => <HeaderBackButton />,
          }}
        />
      </Tabs>
    </RoleGuard>
  );
}