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
              )} / barber ${formatCurrency(transaction.barberShare)})`
            );
            setTimeout(() => router.push('/(admin)/transactions'), 900);
          }}
        />
      </Screen>
      <AppSnackbar message={message} onDismiss={() => setMessage(null)} />
    </>
  );
}
