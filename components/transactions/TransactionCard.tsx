import React from 'react';
import { StyleSheet, View } from 'react-native';
import { Text } from 'react-native-paper';
import { Colors } from '../../constants/colors';
import { isFirebaseConfigured } from '../../services/firebase';
import { Transaction } from '../../types/transaction';
import { formatCurrency } from '../../utils/calculations';
import { formatDateTime } from '../../utils/dateUtils';
import { StatusBadge } from '../ui/StatusBadge';
​
interface TransactionCardProps {
  transaction: Transaction;
  /** Barbers only see their own share, admins see the full split. */
  showSplit?: boolean;
  footer?: React.ReactNode;
}
​
export function TransactionCard({ transaction, showSplit = true, footer }: TransactionCardProps) {
  return (
    <View style={styles.card}>
      <View style={styles.row}>
        <View style={styles.left}>
          <Text variant="titleSmall" style={styles.title}>
            {transaction.serviceName}
          </Text>
          <Text variant="bodySmall" style={styles.muted}>
            {transaction.customerName} - {transaction.barberName}
          </Text>
          <Text variant="bodySmall" style={styles.muted}>
            {formatDateTime(transaction.createdAt)}
          </Text>
        </View>
        <View style={styles.right}>
          <Text variant="titleMedium" style={styles.amount}>
            {formatCurrency(transaction.amount)}
          </Text>
          <View style={styles.badges}>
            <StatusBadge status={transaction.paymentMethod} />
            <StatusBadge status={transaction.status} />
          </View>
        </View>
      </View>
​
      {showSplit && (
        <View style={styles.splitRow}>
          <Text variant="bodySmall" style={styles.split}>
            Shop: {formatCurrency(transaction.shopShare)}
          </Text>
          <Text variant="bodySmall" style={styles.split}>
            Barber: {formatCurrency(transaction.barberShare)}
          </Text>
          {isFirebaseConfigured && !transaction.synced && (
            <Text variant="bodySmall" style={styles.unsynced}>
              Not synced
            </Text>
          )}
        </View>
      )}
​
      {!!transaction.gcashReference && (
        <Text variant="bodySmall" style={styles.muted}>
          GCash ref: {transaction.gcashReference}
        </Text>
      )}
​
      {footer}
    </View>
  );
}
​
const styles = StyleSheet.create({
  card: {
    backgroundColor: Colors.surface,
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: Colors.border,
    gap: 8,
  },
  row: { flexDirection: 'row', justifyContent: 'space-between', gap: 12 },
  left: { flex: 1, gap: 2 },
  right: { alignItems: 'flex-end', gap: 6 },
  title: { fontWeight: '700', color: Colors.text },
  muted: { color: Colors.textMuted },
  amount: { fontWeight: '800', color: Colors.text },
  badges: { gap: 4, alignItems: 'flex-end' },
  splitRow: { flexDirection: 'row', gap: 14, flexWrap: 'wrap' },
  split: { color: Colors.textMuted, fontWeight: '600' },
  unsynced: { color: Colors.warning, fontWeight: '700' },
});
​