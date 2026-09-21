import React, { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { Button, Dialog, HelperText, Portal, Switch, Text, TextInput } from 'react-native-paper';
import { BarberService, ServiceInput } from '../../types/service';
import { parseAmount, validateService } from '../../utils/validation';

interface ServiceFormDialogProps {
  visible: boolean;
  service: BarberService | null;
  minimumPrice: number;
  saving: boolean;
  onDismiss: () => void;
  onSave: (input: ServiceInput, id?: string) => void;
}

export function ServiceFormDialog({
  visible,
  service,
  minimumPrice,
  saving,
  onDismiss,
  onSave,
}: ServiceFormDialogProps) {
  const [name, setName] = useState('');
  const [price, setPrice] = useState('');
  const [duration, setDuration] = useState('20');
  const [active, setActive] = useState(true);
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (visible) {
      setName(service?.name ?? '');
      setPrice(service ? String(service.price) : String(minimumPrice));
      setDuration(String(service?.durationMinutes ?? 20));
      setActive(service?.active ?? true);
      setErrors({});
    }
  }, [visible, service, minimumPrice]);

  const handleSave = () => {
    const result = validateService(name, price, duration, minimumPrice);
    setErrors(result.errors);
    if (!result.valid) return;
    onSave(
      {
        name: name.trim(),
        price: parseAmount(price),
        durationMinutes: Number(duration),
        active,
      },
      service?.id
    );
  };

  return (
    <Portal>
      <Dialog visible={visible} onDismiss={onDismiss}>
        <Dialog.Title>{service ? 'Edit service' : 'Add service'}</Dialog.Title>
        <Dialog.Content style={styles.content}>
          <TextInput label="Service name" mode="outlined" value={name} onChangeText={setName} />
          <HelperText type="error" visible={!!errors.name}>{errors.name}</HelperText>

          <TextInput
            label="Price (₱)"
            mode="outlined"
            keyboardType="numeric"
            value={price}
            onChangeText={setPrice}
          />
          <HelperText type={errors.price ? 'error' : 'info'} visible>
            {errors.price ?? `Minimum service price: ₱${minimumPrice}`}
          </HelperText>

          <TextInput
            label="Average duration (minutes)"
            mode="outlined"
            keyboardType="numeric"
            value={duration}
            onChangeText={setDuration}
          />
          <HelperText type="error" visible={!!errors.duration}>{errors.duration}</HelperText>

          <View style={styles.switchRow}>
            <Text variant="bodyMedium">Active (shown when recording services)</Text>
            <Switch value={active} onValueChange={setActive} />
          </View>
        </Dialog.Content>
        <Dialog.Actions>
          <Button onPress={onDismiss} disabled={saving}>Cancel</Button>
          <Button mode="contained" onPress={handleSave} loading={saving} disabled={saving}>
            {saving ? 'Saving…' : 'Save'}
          </Button>
        </Dialog.Actions>
      </Dialog>
    </Portal>
  );
}

const styles = StyleSheet.create({
  content: { gap: 0 },
  switchRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 8 },
});
