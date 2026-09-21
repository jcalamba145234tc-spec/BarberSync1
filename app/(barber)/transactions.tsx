import React, { useMemo } from 'react';
import { StyleSheet } from 'react-native';
import { Button, Text } from 'react-native-paper';
import { useFocusEffect, useRouter } from 'expo-router';
import { EmptyState } from '../../components/ui/EmptyState';
import { LoadingState } from '../../components/ui/LoadingState';
import { Screen } from '../../components/ui/Screen';
import { SectionCard } from '../../components/ui/SectionCard';
import { TransactionCard } from '../../components/transactions/TransactionCard';
import { Colors } from '../../constants/colors';
import { useAuth } from '../../hooks/useAuth';
import { useTransactions } from '../../hooks/useTransactions';
import { formatCurrency, sum } from '../../utils/calculations';
import { buildRange } from '../../utils/dateUtils';

export default function BarberTransactions() {
  const router = useRouter();
  const { user } = useAuth();
  const month = useMemo(() => buildRange('MONTH'), []);
  const { transactions, loading, refresh } = useTransactions({
    from: month.from,
    to: month.to,
    barberId: user?.id,
  });

  useFocusEffect(React.useCallback(() => { refresh(); }, [refresh]));

  const earnings = useMemo(
    () => sum(transactions.filter((t) => t.status !== 'CANCELLED').map((t) => t.barberShare)),
    [transactions]
  );

  if (loading && !transactions.length) return <LoadingState message="Loading your services…" />;

  return (
    <Screen refreshing={loading} onRefresh={refresh}>
      <SectionCard
        title="My services this month"
        subtitle={`${transactions.length} service(s) · ${formatCurrency(earnings)} earned`}
        right={
          <Button mode="contained" compact icon="plus" onPress={() => router.push('/(barber)/transaction-entry')}>
            Log
          </Button>
        }
      >
        <Text variant="bodySmall" style={styles.muted}>
          You only see the services you recorded.
        </Text>
      </SectionCard>

      {transactions.length === 0 ? (
        <EmptyState
          icon="🧾"
          title="No services yet"
          message="Services you log will show up here."
          actionLabel="Log service"
          onAction={() => router.push('/(barber)/transaction-entry')}
        />
      ) : (
        transactions.map((transaction) => (
          <TransactionCard
            key={transaction.id}
            transaction={transaction}
            showSplit={false}
            footer={
              <Text variant="bodySmall" style={styles.earnings}>
                Your share: {formatCurrency(transaction.barberShare)}
                {transaction.synced ? '' : ' · not synced'}
              </Text>
            }
          />
        ))
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  muted: { color: Colors.textMuted },
  earnings: { color: Colors.success, fontWeight: '700' },
});
