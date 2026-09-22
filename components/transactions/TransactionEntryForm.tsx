import React, { useMemo, useState } from 'react';
import { Image, StyleSheet, View } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import {
  Button,
  Chip,
  HelperText,
  SegmentedButtons,
  Text,
  TextInput,
} from 'react-native-paper';
import { Colors } from '../../constants/colors';
import { useAppData } from '../../context/AppDataContext';
import { useAuth } from '../../hooks/useAuth';
import { PaymentMethod, Transaction } from '../../types/transaction';
import { calculateRevenueSplit, formatCurrency } from '../../utils/calculations';
import { parseAmount, validateTransaction } from '../../utils/validation';
import { createTransaction } from '../../services/transactionService';
import { notifyGcashPending, notifyNewTransaction } from '../../services/notificationService';
import { SectionCard } from '../ui/SectionCard';

interface TransactionEntryFormProps {
 
  lockBarberToCurrentUser?: boolean;
  onSaved: (transaction: Transaction) => void;
}

export function TransactionEntryForm({ lockBarberToCurrentUser, onSaved }: TransactionEntryFormProps) {
  const { user } = useAuth();
  const { services, barbers, settings } = useAppData();
  const activeServices = useMemo(() => services.filter((s) => s.active), [services]);

  const [customerName, setCustomerName] = useState('');
  const [barberId, setBarberId] = useState(lockBarberToCurrentUser ? user?.id ?? '' : '');
  const [serviceId, setServiceId] = useState('');
  const [amount, setAmount] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod | ''>('');
  const [gcashReference, setGcashReference] = useState('');
  const [screenshotUri, setScreenshotUri] = useState<string | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const numericAmount = parseAmount(amount);
  const preview = calculateRevenueSplit(
    Number.isNaN(numericAmount) ? 0 : numericAmount,
    settings.shopPercentage
  );

  const selectService = (id: string, price: number) => {
    setServiceId(id);
    setAmount(String(price));
  };

  const pickScreenshot = async () => {
    try {
      const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permission.granted) {
        setSaveError('Photo permission is required to attach a GCash screenshot.');
        return;
      }
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        quality: 0.6,
      });
      if (!result.canceled && result.assets.length) {
        setScreenshotUri(result.assets[0].uri);
      }
    } catch (error) {
      console.warn('[BarberSync] Image picker failed.', error);
      setSaveError('Could not open the photo library.');
    }
  };

  const reset = () => {
    setCustomerName('');
    setServiceId('');
    setAmount('');
    setPaymentMethod('');
    setGcashReference('');
    setScreenshotUri(null);
    setErrors({});
    if (!lockBarberToCurrentUser) setBarberId('');
  };

  const handleSave = async () => {
    setSaveError(null);
    const result = validateTransaction({
      customerName,
      barberId,
      serviceId,
      amount,
      paymentMethod,
      gcashReference,
    });
    setErrors(result.errors);
    if (!result.valid || !user) return;

    const service = services.find((s) => s.id === serviceId);
    const barber = lockBarberToCurrentUser
      ? { id: user.id, name: user.name }
      : barbers.find((b) => b.id === barberId);
    if (!service || !barber) {
      setSaveError('The selected service or barber is no longer available.');
      return;
    }

    setSaving(true);
    try {
      const transaction = await createTransaction(
        {
          customerName,
          barberId: barber.id,
          barberName: barber.name,
          serviceId: service.id,
          serviceName: service.name,
          amount: numericAmount,
          paymentMethod: paymentMethod as PaymentMethod,
          gcashReference,
          gcashScreenshotLocalUri: screenshotUri,
          createdBy: user.id,
        },
        settings
      );
      await notifyNewTransaction(transaction);
      if (transaction.status === 'PENDING_GCASH') await notifyGcashPending(transaction);
      reset();
      onSaved(transaction);
    } catch (error) {
      console.warn('[BarberSync] Could not save the transaction.', error);
      setSaveError('Could not save the transaction. It stays on this device until it syncs.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <SectionCard title="Customer">
        <TextInput
          label="Customer name"
          mode="outlined"
          value={customerName}
          onChangeText={setCustomerName}
        />
        <HelperText type="error" visible={!!errors.customerName}>{errors.customerName}</HelperText>
      </SectionCard>

      {!lockBarberToCurrentUser && (
        <SectionCard title="Barber">
          <View style={styles.chips}>
            {barbers.map((barber) => (
              <Chip
                key={barber.id}
                selected={barberId === barber.id}
                showSelectedCheck
                onPress={() => setBarberId(barber.id)}
              >
                {barber.name}
              </Chip>
            ))}
          </View>
          <HelperText type="error" visible={!!errors.barberId}>{errors.barberId}</HelperText>
        </SectionCard>
      )}

      <SectionCard title="Service" subtitle="Tap a service to fill in the price automatically.">
        <View style={styles.chips}>
          {activeServices.map((service) => (
            <Chip
              key={service.id}
              selected={serviceId === service.id}
              showSelectedCheck
              onPress={() => selectService(service.id, service.price)}
            >
              {`${service.name} · ${formatCurrency(service.price)}`}
            </Chip>
          ))}
        </View>
        <HelperText type="error" visible={!!errors.serviceId}>{errors.serviceId}</HelperText>

        <TextInput
          label="Amount (₱)"
          mode="outlined"
          keyboardType="numeric"
          value={amount}
          onChangeText={setAmount}
        />
        <HelperText type="error" visible={!!errors.amount}>{errors.amount}</HelperText>
      </SectionCard>

      <SectionCard title="Payment">
        <SegmentedButtons
          value={paymentMethod}
          onValueChange={(value) => setPaymentMethod(value as PaymentMethod)}
          buttons={[
            { value: 'CASH', label: 'Cash', icon: 'cash' },
            { value: 'GCASH', label: 'GCash', icon: 'cellphone' },
          ]}
        />
        <HelperText type="error" visible={!!errors.paymentMethod}>{errors.paymentMethod}</HelperText>

        {paymentMethod === 'GCASH' && (
          <View style={styles.gcash}>
            <TextInput
              label="GCash reference number"
              mode="outlined"
              autoCapitalize="characters"
              value={gcashReference}
              onChangeText={setGcashReference}
            />
            <HelperText type="error" visible={!!errors.gcashReference}>{errors.gcashReference}</HelperText>
            <Button mode="outlined" icon="image-plus" onPress={pickScreenshot}>
              {screenshotUri ? 'Change screenshot' : 'Upload screenshot'}
            </Button>
            {!!screenshotUri && <Image source={{ uri: screenshotUri }} style={styles.preview} />}
            <Text variant="bodySmall" style={styles.muted}>
              GCash payments are saved as “Pending GCash” until the owner verifies them.
            </Text>
          </View>
        )}
      </SectionCard>

      <SectionCard title="Revenue split" subtitle="Calculated automatically from shop settings.">
        <View style={styles.splitRow}>
          <View style={styles.splitBox}>
            <Text variant="labelSmall" style={styles.muted}>SHOP {Math.round(settings.shopPercentage * 100)}%</Text>
            <Text variant="titleMedium" style={styles.splitValue}>{formatCurrency(preview.shopShare)}</Text>
          </View>
          <View style={styles.splitBox}>
            <Text variant="labelSmall" style={styles.muted}>BARBER {Math.round(settings.barberPercentage * 100)}%</Text>
            <Text variant="titleMedium" style={styles.splitValue}>{formatCurrency(preview.barberShare)}</Text>
          </View>
        </View>
      </SectionCard>

      {!!saveError && (
        <Text variant="bodySmall" style={styles.error}>
          {saveError}
        </Text>
      )}

      <Button
        mode="contained"
        icon="content-save"
        onPress={handleSave}
        loading={saving}
        disabled={saving}
        style={styles.save}
        contentStyle={styles.saveContent}
      >
        {saving ? 'Saving transaction…' : 'Save transaction'}
      </Button>
    </>
  );
}

const styles = StyleSheet.create({
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  gcash: { gap: 6, marginTop: 6 },
  preview: { width: '100%', height: 180, borderRadius: 12, resizeMode: 'cover' },
  muted: { color: Colors.textMuted },
  splitRow: { flexDirection: 'row', gap: 10 },
  splitBox: {
    flex: 1,
    padding: 12,
    borderRadius: 12,
    backgroundColor: Colors.background,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  splitValue: { fontWeight: '800', color: Colors.text, marginTop: 2 },
  error: { color: Colors.danger },
  save: { borderRadius: 12, marginTop: 4 },
  saveContent: { paddingVertical: 8 },
});
