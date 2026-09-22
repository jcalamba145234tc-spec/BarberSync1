import React, { useEffect, useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { Button, Chip, Dialog, HelperText, Portal, Snackbar, Text, TextInput } from 'react-native-paper';
import { Colors } from '../../constants/colors';
import { useAppData } from '../../context/AppDataContext';
import { useAuth } from '../../hooks/useAuth';
import { useQueue } from '../../hooks/useQueue';
import { isActive, recalculateWaitTimes } from '../../services/queueService';
import { notifyGcashPending, notifyNewTransaction } from '../../services/notificationService';
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

/** Shared by the admin and barber queue tabs. */
export function QueueBoard() {
  const { services, barbers, settings } = useAppData();
  const { user } = useAuth();
  const { queue, loading, busyId, refresh, add, setStatus } = useQueue(services);

  const [visible, setVisible] = useState(false);
  const [customerName, setCustomerName] = useState('');
  const [serviceId, setServiceId] = useState('');
  const [barberId, setBarberId] = useState<string | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);

  // Payment dialog shown when a service is completed.
  const [payEntry, setPayEntry] = useState<QueueEntry | null>(null);
  const [amount, setAmount] = useState('');
  const [method, setMethod] = useState<PaymentMethod>('CASH');
  const [gcashReference, setGcashReference] = useState('');
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
    const barber = barbers.find((b) => b.id === barberId) ?? null;

    setSaving(true);
    try {
      await add({
        customerName,
        serviceId: service.id,
        serviceName: service.name,
        barberId: barber?.id ?? null,
        barberName: barber?.name ?? null,
        durationMinutes: service.durationMinutes,
      });
      setCustomerName('');
      setServiceId('');
      setBarberId(null);
      setVisible(false);
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
    setPayBarberId(entry.barberId ?? (user?.role === 'BARBER' ? user.id : ''));
    setPayError(null);
  };

  const closePayment = () => {
    setPayEntry(null);
    setPayError(null);
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
          gcashScreenshotLocalUri: null,
          createdBy: user.id,
        },
        settings
      );
      await notifyNewTransaction(transaction);
      if (transaction.status === 'PENDING_GCASH') await notifyGcashPending(transaction);

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
          <Button mode="contained" icon="account-plus" compact onPress={() => setVisible(true)}>
            Add
          </Button>
        }
      >
        {activeQueue.length === 0 ? (
          <EmptyState
            icon="🪑"
            title="No customers waiting"
            message="Walk-ins you add will show up here in order of arrival."
            actionLabel="Add customer"
            onAction={() => setVisible(true)}
          />
        ) : (
          <View style={styles.list}>
            {activeQueue.map((entry, index) => (
              <QueueCard
                key={entry.id}
                entry={entry}
                position={index + 1}
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

      <Portal>
        <Dialog visible={visible} onDismiss={() => setVisible(false)}>
          <Dialog.Title>Add walk-in customer</Dialog.Title>
          <Dialog.Content>
            <TextInput
              label="Customer name"
              mode="outlined"
              value={customerName}
              onChangeText={setCustomerName}
            />
            <HelperText type="error" visible={!!errors.customerName}>{errors.customerName}</HelperText>

            <Text variant="labelLarge" style={styles.label}>Service</Text>
            <View style={styles.chips}>
              {activeServices.map((service) => (
                <Chip key={service.id} selected={serviceId === service.id} onPress={() => setServiceId(service.id)}>
                  {service.name}
                </Chip>
              ))}
            </View>
            <HelperText type="error" visible={!!errors.serviceId}>{errors.serviceId}</HelperText>

            <Text variant="labelLarge" style={styles.label}>Preferred barber (optional)</Text>
            <View style={styles.chips}>
              {barbers.map((barber) => (
                <Chip
                  key={barber.id}
                  selected={barberId === barber.id}
                  onPress={() => setBarberId(barberId === barber.id ? null : barber.id)}
                >
                  {barber.name}
                </Chip>
              ))}
            </View>
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
              <TextInput
                label="GCash reference number"
                mode="outlined"
                value={gcashReference}
                onChangeText={setGcashReference}
                style={styles.field}
              />
            )}

            {needsBarberChoice && (
              <>
                <Text variant="labelLarge" style={styles.label}>Served by</Text>
                <View style={styles.chips}>
                  {barbers.map((barber) => (
                    <Chip
                      key={barber.id}
                      selected={payBarberId === barber.id}
                      onPress={() => setPayBarberId(barber.id)}
                    >
                      {barber.name}
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
  field: { marginTop: 8 },
  muted: { color: Colors.textMuted },
  done: { color: Colors.textMuted },
});
