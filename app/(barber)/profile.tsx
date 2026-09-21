import React from 'react';
import { StyleSheet } from 'react-native';
import { Button, Text } from 'react-native-paper';
import { ChangePasswordCard } from '../../components/ui/ChangePasswordCard';
import { Screen } from '../../components/ui/Screen';
import { SectionCard } from '../../components/ui/SectionCard';
import { Colors } from '../../constants/colors';
import { useAppData } from '../../context/AppDataContext';
import { useAuth } from '../../hooks/useAuth';

export default function BarberProfile() {
  const { user, logout } = useAuth();
  const { settings, connection, pending, syncNow } = useAppData();

  return (
    <Screen>
      <SectionCard title="My account">
        <Text variant="titleMedium" style={styles.name}>{user?.name}</Text>
        <Text variant="bodySmall" style={styles.muted}>{user?.email}</Text>
        <Text variant="bodySmall" style={styles.muted}>Role: {user?.role}</Text>
        {!!user?.phone && <Text variant="bodySmall" style={styles.muted}>Phone: {user.phone}</Text>}
      </SectionCard>

      <SectionCard title="Shop">
        <Text variant="bodyMedium">{settings.shopName}</Text>
        {!!settings.shopAddress && (
          <Text variant="bodySmall" style={styles.muted}>{settings.shopAddress}</Text>
        )}
        <Text variant="bodySmall" style={styles.muted}>
          Your share of each service: {Math.round(settings.barberPercentage * 100)}%
        </Text>
      </SectionCard>

      <SectionCard title="Sync" subtitle={`Status: ${connection} · ${pending} waiting to upload`}>
        <Button mode="contained-tonal" icon="sync" onPress={syncNow}>
          Sync now
        </Button>
      </SectionCard>

      <ChangePasswordCard />

      <Button mode="outlined" icon="logout" textColor={Colors.danger} onPress={logout} style={styles.logout}>
        Log out
      </Button>
    </Screen>
  );
}

const styles = StyleSheet.create({
  name: { fontWeight: '800', color: Colors.text },
  muted: { color: Colors.textMuted },
  logout: { borderColor: Colors.danger, borderRadius: 12 },
});
