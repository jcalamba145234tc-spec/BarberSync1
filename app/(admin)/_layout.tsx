import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Tabs, useRouter } from 'expo-router';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Colors } from '../../constants/colors';
import { ConnectionIndicator } from '../../components/ui/ConnectionIndicator';
import { HeaderBackButton } from '../../components/ui/HeaderBackButton';
import { RoleGuard } from '../../components/ui/RoleGuard';

function icon(name: keyof typeof MaterialCommunityIcons.glyphMap) {
  return ({ color, size }: { color: any; size: number }) => (
    <MaterialCommunityIcons name={name} color={color} size={size} />
  );
}

function BarberHeaderRight() {
  const router = useRouter();
  return (
    <View style={styles.headerRightContainer}>
      <Pressable
        onPress={() => router.push('/(admin)/attendance')}
        style={styles.attendanceBtn}
        accessibilityRole="button"
        accessibilityLabel="Manage Attendance"
      >
        <MaterialCommunityIcons name="clipboard-check-outline" size={16} color="#FFFFFF" />
        <Text style={styles.attendanceBtnText}>Attendance</Text>
      </Pressable>
      <ConnectionIndicator />
    </View>
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
          name="barbers"
          options={{
            title: 'Barbers',
            tabBarIcon: icon('account-tie'),
            headerRight: () => <BarberHeaderRight />,
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
          name="attendance"
          options={{
            title: 'Attendance',
            href: null,
            headerLeft: () => <HeaderBackButton />,
          }}
        />
      </Tabs>
    </RoleGuard>
  );
}

const styles = StyleSheet.create({
  headerRightContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginRight: 6,
  },
  attendanceBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: '#FFFFFF22',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
  },
  attendanceBtnText: {
    color: '#FFFFFF',
    fontWeight: '600',
    fontSize: 12,
  },
});
