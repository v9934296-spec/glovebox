import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React, { useEffect, useRef, useState } from 'react';
import { Alert, Linking, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import type { PurchasesPackage } from 'react-native-purchases';
import { Button, Card, Screen } from '@/components/ui';
import { privacyUrl, termsUrl } from '@/lib/legal';
import { PRO_FEATURES } from '@/lib/monetization/entitlements';
import {
  presentCustomerCenter,
  presentRemotePaywall,
  useEntitlements,
} from '@/lib/monetization/purchases';
import { palette, radius, spacing, typography } from '@/lib/theme';

const PACKAGE_LABELS: Record<string, string> = {
  $rc_monthly: 'Monthly',
  $rc_annual: 'Yearly',
  $rc_lifetime: 'Lifetime',
};

function packageLabel(pkg: PurchasesPackage): string {
  return PACKAGE_LABELS[pkg.identifier] ?? pkg.product.title;
}

function isAnnual(pkg: PurchasesPackage): boolean {
  return pkg.identifier === '$rc_annual';
}

function isMonthly(pkg: PurchasesPackage): boolean {
  return pkg.identifier === '$rc_monthly';
}

function sortPackages(packages: PurchasesPackage[]): PurchasesPackage[] {
  return [...packages].sort((a, b) => {
    const rank = (pkg: PurchasesPackage) => (isAnnual(pkg) ? 0 : isMonthly(pkg) ? 1 : 2);
    return rank(a) - rank(b);
  });
}

export default function PaywallScreen() {
  const router = useRouter();
  const { status, isPro, packages, purchase, restore } = useEntitlements();
  const [busy, setBusy] = useState<string | null>(null);
  const [useFallback, setUseFallback] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const presented = useRef(false);

  useEffect(() => {
    if (status !== 'ready' || isPro || presented.current) return;
    presented.current = true;
    void (async () => {
      const result = await presentRemotePaywall();
      if (result === 'unlocked') {
        Alert.alert('Welcome to Pro', 'Everything is unlocked. Thanks for supporting Glovebox!');
        router.back();
        return;
      }
      if (result === 'unavailable') {
        setUseFallback(true);
      }
    })();
  }, [status, isPro, router]);

  async function showRemotePaywall() {
    setBusy('paywall');
    try {
      const result = await presentRemotePaywall();
      if (result === 'unlocked') {
        Alert.alert('Welcome to Pro', 'Everything is unlocked. Thanks for supporting Glovebox!');
        router.back();
      } else if (result === 'unavailable') {
        setUseFallback(true);
      }
    } finally {
      setBusy(null);
    }
  }

  async function buy(pkg: PurchasesPackage) {
    setBusy(pkg.identifier);
    try {
      const unlocked = await purchase(pkg);
      if (unlocked) {
        Alert.alert('Welcome to Pro', 'Everything is unlocked. Thanks for supporting Glovebox!');
        router.back();
      }
    } catch (e: unknown) {
      Alert.alert('Purchase failed', e instanceof Error ? e.message : 'Try again later.');
    } finally {
      setBusy(null);
    }
  }

  async function restorePurchases() {
    setBusy('restore');
    try {
      const unlocked = await restore();
      if (unlocked) {
        Alert.alert('Purchases restored', 'Glovebox Pro is active on this device.');
        router.back();
      } else {
        Alert.alert('Nothing to restore', 'No previous Glovebox Pro purchase was found for this store account.');
      }
    } catch (e: unknown) {
      Alert.alert('Restore failed', e instanceof Error ? e.message : 'Try again later.');
    } finally {
      setBusy(null);
    }
  }

  async function openCustomerCenter() {
    setBusy('center');
    try {
      const opened = await presentCustomerCenter();
      if (!opened) {
        Alert.alert(
          'Manage subscription',
          'Open your App Store account settings to manage or cancel Glovebox Pro.',
        );
      }
    } finally {
      setBusy(null);
    }
  }

  const showFallbackPackages = useFallback && status === 'ready' && packages.length > 0 && !isPro;
  const orderedPackages = sortPackages(packages);

  return (
    <Screen style={{ padding: 0 }}>
      <ScrollView contentContainerStyle={{ padding: spacing.screenPadding, paddingBottom: spacing['2xl'] }}>
        <View style={styles.hero}>
          <Text style={styles.heroTitle}>Glovebox Pro</Text>
          <Text style={styles.heroSubtitle}>
            Unlimited vehicles, AI help, receipts, and PDF history.
          </Text>
        </View>

        <Card style={{ marginTop: spacing.xl }}>
          {PRO_FEATURES.map((f, i) => (
            <View key={f.title} style={[styles.featureRow, i < PRO_FEATURES.length - 1 && styles.featureBorder]}>
              <Ionicons name="checkmark" size={18} color={palette.status.ok} />
              <Text style={styles.featureTitle}>{f.title}</Text>
            </View>
          ))}
        </Card>

        {isPro ? (
          <Card style={{ marginTop: spacing.xl }}>
            <View style={styles.proActiveRow}>
              <Ionicons name="checkmark-circle" size={20} color={palette.status.ok} />
              <Text style={styles.proActiveText}>Pro is active on this device. Enjoy!</Text>
            </View>
            <Button
              title="Manage subscription"
              variant="secondary"
              loading={busy === 'center'}
              onPress={() => void openCustomerCenter()}
              style={{ marginTop: spacing.md }}
            />
          </Card>
        ) : showFallbackPackages ? (
          <View style={{ marginTop: spacing.xl, gap: spacing.md }}>
            {orderedPackages.map((pkg) => {
              const selected = selectedId === pkg.identifier;
              return (
                <Pressable
                  key={pkg.identifier}
                  onPress={() => setSelectedId(pkg.identifier)}
                  disabled={busy !== null}
                  style={[styles.packageCard, selected && styles.packageCardSelected, busy !== null && { opacity: 0.5 }]}
                >
                  <Text style={styles.packageLabel}>{packageLabel(pkg)}</Text>
                  <Text style={styles.packagePrice}>{pkg.product.priceString}</Text>
                </Pressable>
              );
            })}
            <Button
              title="Continue"
              disabled={selectedId == null || busy !== null}
              loading={busy != null && busy !== 'restore'}
              onPress={() => {
                const pkg = orderedPackages.find((p) => p.identifier === selectedId);
                if (pkg) void buy(pkg);
              }}
            />
            <Button
              title="Restore purchases"
              variant="ghost"
              loading={busy === 'restore'}
              onPress={() => void restorePurchases()}
            />
            <Text style={styles.legal}>
              Subscriptions renew automatically and can be cancelled anytime in your store account settings.
            </Text>
            <LegalLinks />
          </View>
        ) : status === 'loading' ? (
          <Card style={{ marginTop: spacing.xl }}>
            <Text style={styles.unavailableText}>Loading plans…</Text>
          </Card>
        ) : status === 'unavailable' ? (
          <Card style={{ marginTop: spacing.xl }}>
            <Text style={styles.unavailableText}>
              Purchases are not available in this build. Glovebox Pro requires the app from the App Store or Play Store.
            </Text>
          </Card>
        ) : (
          <View style={{ marginTop: spacing.xl, gap: spacing.md }}>
            <Button
              title="See plans"
              loading={busy === 'paywall'}
              onPress={() => void showRemotePaywall()}
            />
            <Button
              title="Restore purchases"
              variant="ghost"
              loading={busy === 'restore'}
              onPress={() => void restorePurchases()}
            />
            <Text style={styles.legal}>
              Subscriptions renew automatically and can be cancelled anytime in your store account settings.
            </Text>
            <LegalLinks />
          </View>
        )}
        {isPro || status === 'unavailable' || status === 'loading' ? <LegalLinks /> : null}
      </ScrollView>
    </Screen>
  );
}

function LegalLinks() {
  if (privacyUrl == null && termsUrl == null) return null;
  return (
    <Text style={styles.legalLinks}>
      {termsUrl ? (
        <Text style={styles.legalLink} onPress={() => { if (termsUrl) void Linking.openURL(termsUrl); }}>
          Terms of Use
        </Text>
      ) : null}
      {termsUrl && privacyUrl ? <Text style={styles.legal}>  ·  </Text> : null}
      {privacyUrl ? (
        <Text style={styles.legalLink} onPress={() => { if (privacyUrl) void Linking.openURL(privacyUrl); }}>
          Privacy Policy
        </Text>
      ) : null}
    </Text>
  );
}

const styles = StyleSheet.create({
  hero: { alignItems: 'center', marginTop: spacing.lg },
  heroTitle: {
    color: palette.text.primary,
    fontSize: typography.display.size,
    fontWeight: typography.display.weight,
    lineHeight: typography.display.lineHeight,
  },
  heroSubtitle: {
    color: palette.text.secondary,
    fontSize: typography.body.size,
    lineHeight: typography.body.lineHeight,
    textAlign: 'center',
    marginTop: spacing.sm,
    paddingHorizontal: spacing.xl,
  },
  featureRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingVertical: spacing.sm },
  featureBorder: { borderBottomWidth: 1, borderBottomColor: palette.border.subtle },
  featureTitle: {
    color: palette.text.primary,
    fontSize: typography.bodyEmphasis.size,
    fontWeight: typography.bodyEmphasis.weight,
    flex: 1,
  },
  packageCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: palette.bg.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: palette.border.subtle,
    padding: spacing.lg,
  },
  packageCardSelected: {
    backgroundColor: palette.accent.soft,
    borderColor: palette.accent.primary,
  },
  packageLabel: {
    color: palette.text.primary,
    fontSize: typography.bodyEmphasis.size,
    fontWeight: typography.bodyEmphasis.weight,
  },
  packagePrice: { color: palette.text.secondary, fontSize: typography.body.size },
  proActiveRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  proActiveText: { color: palette.text.secondary, fontSize: typography.body.size, flex: 1 },
  unavailableText: {
    color: palette.text.secondary,
    fontSize: typography.body.size,
    lineHeight: typography.body.lineHeight,
  },
  legal: {
    color: palette.text.tertiary,
    fontSize: typography.caption.size,
    textAlign: 'center',
    lineHeight: typography.caption.lineHeight,
  },
  legalLinks: {
    textAlign: 'center',
    marginTop: spacing.md,
  },
  legalLink: {
    color: palette.accent.primary,
    fontSize: typography.caption.size,
    fontWeight: '600',
  },
});
