import { useRouter } from 'expo-router';
import React, { useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text } from 'react-native';
import { Button, Field } from '@/components/ui';
import { useAuth } from '@/lib/auth/session';
import { palette, spacing, typography } from '@/lib/theme';

export default function ResetPasswordScreen() {
  const router = useRouter();
  const updatePassword = useAuth((s) => s.updatePassword);
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save() {
    setError(null);
    if (password.length < 8) {
      setError('Password must be at least 8 characters');
      return;
    }
    if (password !== confirm) {
      setError('Passwords do not match');
      return;
    }

    setBusy(true);
    try {
      await updatePassword(password);
      router.replace('/');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not update password');
    } finally {
      setBusy(false);
    }
  }

  return (
    <KeyboardAvoidingView style={styles.screen} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <Text style={styles.intro}>Enter a new password for your Glovebox account.</Text>
        <Field
          label="New password"
          placeholder="At least 8 characters"
          secureTextEntry
          autoComplete="new-password"
          value={password}
          onChangeText={setPassword}
        />
        <Field
          label="Confirm new password"
          placeholder="••••••••"
          secureTextEntry
          value={confirm}
          onChangeText={setConfirm}
        />
        {error != null && <Text style={styles.error}>{error}</Text>}
        <Button
          title="Update password"
          onPress={() => void save()}
          loading={busy}
          disabled={!password || !confirm}
        />
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
});
