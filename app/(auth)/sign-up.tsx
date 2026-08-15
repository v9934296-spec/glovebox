import { useRouter } from 'expo-router';
import React, { useState } from 'react';
import { KeyboardAvoidingView, Linking, Platform, ScrollView, StyleSheet, Text } from 'react-native';
import { Button, Field } from '@/components/ui';
import { useAuth } from '@/lib/auth/session';
import { privacyUrl, termsUrl } from '@/lib/legal';
import { palette, spacing, typography } from '@/lib/theme';

export default function SignUpScreen() {
  const router = useRouter();
  const { signUp } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmationSent, setConfirmationSent] = useState(false);

  async function onSignUp() {
    setError(null);
    if (password !== confirm) {
      setError('Passwords do not match');
      return;
    }
    if (password.length < 8) {
      setError('Password must be at least 8 characters');
      return;
    }
    setBusy(true);
    try {
      const { needsEmailConfirmation } = await signUp(email.trim(), password);
      if (needsEmailConfirmation) {
        setConfirmationSent(true);
      } else {
        router.replace('/');
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Sign up failed');
    } finally {
      setBusy(false);
    }
  }

  if (confirmationSent) {
    return (
      <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
        <Text style={styles.confirmTitle}>Check your email</Text>
        <Text style={styles.confirmBody}>
          We sent a confirmation link to {email.trim()}. Confirm your address, then come back and sign in.
        </Text>
        <Button title="Back to sign in" onPress={() => router.back()} style={{ marginTop: spacing.xl }} />
      </ScrollView>
    );
  }

  return (
    <KeyboardAvoidingView style={styles.screen} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <Field
          label="Email"
          placeholder="you@example.com"
          autoCapitalize="none"
          autoComplete="email"
          keyboardType="email-address"
          value={email}
          onChangeText={setEmail}
        />
        <Field
          label="Password"
          placeholder="At least 8 characters"
          secureTextEntry
          autoComplete="new-password"
          value={password}
          onChangeText={setPassword}
        />
        <Field
          label="Confirm password"
          placeholder="••••••••"
          secureTextEntry
          value={confirm}
          onChangeText={setConfirm}
        />
        {error != null && <Text style={styles.error}>{error}</Text>}
        <Button
          title="Create account"
          onPress={onSignUp}
          loading={busy}
          disabled={!email.trim() || !password || !confirm}
        />
        <Text style={styles.hint}>
          By creating an account, you agree to the{' '}
          {termsUrl ? (
            <Text style={styles.legalLink} onPress={() => { if (termsUrl) void Linking.openURL(termsUrl); }}>
              Terms of Use
            </Text>
          ) : (
            'Terms of Use'
          )}{' '}
          and acknowledge the{' '}
          {privacyUrl ? (
            <Text style={styles.legalLink} onPress={() => { if (privacyUrl) void Linking.openURL(privacyUrl); }}>
              Privacy Policy
            </Text>
          ) : (
            'Privacy Policy'
          )}
          .
        </Text>
        <Text style={styles.hint}>
          Your vehicles and records on this device will be backed up to your account on first sync.
        </Text>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: palette.bg.app },
  content: { padding: spacing.screenPadding, paddingTop: spacing.xl, paddingBottom: spacing['2xl'] },
  error: { color: palette.status.overdue, fontSize: typography.caption.size, marginBottom: spacing.md },
  hint: {
    color: palette.text.tertiary,
    fontSize: typography.caption.size,
    textAlign: 'center',
    marginTop: spacing.lg,
    lineHeight: 18,
  },
  legalLink: {
    color: palette.accent.primary,
    fontSize: typography.caption.size,
    fontWeight: '600',
  },
  confirmTitle: {
    color: palette.text.primary,
    fontSize: typography.h2.size,
    fontWeight: typography.h2.weight,
    textAlign: 'center',
    marginTop: spacing['2xl'],
  },
  confirmBody: {
    color: palette.text.secondary,
    fontSize: typography.body.size,
    textAlign: 'center',
    marginTop: spacing.md,
    lineHeight: typography.body.lineHeight,
  },
});
