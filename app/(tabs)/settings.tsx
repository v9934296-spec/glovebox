import Constants from 'expo-constants';
import { useRouter } from 'expo-router';
import React, { useState } from 'react';
import { Alert, Linking, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Mute, Rule, ShopRow, ShopScreen, SolidButton, TextButton } from '@/components/shop';
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
    <ShopScreen style={{ padding: 0 }}>
      <ScrollView contentContainerStyle={styles.page}>
        <View>
          <Mute>Account & sync</Mute>
          {status === 'signedIn' ? (
            <>
              <ShopRow label="Signed in as" value={session?.user.email ?? '—'} />
              <Rule />
              <ShopRow label="Pending changes" value={String(pending)} />
              <Rule />
              <ShopRow label="Last synced" value={lastSyncedAt ? formatTimestamp(lastSyncedAt) : 'never'} />
              {error != null && <Text style={styles.syncError}>Last sync error: {error}</Text>}
              <View style={styles.rowBtns}>
                <TextButton
                  label={syncing ? 'Syncing…' : 'Sync now'}
                  onPress={() => void syncNow()}
                />
                <TextButton label="Sign out" tone="mute" onPress={confirmSignOut} />
              </View>
            </>
          ) : isSupabaseConfigured ? (
            <>
              <Text style={styles.body}>
                You're in local-only mode. Everything stays on this device — sign in to back up your garage and
                sync across devices.
              </Text>
              <SolidButton title="Sign in or create account" onPress={() => router.push('/(auth)/sign-in')} />
            </>
          ) : (
            <Text style={styles.body}>Cloud sync is not configured in this build. All data stays on this device.</Text>
          )}
        </View>

        <View>
          <Mute>Glovebox Pro</Mute>
          <ShopRow label="Plan" value={isPro ? 'Pro' : 'Free'} />
          <Rule />
          <ShopRow
            label="Vehicles"
            value={isPro ? `${vehicles.length} (unlimited)` : `${vehicles.length} of ${FREE_LIMITS.maxVehicles}`}
          />
          {isPro ? (
            <>
              <View style={{ marginTop: spacing.md }}>
                <TextButton
                  label="Manage subscription"
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
                />
              </View>
              <Text style={styles.hint}>Manage or cancel in your App Store account settings.</Text>
            </>
          ) : (
            <>
              <View style={{ marginTop: spacing.md }}>
                <SolidButton title="Upgrade to Pro" onPress={() => router.push('/paywall')} />
              </View>
              {purchasesStatus === 'unavailable' && (
                <Text style={styles.hint}>Purchases are not available in this build.</Text>
              )}
            </>
          )}
        </View>

        <View>
          <Mute>Units</Mute>
          <ShopRow label="Distance" value="Miles" />
          <Rule />
          <ShopRow label="Currency" value="USD" />
          <Text style={styles.hint}>Metric units and other currencies are coming later.</Text>
        </View>

        {(privacyUrl != null || termsUrl != null) && (
          <View>
            <Mute>Legal</Mute>
            {privacyUrl != null && (
              <View style={styles.linkRow}>
                <TextButton
                  label="Privacy Policy"
                  onPress={() => {
                    if (privacyUrl) void Linking.openURL(privacyUrl);
                  }}
                />
              </View>
            )}
            {termsUrl != null && (
              <View style={styles.linkRow}>
                <TextButton
                  label="Terms of Use"
                  onPress={() => {
                    if (termsUrl) void Linking.openURL(termsUrl);
                  }}
                />
              </View>
            )}
          </View>
        )}

        {status === 'signedIn' && (
          <View>
            <Mute>Account</Mute>
            <TextButton
              label={deleting ? 'Deleting…' : 'Delete account'}
              tone="danger"
              onPress={confirmDeleteAccount}
            />
            <Text style={styles.hint}>
              Permanently deletes your account and cloud data. Subscriptions must be cancelled in App Store settings.
            </Text>
          </View>
        )}

        <View>
          <Mute>Data</Mute>
          <ShopRow label="Vehicles on this device" value={String(vehicles.length)} />
          <View style={{ marginTop: spacing.md }}>
            <TextButton label="Erase all data" tone="danger" onPress={confirmReset} />
          </View>
          <Text style={styles.hint}>
            Removes vehicles, service records, and reminders on this device. Cloud copies are not touched.
          </Text>
        </View>

        <Text style={styles.version}>Glovebox {Constants.expoConfig?.version ?? ''}</Text>
      </ScrollView>
    </ShopScreen>
  );
}

function formatTimestamp(iso: string): string {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? iso : d.toLocaleString();
}

const styles = StyleSheet.create({
  page: {
    padding: spacing.screenPadding,
    paddingBottom: spacing['2xl'],
    gap: spacing.section,
  },
  body: {
    color: palette.text.secondary,
    fontSize: typography.body.size,
    lineHeight: typography.body.lineHeight,
    marginTop: spacing.sm,
    marginBottom: spacing.md,
  },
  hint: { color: palette.text.tertiary, fontSize: typography.caption.size, marginTop: spacing.sm },
  rowBtns: { flexDirection: 'row', justifyContent: 'space-between', marginTop: spacing.md },
  syncError: { color: palette.status.overdue, fontSize: typography.caption.size, marginTop: spacing.sm },
  version: {
    color: palette.text.tertiary,
    fontSize: typography.caption.size,
    textAlign: 'center',
  },
  linkRow: { paddingVertical: spacing.sm },
});
