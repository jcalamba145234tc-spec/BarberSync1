/**
 * Admin home screen: today's key numbers plus the quick-action shortcuts and
 * barber performance table for the current period.
 */
import React, { useCallback, useMemo, useState } from 'react';
import { StyleSheet } from 'react-native';
import { Button, FAB, Text } from 'react-native-paper';
import { useFocusEffect, useRouter } from 'expo-router';
import { BarberPerformanceTable } from '../../components/dashboard/BarberPerformanceTable';
import { TopBarbersList } from '../../components/dashboard/TopBarbersList';
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
import { calculateAttendanceSummary, getDailyAttendance } from '../../services/attendanceService';
import { notifyEndOfDaySummary } from '../../services/notificationService';
import { AttendanceSummary } from '../../types/attendance';
import { buildFinancialReport, formatCurrency } from '../../utils/calculations';
import { buildRange, formatDate, isWithinRange } from '../../utils/dateUtils';

/** Local-time YYYY-MM-DD, the same id format the attendance screen saves under. */
function todayId(): string {
  const d = new Date();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${month}-${day}`;
}

export default function AdminDashboard() {
  const router = useRouter();
  const { user } = useAuth();
  const { settings, services, barbers } = useAppData();
  const today = useMemo(() => buildRange('TODAY'), []);
  const month = useMemo(() => buildRange('MONTH'), []);
  const { transactions, loading, refresh } = useTransactions({ from: month.from, to: month.to });
  // Same hook as the queue tab, so the counter here and the list there
  // always agree (it reloads whenever this screen gains focus).
  const { activeQueue } = useQueue(services);

  // Real attendance for today (this used to be hardcoded 3 / 1 / 4).
  const [attendance, setAttendance] = useState<AttendanceSummary | null>(null);
  const [attendanceSaved, setAttendanceSaved] = useState(false);

  const loadAttendance = useCallback(async () => {
    try {
      const day = await getDailyAttendance(todayId(), barbers);
      setAttendance(calculateAttendanceSummary(day.records));
      setAttendanceSaved(!day.draft);
    } catch (error) {
      console.warn('[BarberSync] Could not load today\'s attendance for the dashboard.', error);
    }
  }, [barbers]);

  useFocusEffect(
    React.useCallback(() => {
      refresh();
      loadAttendance();
    }, [refresh, loadAttendance])
  );

  const todays = useMemo(
    () => transactions.filter((t) => isWithinRange(t.createdAt, today.from, today.to)),
    [transactions, today]
  );
  const todayReport = useMemo(() => buildFinancialReport(todays, [], today), [todays, today]);
  const monthReport = useMemo(() => buildFinancialReport(transactions, [], month), [transactions, month]);
  const topBarbers = useMemo(
    () =>
      [...monthReport.barbers]
        .sort((a, b) => b.serviceCount - a.serviceCount || b.revenue - a.revenue)
        .slice(0, 3),
    [monthReport.barbers]
  );
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
          <StatCard label="In queue" value={String(activeQueue.length)} />
          <StatCard label="This month" value={formatCurrency(monthReport.grossRevenue)} tone="accent" />
        </StatGrid>

        <SectionCard title="Quick actions">
          <QuickActions
            actions={[
              { label: 'New Transaction', icon: 'plus', href: '/(admin)/transaction-entry' },
              { label: 'Attendance', icon: 'calendar-check', href: '/(admin)/attendance' },
              { label: 'Services', icon: 'content-cut', href: '/(admin)/services' },
              { label: 'Expenses', icon: 'cash-minus', href: '/(admin)/expenses' },
              { label: 'Revenue Split', icon: 'call-split', href: '/(admin)/revenue-split' },
              { label: 'Reports', icon: 'chart-box', href: '/(admin)/reports' },
            ]}
          />
        </SectionCard>

        <SectionCard
          title="Today's attendance"
          subtitle={
            attendance === null
              ? 'Loading…'
              : attendanceSaved
              ? `${attendance.total} barber${attendance.total === 1 ? '' : 's'} on the roster`
              : 'Not saved yet today'
          }
          right={
            <Button compact onPress={() => router.push('/(admin)/attendance')}>
              Manage
            </Button>
          }
        >
          <StatGrid>
            <StatCard label="Present" value={String(attendance?.present ?? 0)} tone="success" />
            <StatCard label="Late" value={String(attendance?.late ?? 0)} tone="warning" />
            <StatCard label="Absent" value={String(attendance?.absent ?? 0)} tone="danger" />
            <StatCard label="Day off" value={String(attendance?.off ?? 0)} />
          </StatGrid>
        </SectionCard>

        <SectionCard
          title="Barber performance"
          subtitle="Today"
          right={
            <Button compact onPress={() => router.push('/(admin)/barbers')}>
              View all
            </Button>
          }
        >
          <BarberPerformanceTable rows={todayReport.barbers} />
        </SectionCard>

        <SectionCard title="Top barbers this month" subtitle="Ranked by customers served">
          <TopBarbersList rows={topBarbers} />
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
        accessibilityLabel="New transaction"
        style={styles.fab}
        onPress={() => router.push('/(admin)/transaction-entry')}
      />
    </>
  );
}

const styles = StyleSheet.create({
  greeting: { fontWeight: '800', color: Colors.text },
  muted: { color: Colors.textMuted, marginBottom: 4 },
  fab: { position: 'absolute', right: 16, bottom: 16, backgroundColor: Colors.accent },
});
