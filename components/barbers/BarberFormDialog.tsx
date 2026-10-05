/**
 * Add/edit form for a barber profile, used by the admin Barbers screen.
 * Creating a barber here also creates a real Firebase Auth login account
 * (see services/barberService.ts), not just a Firestore profile document.
 */
import React, { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import {
  Button,
  Chip,
  Dialog,
  HelperText,
  IconButton,
  Portal,
  Switch,
  Text,
  TextInput,
} from 'react-native-paper';
import { Colors } from '../../constants/colors';
import { AppUser, BarberInput } from '../../types/auth';
import { validateBarber } from '../../utils/validation';

const COMMON_SPECIALTIES = [
  'Classic Cut',
  'Skin Fade',
  'Beard Trim',
  'Hot Towel Shave',
  'Hair Color',
  'Kids Haircut',
  'Styling & Blowdry',
];

interface BarberFormDialogProps {
  visible: boolean;
  barber: AppUser | null;
  saving: boolean;
  shopPercentage: number;
  onDismiss: () => void;
  onSave: (input: BarberInput, id?: string) => void;
}

export function BarberFormDialog({
  visible,
  barber,
  saving,
  shopPercentage,
  onDismiss,
  onSave,
}: BarberFormDialogProps) {
  const isEditing = Boolean(barber);

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [commissionRate, setCommissionRate] = useState('');
  const [notes, setNotes] = useState('');
  const [active, setActive] = useState(true);
  const [specialties, setSpecialties] = useState<string[]>([]);
  const [customSpecialty, setCustomSpecialty] = useState('');
  const [showCustomInput, setShowCustomInput] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (visible) {
      if (barber) {
        setName(barber.name ?? '');
        setEmail(barber.email ?? '');
        setPhone(barber.phone ?? '');
        setPassword('');
        setCommissionRate(
          barber.commissionRate !== undefined
            ? String(Math.round(barber.commissionRate * 100))
            : ''
        );
        setNotes(barber.notes ?? '');
        setActive(barber.active ?? true);
        setSpecialties(barber.specialties ?? []);
      } else {
        setName('');
        setEmail('');
        setPhone('');
        setPassword('barber123'); // friendly default password
        setCommissionRate(String(Math.round((1 - shopPercentage) * 100)));
        setNotes('');
        setActive(true);
        setSpecialties(['Classic Cut', 'Fade', 'Beard Trim']);
      }
      setShowPassword(false);
      setCustomSpecialty('');
      setShowCustomInput(false);
      setErrors({});
    }
  }, [visible, barber, shopPercentage]);

  const toggleSpecialty = (item: string) => {
    setSpecialties((prev) =>
      prev.includes(item) ? prev.filter((s) => s !== item) : [...prev, item]
    );
  };

  const handleAddCustomSpecialty = () => {
    const trimmed = customSpecialty.trim();
    if (trimmed && !specialties.includes(trimmed)) {
      setSpecialties((prev) => [...prev, trimmed]);
      setCustomSpecialty('');
      setShowCustomInput(false);
    }
  };

  const handleSave = () => {
    const result = validateBarber(name, email, {
      password,
      isEditing,
      phone,
      commissionRate,
    });
    setErrors(result.errors);
    if (!result.valid) return;

    const rateNum = commissionRate.trim() ? Number(commissionRate) / 100 : undefined;

    const input: BarberInput = {
      name: name.trim(),
      email: email.trim().toLowerCase(),
      phone: phone.trim(),
      password: password ? password : undefined,
      active,
      specialties,
      commissionRate: rateNum,
      notes: notes.trim(),
    };

    onSave(input, barber?.id);
  };

  return (
    <Portal>
      <Dialog visible={visible} onDismiss={onDismiss} style={styles.dialog}>
        <Dialog.Title style={styles.title}>
          {isEditing ? 'Edit Barber Details' : 'Add New Barber'}
        </Dialog.Title>

        <Dialog.ScrollArea style={styles.scrollArea}>
          <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
            <TextInput
              label="Full Name *"
              mode="outlined"
              placeholder="e.g. Juan Dela Cruz"
              value={name}
              onChangeText={setName}
              error={!!errors.name}
              style={styles.input}
            />
            <HelperText type="error" visible={!!errors.name}>
              {errors.name}
            </HelperText>

            <TextInput
              label="Email Address *"
              mode="outlined"
              placeholder="e.g. barber@shop.com"
              keyboardType="email-address"
              autoCapitalize="none"
              value={email}
              onChangeText={setEmail}
              error={!!errors.email}
              disabled={isEditing}
              style={styles.input}
            />
            <HelperText type={errors.email ? 'error' : 'info'} visible>
              {errors.email ?? (isEditing ? 'Email cannot be changed once created.' : 'Used for login.')}
            </HelperText>

            {!isEditing && (
              <>
                <TextInput
                  label="Temporary Password *"
                  mode="outlined"
                  secureTextEntry={!showPassword}
                  value={password}
                  onChangeText={setPassword}
                  error={!!errors.password}
                  right={
                    <TextInput.Icon
                      icon={showPassword ? 'eye-off' : 'eye'}
                      onPress={() => setShowPassword(!showPassword)}
                    />
                  }
                  style={styles.input}
                />
                <HelperText type={errors.password ? 'error' : 'info'} visible>
                  {errors.password ?? 'Min 6 characters. The barber can change this later.'}
                </HelperText>
              </>
            )}

            <TextInput
              label="Phone Number"
              mode="outlined"
              placeholder="e.g. 09181234567"
              keyboardType="phone-pad"
              value={phone}
              onChangeText={setPhone}
              error={!!errors.phone}
              style={styles.input}
            />
            <HelperText type="error" visible={!!errors.phone}>
              {errors.phone}
            </HelperText>

            <TextInput
              label="Barber Commission Split (%)"
              mode="outlined"
              placeholder={`Shop default: ${Math.round((1 - shopPercentage) * 100)}%`}
              keyboardType="numeric"
              value={commissionRate}
              onChangeText={setCommissionRate}
              error={!!errors.commissionRate}
              style={styles.input}
            />
            <HelperText type={errors.commissionRate ? 'error' : 'info'} visible>
              {errors.commissionRate ??
                `Default is ${Math.round((1 - shopPercentage) * 100)}% for barber (${Math.round(shopPercentage * 100)}% to shop).`}
            </HelperText>

            <Text variant="titleSmall" style={styles.sectionHeader}>
              Specialties & Skills
            </Text>
            <View style={styles.chipsContainer}>
              {COMMON_SPECIALTIES.map((item) => {
                const selected = specialties.includes(item);
                return (
                  <Chip
                    key={item}
                    selected={selected}
                    showSelectedCheck
                    mode={selected ? 'flat' : 'outlined'}
                    selectedColor={Colors.primary}
                    style={selected ? styles.selectedChip : styles.unselectedChip}
                    onPress={() => toggleSpecialty(item)}
                  >
                    {item}
                  </Chip>
                );
              })}

              {specialties
                .filter((item) => !COMMON_SPECIALTIES.includes(item))
                .map((custom) => (
                  <Chip
                    key={custom}
                    selected
                    showSelectedCheck
                    onClose={() => toggleSpecialty(custom)}
                    style={styles.selectedChip}
                  >
                    {custom}
                  </Chip>
                ))}

              {!showCustomInput ? (
                <Chip
                  icon="plus"
                  mode="outlined"
                  onPress={() => setShowCustomInput(true)}
                  style={styles.addChip}
                >
                  Add Custom
                </Chip>
              ) : (
                <View style={styles.customInputRow}>
                  <TextInput
                    mode="outlined"
                    dense
                    placeholder="Custom skill"
                    value={customSpecialty}
                    onChangeText={setCustomSpecialty}
                    style={styles.customInput}
                  />
                  <IconButton
                    icon="check"
                    size={20}
                    mode="contained"
                    onPress={handleAddCustomSpecialty}
                  />
                  <IconButton
                    icon="close"
                    size={20}
                    onPress={() => {
                      setCustomSpecialty('');
                      setShowCustomInput(false);
                    }}
                  />
                </View>
              )}
            </View>

            <TextInput
              label="Notes / Schedule / Bio"
              mode="outlined"
              placeholder="e.g. Days on duty, years of experience, chair #"
              multiline
              numberOfLines={3}
              value={notes}
              onChangeText={setNotes}
              style={[styles.input, styles.notesInput]}
            />

            <View style={styles.switchRow}>
              <View style={styles.switchInfo}>
                <Text variant="bodyLarge" style={styles.switchLabel}>
                  Active Status
                </Text>
                <Text variant="bodySmall" style={styles.switchMuted}>
                  Active barbers can accept queues and log transactions.
                </Text>
              </View>
              <Switch value={active} onValueChange={setActive} />
            </View>
          </ScrollView>
        </Dialog.ScrollArea>

        <Dialog.Actions style={styles.actions}>
          <Button onPress={onDismiss} disabled={saving}>
            Cancel
          </Button>
          <Button
            mode="contained"
            onPress={handleSave}
            loading={saving}
            disabled={saving}
            style={styles.saveBtn}
          >
            {saving ? 'Saving…' : isEditing ? 'Save Changes' : 'Create Barber'}
          </Button>
        </Dialog.Actions>
      </Dialog>
    </Portal>
  );
}

const styles = StyleSheet.create({
  dialog: {
    maxHeight: '90%',
    borderRadius: 16,
  },
  title: {
    fontWeight: '700',
    color: Colors.text,
  },
  scrollArea: {
    paddingHorizontal: 0,
  },
  scrollContent: {
    paddingHorizontal: 24,
    paddingBottom: 16,
  },
  input: {
    marginBottom: 2,
    backgroundColor: '#FFFFFF',
  },
  notesInput: {
    marginTop: 8,
    minHeight: 70,
  },
  sectionHeader: {
    marginTop: 12,
    marginBottom: 8,
    fontWeight: '600',
    color: Colors.text,
  },
  chipsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginBottom: 8,
  },
  selectedChip: {
    backgroundColor: '#E8DEF8',
  },
  unselectedChip: {
    backgroundColor: '#F7F7F7',
  },
  addChip: {
    borderStyle: 'dashed',
  },
  customInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    width: '100%',
    marginTop: 4,
  },
  customInput: {
    flex: 1,
    height: 38,
    backgroundColor: '#FFFFFF',
  },
  switchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 16,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
  },
  switchInfo: {
    flex: 1,
    paddingRight: 16,
  },
  switchLabel: {
    fontWeight: '600',
    color: Colors.text,
  },
  switchMuted: {
    color: Colors.textMuted,
  },
  actions: {
    paddingHorizontal: 16,
    paddingBottom: 12,
  },
  saveBtn: {
    borderRadius: 10,
    backgroundColor: Colors.primary,
  },
});

