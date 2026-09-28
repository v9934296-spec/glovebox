import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Alert, Linking, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import type { PurchasesPackage } from 'react-native-purchases';
import { GhostLink, WorkButton, paper } from '@/components/form';
import { ShopScreen, SolidButton, TextButton } from '@/components/shop';
import { privacyUrl, termsUrl } from '@/lib/legal';
import { PRO_FEATURES } from '@/lib/monetization/entitlements';
import {
  presentCustomerCenter,
  presentRemotePaywall,
  useEntitlements,
} from '@/lib/monetization/purchases';
import { palette, spacing, typography } from '@/lib/theme';

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
  const { skin } = useLocalSearchParams<{ skin?: string }>();
  const isPaper = skin === 'paper';
  const { status, isPro, packages, purchase, restore } = useEntitlements();
  const [busy, setBusy] = useState<string | null>(null);
  const [useFallback, setUseFallback] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const presented = useRef(false);
  const styles = useMemo(() => (isPaper ? paperStyles : darkStyles), [isPaper]);

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
  const Shell = isPaper ? View : ShopScreen;

  return (
    <Shell style={isPaper ? paperStyles.page : { padding: 0, flex: 1 }}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <Text style={styles.heroTitle}>{isPaper ? 'GLOVEBOX PRO' : 'Glovebox Pro'}</Text>
        <Text style={styles.heroSubtitle}>
          Unlimited vehicles, AI help, receipts, and PDF history.
        </Text>

        <View style={{ marginTop: spacing.xl }}>
          {PRO_FEATURES.map((f, i) => (
            <View key={f.title}>
              {i > 0 && !isPaper ? <View style={darkStyles.hair} /> : null}
              <Text style={styles.feature}>{isPaper ? f.title.toUpperCase() : f.title}</Text>
              {isPaper ? <Text style={paperStyles.featureDetail}>{f.detail.toUpperCase()}</Text> : null}
            </View>
          ))}
        </View>

        {isPro ? (
          <View style={{ marginTop: spacing.xl, gap: spacing.md }}>
            <Text style={styles.body}>Pro is active on this device. Enjoy!</Text>
            {isPaper ? (
              <WorkButton
                title={busy === 'center' ? 'Opening…' : 'Manage subscription'}
                onPress={() => void openCustomerCenter()}
                disabled={busy === 'center'}
              />
            ) : (
              <TextButton label="Manage subscription" onPress={() => void openCustomerCenter()} />
            )}
          </View>
        ) : showFallbackPackages ? (
          <View style={{ marginTop: spacing.xl, gap: spacing.md }}>
            {orderedPackages.map((pkg) => {
              const selected = selectedId === pkg.identifier;
              return (
                <Pressable
                  key={pkg.identifier}
                  onPress={() => setSelectedId(pkg.identifier)}
                  disabled={busy !== null}
                  style={[styles.package, selected && styles.packageOn, busy !== null && { opacity: 0.5 }]}
                >
                  <Text style={styles.packageLabel}>{packageLabel(pkg)}</Text>
                  <Text style={styles.packagePrice}>{pkg.product.priceString}</Text>
                </Pressable>
              );
            })}
            {isPaper ? (
              <WorkButton
                title="Continue"
                onPress={() => {
                  const pkg = orderedPackages.find((p) => p.identifier === selectedId);
                  if (pkg) void buy(pkg);
                }}
                disabled={selectedId == null || busy !== null}
              />
            ) : (
              <SolidButton
                title="Continue"
                disabled={selectedId == null || busy !== null}
                onPress={() => {
                  const pkg = orderedPackages.find((p) => p.identifier === selectedId);
                  if (pkg) void buy(pkg);
                }}
              />
            )}
            {isPaper ? (
              <GhostLink title="Restore purchases" onPress={() => void restorePurchases()} />
            ) : (
              <TextButton label="Restore purchases" tone="mute" onPress={() => void restorePurchases()} />
            )}
            <Text style={styles.legal}>
              Subscriptions renew automatically and can be cancelled anytime in your store account settings.
            </Text>
            <LegalLinks paperSkin={isPaper} />
          </View>
        ) : status === 'loading' ? (
          <Text style={[styles.body, { marginTop: spacing.xl }]}>Loading plans…</Text>
        ) : status === 'unavailable' ? (
          <Text style={[styles.body, { marginTop: spacing.xl }]}>
            Purchases are not available in this build. Glovebox Pro requires the app from the App Store or Play Store.
          </Text>
        ) : (
          <View style={{ marginTop: spacing.xl, gap: spacing.md }}>
            {isPaper ? (
              <WorkButton
                title={busy === 'paywall' ? 'Opening…' : 'See plans'}
                onPress={() => void showRemotePaywall()}
                disabled={busy === 'paywall'}
              />
            ) : (
              <SolidButton
                title={busy === 'paywall' ? 'Opening…' : 'See plans'}
                onPress={() => void showRemotePaywall()}
                disabled={busy === 'paywall'}
              />
            )}
            {isPaper ? (
              <GhostLink title="Restore purchases" onPress={() => void restorePurchases()} />
            ) : (
              <TextButton label="Restore purchases" tone="mute" onPress={() => void restorePurchases()} />
            )}
            <Text style={styles.legal}>
              Subscriptions renew automatically and can be cancelled anytime in your store account settings.
            </Text>
            <LegalLinks paperSkin={isPaper} />
          </View>
        )}
        {isPro || status === 'unavailable' || status === 'loading' ? <LegalLinks paperSkin={isPaper} /> : null}
      </ScrollView>
    </Shell>
  );
}

function LegalLinks({ paperSkin }: { paperSkin: boolean }) {
  if (privacyUrl == null && termsUrl == null) return null;
  const terms = termsUrl;
  const privacy = privacyUrl;
  if (paperSkin) {
    return (
      <View style={{ marginTop: 12, gap: 8, alignItems: 'center' }}>
        {terms != null ? <GhostLink title="Terms of Use" onPress={() => openUrl(terms)} /> : null}
        {privacy != null ? <GhostLink title="Privacy Policy" onPress={() => openUrl(privacy)} /> : null}
      </View>
    );
  }
  return (
    <View style={{ marginTop: 12, gap: 8, alignItems: 'center' }}>
      {terms != null ? <TextButton label="Terms of Use" onPress={() => openUrl(terms)} /> : null}
      {privacy != null ? <TextButton label="Privacy Policy" onPress={() => openUrl(privacy)} /> : null}
    </View>
  );
}

function openUrl(url: string | null) {
  if (url == null) return;
  void Linking.openURL(url);
}

const darkStyles = StyleSheet.create({
  scroll: { padding: spacing.screenPadding, paddingBottom: spacing['2xl'] },
  heroTitle: {
    color: palette.text.primary,
    fontSize: typography.display.size,
    fontWeight: '600',
    textAlign: 'center',
    marginTop: spacing.lg,
  },
  heroSubtitle: {
    color: palette.text.secondary,
    fontSize: typography.body.size,
    textAlign: 'center',
    marginTop: spacing.sm,
  },
  feature: {
    color: palette.text.primary,
    fontSize: typography.bodyEmphasis.size,
    fontWeight: '600',
    paddingVertical: spacing.sm,
  },
  body: { color: palette.text.secondary, fontSize: typography.body.size },
  package: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: palette.border.subtle,
  },
  packageOn: { borderBottomColor: palette.accent.primary },
  packageLabel: { color: palette.text.primary, fontSize: typography.bodyEmphasis.size, fontWeight: '600' },
  packagePrice: { color: palette.text.secondary },
  legal: {
    color: palette.text.tertiary,
    fontSize: typography.caption.size,
    textAlign: 'center',
  },
  hair: { height: StyleSheet.hairlineWidth, backgroundColor: palette.border.subtle },
});

const paperStyles = StyleSheet.create({
  page: { flex: 1, backgroundColor: paper.sheet },
  scroll: { padding: 20, paddingBottom: 40 },
  heroTitle: {
    color: paper.ink,
    fontSize: 22,
    fontWeight: '800',
    letterSpacing: 1.4,
    textAlign: 'center',
    marginTop: 12,
  },
  heroSubtitle: {
    color: paper.mute,
    fontSize: 13,
    fontWeight: '700',
    textAlign: 'center',
    marginTop: 8,
  },
  feature: {
    color: paper.ink,
    fontSize: 13,
    fontWeight: '800',
    letterSpacing: 0.8,
    marginTop: 14,
  },
  featureDetail: { color: paper.mute, fontSize: 11, fontWeight: '700', marginTop: 2 },
  body: { color: paper.mute, fontSize: 13, fontWeight: '700' },
  package: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    borderBottomWidth: 1,
    borderColor: paper.rule,
    paddingVertical: 12,
  },
  packageOn: { backgroundColor: paper.fill },
  packageLabel: { color: paper.ink, fontSize: 13, fontWeight: '800' },
  packagePrice: { color: paper.ink, fontSize: 13, fontWeight: '800' },
  legal: { color: paper.mute, fontSize: 11, textAlign: 'center' },
});
