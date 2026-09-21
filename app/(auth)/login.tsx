import React, { useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, View } from 'react-native';
import { Button, Dialog, HelperText, Portal, Snackbar, Text, TextInput } from 'react-native-paper';
import { Redirect } from 'expo-router';
import { Colors } from '../../constants/colors';
import { DEMO_ACCOUNTS } from '../../constants/config';
import { isFirebaseConfigured } from '../../services/firebase';
import { describeAuthError, requestPasswordReset } from '../../services/authService';
import { useAuth } from '../../hooks/useAuth';
import { validateLogin, validateResetRequest } from '../../utils/validation';

export default function LoginScreen() {
  const { user, login, signingIn, error, clearError, initializing } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [secure, setSecure] = useState(true);
  const [errors, setErrors] = useState<Record<string, string>>({});

  // "Forgot password" state. Firebase emails the reset link, so there is
  // nothing to build on the server side.
  const [resetVisible, setResetVisible] = useState(false);
  const [resetEmail, setResetEmail] = useState('');
  const [resetError, setResetError] = useState<string | null>(null);
  const [resetSending, setResetSending] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  if (!initializing && user) {
    return <Redirect href={user.role === 'ADMIN' ? '/(admin)/dashboard' : '/(barber)/dashboard'} />;
  }

  const handleLogin = async () => {
    clearError();
    const result = validateLogin(email, password);
    setErrors(result.errors);
    if (!result.valid) return;
    await login(email, password);
  };

  const openReset = () => {
    setResetEmail(email);
    setResetError(null);
    setResetVisible(true);
  };

  const handleReset = async () => {
    const result = validateResetRequest(resetEmail);
    if (!result.valid) {
      setResetError(result.errors.email);
      return;
    }
    setResetSending(true);
    setResetError(null);
    try {
      await requestPasswordReset(resetEmail);
      setResetVisible(false);
      // Deliberately the same message whether or not the account exists.
      setNotice('If that email has an account, a reset link is on its way.');
    } catch (resetFailure) {
      setResetError(describeAuthError(resetFailure));
    } finally {
      setResetSending(false);
    }
  };

  return (
    <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
        <View style={styles.brand}>
          <Text style={styles.logo}>💈</Text>
          <Text variant="headlineMedium" style={styles.title}>
            BarberSync
          </Text>
          <Text variant="bodyMedium" style={styles.subtitle}>
            Barbershop management, without the notebook.
          </Text>
        </View>

        <View style={styles.card}>
          <TextInput
            label="Email"
            mode="outlined"
            autoCapitalize="none"
            keyboardType="email-address"
            value={email}
            onChangeText={setEmail}
            left={<TextInput.Icon icon="email-outline" />}
          />
          <HelperText type="error" visible={!!errors.email}>{errors.email}</HelperText>

          <TextInput
            label="Password"
            mode="outlined"
            secureTextEntry={secure}
            value={password}
            onChangeText={setPassword}
            left={<TextInput.Icon icon="lock-outline" />}
            right={<TextInput.Icon icon={secure ? 'eye' : 'eye-off'} onPress={() => setSecure(!secure)} />}
          />
          <HelperText type="error" visible={!!errors.password}>{errors.password}</HelperText>

          {!!error && (
            <Text variant="bodySmall" style={styles.error}>
              {error}
            </Text>
          )}

          <Button
            mode="contained"
            onPress={handleLogin}
            loading={signingIn}
            disabled={signingIn}
            style={styles.button}
            contentStyle={styles.buttonContent}
          >
            {signingIn ? 'Signing in…' : 'Sign in'}
          </Button>

          {isFirebaseConfigured && (
            <Button mode="text" compact onPress={openReset} style={styles.forgot}>
              Forgot password?
            </Button>
          )}

          {!isFirebaseConfigured && (
            <View style={styles.notice}>
              <Text variant="labelLarge" style={styles.noticeTitle}>
                Local mode (Firebase not configured)
              </Text>
              <Text variant="bodySmall" style={styles.noticeText}>
                Admin: {DEMO_ACCOUNTS.admin.email}
              </Text>
              <Text variant="bodySmall" style={styles.noticeText}>
                Barber: {DEMO_ACCOUNTS.barbers[0].email}
              </Text>
              <Text variant="bodySmall" style={styles.noticeText}>
                Barber 2: {DEMO_ACCOUNTS.barbers[1].email}
              </Text>
              <Text variant="bodySmall" style={styles.noticeText}>
                Password: any 6+ characters. Add your Firebase keys to .env for real accounts.
              </Text>
            </View>
          )}
        </View>
      </ScrollView>

      <Portal>
        <Dialog visible={resetVisible} onDismiss={() => setResetVisible(false)}>
          <Dialog.Title>Reset password</Dialog.Title>
          <Dialog.Content>
            <Text variant="bodySmall" style={styles.dialogText}>
              We will email you a link to choose a new password.
            </Text>
            <TextInput
              label="Email"
              mode="outlined"
              autoCapitalize="none"
              keyboardType="email-address"
              value={resetEmail}
              onChangeText={setResetEmail}
              left={<TextInput.Icon icon="email-outline" />}
            />
            <HelperText type="error" visible={!!resetError}>
              {resetError}
            </HelperText>
          </Dialog.Content>
          <Dialog.Actions>
            <Button onPress={() => setResetVisible(false)}>Cancel</Button>
            <Button onPress={handleReset} loading={resetSending} disabled={resetSending}>
              Send link
            </Button>
          </Dialog.Actions>
        </Dialog>
      </Portal>

      <Snackbar visible={!!notice} onDismiss={() => setNotice(null)} duration={5000}>
        {notice ?? ''}
      </Snackbar>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: Colors.primary },
  container: { flexGrow: 1, justifyContent: 'center', padding: 24, gap: 24 },
  brand: { alignItems: 'center', gap: 4 },
  logo: { fontSize: 52 },
  title: { color: '#FFFFFF', fontWeight: '800', letterSpacing: 1 },
  subtitle: { color: '#D1D5DB', textAlign: 'center' },
  card: { backgroundColor: Colors.surface, borderRadius: 20, padding: 20 },
  button: { borderRadius: 12, marginTop: 4 },
  buttonContent: { paddingVertical: 6 },
  error: { color: Colors.danger, marginBottom: 8 },
  forgot: { alignSelf: 'center', marginTop: 8 },
  dialogText: { color: Colors.textMuted, marginBottom: 12 },
  notice: {
    marginTop: 18,
    padding: 12,
    borderRadius: 12,
    backgroundColor: '#FEF3C7',
    gap: 2,
  },
  noticeTitle: { color: '#92400E', fontWeight: '700' },
  noticeText: { color: '#92400E' },
});
