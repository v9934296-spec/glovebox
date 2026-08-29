import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React from 'react';
import { Alert, Image, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Screen } from '@/components/ui';
import { FlowFooter, ReviewRow } from '@/components/flow';
import { formatIsoLong } from '@/lib/domain/dates';
import { formatMoney } from '@/lib/domain/expenses';
import { serviceTypeLabel } from '@/lib/domain/serviceTypes';
import { draftCost, draftMileage, useServiceDraft, type AiField } from '@/lib/forms/serviceDraft';
import { saveServiceDraft } from '@/lib/forms/saveService';
import { palette, radius, spacing, typography } from '@/lib/theme';

/**
 * Read-back of a scanned receipt. Fields the model returned are marked with a
 * dot; fields it could not read say so out loud rather than sitting blank —
 * an assistant that admits what it missed is easier to trust.
 */
export default function LogServiceConfirm() {
  const router = useRouter();
  const draft = useServiceDraft();

  const filled = (field: AiField) => draft.aiFields.includes(field);
  const mileage = draftMileage(draft);
  const cost = draftCost(draft);

  function cancel() {
    useServiceDraft.getState().reset();
    router.dismissAll();
  }

  function save() {
    const result = saveServiceDraft();
    if (!result.ok) {
      Alert.alert('Not saved', result.reason);
      return;
    }
    router.dismissAll();
  }

  return (
    <Screen style={{ padding: 0 }}>
      <ScrollView
        contentContainerStyle={{ padding: spacing.screenPadding, paddingBottom: spacing['2xl'] }}
      >
        <View style={styles.header}>
          <Pressable onPress={() => router.back()} hitSlop={12} accessibilityRole="button" accessibilityLabel="Back">
            <Ionicons name="chevron-back" size={24} color={palette.text.primary} />
          </Pressable>
          <Pressable onPress={() => router.back()} hitSlop={12} accessibilityRole="button">
            <Text style={styles.retake}>Retake</Text>
          </Pressable>
        </View>

        <View style={styles.hero}>
          {draft.receiptUri != null ? (
            <Image source={{ uri: draft.receiptUri }} style={styles.receipt} />
          ) : (
            <View style={[styles.receipt, styles.receiptPlaceholder]}>
              <Ionicons name="receipt-outline" size={30} color={palette.text.tertiary} />
            </View>
          )}
          <View style={{ flex: 1 }}>
            <View style={styles.scannedPill}>
              <Ionicons name="sparkles-outline" size={14} color={palette.accent.primary} />
              <Text style={styles.scannedText}>Scanned</Text>
            </View>
            <Text style={styles.title}>Check these over</Text>
            <Text style={styles.subtitle}>
              We filled in what we could read. Tap any line to fix it.
            </Text>
          </View>
        </View>

        <View style={styles.card}>
          <ReviewRow
            label="Service"
            value={draft.serviceType != null ? serviceTypeLabel(draft.serviceType) : 'Not set'}
            missing={draft.serviceType == null}
            aiFilled={filled('serviceType')}
            onPress={() => router.back()}
          />
          <ReviewRow
            label="Date"
            value={formatIsoLong(draft.date)}
            aiFilled={filled('date')}
            onPress={() => router.push('/service/log/when')}
          />
          <ReviewRow
            label="Total"
            value={cost != null ? formatMoney(cost) : "Couldn't read — add"}
            missing={cost == null}
            aiFilled={filled('cost')}
            onPress={() => router.push('/service/log/when')}
          />
          <ReviewRow
            label="Odometer"
            value={mileage != null ? `${mileage.toLocaleString()} mi` : "Couldn't read — add"}
            missing={mileage == null}
            aiFilled={filled('mileage')}
            onPress={() => router.push('/service/log/when')}
          />
          <ReviewRow
            label="Shop"
            value={draft.shopName.trim() !== '' ? draft.shopName : "Couldn't read — add"}
            missing={draft.shopName.trim() === ''}
            aiFilled={filled('shopName')}
            onPress={() => router.push('/service/log/extras')}
            last
          />
        </View>

        <View style={styles.legend}>
          <View style={styles.legendDot} />
          <Text style={styles.legendText}>Filled in from the receipt</Text>
        </View>

        <FlowFooter
          primaryLabel={draft.saving ? 'Saving…' : 'Save record'}
          onPrimary={save}
          primaryDisabled={draft.saving || draft.serviceType == null}
          secondaryLabel="Cancel"
          onSecondary={cancel}
        />
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.lg,
  },
  retake: { color: palette.text.secondary, fontSize: typography.body.size },
  hero: { flexDirection: 'row', gap: spacing.lg, marginBottom: spacing.xl },
  receipt: { width: 84, height: 108, borderRadius: radius.md },
  receiptPlaceholder: {
    backgroundColor: palette.bg.surfaceRaised,
    borderWidth: 1,
    borderColor: palette.border.default,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scannedPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    alignSelf: 'flex-start',
    backgroundColor: palette.bg.surfaceRaised,
    borderRadius: radius.pill,
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    marginBottom: spacing.sm,
  },
  scannedText: { color: palette.accent.primary, fontSize: 11, fontWeight: '700' },
  title: {
    color: palette.text.primary,
    fontSize: typography.h3.size,
    fontWeight: typography.h3.weight,
  },
  subtitle: {
    color: palette.text.secondary,
    fontSize: typography.caption.size,
    marginTop: spacing.xs,
    lineHeight: typography.caption.lineHeight,
  },
  card: {
    backgroundColor: palette.bg.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: palette.border.subtle,
    overflow: 'hidden',
  },
  legend: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginTop: spacing.md,
  },
  legendDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: palette.accent.primary },
  legendText: { color: palette.text.tertiary, fontSize: typography.caption.size },
});
