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
import { getGcashScreenshotBase64 } from '../../services/storageService';
import { notifyNewTransaction } from '../../services/notificationService';
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
  const [tip, setTip] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod | ''>('');
  const [gcashReference, setGcashReference] = useState('');
  const [screenshotUri, setScreenshotUri] = useState<string | null>(null);
  const [screenshotBase64, setScreenshotBase64] = useState<string | null>(null);
  const [compressingScreenshot, setCompressingScreenshot] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const numericAmount = parseAmount(amount);
  const preview = calculateRevenueSplit(
    Number.isNaN(numericAmount) ? 0 : numericAmount,
    settings.shopPercentage
  );

  const numericTip = tip.trim() ? parseAmount(tip) : 0;

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
        const uri = result.assets[0].uri;
        setScreenshotUri(uri);
        setScreenshotBase64(null);
        setCompressingScreenshot(true);
        try {
          const base64 = await getGcashScreenshotBase64(uri);
          setScreenshotBase64(base64);
          if (!base64) {
            setSaveError('Could not process that screenshot. Try a smaller image or a different photo.');
          }
        } finally {
          setCompressingScreenshot(false);
        }
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
    setTip('');
    setPaymentMethod('');
    setGcashReference('');
    setScreenshotUri(null);
    setScreenshotBase64(null);
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
      tip,
      paymentMethod,
      gcashReference,
    });
    setErrors(result.errors);
    if (!result.valid || !user) return;
    if (compressingScreenshot) {
      setSaveError('Still processing the screenshot, please wait a moment.');
      return;
    }

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
          tip: numericTip,
          paymentMethod: paymentMethod as PaymentMethod,
          gcashReference,
          gcashScreenshotLocalUri: screenshotUri,
          gcashScreenshotBase64: screenshotBase64,
          createdBy: user.id,
        },
        settings
      );
      await notifyNewTransaction(transaction);
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
            {barbers.filter((b) => b.active !== false).map((barber) => (
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
            <Button mode="outlined" icon="image-plus" onPress={pickScreenshot} loading={compressingScreenshot}>
              {compressingScreenshot ? 'Processing…' : screenshotUri ? 'Change screenshot' : 'Upload screenshot'}
            </Button>
            {!!screenshotUri && <Image source={{ uri: screenshotUri }} style={styles.preview} />}
            <Text variant="bodySmall" style={styles.muted}>
              The payment is saved as verified. Keep the reference number for your records; the screenshot is optional.
            </Text>
          </View>
        )}
      </SectionCard>

      <SectionCard title="Tip (optional)" subtitle="Goes 100% to the barber. It is not split with the shop.">
        <View style={styles.chips}>
          {['20', '50', '100'].map((value) => (
            <Chip
              key={value}
              selected={tip === value}
              showSelectedCheck
              onPress={() => setTip(tip === value ? '' : value)}
            >
              {formatCurrency(Number(value))}
            </Chip>
          ))}
        </View>
        <TextInput
          label="Tip amount (₱)"
          mode="outlined"
          keyboardType="numeric"
          value={tip}
          onChangeText={setTip}
          style={styles.tipInput}
        />
        <HelperText type="error" visible={!!errors.tip}>{errors.tip}</HelperText>
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
        {!Number.isNaN(numericTip) && numericTip > 0 && (
          <Text variant="bodySmall" style={styles.muted}>
            Barber receives {formatCurrency(preview.barberShare)} commission + {formatCurrency(numericTip)} tip ={' '}
            {formatCurrency(preview.barberShare + numericTip)}
          </Text>
        )}
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
  tipInput: { marginTop: 8 },
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
