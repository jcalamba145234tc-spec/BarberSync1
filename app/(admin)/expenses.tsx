import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { Button, Chip, Dialog, HelperText, Portal, Text, TextInput } from 'react-native-paper';
import { AppSnackbar } from '../../components/ui/AppSnackbar';
import { EmptyState } from '../../components/ui/EmptyState';
import { LoadingState } from '../../components/ui/LoadingState';
import { Screen } from '../../components/ui/Screen';
import { SectionCard } from '../../components/ui/SectionCard';
import { Colors } from '../../constants/colors';
import { EXPENSE_CATEGORIES } from '../../constants/config';
import { useAppData } from '../../context/AppDataContext';
import { Expense, ExpenseCategory } from '../../types/expense';
import { deleteExpense, getExpenses, saveExpense } from '../../services/expenseService';
import { formatCurrency, sum } from '../../utils/calculations';
import { buildRange, formatDate, parseInputDate } from '../../utils/dateUtils';
import { parseAmount, validateExpense } from '../../utils/validation';

export default function ExpensesScreen() {
  const { settings } = useAppData();
  const month = useMemo(() => buildRange('MONTH'), []);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [loading, setLoading] = useState(true);
  const [visible, setVisible] = useState(false);
  const [editing, setEditing] = useState<Expense | null>(null);
  const [name, setName] = useState('');
  const [amount, setAmount] = useState('');
  const [category, setCategory] = useState<ExpenseCategory>('SUPPLIES');
  const [dateText, setDateText] = useState('');
  const [notes, setNotes] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setExpenses(await getExpenses());
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const monthExpenses = useMemo(
    () => expenses.filter((e) => e.date >= month.from && e.date <= month.to),
    [expenses, month]
  );
  const monthTotal = useMemo(() => sum(monthExpenses.map((e) => e.amount)), [monthExpenses]);

  const openDialog = (expense: Expense | null) => {
    setEditing(expense);
    setName(expense?.name ?? '');
    setAmount(expense ? String(expense.amount) : '');
    setCategory(expense?.category ?? 'SUPPLIES');
    setDateText(expense ? expense.date.slice(0, 10) : new Date().toISOString().slice(0, 10));
    setNotes(expense?.notes ?? '');
    setErrors({});
    setVisible(true);
  };

  const handleSave = async () => {
    const result = validateExpense(name, amount);
    const date = parseInputDate(dateText);
    if (!date) result.errors.date = 'Use the format YYYY-MM-DD.';
    setErrors(result.errors);
    if (Object.keys(result.errors).length) return;

    setSaving(true);
    try {
      await saveExpense(
        {
          name: name.trim(),
          amount: parseAmount(amount),
          category,
          date: (date as Date).toISOString(),
          notes: notes.trim(),
        },
        editing?.id
      );
      setVisible(false);
      setMessage(editing ? 'Expense updated.' : 'Expense added.');
      await load();
    } catch {
      setMessage('Could not save the expense.');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (expense: Expense) => {
    await deleteExpense(expense.id);
    setMessage('Expense deleted.');
    await load();
  };

  if (loading && !expenses.length) return <LoadingState message="Loading expenses…" />;

  return (
    <>
      <Screen refreshing={loading} onRefresh={load}>
        <SectionCard
          title="This month"
          subtitle={`Configured fixed cost: ${formatCurrency(settings.monthlyFixedExpense)}`}
          right={
            <Button mode="contained" compact icon="plus" onPress={() => openDialog(null)}>
              Add
            </Button>
          }
        >
          <Text variant="headlineSmall" style={styles.total}>{formatCurrency(monthTotal)}</Text>
          <Text variant="bodySmall" style={styles.muted}>
            {monthExpenses.length} expense record(s) recorded this month.
          </Text>
        </SectionCard>

        <SectionCard title="All expenses">
          {expenses.length === 0 ? (
            <EmptyState
              icon="🧾"
              title="No expenses recorded"
              message="Add rent, utilities and supplies to track net income."
              actionLabel="Add expense"
              onAction={() => openDialog(null)}
            />
          ) : (
            expenses.map((expense) => (
              <View key={expense.id} style={styles.row}>
                <View style={styles.info}>
                  <Text variant="titleSmall" style={styles.name}>{expense.name}</Text>
                  <Text variant="bodySmall" style={styles.muted}>
                    {expense.category} · {formatDate(expense.date)}
                    {expense.notes ? ` · ${expense.notes}` : ''}
                  </Text>
                </View>
                <View style={styles.right}>
                  <Text variant="titleSmall" style={styles.amount}>{formatCurrency(expense.amount)}</Text>
                  <View style={styles.actions}>
                    <Button compact onPress={() => openDialog(expense)}>Edit</Button>
                    <Button compact textColor={Colors.danger} onPress={() => handleDelete(expense)}>
                      Delete
                    </Button>
                  </View>
                </View>
              </View>
            ))
          )}
        </SectionCard>
      </Screen>

      <Portal>
        <Dialog visible={visible} onDismiss={() => setVisible(false)}>
          <Dialog.Title>{editing ? 'Edit expense' : 'Add expense'}</Dialog.Title>
          <Dialog.Content>
            <TextInput label="Expense name" mode="outlined" value={name} onChangeText={setName} />
            <HelperText type="error" visible={!!errors.name}>{errors.name}</HelperText>

            <TextInput
              label="Amount (₱)"
              mode="outlined"
              keyboardType="numeric"
              value={amount}
              onChangeText={setAmount}
            />
            <HelperText type="error" visible={!!errors.amount}>{errors.amount}</HelperText>

            <TextInput label="Date (YYYY-MM-DD)" mode="outlined" value={dateText} onChangeText={setDateText} />
            <HelperText type="error" visible={!!errors.date}>{errors.date}</HelperText>

            <View style={styles.chips}>
              {EXPENSE_CATEGORIES.map((item) => (
                <Chip key={item} selected={category === item} onPress={() => setCategory(item)}>
                  {item}
                </Chip>
              ))}
            </View>

            <TextInput
              label="Notes (optional)"
              mode="outlined"
              value={notes}
              onChangeText={setNotes}
              style={styles.notes}
            />
          </Dialog.Content>
          <Dialog.Actions>
            <Button onPress={() => setVisible(false)} disabled={saving}>Cancel</Button>
            <Button mode="contained" onPress={handleSave} loading={saving} disabled={saving}>
              Save
            </Button>
          </Dialog.Actions>
        </Dialog>
      </Portal>

      <AppSnackbar message={message} onDismiss={() => setMessage(null)} />
    </>
  );
}

const styles = StyleSheet.create({
  total: { fontWeight: '800', color: Colors.danger },
  muted: { color: Colors.textMuted },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 10,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
    paddingVertical: 8,
  },
  info: { flex: 1 },
  right: { alignItems: 'flex-end' },
  name: { fontWeight: '700', color: Colors.text },
  amount: { fontWeight: '800', color: Colors.text },
  actions: { flexDirection: 'row' },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 6 },
  notes: { marginTop: 10 },
});
