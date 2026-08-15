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
  const hasAnnualAndMonthly = orderedPackages.some(isAnnual) && orderedPackages.some(isMonthly);

  return (
    <Screen style={{ padding: 0 }}>
      <ScrollView contentContainerStyle={{ padding: spacing.screenPadding, paddingBottom: spacing['2xl'] }}>
        <View style={styles.hero}>
          <View style={styles.heroIcon}>
            <Ionicons name="star" size={28} color={palette.accent.primary} />
          </View>
          <Text style={styles.heroTitle}>Glovebox Pro</Text>
          <Text style={styles.heroSubtitle}>Everything about your car. Finally in one place.</Text>
        </View>

        <Card style={{ marginTop: spacing.xl }}>
          {PRO_FEATURES.map((f, i) => (
            <View key={f.title} style={[styles.featureRow, i < PRO_FEATURES.length - 1 && styles.featureBorder]}>
              <Ionicons name="checkmark-circle" size={20} color={palette.status.ok} />
              <View style={{ flex: 1 }}>
                <Text style={styles.featureTitle}>{f.title}</Text>
                <Text style={styles.featureDetail}>{f.detail}</Text>
              </View>
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
              const annual = isAnnual(pkg);
              const monthly = isMonthly(pkg);
              const emphasize = annual && hasAnnualAndMonthly;
              return (
                <Pressable
                  key={pkg.identifier}
                  onPress={() => void buy(pkg)}
                  disabled={busy !== null}
                  style={({ pressed }) => [
                    styles.packageCard,
                    emphasize && styles.packageCardBest,
                    monthly && hasAnnualAndMonthly && styles.packageCardSecondary,
                    pressed && { opacity: 0.85 },
                    busy !== null && { opacity: 0.5 },
                  ]}
                >
                  <View style={{ flex: 1 }}>
                    <View style={styles.packageLabelRow}>
                      <Text style={[styles.packageLabel, emphasize && styles.packageLabelOnAccent]}>
                        {packageLabel(pkg)}
                      </Text>
                      {emphasize && (
                        <View style={styles.bestBadge}>
                          <Text style={styles.bestBadgeText}>Best value</Text>
                        </View>
                      )}
                    </View>
                    <Text style={[styles.packagePrice, emphasize && styles.packageLabelOnAccent]}>
                      {pkg.product.priceString}
                    </Text>
                  </View>
                  <Ionicons
                    name="chevron-forward"
                    size={18}
                    color={emphasize ? palette.text.onAccent : palette.text.tertiary}
                  />
                </Pressable>
              );
            })}
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
  heroIcon: {
    width: 64,
    height: 64,
    borderRadius: radius.pill,
    backgroundColor: palette.bg.surfaceRaised,
    borderWidth: 1,
    borderColor: palette.border.subtle,
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroTitle: {
    color: palette.text.primary,
    fontSize: typography.h1.size,
    fontWeight: typography.h1.weight,
    marginTop: spacing.md,
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
  },
  featureDetail: { color: palette.text.tertiary, fontSize: typography.caption.size, marginTop: 2 },
  packageCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: palette.bg.surfaceRaised,
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: palette.border.subtle,
    padding: spacing.lg,
  },
  packageCardBest: {
    backgroundColor: palette.accent.primary,
    borderColor: palette.accent.primary,
  },
  packageCardSecondary: {
    backgroundColor: palette.bg.surface,
  },
  packageLabelRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  packageLabel: {
    color: palette.text.primary,
    fontSize: typography.bodyEmphasis.size,
    fontWeight: typography.bodyEmphasis.weight,
  },
  packageLabelOnAccent: {
    color: palette.text.onAccent,
  },
  packagePrice: { color: palette.text.secondary, fontSize: typography.caption.size, marginTop: 2 },
  bestBadge: {
    backgroundColor: palette.bg.app,
    borderRadius: radius.pill,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
  },
  bestBadgeText: {
    color: palette.accent.primary,
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.4,
    textTransform: 'uppercase',
  },
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
