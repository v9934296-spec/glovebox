import React, { useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text } from 'react-native';
import { Button, Field } from '@/components/ui';
import { useAuth } from '@/lib/auth/session';
import { palette, spacing, typography } from '@/lib/theme';

export default function ForgotPasswordScreen() {
  const { sendPasswordReset } = useAuth();
  const [email, setEmail] = useState('');
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSend() {
    setError(null);
    setBusy(true);
    try {
      await sendPasswordReset(email.trim());
      setSent(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not send reset email');
    } finally {
      setBusy(false);
    }
  }

  return (
    <KeyboardAvoidingView style={styles.screen} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        {sent ? (
          <Text style={styles.sentText}>
            If an account exists for {email.trim()}, a password reset link is on its way.
          </Text>
        ) : (
          <>
            <Text style={styles.intro}>Enter your account email and we&apos;ll send a reset link.</Text>
            <Field
              label="Email"
              placeholder="you@example.com"
              autoCapitalize="none"
              keyboardType="email-address"
              value={email}
              onChangeText={setEmail}
            />
            {error != null && <Text style={styles.error}>{error}</Text>}
            <Button title="Send reset link" onPress={onSend} loading={busy} disabled={!email.trim()} />
          </>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: palette.bg.app },
  content: { padding: spacing.screenPadding, paddingTop: spacing.xl },
  intro: {
    color: palette.text.secondary,
    fontSize: typography.body.size,
    marginBottom: spacing.lg,
    lineHeight: typography.body.lineHeight,
  },
  error: { color: palette.status.overdue, fontSize: typography.caption.size, marginBottom: spacing.md },
  sentText: {
    color: palette.text.secondary,
    fontSize: typography.body.size,
    textAlign: 'center',
    marginTop: spacing['2xl'],
    lineHeight: typography.body.lineHeight,
  },
});