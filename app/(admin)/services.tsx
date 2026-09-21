import React, { useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { Button, FAB, Switch, Text } from 'react-native-paper';
import { AppSnackbar } from '../../components/ui/AppSnackbar';
import { EmptyState } from '../../components/ui/EmptyState';
import { Screen } from '../../components/ui/Screen';
import { SectionCard } from '../../components/ui/SectionCard';
import { ServiceFormDialog } from '../../components/services/ServiceFormDialog';
import { Colors } from '../../constants/colors';
import { useAppData } from '../../context/AppDataContext';
import { useTransactions } from '../../hooks/useTransactions';
import { BarberService, ServiceInput } from '../../types/service';
import { deleteService, saveService, setServiceActive } from '../../services/serviceService';
import { formatCurrency } from '../../utils/calculations';

export default function ServicesScreen() {
  const { services, settings, refreshServices } = useAppData();
  const { transactions } = useTransactions({});
  const [dialogVisible, setDialogVisible] = useState(false);
  const [editing, setEditing] = useState<BarberService | null>(null);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const usedServiceIds = useMemo(
    () => new Set(transactions.map((transaction) => transaction.serviceId)),
    [transactions]
  );

  const handleSave = async (input: ServiceInput, id?: string) => {
    setSaving(true);
    try {
      await saveService(input, id);
      await refreshServices();
      setDialogVisible(false);
      setEditing(null);
      setMessage(id ? 'Service updated.' : 'Service added.');
    } catch {
      setMessage('Could not save the service.');
    } finally {
      setSaving(false);
    }
  };

  const toggleActive = async (service: BarberService) => {
    await setServiceActive(service.id, !service.active);
    await refreshServices();
    setMessage(service.active ? `${service.name} deactivated.` : `${service.name} activated.`);
  };

  const handleDelete = async (service: BarberService) => {
    if (usedServiceIds.has(service.id)) {
      setMessage('This service has transaction history. Deactivate it instead.');
      return;
    }
    await deleteService(service.id);
    await refreshServices();
    setMessage('Service deleted.');
  };

  return (
    <>
      <Screen>
        <SectionCard
          title="Service menu"
          subtitle={`Minimum price: ${formatCurrency(settings.minimumServicePrice)}`}
        >
          {services.length === 0 ? (
            <EmptyState
              icon="✂️"
              title="No services yet"
              message="Add the services your shop offers."
              actionLabel="Add service"
              onAction={() => { setEditing(null); setDialogVisible(true); }}
            />
          ) : (
            services.map((service) => (
              <View key={service.id} style={styles.row}>
                <View style={styles.info}>
                  <Text variant="titleSmall" style={styles.name}>{service.name}</Text>
                  <Text variant="bodySmall" style={styles.muted}>
                    {formatCurrency(service.price)} · {service.durationMinutes} min
                    {usedServiceIds.has(service.id) ? ' · has history' : ''}
                  </Text>
                  <View style={styles.actions}>
                    <Button compact onPress={() => { setEditing(service); setDialogVisible(true); }}>
                      Edit
                    </Button>
                    <Button
                      compact
                      textColor={Colors.danger}
                      disabled={usedServiceIds.has(service.id)}
                      onPress={() => handleDelete(service)}
                    >
                      Delete
                    </Button>
                  </View>
                </View>
                <Switch value={service.active} onValueChange={() => toggleActive(service)} />
              </View>
            ))
          )}
        </SectionCard>
        <Text variant="bodySmall" style={styles.note}>
          Services used by past transactions can only be deactivated, so old records stay accurate.
        </Text>
      </Screen>

      <FAB
        icon="plus"
        style={styles.fab}
        onPress={() => { setEditing(null); setDialogVisible(true); }}
      />

      <ServiceFormDialog
        visible={dialogVisible}
        service={editing}
        minimumPrice={settings.minimumServicePrice}
        saving={saving}
        onDismiss={() => { setDialogVisible(false); setEditing(null); }}
        onSave={handleSave}
      />

      <AppSnackbar message={message} onDismiss={() => setMessage(null)} />
    </>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
    paddingVertical: 8,
    gap: 10,
  },
  info: { flex: 1 },
  name: { fontWeight: '700', color: Colors.text },
  muted: { color: Colors.textMuted },
  actions: { flexDirection: 'row', gap: 4, marginTop: 2 },
  note: { color: Colors.textMuted, paddingHorizontal: 4 },
  fab: { position: 'absolute', right: 16, bottom: 20, backgroundColor: Colors.accent },
});
