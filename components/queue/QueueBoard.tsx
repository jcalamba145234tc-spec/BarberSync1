/**
 * The shared walk-in queue UI used by both the admin and barber Queue tabs
 * (see app/(admin)/queue.tsx and app/(barber)/queue.tsx, which just render
 * this same component). Wraps hooks/useQueue.ts.
 */
import React, { useEffect, useMemo, useState } from 'react';
import { Image, StyleSheet, View } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { Button, Chip, Dialog, HelperText, Portal, Snackbar, Text, TextInput } from 'react-native-paper';
import { Colors } from '../../constants/colors';
import { useAppData } from '../../context/AppDataContext';
import { useAuth } from '../../hooks/useAuth';
import { unavailableLabel, useBarberAvailability } from '../../hooks/useBarberAvailability';
import { useQueue } from '../../hooks/useQueue';
import { isActive, recalculateWaitTimes } from '../../services/queueService';
import { notifyNewTransaction } from '../../services/notificationService';
import { getGcashScreenshotBase64 } from '../../services/storageService';
import { createTransaction } from '../../services/transactionService';
import { QueueEntry } from '../../types/queue';
import { PaymentMethod } from '../../types/transaction';
import { formatCurrency } from '../../utils/calculations';
import { parseAmount, validateQueueEntry } from '../../utils/validation';
import { EmptyState } from '../ui/EmptyState';
import { LoadingState } from '../ui/LoadingState';
import { Screen } from '../ui/Screen';
import { SectionCard } from '../ui/SectionCard';
import { QueueCard } from './QueueCard';

/**
 * Shared by the admin and barber queue tabs. The admin/owner manages the
 * queue (add, call, start, complete + payment, cancel). Barbers see their own
 * waiting customers and can only Call and Start them; they cannot add
 * customers, complete a service (payment) or cancel.
 */
export function QueueBoard() {
  const { services, barbers, settings } = useAppData();
  const { user } = useAuth();
  const isBarberPortal = user?.role === 'BARBER';
  // Barbers can't add customers or complete/cancel; they only Call/Start.
  const readOnly = isBarberPortal;
  const { unavailable } = useBarberAvailability();
  const { queue, loading, busyId, refresh, add, setStatus } = useQueue(
    services,
    isBarberPortal ? user?.id : undefined
  );

  const [visible, setVisible] = useState(false);
  const [customerName, setCustomerName] = useState('');
  const [serviceId, setServiceId] = useState('');
  const [barberId, setBarberId] = useState<string | null>(
    isBarberPortal && user ? user.id : null
  );
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);

  // Payment dialog shown when a service is completed.
  const [payEntry, setPayEntry] = useState<QueueEntry | null>(null);
  const [amount, setAmount] = useState('');
  const [method, setMethod] = useState<PaymentMethod>('CASH');
  const [gcashReference, setGcashReference] = useState('');
  const [gcashReceiptUri, setGcashReceiptUri] = useState<string | null>(null);
  const [gcashReceiptBase64, setGcashReceiptBase64] = useState<string | null>(null);
  const [processingReceipt, setProcessingReceipt] = useState(false);
  const [payBarberId, setPayBarberId] = useState<string>('');
  const [payError, setPayError] = useState<string | null>(null);
  const [paying, setPaying] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  // Re-runs the estimate every minute so the number counts down on screen
  // instead of staying frozen until the next pull-to-refresh.
  const [tick, setTick] = useState(() => new Date());
  useEffect(() => {
    const timer = setInterval(() => setTick(new Date()), 60000);
    return () => clearInterval(timer);
  }, []);

  const liveQueue = useMemo(
    () => recalculateWaitTimes(queue, services, tick),
    [queue, services, tick]
  );
  const activeQueue = useMemo(() => liveQueue.filter(isActive), [liveQueue]);
  const doneToday = useMemo(() => liveQueue.filter((entry) => !isActive(entry)), [liveQueue]);
  const activeServices = useMemo(() => services.filter((s) => s.active), [services]);

  const handleAdd = async () => {
    const result = validateQueueEntry(customerName, serviceId);
    setErrors(result.errors);
    if (!result.valid) return;

    const service = services.find((s) => s.id === serviceId);
    if (!service) return;

    const assignedBarberId = isBarberPortal ? user?.id : barberId;
    if (!assignedBarberId) {
      setErrors({ ...result.errors, barberId: 'Choose the barber requested by the customer.' });
      return;
    }
    if (!isBarberPortal && unavailable[assignedBarberId]) {
      setErrors({ ...result.errors, barberId: 'That barber is absent or on leave today. Choose another barber.' });
      return;
    }
    const barber =
      isBarberPortal && user
        ? { id: user.id, name: user.name }
        : barbers.find((b) => b.id === assignedBarberId) ?? null;
    if (!barber) {
      setErrors({ ...result.errors, barberId: 'That barber is no longer available. Choose another barber.' });
      return;
    }

    setSaving(true);
    try {
      await add({
        customerName,
        serviceId: service.id,
        serviceName: service.name,
        barberId: barber.id,
        barberName: barber.name,
        durationMinutes: service.durationMinutes,
      });

      setCustomerName('');
      setServiceId('');
      setBarberId(isBarberPortal && user ? user.id : null);
      setErrors({});
      setVisible(false);
    } catch (error) {
      console.warn('[BarberSync] Could not add the queue customer.', error);
      setToast('Could not add customer to the queue. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const openPayment = (entry: QueueEntry) => {
    const service = services.find((s) => s.id === entry.serviceId);
    setPayEntry(entry);
    setAmount(service ? String(service.price) : '');
    setMethod('CASH');
    setGcashReference('');
    setGcashReceiptUri(null);
    setGcashReceiptBase64(null);
    setProcessingReceipt(false);
    setPayBarberId(entry.barberId ?? (user?.role === 'BARBER' ? user.id : ''));
    setPayError(null);
  };

  const pickGcashReceipt = async () => {
    setPayError(null);
    try {
      const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permission.granted) {
        setPayError('Photo library permission is required to attach a GCash receipt.');
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        quality: 0.6,
      });
      if (result.canceled || !result.assets.length) return;

      const uri = result.assets[0].uri;
      setGcashReceiptUri(uri);
      setGcashReceiptBase64(null);
      setProcessingReceipt(true);
      try {
        const base64 = await getGcashScreenshotBase64(uri);
        if (!base64) {
          setPayError('Could not process that receipt. Try a smaller image or a different photo.');
          return;
        }
        setGcashReceiptBase64(base64);
      } finally {
        setProcessingReceipt(false);
      }
    } catch (error) {
      console.warn('[BarberSync] Could not select the queue GCash receipt.', error);
      setPayError('Could not open the photo library. Please try again.');
    }
  };

  const closePayment = () => {
    setPayEntry(null);
    setPayError(null);
    setGcashReceiptUri(null);
    setGcashReceiptBase64(null);
  };

  const handleRecordPayment = async () => {
    if (!payEntry || !user) return;
    const numericAmount = parseAmount(amount);
    if (!Number.isFinite(numericAmount) || numericAmount <= 0) {
      setPayError('Enter the amount the customer paid.');
      return;
    }
    if (method === 'GCASH' && !gcashReference.trim()) {
      setPayError('Enter the GCash reference number.');
      return;
    }
    if (processingReceipt) {
      setPayError('Still processing the GCash receipt. Please wait a moment.');
      return;
    }
    if (method === 'GCASH' && gcashReceiptUri && !gcashReceiptBase64) {
      setPayError('The selected receipt could not be processed. Upload it again or remove it before continuing.');
      return;
    }

    const chosen = barbers.find((b) => b.id === payBarberId);
    const fallback =
      payEntry.barberId && payEntry.barberName
        ? { id: payEntry.barberId, name: payEntry.barberName }
        : user.role === 'BARBER'
        ? { id: user.id, name: user.name }
        : null;
    const barber = chosen ? { id: chosen.id, name: chosen.name } : fallback;

    if (!barber) {
      setPayError('Choose which barber served this customer.');
      return;
    }

    setPaying(true);
    try {
      const transaction = await createTransaction(
        {
          customerName: payEntry.customerName,
          barberId: barber.id,
          barberName: barber.name,
          serviceId: payEntry.serviceId,
          serviceName: payEntry.serviceName,
          amount: numericAmount,
          paymentMethod: method,
          gcashReference: method === 'GCASH' ? gcashReference : null,
          gcashScreenshotLocalUri: method === 'GCASH' ? gcashReceiptUri : null,
          gcashScreenshotBase64: method === 'GCASH' ? gcashReceiptBase64 : null,
          createdBy: user.id,
        },
        settings
      );
      await notifyNewTransaction(transaction);

      // Only close the queue entry once the sale is safely stored.
      await setStatus(payEntry.id, 'COMPLETED');
      setToast(formatCurrency(numericAmount) + ' recorded for ' + payEntry.customerName);
      closePayment();
    } catch (error) {
      console.warn('[BarberSync] Could not record the queue payment.', error);
      setPayError('Could not save the sale. The customer stays in the queue, please try again.');
    } finally {
      setPaying(false);
    }
  };

  if (loading && !queue.length) return <LoadingState message="Loading the queue..." />;

  const needsBarberChoice = !!payEntry && !payEntry.barberId && user?.role !== 'BARBER';

  return (
    <Screen refreshing={loading} onRefresh={refresh}>
      <SectionCard
        title="Now waiting"
        subtitle={`${activeQueue.length} customer${activeQueue.length === 1 ? '' : 's'} in line`}
        right={
          readOnly ? undefined : (
            <Button mode="contained" icon="account-plus" compact onPress={() => setVisible(true)}>
              Add
            </Button>
          )
        }
      >
        {activeQueue.length === 0 ? (
          <EmptyState
            icon="🪑"
            title="No customers waiting"
            message={
              readOnly
                ? 'Customers assigned to you will show up here in order of arrival.'
                : 'Walk-ins you add will show up here in order of arrival.'
            }
            actionLabel={readOnly ? undefined : 'Add customer'}
            onAction={readOnly ? undefined : () => setVisible(true)}
          />
        ) : (
          <View style={styles.list}>
            {activeQueue.map((entry, index) => (
              <QueueCard
                key={entry.id}
                entry={entry}
                position={index + 1}
                limited={isBarberPortal}
                busy={busyId === entry.id}
                onStatusChange={(status) => setStatus(entry.id, status)}
                onComplete={() => openPayment(entry)}
              />
            ))}
          </View>
        )}
      </SectionCard>

      {doneToday.length > 0 && (
        <SectionCard title="Finished today" subtitle={`${doneToday.length} customer(s)`}>
          {doneToday.map((entry) => (
            <Text key={entry.id} variant="bodySmall" style={styles.done}>
              {entry.customerName} - {entry.serviceName} -{' '}
              {entry.status === 'COMPLETED' ? 'Completed' : 'Cancelled'}
            </Text>
          ))}
        </SectionCard>
      )}

      {!readOnly && (
      <Portal>
        <Dialog visible={visible} onDismiss={() => setVisible(false)}>
          <Dialog.Title>Add walk-in customer</Dialog.Title>
          <Dialog.Content>
            <TextInput
              label="Customer name"
              mode="outlined"
              value={customerName}
              onChangeText={(value) => {
                setCustomerName(value);
                setErrors((current) => ({ ...current, customerName: '' }));
              }}
            />
            <HelperText type="error" visible={!!errors.customerName}>{errors.customerName}</HelperText>

            {isBarberPortal && user && (
              <>
                <Text variant="labelLarge" style={styles.label}>Assigned barber</Text>
                <Text variant="bodyMedium" style={styles.assignedBarber}>{user.name} (your account)</Text>
              </>
            )}

            <Text variant="labelLarge" style={styles.label}>Service</Text>
            <View style={styles.chips}>
              {activeServices.map((service) => (
                <Chip
                  key={service.id}
                  selected={serviceId === service.id}
                  onPress={() => {
                    setServiceId(service.id);
                    setErrors((current) => ({ ...current, serviceId: '' }));
                  }}
                >
                  {service.name}
                </Chip>
              ))}
            </View>
            <HelperText type="error" visible={!!errors.serviceId}>{errors.serviceId}</HelperText>

            {!isBarberPortal && (
              <>
                <Text variant="labelLarge" style={styles.label}>Customer's chosen barber</Text>
                <View style={styles.chips}>
                  {barbers.filter((b) => b.active !== false).map((barber) => (
                    <Chip
                      key={barber.id}
                      selected={barberId === barber.id}
                      disabled={!!unavailable[barber.id]}
                      onPress={() => {
                        setBarberId(barber.id);
                        setErrors((current) => ({ ...current, barberId: '' }));
                      }}
                    >
                      {unavailable[barber.id] ? `${barber.name} · ${unavailableLabel(unavailable[barber.id])}` : barber.name}
                    </Chip>
                  ))}
                </View>
                <HelperText type="error" visible={!!errors.barberId}>{errors.barberId}</HelperText>
              </>
            )}
          </Dialog.Content>
          <Dialog.Actions>
            <Button onPress={() => setVisible(false)} disabled={saving}>Cancel</Button>
            <Button mode="contained" onPress={handleAdd} loading={saving} disabled={saving}>
              Add to queue
            </Button>
          </Dialog.Actions>
        </Dialog>

        <Dialog visible={!!payEntry} onDismiss={closePayment}>
          <Dialog.Title>Record payment</Dialog.Title>
          <Dialog.Content>
            <Text variant="bodySmall" style={styles.muted}>
              {payEntry?.customerName} - {payEntry?.serviceName}
            </Text>

            <TextInput
              label="Amount paid"
              mode="outlined"
              keyboardType="numeric"
              value={amount}
              onChangeText={setAmount}
              style={styles.field}
            />

            <Text variant="labelLarge" style={styles.label}>Payment method</Text>
            <View style={styles.chips}>
              <Chip selected={method === 'CASH'} onPress={() => setMethod('CASH')}>Cash</Chip>
              <Chip selected={method === 'GCASH'} onPress={() => setMethod('GCASH')}>GCash</Chip>
            </View>

            {method === 'GCASH' && (
              <View style={styles.receiptSection}>
                <TextInput
                  label="GCash reference number"
                  mode="outlined"
                  value={gcashReference}
                  onChangeText={setGcashReference}
                  style={styles.field}
                />
                <Button
                  mode="outlined"
                  icon="image-plus"
                  onPress={pickGcashReceipt}
                  loading={processingReceipt}
                  disabled={processingReceipt || paying}
                >
                  {processingReceipt
                    ? 'Processing receipt…'
                    : gcashReceiptUri
                      ? 'Change receipt photo'
                      : 'Upload receipt photo'}
                </Button>
                {gcashReceiptUri && (
                  <View style={styles.receiptPreviewContainer}>
                    <Image
                      source={{ uri: gcashReceiptUri }}
                      style={styles.receiptPreview}
                      resizeMode="contain"
                    />
                    <Button
                      mode="text"
                      compact
                      onPress={() => {
                        setGcashReceiptUri(null);
                        setGcashReceiptBase64(null);
                        setPayError(null);
                      }}
                      disabled={paying || processingReceipt}
                    >
                      Remove photo
                    </Button>
                  </View>
                )}
              </View>
            )}

            {needsBarberChoice && (
              <>
                <Text variant="labelLarge" style={styles.label}>Served by</Text>
                <View style={styles.chips}>
                  {barbers.filter((b) => b.active !== false).map((barber) => (
                    <Chip
                      key={barber.id}
                      selected={payBarberId === barber.id}
                      disabled={!!unavailable[barber.id]}
                      onPress={() => setPayBarberId(barber.id)}
                    >
                      {unavailable[barber.id] ? `${barber.name} · ${unavailableLabel(unavailable[barber.id])}` : barber.name}
                    </Chip>
                  ))}
                </View>
              </>
            )}

            <HelperText type="error" visible={!!payError}>{payError}</HelperText>
          </Dialog.Content>
          <Dialog.Actions>
            <Button onPress={closePayment} disabled={paying}>Cancel</Button>
            <Button mode="contained" onPress={handleRecordPayment} loading={paying} disabled={paying}>
              Record and complete
            </Button>
          </Dialog.Actions>
        </Dialog>
      </Portal>
      )}

      <Snackbar visible={!!toast} onDismiss={() => setToast(null)} duration={3000}>
        {toast ?? ''}
      </Snackbar>
    </Screen>
  );
}

const styles = StyleSheet.create({
  list: { gap: 10 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  label: { marginTop: 8, marginBottom: 6, color: Colors.textMuted },
  assignedBarber: { color: Colors.text, fontWeight: '600' },
  field: { marginTop: 8 },
  receiptSection: { gap: 10, marginTop: 10 },
  receiptPreviewContainer: { alignItems: 'flex-start', gap: 4 },
  receiptPreview: { width: 180, height: 120, backgroundColor: Colors.background, borderRadius: 8 },
  muted: { color: Colors.textMuted },
  done: { color: Colors.textMuted },
});
