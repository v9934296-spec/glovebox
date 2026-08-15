import Constants from 'expo-constants';
import { useRouter } from 'expo-router';
import React, { useState } from 'react';
import { Alert, Linking, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Button, Card, Screen, SectionHeader } from '@/components/ui';
import { useAuth } from '@/lib/auth/session';
import { resetAllData } from '@/lib/db/database';
import { useVehicles } from '@/lib/db/hooks';
import { privacyUrl, termsUrl } from '@/lib/legal';
import { FREE_LIMITS } from '@/lib/monetization/entitlements';
import { presentCustomerCenter, useEntitlements } from '@/lib/monetization/purchases';
import { isSupabaseConfigured } from '@/lib/supabase';
import { syncNow, useSyncStatus } from '@/lib/sync/engine';
import { palette, spacing, typography } from '@/lib/theme';

export default function SettingsScreen() {
  const router = useRouter();
  const vehicles = useVehicles();
  const { status, session, signOut, deleteAccount } = useAuth();
  const { syncing, lastSyncedAt, pending, error } = useSyncStatus();
  const { status: purchasesStatus, isPro } = useEntitlements();
  const [deleting, setDeleting] = useState(false);

  function confirmReset() {
    Alert.alert(
      'Erase all data',
      'This permanently deletes every vehicle, service record, and reminder on this device. Cloud copies (if you sync) are not touched. There is no undo.',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Erase everything', style: 'destructive', onPress: () => resetAllData() },
      ],
    );
  }

  function confirmSignOut() {
    Alert.alert('Sign out', 'Your data stays on this device and stops syncing until you sign in again.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Sign out',
        style: 'destructive',
        onPress: () => {
          void signOut().catch((e: unknown) => {
            Alert.alert('Sign out failed', e instanceof Error ? e.message : 'Try again.');
          });
        },
      },
    ]);
  }

  function confirmDeleteAccount() {
    Alert.alert(
      'Delete account permanently?',
      'This permanently deletes your Glovebox account and all cloud data (vehicles, service history, reminders, photos). This cannot be undone.\n\nDeleting your Glovebox account does not automatically cancel an active App Store subscription.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete forever',
          style: 'destructive',
          onPress: () => {
            Alert.alert('Are you sure?', 'This is final. Your account and all synced data will be permanently removed.', [
              { text: 'Cancel', style: 'cancel' },
              {
                text: 'Yes, delete everything',
                style: 'destructive',
                onPress: () => {
                  if (deleting) return;
                  void (async () => {
                    setDeleting(true);
                    try {
                      await deleteAccount();
                      Alert.alert(
                        'Account deleted',
                        'Your account and cloud data have been permanently removed.',
                      );
                    } catch (e: unknown) {
                      Alert.alert(
                        'Delete failed',
                        e instanceof Error ? e.message : 'Try again later.',
                      );
                    } finally {
                      setDeleting(false);
                    }
                  })();
                },
              },
            ]);
          },
        },
      ],
    );
  }

  return (
    <Screen style={{ padding: 0 }}>
      <ScrollView contentContainerStyle={{ padding: spacing.screenPadding, paddingBottom: spacing['2xl'] }}>
        <SectionHeader title="Account & Sync" />
        {status === 'signedIn' ? (
          <>
            <Card>
              <Row label="Signed in as" value={session?.user.email ?? '—'} />
              <Row label="Sync status" value={syncing ? 'Syncing…' : pending > 0 ? `${pending} pending` : 'Up to date'} />
              <Row label="Last synced" value={lastSyncedAt ? formatTimestamp(lastSyncedAt) : 'never'} last />
            </Card>
            {error != null && <Text style={styles.syncError}>Last sync error: {error}</Text>}
            <Button
              title={syncing ? 'Syncing…' : 'Sync now'}
              variant="secondary"
              loading={syncing}
              onPress={() => void syncNow()}
              style={{ marginTop: spacing.md }}
            />
          </>
        ) : isSupabaseConfigured ? (
          <>
            <Card>
              <Text style={styles.localOnlyText}>
                You're in local-only mode. Everything stays on this device — sign in to back up your garage and
                sync across devices.
              </Text>
            </Card>
            <Button
              title="Sign in or create account"
              onPress={() => router.push('/(auth)/sign-in')}
              style={{ marginTop: spacing.md }}
            />
          </>
        ) : (
          <Card>
            <Text style={styles.localOnlyText}>
              Cloud sync is not configured in this build. All data stays on this device.
            </Text>
          </Card>
        )}

        <SectionHeader title="Glovebox Pro" />
        <Card>
          <Row label="Plan" value={isPro ? 'Pro' : 'Free'} />
          <Row
            label="Vehicles"
            value={isPro ? `${vehicles.length} (unlimited)` : `${vehicles.length} of ${FREE_LIMITS.maxVehicles}`}
            last
          />
        </Card>
        {isPro ? (
          <>
            <Button
              title="Manage subscription"
              variant="secondary"
              onPress={() => {
                void (async () => {
                  const opened = await presentCustomerCenter();
                  if (!opened) {
                    Alert.alert(
                      'Manage subscription',
                      'Open your App Store account settings to manage or cancel Glovebox Pro.',
                    );
                  }
                })();
              }}
              style={{ marginTop: spacing.md }}
            />
            <Text style={styles.hint}>
              Manage or cancel through RevenueCat Customer Center, or in your store account settings.
            </Text>
          </>
        ) : (
          <>
            <Button
              title="Upgrade to Pro"
              onPress={() => router.push('/paywall')}
              style={{ marginTop: spacing.md }}
            />
            {purchasesStatus === 'unavailable' && (
              <Text style={styles.hint}>Purchases are not available in this build.</Text>
            )}
          </>
        )}

        <SectionHeader title="Preferences" />
        <Card>
          <Row label="Units" value="Miles" />
          <Row label="Currency" value="USD" last />
        </Card>
        <Text style={styles.hint}>Metric units and other currencies are coming later.</Text>

        {(privacyUrl != null || termsUrl != null) && (
          <>
            <SectionHeader title="Legal" />
            <Card>
              {privacyUrl != null && (
                <LinkRow
                  label="Privacy Policy"
                  onPress={() => { if (privacyUrl) void Linking.openURL(privacyUrl); }}
                  last={termsUrl == null}
                />
              )}
              {termsUrl != null && (
                <LinkRow
                  label="Terms of Use"
                  onPress={() => { if (termsUrl) void Linking.openURL(termsUrl); }}
                  last
                />
              )}
            </Card>
          </>
        )}

        {status === 'signedIn' && (
          <>
            <SectionHeader title="Account" />
            <Button title="Sign out" variant="secondary" onPress={confirmSignOut} />
            <Button
              title={deleting ? 'Deleting…' : 'Delete account'}
              variant="danger"
              loading={deleting}
              disabled={deleting}
              onPress={confirmDeleteAccount}
              style={{ marginTop: spacing.md }}
            />
            <Text style={styles.hint}>
              Permanently deletes your account and cloud data. Deleting your Glovebox account does not
              automatically cancel an active App Store subscription.
            </Text>
          </>
        )}

        <SectionHeader title="Danger Zone" />
        <Card>
          <Row label="Vehicles on this device" value={String(vehicles.length)} last />
        </Card>
        <Button title="Erase local data" variant="danger" onPress={confirmReset} style={{ marginTop: spacing.md }} />
        <Text style={styles.hint}>
          Removes vehicles, service records, and reminders stored on this device. Cloud copies are not touched.
        </Text>

        <Text style={styles.version}>Glovebox {Constants.expoConfig?.version ?? ''}</Text>
      </ScrollView>
    </Screen>
  );
}

function formatTimestamp(iso: string): string {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? iso : d.toLocaleString();
}

function Row({ label, value, last }: { label: string; value: string; last?: boolean }) {
  return (
    <View style={[styles.row, !last && styles.rowBorder]}>
      <Text style={styles.rowLabel} numberOfLines={1}>
        {label}
      </Text>
      <Text style={styles.rowValue} numberOfLines={1}>
        {value}
      </Text>
    </View>
  );
}

function LinkRow({ label, onPress, last }: { label: string; onPress: () => void; last?: boolean }) {
  return (
    <Pressable onPress={onPress} style={[styles.row, !last && styles.rowBorder]}>
      <Text style={styles.rowLabel}>{label}</Text>
      <View style={styles.linkTrail}>
        <Text style={styles.legalLink}>Open</Text>
        <Ionicons name="chevron-forward" size={14} color={palette.accent.primary} />
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: spacing.md, paddingVertical: spacing.sm },
  rowBorder: { borderBottomWidth: 1, borderBottomColor: palette.border.subtle },
  rowLabel: { color: palette.text.primary, fontSize: typography.body.size, flexShrink: 0 },
  rowValue: { color: palette.text.tertiary, fontSize: typography.body.size, flexShrink: 1, textAlign: 'right' },
  hint: { color: palette.text.tertiary, fontSize: typography.caption.size, marginTop: spacing.sm },
  localOnlyText: {
    color: palette.text.secondary,
    fontSize: typography.body.size,
    lineHeight: typography.body.lineHeight,
  },
  syncError: { color: palette.status.overdue, fontSize: typography.caption.size, marginTop: spacing.sm },
  version: {
    color: palette.text.tertiary,
    fontSize: typography.caption.size,
    textAlign: 'center',
    marginTop: spacing['2xl'],
  },
  legalLink: { color: palette.accent.primary, fontSize: typography.body.size, fontWeight: '600' },
  linkTrail: { flexDirection: 'row', alignItems: 'center', gap: 4 },
});
