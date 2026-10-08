/**
 * Lets an admin log a transaction on behalf of any barber (unlike the barber
 * version of this screen, which locks the barber field to the logged-in
 * user - see components/transactions/TransactionEntryForm.tsx).
 */
import React, { useState } from 'react';
import { useRouter } from 'expo-router';
import { AppSnackbar } from '../../components/ui/AppSnackbar';
import { Screen } from '../../components/ui/Screen';
import { TransactionEntryForm } from '../../components/transactions/TransactionEntryForm';
import { formatCurrency } from '../../utils/calculations';

export default function AdminTransactionEntry() {
  const router = useRouter();
  const [message, setMessage] = useState<string | null>(null);

  return (
    <>
      <Screen>
        <TransactionEntryForm
          onSaved={(transaction) => {
            setMessage(
              `Saved ${transaction.serviceName} · ${formatCurrency(transaction.amount)} (shop ${formatCurrency(
                transaction.shopShare
              )} / barber ${formatCurrency(transaction.barberShare)})${
                transaction.tip ? ` + ${formatCurrency(transaction.tip)} tip` : ''
              }`
            );
            setTimeout(() => router.push('/(admin)/transactions'), 900);
          }}
        />
      </Screen>
      <AppSnackbar message={message} onDismiss={() => setMessage(null)} />
    </>
  );
}
