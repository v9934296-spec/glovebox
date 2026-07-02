import { Ionicons } from '@expo/vector-icons';
import { Link, useRouter } from 'expo-router';
import React, { useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Button, Field } from '@/components/ui';
import { useAuth } from '@/lib/auth/session';
import { palette, spacing, typography } from '@/lib/theme';

export default function SignInScreen() {
  const router = useRouter();
  const { signIn, continueWithoutAccount } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSignIn() {
    setError(null);
    setBusy(true);
    try {
      await signIn(email.trim(), password);
      router.replace('/');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Sign in failed');
    } finally {
      setBusy(false);
    }
  }

  async function onSkip() {
    await continueWithoutAccount();
    router.replace('/');
  }

  return (
    <KeyboardAvoidingView style={styles.screen} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <View style={styles.hero}>
          <Ionicons name="car-sport" size={44} color={palette.accent.primary} />
          <Text style={styles.title}>Glovebox</Text>
          <Text style={styles.tagline}>
            Your car's memory, maintenance plan, and repair history in one app.
          </Text>
        </View>

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
          placeholder="••••••••"
          secureTextEntry
          autoComplete="password"
          value={password}
          onChangeText={setPassword}
        />
        {error != null && <Text style={styles.error}>{error}</Text>}

        <Button title="Sign in" onPress={onSignIn} loading={busy} disabled={!email.trim() || !password} />

        <View style={styles.links}>
          <Link href="/(auth)/sign-up" style={styles.link}>
            Create account
          </Link>
          <Link href="/(auth)/forgot-password" style={styles.link}>
            Forgot password?
          </Link>
        </View>

        <Button title="Continue without account" variant="ghost" onPress={onSkip} style={{ marginTop: spacing.xl }} />
        <Text style={styles.skipHint}>
          Local-only mode keeps everything on this device. You can sign in later from Settings to back up and sync.
        </Text>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: palette.bg.app },
  content: { padding: spacing.screenPadding, paddingTop: 80, paddingBottom: spacing['2xl'] },
  hero: { alignItems: 'center', marginBottom: spacing['2xl'] },
  title: {
    color: palette.text.primary,
    fontSize: typography.h1.size,
    fontWeight: typography.h1.weight,
    marginTop: spacing.sm,
  },
  tagline: {
    color: palette.text.secondary,
    fontSize: typography.body.size,
    textAlign: 'center',
    marginTop: spacing.sm,
    lineHeight: typography.body.lineHeight,
  },
  error: { color: palette.status.overdue, fontSize: typography.caption.size, marginBottom: spacing.md },
  links: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: spacing.lg,
  },
  link: { color: palette.accent.primary, fontSize: typography.caption.size, fontWeight: '600' },
  skipHint: {
    color: palette.text.tertiary,
    fontSize: typography.caption.size,
    textAlign: 'center',
    marginTop: spacing.sm,
    lineHeight: 18,
  },
});
