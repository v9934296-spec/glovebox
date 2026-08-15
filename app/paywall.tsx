import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React, { useState } from 'react';
import { Alert, Linking, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import type { PurchasesPackage } from 'react-native-purchases';
import { Button, Card, Screen } from '@/components/ui';
import { privacyUrl, termsUrl } from '@/lib/legal';
import { PRO_FEATURES } from '@/lib/monetization/entitlements';
import { useEntitlements } from '@/lib/monetization/purchases';
import { palette, radius, spacing, typography } from '@/lib/theme';

const PACKAGE_LABELS: Record<string, string> = {
  $rc_monthly: 'Monthly',
  $rc_annual: 'Annual',
  $rc_lifetime: 'Lifetime',
};

function packageLabel(pkg: PurchasesPackage): string {
  return PACKAGE_LABELS[pkg.identifier] ?? pkg.product.title;
}

export default function PaywallScreen() {
  const router = useRouter();
  const { status, isPro, packages, purchase, restore } = useEntitlements();
  const [busy, setBusy] = useState<string | null>(null);

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

  return (
    <Screen style={{ padding: 0 }}>
      <ScrollView contentContainerStyle={{ padding: spacing.screenPadding, paddingBottom: spacing['2xl'] }}>
        <View style={styles.hero}>
          <View style={styles.heroIcon}>
            <Ionicons name="star" size={28} color={palette.accent.primary} />
          </View>
          <Text style={styles.heroTitle}>Glovebox Pro</Text>
          <Text style={styles.heroSubtitle}>
            The full toolbox for people who take care of their cars.
          </Text>
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
          </Card>
        ) : status === 'ready' && packages.length > 0 ? (
          <View style={{ marginTop: spacing.xl, gap: spacing.md }}>
            {packages.map((pkg) => (
              <Pressable
                key={pkg.identifier}
                onPress={() => void buy(pkg)}
                disabled={busy !== null}
                style={({ pressed }) => [styles.packageCard, pressed && { opacity: 0.85 }, busy !== null && { opacity: 0.5 }]}
              >
                <View style={{ flex: 1 }}>
                  <Text style={styles.packageLabel}>{packageLabel(pkg)}</Text>
                  <Text style={styles.packagePrice}>{pkg.product.priceString}</Text>
                </View>
                <Ionicons name="chevron-forward" size={18} color={palette.text.onAccent} />
              </Pressable>
            ))}
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
        ) : (
          <Card style={{ marginTop: spacing.xl }}>
            <Text style={styles.unavailableText}>
              {status === 'loading'
                ? 'Loading plans…'
                : 'Purchases are not available in this build. Glovebox Pro requires the app from the App Store or Play Store.'}
            </Text>
          </Card>
        )}
        {!(status === 'ready' && packages.length > 0 && !isPro) && <LegalLinks />}
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
    backgroundColor: palette.accent.primary,
    borderRadius: radius.lg,
    padding: spacing.lg,
  },
  packageLabel: {
    color: palette.text.onAccent,
    fontSize: typography.bodyEmphasis.size,
    fontWeight: typography.bodyEmphasis.weight,
  },
  packagePrice: { color: palette.text.onAccent, fontSize: typography.caption.size, marginTop: 2, opacity: 0.8 },
  proActiveRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  proActiveText: { color: palette.text.secondary, fontSize: typography.body.size },
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
