import React, { useState } from 'react';
import { useRouter } from 'expo-router';
import { AppSnackbar } from '../../components/ui/AppSnackbar';
import { Screen } from '../../components/ui/Screen';
import { TransactionEntryForm } from '../../components/transactions/TransactionEntryForm';
import { formatCurrency } from '../../utils/calculations';

export default function BarberTransactionEntry() {
  const router = useRouter();
  const [message, setMessage] = useState<string | null>(null);

  return (
    <>
      <Screen>
        {/* The barber picker is locked: staff can only log their own work. */}
        <TransactionEntryForm
          lockBarberToCurrentUser
          onSaved={(transaction) => {
            setMessage(`Saved. Your share: ${formatCurrency(transaction.barberShare)}`);
            setTimeout(() => router.push('/(barber)/transactions'), 900);
          }}
        />
      </Screen>
      <AppSnackbar message={message} onDismiss={() => setMessage(null)} />
    </>
  );
}
