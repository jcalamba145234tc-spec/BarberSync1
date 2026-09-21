import React, { useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { Button, Chip, Dialog, HelperText, Portal, Text, TextInput } from 'react-native-paper';
import { Colors } from '../../constants/colors';
import { useAppData } from '../../context/AppDataContext';
import { useQueue } from '../../hooks/useQueue';
import { isActive } from '../../services/queueService';
import { validateQueueEntry } from '../../utils/validation';
import { EmptyState } from '../ui/EmptyState';
import { LoadingState } from '../ui/LoadingState';
import { Screen } from '../ui/Screen';
import { SectionCard } from '../ui/SectionCard';
import { QueueCard } from './QueueCard';

/** Shared by the admin and barber queue tabs. */
export function QueueBoard() {
  const { services, barbers } = useAppData();
  const { queue, loading, busyId, refresh, add, setStatus } = useQueue(services);

  const [visible, setVisible] = useState(false);
  const [customerName, setCustomerName] = useState('');
  const [serviceId, setServiceId] = useState('');
  const [barberId, setBarberId] = useState<string | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);

  const activeQueue = useMemo(() => queue.filter(isActive), [queue]);
  const doneToday = useMemo(() => queue.filter((entry) => !isActive(entry)), [queue]);
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

  if (loading && !queue.length) return <LoadingState message="Loading the queue…" />;

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
              />
            ))}
          </View>
        )}
      </SectionCard>

      {doneToday.length > 0 && (
        <SectionCard title="Finished today" subtitle={`${doneToday.length} customer(s)`}>
          {doneToday.map((entry) => (
            <Text key={entry.id} variant="bodySmall" style={styles.done}>
              {entry.customerName} · {entry.serviceName} · {entry.status === 'COMPLETED' ? 'Completed' : 'Cancelled'}
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
      </Portal>
    </Screen>
  );
}

const styles = StyleSheet.create({
  list: { gap: 10 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  label: { marginTop: 8, marginBottom: 6, color: Colors.textMuted },
  done: { color: Colors.textMuted },
});
