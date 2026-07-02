import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useState } from 'react';
import { Alert, KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Button, Card, EmptyState, Field, SectionHeader } from '@/components/ui';
import { aiAvailability, checkCost, explainRepair } from '@/lib/ai/client';
import type { CostCheck, CostVerdict, DiyDifficulty, RepairExplanation, Urgency } from '@/lib/ai/parse';
import { useVehicle } from '@/lib/db/hooks';
import { canUseAi } from '@/lib/monetization/entitlements';
import { useIsPro } from '@/lib/monetization/purchases';
import { palette, radius, spacing, typography } from '@/lib/theme';

const URGENCY_BADGE: Record<Urgency, { label: string; color: string }> = {
  routine: { label: 'Routine', color: palette.status.ok },
  soon: { label: 'Do it soon', color: palette.status.dueSoon },
  urgent: { label: 'Urgent', color: palette.status.overdue },
};

const DIY_LABEL: Record<DiyDifficulty, string> = {
  easy: 'Easy DIY',
  moderate: 'Moderate DIY',
  'pro-only': 'Leave it to a shop',
};

const VERDICT_BADGE: Record<CostVerdict, { label: string; color: string }> = {
  low: { label: 'Below typical', color: palette.status.dueSoon },
  fair: { label: 'Fair price', color: palette.status.ok },
  high: { label: 'Above typical', color: palette.status.overdue },
};

export default function AiAssistantScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ vehicleId: string; serviceLabel?: string; cost?: string }>();
  const vehicle = useVehicle(params.vehicleId);
  const isPro = useIsPro();

  const [serviceLabel, setServiceLabel] = useState(params.serviceLabel ?? '');
  const [cost, setCost] = useState(params.cost ?? '');
  const [busy, setBusy] = useState<'explain' | 'cost' | null>(null);
  const [explanation, setExplanation] = useState<RepairExplanation | null>(null);
  const [costCheck, setCostCheck] = useState<CostCheck | null>(null);

  if (!vehicle) {
    return (
      <View style={styles.screen}>
        <EmptyState title="Vehicle not found" message="It may have been deleted." />
      </View>
    );
  }

  /** Shared preflight for both actions; returns false when blocked. */
  function preflight(): boolean {
    const gate = canUseAi(isPro);
    if (!gate.allowed) {
      Alert.alert('Glovebox Pro', gate.reason, [
        { text: 'Not now', style: 'cancel' },
        { text: 'See Pro', onPress: () => router.push('/paywall') },
      ]);
      return false;
    }
    const availability = aiAvailability();
    if (!availability.available) {
      Alert.alert('AI unavailable', availability.reason);
      return false;
    }
    if (serviceLabel.trim() === '') {
      Alert.alert('What repair?', 'Describe the service or repair first, e.g. "front brake pads and rotors".');
      return false;
    }
    return true;
  }

  async function runExplain() {
    if (busy || !preflight() || !vehicle) return;
    setBusy('explain');
    try {
      setExplanation(await explainRepair(serviceLabel.trim(), vehicle));
    } catch (e: unknown) {
      Alert.alert('Something went wrong', e instanceof Error ? e.message : 'Try again later.');
    } finally {
      setBusy(null);
    }
  }

  async function runCostCheck() {
    if (busy || !preflight() || !vehicle) return;
    const amount = Number(cost.replace(/[^\d.]/g, ''));
    if (!Number.isFinite(amount) || amount <= 0) {
      Alert.alert('What price?', 'Enter the quoted price to check, e.g. 350.');
      return;
    }
    setBusy('cost');
    try {
      setCostCheck(await checkCost(serviceLabel.trim(), amount, vehicle));
    } catch (e: unknown) {
      Alert.alert('Something went wrong', e instanceof Error ? e.message : 'Try again later.');
    } finally {
      setBusy(null);
    }
  }

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView
        style={styles.screen}
        contentContainerStyle={{ padding: spacing.screenPadding, paddingBottom: spacing['2xl'] }}
        keyboardShouldPersistTaps="handled"
      >
        <Text style={styles.vehicleLine}>
          {vehicle.year} {vehicle.make} {vehicle.model} · {vehicle.mileage.toLocaleString()} mi
        </Text>

        <Field
          label="Service or repair"
          placeholder='e.g. "front brake pads and rotors"'
          value={serviceLabel}
          onChangeText={setServiceLabel}
        />
        <Field
          label="Quoted price (for the price check)"
          placeholder="350"
          keyboardType="decimal-pad"
          value={cost}
          onChangeText={setCost}
        />

        <View style={styles.actions}>
          <Button
            title="Explain it"
            variant="secondary"
            loading={busy === 'explain'}
            disabled={busy === 'cost'}
            onPress={() => void runExplain()}
            style={{ flex: 1 }}
          />
          <Button
            title="Check the price"
            loading={busy === 'cost'}
            disabled={busy === 'explain'}
            onPress={() => void runCostCheck()}
            style={{ flex: 1 }}
          />
        </View>

        {explanation != null && (
          <>
            <SectionHeader title="What it is" />
            <Card>
              <View style={styles.badgeRow}>
                <Badge {...URGENCY_BADGE[explanation.urgency]} />
                <Badge label={DIY_LABEL[explanation.diyDifficulty]} color={palette.text.secondary} />
              </View>
              <Text style={styles.resultTitle}>{explanation.summary}</Text>
              <Text style={styles.resultBody}>{explanation.whatItIs}</Text>
              {explanation.urgencyWhy != null && <Text style={styles.resultBody}>{explanation.urgencyWhy}</Text>}
              {explanation.questionsForShop.length > 0 && (
                <>
                  <Text style={styles.resultSubhead}>Ask the shop</Text>
                  {explanation.questionsForShop.map((q) => (
                    <Text key={q} style={styles.resultBullet}>
                      • {q}
                    </Text>
                  ))}
                </>
              )}
            </Card>
          </>
        )}

        {costCheck != null && (
          <>
            <SectionHeader title="Price check" />
            <Card>
              <View style={styles.badgeRow}>
                <Badge {...VERDICT_BADGE[costCheck.verdict]} />
                {costCheck.typicalLow != null && costCheck.typicalHigh != null && (
                  <Text style={styles.rangeText}>
                    Typical: ${Math.round(costCheck.typicalLow)}–${Math.round(costCheck.typicalHigh)}
                  </Text>
                )}
              </View>
              <Text style={styles.resultBody}>{costCheck.explanation}</Text>
              {costCheck.tips.map((tip) => (
                <Text key={tip} style={styles.resultBullet}>
                  • {tip}
                </Text>
              ))}
            </Card>
          </>
        )}

        {(explanation != null || costCheck != null) && (
          <View style={styles.disclaimer}>
            <Ionicons name="information-circle-outline" size={14} color={palette.text.tertiary} />
            <Text style={styles.disclaimerText}>
              AI-generated guidance — a starting point, not a diagnosis. When in doubt, get a second opinion from a
              trusted mechanic.
            </Text>
          </View>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

function Badge({ label, color }: { label: string; color: string }) {
  return (
    <View style={[styles.badge, { borderColor: color }]}>
      <Text style={[styles.badgeText, { color }]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: palette.bg.app },
  vehicleLine: { color: palette.text.secondary, fontSize: typography.caption.size, marginBottom: spacing.lg },
  actions: { flexDirection: 'row', gap: spacing.md },
  badgeRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginBottom: spacing.sm },
  badge: {
    borderWidth: 1,
    borderRadius: radius.pill,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
  },
  badgeText: { fontSize: typography.caption.size, fontWeight: '600' },
  rangeText: { color: palette.text.secondary, fontSize: typography.caption.size },
  resultTitle: {
    color: palette.text.primary,
    fontSize: typography.bodyEmphasis.size,
    fontWeight: typography.bodyEmphasis.weight,
    marginBottom: spacing.sm,
  },
  resultBody: {
    color: palette.text.secondary,
    fontSize: typography.body.size,
    lineHeight: typography.body.lineHeight,
    marginBottom: spacing.sm,
  },
  resultSubhead: {
    color: palette.text.primary,
    fontSize: typography.caption.size,
    fontWeight: '600',
    marginTop: spacing.xs,
    marginBottom: spacing.xs,
  },
  resultBullet: {
    color: palette.text.secondary,
    fontSize: typography.caption.size,
    lineHeight: 20,
  },
  disclaimer: {
    flexDirection: 'row',
    gap: spacing.xs,
    marginTop: spacing.lg,
    paddingHorizontal: spacing.xs,
  },
  disclaimerText: {
    flex: 1,
    color: palette.text.tertiary,
    fontSize: typography.caption.size,
    lineHeight: typography.caption.lineHeight,
  },
});
