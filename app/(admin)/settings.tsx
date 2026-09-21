import React, { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { Button, Divider, HelperText, Switch, Text, TextInput } from 'react-native-paper';
import { AppSnackbar } from '../../components/ui/AppSnackbar';
import { ChangePasswordCard } from '../../components/ui/ChangePasswordCard';
import { Screen } from '../../components/ui/Screen';
import { SectionCard } from '../../components/ui/SectionCard';
import { Colors } from '../../constants/colors';
import { DEMO_MODE } from '../../constants/config';
import { useAppData } from '../../context/AppDataContext';
import { useAuth } from '../../hooks/useAuth';
import { isFirebaseConfigured } from '../../services/firebase';
import { clearDemoData, seedDemoData } from '../../services/demoData';
import { formatCurrency } from '../../utils/calculations';
import { parseAmount } from '../../utils/validation';

export default function SettingsScreen() {
  const { settings, updateSettings, pending, syncNow, connection } = useAppData();
  const { user, logout } = useAuth();

  const [shopName, setShopName] = useState(settings.shopName);
  const [shopAddress, setShopAddress] = useState(settings.shopAddress);
  const [shopContact, setShopContact] = useState(settings.shopContact);
  const [shopPercent, setShopPercent] = useState(String(Math.round(settings.shopPercentage * 100)));
  const [minimumPrice, setMinimumPrice] = useState(String(settings.minimumServicePrice));
  const [monthlyFixed, setMonthlyFixed] = useState(String(settings.monthlyFixedExpense));
  const [notifications, setNotifications] = useState(settings.notificationsEnabled);
  const [endOfDay, setEndOfDay] = useState(settings.endOfDaySummaryEnabled);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    setShopName(settings.shopName);
    setShopAddress(settings.shopAddress);
    setShopContact(settings.shopContact);
    setShopPercent(String(Math.round(settings.shopPercentage * 100)));
    setMinimumPrice(String(settings.minimumServicePrice));
    setMonthlyFixed(String(settings.monthlyFixedExpense));
    setNotifications(settings.notificationsEnabled);
    setEndOfDay(settings.endOfDaySummaryEnabled);
  }, [settings]);

  const handleSave = async () => {
    const percent = Number(shopPercent);
    const minimum = parseAmount(minimumPrice);
    const fixed = parseAmount(monthlyFixed);
    if (!Number.isFinite(percent) || percent < 0 || percent > 100) {
      setError('The shop percentage must be between 0 and 100.');
      return;
    }
    if (Number.isNaN(minimum) || minimum <= 0 || Number.isNaN(fixed) || fixed < 0) {
      setError('Enter valid amounts for the minimum price and monthly fixed expense.');
      return;
    }
    setError(null);
    setSaving(true);
    try {
      await updateSettings({
        shopName: shopName.trim() || 'BarberSync',
        shopAddress: shopAddress.trim(),
        shopContact: shopContact.trim(),
        shopPercentage: percent / 100,
        barberPercentage: (100 - percent) / 100,
        minimumServicePrice: minimum,
        monthlyFixedExpense: fixed,
        notificationsEnabled: notifications,
        endOfDaySummaryEnabled: endOfDay,
      });
      setMessage('Settings saved.');
    } catch {
      setMessage('Could not save settings.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <Screen>
        <SectionCard title="Shop details">
          <TextInput label="Shop name" mode="outlined" value={shopName} onChangeText={setShopName} />
          <TextInput label="Address" mode="outlined" value={shopAddress} onChangeText={setShopAddress} />
          <TextInput label="Contact number" mode="outlined" keyboardType="phone-pad" value={shopContact} onChangeText={setShopContact} />
        </SectionCard>

        <SectionCard title="Revenue & pricing" subtitle="Used by every calculation in the app.">
          <TextInput
            label="Shop percentage (%)"
            mode="outlined"
            keyboardType="numeric"
            value={shopPercent}
            onChangeText={setShopPercent}
          />
          <HelperText type="info" visible>
            Barber receives {100 - (Number(shopPercent) || 0)}%.
          </HelperText>
          <TextInput
            label="Minimum service price (₱)"
            mode="outlined"
            keyboardType="numeric"
            value={minimumPrice}
            onChangeText={setMinimumPrice}
          />
          <TextInput
            label="Monthly fixed expense (₱)"
            mode="outlined"
            keyboardType="numeric"
            value={monthlyFixed}
            onChangeText={setMonthlyFixed}
          />
          <HelperText type="info" visible>
            Rent and utilities, currently {formatCurrency(settings.monthlyFixedExpense)}.
          </HelperText>
        </SectionCard>

        <SectionCard title="Notifications">
          <View style={styles.switchRow}>
            <Text variant="bodyMedium">Transaction & GCash alerts</Text>
            <Switch value={notifications} onValueChange={setNotifications} />
          </View>
          <View style={styles.switchRow}>
            <Text variant="bodyMedium">End-of-day summary</Text>
            <Switch value={endOfDay} onValueChange={setEndOfDay} />
          </View>
        </SectionCard>

        {!!error && <Text style={styles.error}>{error}</Text>}

        <Button mode="contained" onPress={handleSave} loading={saving} disabled={saving} style={styles.save}>
          {saving ? 'Saving…' : 'Save settings'}
        </Button>

        <SectionCard title="Data & sync" subtitle={`Status: ${connection} · ${pending} unsynced transaction(s)`}>
          <Button mode="contained-tonal" icon="sync" onPress={syncNow}>
            Sync now
          </Button>
          <Text variant="bodySmall" style={styles.muted}>
            {isFirebaseConfigured
              ? 'Connected to Firebase.'
              : 'Local mode: data stays on this device until Firebase keys are added to .env.'}
          </Text>
          {DEMO_MODE && (
            <>
              <Divider style={styles.divider} />
              <Text variant="bodySmall" style={styles.muted}>Demo mode is on (EXPO_PUBLIC_DEMO_MODE=true).</Text>
              <View style={styles.demoRow}>
                <Button
                  compact
                  onPress={async () => {
                    await seedDemoData(true);
                    setMessage('Demo data reloaded. Pull to refresh any screen.');
                  }}
                >
                  Reload demo data
                </Button>
                <Button
                  compact
                  textColor={Colors.danger}
                  onPress={async () => {
                    await clearDemoData();
                    setMessage('Demo data cleared.');
                  }}
                >
                  Clear demo data
                </Button>
              </View>
            </>
          )}
        </SectionCard>

        <ChangePasswordCard onDone={setMessage} />

        <SectionCard title="Account">
          <Text variant="bodyMedium">{user?.name}</Text>
          <Text variant="bodySmall" style={styles.muted}>{user?.email} · {user?.role}</Text>
          <Button mode="outlined" icon="logout" textColor={Colors.danger} onPress={logout} style={styles.logout}>
            Log out
          </Button>
        </SectionCard>
      </Screen>
      <AppSnackbar message={message} onDismiss={() => setMessage(null)} />
    </>
  );
}

const styles = StyleSheet.create({
  switchRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  error: { color: Colors.danger },
  save: { borderRadius: 12 },
  muted: { color: Colors.textMuted },
  divider: { marginVertical: 8 },
  demoRow: { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
  logout: { marginTop: 10, borderColor: Colors.danger },
});
