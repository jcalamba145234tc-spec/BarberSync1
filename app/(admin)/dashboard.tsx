import React, { useMemo } from 'react';
import { StyleSheet } from 'react-native';
import { Button, FAB, Text } from 'react-native-paper';
import { useFocusEffect, useRouter } from 'expo-router';
import { BarberPerformanceTable } from '../../components/dashboard/BarberPerformanceTable';
import { QuickActions } from '../../components/dashboard/QuickActions';
import { EmptyState } from '../../components/ui/EmptyState';
import { LoadingState } from '../../components/ui/LoadingState';
import { Screen } from '../../components/ui/Screen';
import { SectionCard } from '../../components/ui/SectionCard';
import { StatCard, StatGrid } from '../../components/ui/StatCard';
import { TransactionCard } from '../../components/transactions/TransactionCard';
import { Colors } from '../../constants/colors';
import { useAppData } from '../../context/AppDataContext';
import { useAuth } from '../../hooks/useAuth';
import { useQueue } from '../../hooks/useQueue';
import { useTransactions } from '../../hooks/useTransactions';
import { notifyEndOfDaySummary } from '../../services/notificationService';
import { buildFinancialReport, formatCurrency } from '../../utils/calculations';
import { buildRange, formatDate, isWithinRange } from '../../utils/dateUtils';

export default function AdminDashboard() {
  const router = useRouter();
  const { user } = useAuth();
  const { settings, services } = useAppData();
  const today = useMemo(() => buildRange('TODAY'), []);
  const month = useMemo(() => buildRange('MONTH'), []);
  const { transactions, loading, refresh } = useTransactions({ from: month.from, to: month.to });
  // Same hook as the queue tab, so the counter here and the list there
  // always agree (it reloads whenever this screen gains focus).
  const { activeQueue } = useQueue(services);

  useFocusEffect(
    React.useCallback(() => {
      refresh();
    }, [refresh])
  );

  const todays = useMemo(
    () => transactions.filter((t) => isWithinRange(t.createdAt, today.from, today.to)),
    [transactions, today]
  );
  const todayReport = useMemo(() => buildFinancialReport(todays, [], today), [todays, today]);
  const monthReport = useMemo(() => buildFinancialReport(transactions, [], month), [transactions, month]);
  const pendingGcash = useMemo(
    () => transactions.filter((t) => t.status === 'PENDING_GCASH'),
    [transactions]
  );

  if (loading && !transactions.length) return <LoadingState message="Loading your dashboard…" />;

  return (
    <>
      <Screen refreshing={loading} onRefresh={refresh}>
        <Text variant="titleLarge" style={styles.greeting}>
          {settings.shopName}
        </Text>
        <Text variant="bodySmall" style={styles.muted}>
          {formatDate(new Date())} · Signed in as {user?.name}
        </Text>

        <StatGrid>
          <StatCard label="Today's revenue" value={formatCurrency(todayReport.grossRevenue)} tone="accent" />
          <StatCard label="Transactions" value={String(todayReport.transactionCount)} />
          <StatCard label="Shop share" value={formatCurrency(todayReport.shopShare)} tone="success" />
          <StatCard label="Barber payout" value={formatCurrency(todayReport.barberShare)} />
          <StatCard label="Cash" value={formatCurrency(todayReport.cashRevenue)} />
          <StatCard label="GCash" value={formatCurrency(todayReport.gcashRevenue)} />
          <StatCard
            label="GCash to verify"
            value={String(pendingGcash.length)}
            tone={pendingGcash.length ? 'warning' : 'default'}
          />
          <StatCard label="In queue" value={String(activeQueue.length)} />
          <StatCard label="This month" value={formatCurrency(monthReport.grossRevenue)} tone="accent" />
        </StatGrid>

        <SectionCard title="Quick actions">
          <QuickActions
            actions={[
              { label: 'New Transaction', icon: 'plus', href: '/(admin)/transaction-entry' },
              { label: 'Queue', icon: 'account-clock', href: '/(admin)/queue' },
              { label: 'Reports', icon: 'chart-box', href: '/(admin)/reports' },
              { label: 'Services', icon: 'content-cut', href: '/(admin)/services' },
              { label: 'Expenses', icon: 'cash-minus', href: '/(admin)/expenses' },
              { label: 'Revenue Split', icon: 'call-split', href: '/(admin)/revenue-split' },
            ]}
          />
        </SectionCard>

        <SectionCard
          title="Barber performance"
          subtitle="Today · admin only"
          right={
            <Button compact onPress={() => router.push('/(admin)/barbers')}>
              All
            </Button>
          }
        >
          <BarberPerformanceTable rows={todayReport.barbers} />
        </SectionCard>

        {pendingGcash.length > 0 && (
          <SectionCard title="GCash awaiting verification" subtitle={`${pendingGcash.length} payment(s)`}>
            {pendingGcash.slice(0, 3).map((transaction) => (
              <TransactionCard key={transaction.id} transaction={transaction} />
            ))}
            <Button mode="contained-tonal" onPress={() => router.push('/(admin)/transactions')}>
              Review payments
            </Button>
          </SectionCard>
        )}

        <SectionCard title="Recent transactions">
          {todays.length === 0 ? (
            <EmptyState
              icon="🧾"
              title="No transactions today"
              message="Record the first service of the day."
              actionLabel="New transaction"
              onAction={() => router.push('/(admin)/transaction-entry')}
            />
          ) : (
            todays.slice(0, 5).map((transaction) => (
              <TransactionCard key={transaction.id} transaction={transaction} />
            ))
          )}
        </SectionCard>

        <Button
          mode="text"
          icon="bell-outline"
          onPress={() => notifyEndOfDaySummary(todayReport)}
          disabled={!settings.endOfDaySummaryEnabled}
        >
          Send end-of-day summary
        </Button>
      </Screen>

      <FAB
        icon="plus"
        label="Transaction"
        style={styles.fab}
        onPress={() => router.push('/(admin)/transaction-entry')}
      />
    </>
  );
}

const styles = StyleSheet.create({
  greeting: { fontWeight: '800', color: Colors.text },
  muted: { color: Colors.textMuted, marginBottom: 4 },
  fab: { position: 'absolute', right: 16, bottom: 20, backgroundColor: Colors.accent },
});
