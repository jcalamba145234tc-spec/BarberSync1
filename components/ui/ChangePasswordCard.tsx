import React, { useState } from 'react';
import { StyleSheet } from 'react-native';
import { Button, HelperText, Text, TextInput } from 'react-native-paper';
import { SectionCard } from './SectionCard';
import { Colors } from '../../constants/colors';
import { changePassword, describeAuthError } from '../../services/authService';
import { isFirebaseConfigured } from '../../services/firebase';
import { validatePasswordChange } from '../../utils/validation';

/**
 * Lets the signed-in user (owner or barber) change their own password.
 * Firebase re-checks the current password first, so a phone left unlocked
 * cannot be used to take over the account.
 */
export function ChangePasswordCard({ onDone }: { onDone?: (message: string) => void }) {
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [secure, setSecure] = useState(true);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  if (!isFirebaseConfigured) {
    return (
      <SectionCard title="Password">
        <Text variant="bodySmall" style={styles.muted}>
          Passwords are managed by Firebase. Add your Firebase keys to .env to enable this.
        </Text>
      </SectionCard>
    );
  }

  const handleSubmit = async () => {
    setError(null);
    setSuccess(null);
    const result = validatePasswordChange(currentPassword, newPassword, confirmPassword);
    setErrors(result.errors);
    if (!result.valid) return;

    setSaving(true);
    try {
      await changePassword(currentPassword, newPassword);
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      setSuccess('Password updated.');
      onDone?.('Password updated.');
    } catch (changeError) {
      setError(describeAuthError(changeError));
    } finally {
      setSaving(false);
    }
  };

  return (
    <SectionCard title="Change password" subtitle="At least 6 characters.">
      <TextInput
        label="Current password"
        mode="outlined"
        secureTextEntry={secure}
        autoCapitalize="none"
        value={currentPassword}
        onChangeText={setCurrentPassword}
        left={<TextInput.Icon icon="lock-outline" />}
        right={<TextInput.Icon icon={secure ? 'eye' : 'eye-off'} onPress={() => setSecure(!secure)} />}
      />
      <HelperText type="error" visible={!!errors.currentPassword}>
        {errors.currentPassword}
      </HelperText>

      <TextInput
        label="New password"
        mode="outlined"
        secureTextEntry={secure}
        autoCapitalize="none"
        value={newPassword}
        onChangeText={setNewPassword}
        left={<TextInput.Icon icon="lock-reset" />}
      />
      <HelperText type="error" visible={!!errors.newPassword}>
        {errors.newPassword}
      </HelperText>

      <TextInput
        label="Confirm new password"
        mode="outlined"
        secureTextEntry={secure}
        autoCapitalize="none"
        value={confirmPassword}
        onChangeText={setConfirmPassword}
        left={<TextInput.Icon icon="lock-check-outline" />}
      />
      <HelperText type="error" visible={!!errors.confirmPassword}>
        {errors.confirmPassword}
      </HelperText>

      {!!error && (
        <Text variant="bodySmall" style={styles.error}>
          {error}
        </Text>
      )}
      {!!success && (
        <Text variant="bodySmall" style={styles.success}>
          {success}
        </Text>
      )}

      <Button
        mode="contained"
        icon="key-variant"
        onPress={handleSubmit}
        loading={saving}
        disabled={saving}
        style={styles.button}
      >
        {saving ? 'Updating…' : 'Update password'}
      </Button>
    </SectionCard>
  );
}

const styles = StyleSheet.create({
  muted: { color: Colors.textMuted },
  error: { color: Colors.danger },
  success: { color: Colors.success },
  button: { borderRadius: 12, marginTop: 4 },
});
