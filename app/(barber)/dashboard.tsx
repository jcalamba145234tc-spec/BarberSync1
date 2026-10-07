/**
 * Barber home screen (read-only): today's commission, the services the
 * admin/owner logged under this barber, and the live customer queue.
 * Barbers cannot log services themselves.
 */
import React, { useMemo } from 'react';
import { StyleSheet } from 'react-native';
import { Text } from 'react-native-paper';
import { useFocusEffect } from 'expo-router';
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
import { useQueue } from '../../hooks/useQueue';
import { useTransactions } from '../../hooks/useTransactions';
import { formatCurrency, sum } from '../../utils/calculations';
import { buildRange, formatDate, isWithinRange } from '../../utils/dateUtils';

/** Barbers only ever see their own numbers. */
export default function BarberDashboard() {
  const { user } = useAuth();
  const { services } = useAppData();
  const today = useMemo(() => buildRange('TODAY'), []);
  const month = useMemo(() => buildRange('MONTH'), []);
  const { transactions, loading, refresh } = useTransactions({
    from: month.from,
    to: month.to,
    barberId: user?.id,
  });
  // Shared with the queue tab and the admin dashboard.
  const { activeQueue, busyId, setStatus } = useQueue(services, user?.id);

  useFocusEffect(
    React.useCallback(() => {
      refresh();
    }, [refresh])
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

  if (loading && !transactions.length) return <LoadingState message="Loading your day…" />;

  return (
    <>
      <Screen refreshing={loading} onRefresh={refresh}>
        <Text variant="titleLarge" style={styles.greeting}>Hi, {user?.name}</Text>
        <Text variant="bodySmall" style={styles.muted}>{formatDate(new Date())}</Text>

        <StatGrid>
          <StatCard label="Today's commission" value={formatCurrency(todayEarnings)} tone="success" />
          <StatCard label="Services today" value={String(todays.length)} />
          <StatCard label="This pay period" value={formatCurrency(periodEarnings)} tone="accent" hint="Month to date" />
          <StatCard label="Customers waiting" value={String(activeQueue.length)} />
        </StatGrid>

        <SectionCard title="Current queue">
          {activeQueue.length === 0 ? (
            <EmptyState icon="🪑" title="No customers waiting" message="The queue is clear right now." />
          ) : (
            activeQueue.slice(0, 3).map((entry, index) => (
              <QueueCard
                key={entry.id}
                entry={entry}
                position={index + 1}
                busy={busyId === entry.id}
                onStatusChange={(status) => setStatus(entry.id, status)}
              />
            ))
          )}
        </SectionCard>

        <SectionCard title="Services today" subtitle="Recorded by the owner at the counter.">
          {todays.length === 0 ? (
            <EmptyState
              icon="✂️"
              title="No services yet today"
              message="Services show up here once the owner records them."
            />
          ) : (
            todays.map((transaction) => (
              <TransactionCard
                key={transaction.id}
                transaction={transaction}
                showSplit={false}
                footer={
                  <Text variant="bodySmall" style={styles.commission}>
                    Your commission: {formatCurrency(transaction.barberShare)}
                  </Text>
                }
              />
            ))
          )}
        </SectionCard>
      </Screen>
    </>
  );
}

const styles = StyleSheet.create({
  greeting: { fontWeight: '800', color: Colors.text },
  muted: { color: Colors.textMuted },
  commission: { color: Colors.success, fontWeight: '700' },
});
