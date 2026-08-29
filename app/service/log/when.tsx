import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React, { useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Screen } from '@/components/ui';
import {
  BigValueField,
  DateChips,
  FlowFooter,
  FlowHeader,
  NextDueCard,
  StepProgress,
  icon,
} from '@/components/flow';
import { useVehicle } from '@/lib/db/hooks';
import { formatIsoLong } from '@/lib/domain/dates';
import { serviceTypeDef } from '@/lib/domain/serviceTypes';
import { resolveNextDue, useServiceDraft } from '@/lib/forms/serviceDraft';
import { palette, radius, spacing, typography } from '@/lib/theme';

const TOTAL_STEPS = 3;

export default function LogServiceStepWhen() {
  const router = useRouter();
  const draft = useServiceDraft();
  const vehicle = useVehicle(draft.vehicleId ?? undefined);
  const [editingNextDue, setEditingNextDue] = useState(false);

  const def = serviceTypeDef(draft.serviceType ?? 'other');
  const nextDue = resolveNextDue(draft);

  const nextDueSummary = [
    def.defaultIntervalMonths != null ? `${def.defaultIntervalMonths} months` : null,
    def.defaultIntervalMiles != null ? `${def.defaultIntervalMiles.toLocaleString()} mi` : null,
  ]
    .filter((s): s is string => s != null)
    .join(' or ');

  const nextDueDetail = [
    nextDue.dueDate != null ? formatIsoLong(nextDue.dueDate) : null,
    nextDue.dueMileage != null ? `${nextDue.dueMileage.toLocaleString()} mi` : null,
  ]
    .filter((s): s is string => s != null)
    .join(' · ');

  function cancel() {
    useServiceDraft.getState().reset();
    router.dismissAll();
  }

  function clearNextDue() {
    draft.setNextDueOverride({ dueDate: null, dueMileage: null });
    setEditingNextDue(false);
  }

  function restoreNextDue() {
    draft.setNextDueOverride(null);
    setEditingNextDue(false);
  }

  return (
    <Screen style={{ padding: 0 }}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          contentContainerStyle={{ padding: spacing.screenPadding, paddingBottom: spacing['2xl'] }}
          keyboardShouldPersistTaps="handled"
        >
          <FlowHeader step={2} total={TOTAL_STEPS} onBack={() => router.back()} onCancel={cancel} />
          <StepProgress step={2} total={TOTAL_STEPS} />

          <View style={styles.typeRow}>
            <View style={styles.typeIcon}>
              <Ionicons name={icon(def.icon)} size={22} color={palette.accent.primary} />
            </View>
            <View>
              <Text style={styles.typeLabel}>{def.label}</Text>
              {vehicle != null && <Text style={styles.typeMeta}>{vehicle.nickname}</Text>}
            </View>
          </View>

          <Text style={styles.overline}>WHEN</Text>
          <View style={{ marginBottom: spacing.lg }}>
            <DateChips value={draft.date} onChange={draft.setDate} />
          </View>

          <BigValueField
            label="Odometer"
            value={draft.mileage}
            onChangeText={draft.setMileage}
            placeholder="0"
            suffix="mi"
            hint={
              vehicle != null && draft.mileage === String(vehicle.mileage)
                ? 'Current reading — tap to change'
                : undefined
            }
            emphasized
          />

          <BigValueField
            label="Cost"
            value={draft.cost}
            onChangeText={draft.setCost}
            placeholder="0"
            prefix="$"
            keyboardType="decimal-pad"
          />

          {editingNextDue ? (
            <View style={styles.nextDueEdit}>
              <Text style={styles.overline}>NEXT REMINDER</Text>
              <BigValueField
                label="Remind at"
                value={nextDue.dueMileage != null ? String(nextDue.dueMileage) : ''}
                onChangeText={(raw) =>
                  draft.setNextDueOverride({
                    dueDate: nextDue.dueDate,
                    dueMileage: raw.replace(/[^\d]/g, '') === '' ? null : Number(raw.replace(/[^\d]/g, '')),
                  })
                }
                placeholder="0"
                suffix="mi"
              />
              <DateChips
                value={nextDue.dueDate ?? draft.date}
                onChange={(iso) => draft.setNextDueOverride({ dueDate: iso, dueMileage: nextDue.dueMileage })}
              />
              <View style={styles.nextDueActions}>
                <Text onPress={clearNextDue} style={styles.linkMuted}>
                  No reminder
                </Text>
                <Text onPress={restoreNextDue} style={styles.link}>
                  Use the default
                </Text>
              </View>
            </View>
          ) : (
            <NextDueCard
              dueDate={nextDue.dueDate}
              dueMileage={nextDue.dueMileage}
              summary={
                nextDueSummary !== ''
                  ? `${nextDueSummary}${nextDueDetail !== '' ? `\n${nextDueDetail}` : ''}`
                  : nextDueDetail
              }
              onChange={() => setEditingNextDue(true)}
            />
          )}

          <FlowFooter
            primaryLabel="Continue"
            onPrimary={() => router.push('/service/log/extras')}
            secondaryLabel="Back"
            onSecondary={() => router.back()}
          />
        </ScrollView>
      </KeyboardAvoidingView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  typeRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, marginBottom: spacing.xl },
  typeIcon: {
    width: 44,
    height: 44,
    borderRadius: radius.md,
    backgroundColor: palette.bg.surfaceRaised,
    alignItems: 'center',
    justifyContent: 'center',
  },
  typeLabel: {
    color: palette.text.primary,
    fontSize: typography.h3.size,
    fontWeight: typography.h3.weight,
  },
  typeMeta: { color: palette.text.tertiary, fontSize: typography.caption.size, marginTop: 2 },
  overline: {
    color: palette.text.tertiary,
    fontSize: typography.overline.size,
    fontWeight: typography.overline.weight,
    letterSpacing: typography.overline.letterSpacing,
    marginBottom: spacing.sm,
  },
  nextDueEdit: {
    backgroundColor: palette.bg.surface,
    borderLeftWidth: 3,
    borderLeftColor: palette.accent.primary,
    padding: spacing.lg,
    marginBottom: spacing.lg,
  },
  nextDueActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: spacing.lg,
  },
  link: { color: palette.accent.primary, fontSize: typography.caption.size, fontWeight: '600' },
  linkMuted: { color: palette.text.secondary, fontSize: typography.caption.size },
});
