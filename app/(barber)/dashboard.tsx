import React, { useMemo, useState } from 'react';
import { StyleSheet } from 'react-native';
import { FAB, Text } from 'react-native-paper';
import { useFocusEffect, useRouter } from 'expo-router';
import { EmptyState } from '../../components/ui/EmptyState';
import { LoadingState } from '../../components/ui/LoadingState';
import { Screen } from '../../components/ui/Screen';
import { SectionCard } from '../../components/ui/SectionCard';
import { StatCard, StatGrid } from '../../components/ui/StatCard';
import { TransactionCard } from '../../components/transactions/TransactionCard';
import { QueueCard } from '../../components/queue/QueueCard';
import { Colors } from '../../constants/colors';
import { useAppData } from '../../context/AppDataContext';
import { useAuth } from '../../hooks/useAuth';
import { useTransactions } from '../../hooks/useTransactions';
import { getQueue, isActive, updateQueueStatus } from '../../services/queueService';
import { QueueEntry, QueueStatus } from '../../types/queue';
import { formatCurrency, sum } from '../../utils/calculations';
import { buildRange, formatDate, isWithinRange } from '../../utils/dateUtils';

/** Barbers only ever see their own numbers. */
export default function BarberDashboard() {
  const router = useRouter();
  const { user } = useAuth();
  const { services } = useAppData();
  const today = useMemo(() => buildRange('TODAY'), []);
  const month = useMemo(() => buildRange('MONTH'), []);
  const { transactions, loading, refresh } = useTransactions({
    from: month.from,
    to: month.to,
    barberId: user?.id,
  });
  const [queue, setQueue] = useState<QueueEntry[]>([]);

  useFocusEffect(
    React.useCallback(() => {
      let mounted = true;
      refresh();
      getQueue(services).then((entries) => {
        if (mounted) setQueue(entries.filter(isActive));
      });
      return () => { mounted = false; };
    }, [refresh, services])
  );

  const todays = useMemo(
    () => transactions.filter((t) => isWithinRange(t.createdAt, today.from, today.to) && t.status !== 'CANCELLED'),
    [transactions, today]
  );
  const todayEarnings = useMemo(() => sum(todays.map((t) => t.barberShare)), [todays]);
  const periodEarnings = useMemo(
    () => sum(transactions.filter((t) => t.status !== 'CANCELLED').map((t) => t.barberShare)),
    [transactions]
  );

  const handleStatus = async (id: string, status: QueueStatus) => {
    await updateQueueStatus(id, status);
    setQueue((await getQueue(services)).filter(isActive));
  };

  if (loading && !transactions.length) return <LoadingState message="Loading your day…" />;

  return (
    <>
      <Screen refreshing={loading} onRefresh={refresh}>
        <Text variant="titleLarge" style={styles.greeting}>Hi, {user?.name}</Text>
        <Text variant="bodySmall" style={styles.muted}>{formatDate(new Date())}</Text>

        <StatGrid>
          <StatCard label="Today's earnings" value={formatCurrency(todayEarnings)} tone="success" />
          <StatCard label="Services today" value={String(todays.length)} />
          <StatCard label="This pay period" value={formatCurrency(periodEarnings)} tone="accent" hint="Month to date" />
          <StatCard label="Customers waiting" value={String(queue.length)} />
        </StatGrid>

        <SectionCard title="Current queue">
          {queue.length === 0 ? (
            <EmptyState icon="🪑" title="No customers waiting" message="The queue is clear right now." />
          ) : (
            queue.slice(0, 3).map((entry, index) => (
              <QueueCard
                key={entry.id}
                entry={entry}
                position={index + 1}
                busy={false}
                onStatusChange={(status) => handleStatus(entry.id, status)}
              />
            ))
          )}
        </SectionCard>

        <SectionCard title="My recent services">
          {todays.length === 0 ? (
            <EmptyState
              icon="✂️"
              title="No services logged today"
              message="Log a service as soon as you finish a customer."
              actionLabel="Log service"
              onAction={() => router.push('/(barber)/transaction-entry')}
            />
          ) : (
            todays.slice(0, 5).map((transaction) => (
              <TransactionCard key={transaction.id} transaction={transaction} showSplit={false} />
            ))
          )}
        </SectionCard>
      </Screen>

      <FAB
        icon="plus"
        label="Log service"
        style={styles.fab}
        onPress={() => router.push('/(barber)/transaction-entry')}
      />
    </>
  );
}

const styles = StyleSheet.create({
  greeting: { fontWeight: '800', color: Colors.text },
  muted: { color: Colors.textMuted },
  fab: { position: 'absolute', right: 16, bottom: 20, backgroundColor: Colors.accent },
});
