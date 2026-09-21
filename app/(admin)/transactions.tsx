import React, { useMemo, useState } from 'react';
import { Image, Linking, StyleSheet, View } from 'react-native';
import { Button, Chip, Dialog, Portal, SegmentedButtons, Text } from 'react-native-paper';
import { useFocusEffect, useRouter } from 'expo-router';
import { AppSnackbar } from '../../components/ui/AppSnackbar';
import { EmptyState } from '../../components/ui/EmptyState';
import { LoadingState } from '../../components/ui/LoadingState';
import { Screen } from '../../components/ui/Screen';
import { SectionCard } from '../../components/ui/SectionCard';
import { TransactionCard } from '../../components/transactions/TransactionCard';
import { Colors } from '../../constants/colors';
import { useAppData } from '../../context/AppDataContext';
import { useTransactions } from '../../hooks/useTransactions';
import { cancelTransaction, setGcashVerification } from '../../services/transactionService';
import { Transaction } from '../../types/transaction';
import { exportTransactionsCsv } from '../../utils/csvExport';
import { formatCurrency } from '../../utils/calculations';
import { buildRange } from '../../utils/dateUtils';

type PaymentFilter = 'ALL' | 'CASH' | 'GCASH';

export default function AdminTransactions() {
  const router = useRouter();
  const { barbers } = useAppData();
  const month = useMemo(() => buildRange('MONTH'), []);
  const { transactions, loading, refresh } = useTransactions({ from: month.from, to: month.to });

  const [payment, setPayment] = useState<PaymentFilter>('ALL');
  const [barberId, setBarberId] = useState<string | null>(null);
  const [pendingOnly, setPendingOnly] = useState(false);
  const [selected, setSelected] = useState<Transaction | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  useFocusEffect(React.useCallback(() => { refresh(); }, [refresh]));

  const filtered = useMemo(
    () =>
      transactions.filter((t) => {
        if (payment !== 'ALL' && t.paymentMethod !== payment) return false;
        if (barberId && t.barberId !== barberId) return false;
        if (pendingOnly && t.status !== 'PENDING_GCASH') return false;
        return true;
      }),
    [transactions, payment, barberId, pendingOnly]
  );

  const total = useMemo(
    () => filtered.filter((t) => t.status === 'COMPLETED').reduce((sum, t) => sum + t.amount, 0),
    [filtered]
  );

  const handleVerify = async (verified: boolean) => {
    if (!selected) return;
    setBusy(true);
    try {
      await setGcashVerification(selected.id, verified);
      setMessage(verified ? 'GCash payment verified.' : 'GCash payment rejected.');
      setSelected(null);
      await refresh();
    } catch {
      setMessage('Could not update the payment. Please try again.');
    } finally {
      setBusy(false);
    }
  };

  const handleCancel = async () => {
    if (!selected) return;
    setBusy(true);
    try {
      await cancelTransaction(selected.id);
      setMessage('Transaction cancelled.');
      setSelected(null);
      await refresh();
    } finally {
      setBusy(false);
    }
  };

  const handleExport = async () => {
    try {
      await exportTransactionsCsv(filtered);
      setMessage('CSV exported.');
    } catch {
      setMessage('Could not export the CSV file.');
    }
  };

  if (loading && !transactions.length) return <LoadingState message="Loading transactions..." />;

  return (
    <>
      <Screen refreshing={loading} onRefresh={refresh}>
        <SectionCard title="Filters" subtitle={`${filtered.length} record(s) - ${formatCurrency(total)} completed`}>
          <SegmentedButtons
            value={payment}
            onValueChange={(value) => setPayment(value as PaymentFilter)}
            buttons={[
              { value: 'ALL', label: 'All' },
              { value: 'CASH', label: 'Cash' },
              { value: 'GCASH', label: 'GCash' },
            ]}
          />
          <View style={styles.chips}>
            <Chip selected={pendingOnly} onPress={() => setPendingOnly(!pendingOnly)} icon="clock-alert-outline">
              Pending GCash
            </Chip>
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
          <View style={styles.actions}>
            <Button mode="contained-tonal" icon="file-delimited" onPress={handleExport}>
              Export CSV
            </Button>
            <Button mode="contained" icon="plus" onPress={() => router.push('/(admin)/transaction-entry')}>
              New
            </Button>
          </View>
        </SectionCard>

        {filtered.length === 0 ? (
          <EmptyState
            icon={"\u{1F9FE}"}
            title="No transactions match these filters"
            message="Try clearing the filters or record a new service."
          />
        ) : (
          filtered.map((transaction) => (
            <TransactionCard
              key={transaction.id}
              transaction={transaction}
              footer={
                <Button compact mode="text" onPress={() => setSelected(transaction)}>
                  Manage
                </Button>
              }
            />
          ))
        )}
      </Screen>

      <Portal>
        <Dialog visible={Boolean(selected)} onDismiss={() => setSelected(null)}>
          <Dialog.Title>{selected?.serviceName}</Dialog.Title>
          <Dialog.Content style={styles.dialog}>
            <Text variant="bodyMedium">
              {selected?.customerName} - {selected?.barberName}
            </Text>
            <Text variant="bodyMedium">
              {formatCurrency(selected?.amount ?? 0)} - {selected?.paymentMethod}
            </Text>
            {!!selected?.gcashReference && (
              <Text variant="bodySmall" style={styles.muted}>
                Reference: {selected.gcashReference}
              </Text>
            )}
            {!!selected?.gcashScreenshotUrl && (
              <>
                <Image source={{ uri: selected.gcashScreenshotUrl }} style={styles.screenshot} />
                <Button onPress={() => Linking.openURL(selected.gcashScreenshotUrl as string)}>
                  Open screenshot
                </Button>
              </>
            )}
            {!selected?.gcashScreenshotUrl && !!selected?.gcashScreenshotLocalUri && (
              <>
                <Image source={{ uri: selected.gcashScreenshotLocalUri }} style={styles.screenshot} />
                <Text variant="bodySmall" style={styles.muted}>
                  Stored on this device, it uploads on the next sync.
                </Text>
              </>
            )}
          </Dialog.Content>
          <Dialog.Actions style={styles.dialogActions}>
            {selected?.status === 'PENDING_GCASH' && (
              <Button textColor={Colors.danger} disabled={busy} onPress={() => handleVerify(false)}>
                Reject
              </Button>
            )}
            {selected?.status === 'PENDING_GCASH' && (
              <Button mode="contained" loading={busy} disabled={busy} onPress={() => handleVerify(true)}>
                Verify payment
              </Button>
            )}
            {selected?.status === 'COMPLETED' && (
              <Button textColor={Colors.danger} disabled={busy} onPress={handleCancel}>
                Cancel transaction
              </Button>
            )}
            <Button onPress={() => setSelected(null)}>Close</Button>
          </Dialog.Actions>
        </Dialog>
      </Portal>

      <AppSnackbar message={message} onDismiss={() => setMessage(null)} />
    </>
  );
}

const styles = StyleSheet.create({
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 10 },
  actions: { flexDirection: 'row', gap: 8, marginTop: 10 },
  dialog: { gap: 6 },
  dialogActions: { flexWrap: 'wrap' },
  screenshot: { width: '100%', height: 220, borderRadius: 12, resizeMode: 'contain', marginTop: 8 },
  muted: { color: Colors.textMuted },
});

