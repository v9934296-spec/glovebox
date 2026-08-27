import { Link, useRouter } from 'expo-router';
import React, { useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
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

  async function onContinueLocal() {
    await continueWithoutAccount();
    router.replace('/');
  }

  return (
    <KeyboardAvoidingView style={styles.screen} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <Text style={styles.brand}>Glovebox</Text>

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

        <Button title="Sign in" onPress={() => void onSignIn()} loading={busy} disabled={!email.trim() || !password} />

        <View style={styles.links}>
          <Link href="/(auth)/forgot-password" style={styles.link}>
            Forgot password?
          </Link>
          <Link href="/(auth)/sign-up" style={styles.link}>
            Create account
          </Link>
        </View>

        <View style={styles.divider} />

        <Pressable onPress={() => void onContinueLocal()} hitSlop={8}>
          <Text style={styles.localLink}>Continue without account</Text>
        </Pressable>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: palette.bg.app },
  content: { padding: spacing.screenPadding, paddingTop: 80, paddingBottom: spacing['2xl'] },
  brand: {
    color: palette.text.primary,
    fontSize: typography.display.size,
    fontWeight: typography.display.weight,
    lineHeight: typography.display.lineHeight,
    marginBottom: spacing['2xl'],
    textAlign: 'center',
  },
  error: { color: palette.status.overdue, fontSize: typography.caption.size, marginBottom: spacing.md },
  links: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: spacing.lg,
  },
  link: { color: palette.accent.primary, fontSize: typography.caption.size, fontWeight: '600' },
  divider: {
    height: 1,
    backgroundColor: palette.border.subtle,
    marginVertical: spacing.xl,
  },
  localLink: {
    color: palette.text.tertiary,
    fontSize: typography.caption.size,
    textAlign: 'center',
    fontWeight: '500',
  },
});
