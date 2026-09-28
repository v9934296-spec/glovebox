import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useState } from 'react';
import { Alert, KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, View } from 'react-native';
import { BayField, BayHair, BayLink, BayPaint, BayRoom } from '@/components/bay';
import type { CostCheck, CostVerdict, DiyDifficulty, RepairExplanation, Urgency } from '@/lib/ai/parse';
import { aiAvailability, checkCost, explainRepair } from '@/lib/ai/client';
import { bay } from '@/lib/bay';
import { useVehicle } from '@/lib/db/hooks';
import { canUseAi } from '@/lib/monetization/entitlements';
import { useIsPro } from '@/lib/monetization/purchases';

const URGENCY_LABEL: Record<Urgency, string> = {
  routine: 'Routine',
  soon: 'Do it soon',
  urgent: 'Urgent',
};

const DIY_LABEL: Record<DiyDifficulty, string> = {
  easy: 'Easy DIY',
  moderate: 'Moderate DIY',
  'pro-only': 'Leave it to a shop',
};

const VERDICT_LABEL: Record<CostVerdict, string> = {
  low: 'Below typical',
  fair: 'Fair price',
  high: 'Above typical',
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
      <BayRoom>
        <View style={styles.pad}>
          <BayPaint>BAY —</BayPaint>
          <Text style={styles.mute}>Vehicle not found. It may have been deleted.</Text>
        </View>
      </BayRoom>
    );
  }

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
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: bay.room }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView
        style={{ flex: 1, backgroundColor: bay.room }}
        contentContainerStyle={styles.scroll}
        keyboardShouldPersistTaps="handled"
      >
        <Text style={styles.meta}>
          {`${vehicle.year} ${vehicle.make} ${vehicle.model}  ·  ${vehicle.mileage.toLocaleString()} MI`.toUpperCase()}
        </Text>

        <BayField
          label="Service or repair"
          placeholder='e.g. "front brake pads and rotors"'
          value={serviceLabel}
          onChangeText={setServiceLabel}
        />
        <BayField
          label="Quoted price (for the price check)"
          placeholder="350"
          keyboardType="decimal-pad"
          value={cost}
          onChangeText={setCost}
        />

        <View style={styles.actions}>
          <BayLink
            title={busy === 'explain' ? 'Explaining…' : 'Explain it'}
            onPress={() => void runExplain()}
            disabled={busy !== null}
            tone="cream"
          />
          <BayLink
            title={busy === 'cost' ? 'Checking…' : 'Check the price'}
            onPress={() => void runCostCheck()}
            disabled={busy !== null}
            tone="orange"
          />
        </View>

        {explanation != null && (
          <View style={{ marginTop: 28 }}>
            <Text style={styles.section}>WHAT IT IS</Text>
            <Text style={styles.stamp}>
              {URGENCY_LABEL[explanation.urgency].toUpperCase()}  ·  {DIY_LABEL[explanation.diyDifficulty].toUpperCase()}
            </Text>
            <Text style={styles.title}>{explanation.summary}</Text>
            <Text style={styles.body}>{explanation.whatItIs}</Text>
            {explanation.urgencyWhy != null && <Text style={styles.body}>{explanation.urgencyWhy}</Text>}
            {explanation.questionsForShop.length > 0 && (
              <>
                <Text style={styles.section}>ASK THE SHOP</Text>
                {explanation.questionsForShop.map((q) => (
                  <Text key={q} style={styles.body}>
                    {q}
                  </Text>
                ))}
              </>
            )}
          </View>
        )}

        {costCheck != null && (
          <View style={{ marginTop: 28 }}>
            <Text style={styles.section}>PRICE CHECK</Text>
            <Text style={styles.stamp}>{VERDICT_LABEL[costCheck.verdict].toUpperCase()}</Text>
            {costCheck.typicalLow != null && costCheck.typicalHigh != null && (
              <Text style={styles.body}>
                Typical: ${Math.round(costCheck.typicalLow)}–${Math.round(costCheck.typicalHigh)}
              </Text>
            )}
            <BayHair />
            <Text style={styles.body}>{costCheck.explanation}</Text>
            {costCheck.tips.map((tip) => (
              <Text key={tip} style={styles.body}>
                {tip}
              </Text>
            ))}
          </View>
        )}

        {(explanation != null || costCheck != null) && (
          <Text style={styles.disclaimer}>
            AI-generated guidance — a starting point, not a diagnosis. When in doubt, get a second opinion from a
            trusted mechanic.
          </Text>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  pad: { flex: 1, justifyContent: 'center', padding: 20, gap: 12 },
  scroll: { padding: 20, paddingBottom: 40 },
  meta: { color: bay.due, fontSize: 11, fontWeight: '800', letterSpacing: 1.1, marginBottom: 20 },
  actions: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 8 },
  section: {
    color: bay.due,
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 1.4,
    marginBottom: 8,
    marginTop: 8,
  },
  stamp: { color: bay.orange, fontSize: 11, fontWeight: '800', letterSpacing: 1.2, marginBottom: 8 },
  title: { color: bay.cream, fontSize: 16, fontWeight: '800', marginBottom: 8 },
  body: { color: bay.ymm, fontSize: 14, lineHeight: 20, marginBottom: 8 },
  mute: { color: bay.hint, fontSize: 13, fontWeight: '700' },
  disclaimer: { color: bay.hint, fontSize: 11, lineHeight: 16, marginTop: 24 },
});
