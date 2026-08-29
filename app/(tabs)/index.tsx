import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React, { useMemo } from 'react';
import { Image, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import {
  AttentionRow,
  Button,
  Card,
  EmptyState,
  IconCircle,
  kindAccent,
  ListRow,
  MetricStrip,
  Screen,
  SectionLabel,
  healthRingColor,
  serviceTypeIcon,
} from '@/components/ui';
import { useAllServiceRecords, useReminders, useVehicles } from '@/lib/db/hooks';
import { dueSummary, reminderDueState, todayIso, type DueState } from '@/lib/domain/due';
import { formatMoney, summarizeExpenses } from '@/lib/domain/expenses';
import { healthScore } from '@/lib/domain/healthScore';
import { serviceTypeDef, serviceTypeLabel } from '@/lib/domain/serviceTypes';
import type { Vehicle } from '@/lib/domain/types';
import { palette, radius, spacing, typography } from '@/lib/theme';

const BLOCK_GAP = 28;

function formatMileageShort(miles: number): string {
  if (miles >= 1000) return `${Math.round(miles / 1000)}k mi`;
  return `${miles.toLocaleString()} mi`;
}

export default function DashboardScreen() {
  const router = useRouter();
  const vehicles = useVehicles();
  const allRecords = useAllServiceRecords();
  const activeReminders = useReminders({ status: 'active' });
  const today = todayIso();

  const attention = useMemo(() => {
    const vehicleById = new Map(vehicles.map((v) => [v.id, v]));
    const rank: Record<DueState, number> = { overdue: 0, due_soon: 1, upcoming: 2, no_due: 3 };
    return activeReminders
      .map((reminder) => {
        const vehicle = vehicleById.get(reminder.vehicleId);
        if (!vehicle) return null;
        const state = reminderDueState(reminder, vehicle.mileage, today);
        return { reminder, vehicle, state };
      })
      .filter((e): e is NonNullable<typeof e> => e !== null && e.state !== 'no_due' && e.state !== 'upcoming')
      .sort((a, b) => rank[a.state] - rank[b.state])
      .slice(0, 5);
  }, [activeReminders, vehicles, today]);

  const expenses = useMemo(() => summarizeExpenses(allRecords, today), [allRecords, today]);
  const recentRecords = allRecords.slice(0, 3);

  const garagePreview = useMemo(() => {
    return vehicles.slice(0, 3).map((vehicle) => {
      const records = allRecords.filter((r) => r.vehicleId === vehicle.id);
      const reminders = activeReminders.filter((r) => r.vehicleId === vehicle.id);
      const health = healthScore({ vehicle, records, reminders, today });
      return { vehicle, score: health.score };
    });
  }, [vehicles, allRecords, activeReminders, today]);

  if (vehicles.length === 0) {
    return (
      <Screen>
        <EmptyState
          title="Welcome to Glovebox"
          message="Your car’s memory and maintenance plan in one place."
          icon="car-outline"
          action={<Button title="Add your car" onPress={() => router.push('/vehicle/add')} />}
        />
      </Screen>
    );
  }

  return (
    <Screen style={{ padding: 0 }}>
      <ScrollView
        contentContainerStyle={{
          padding: spacing.screenPadding,
          paddingBottom: spacing['2xl'],
          gap: BLOCK_GAP,
        }}
      >
        <MetricStrip
          items={[
            { label: 'This month', value: formatMoney(expenses.monthTotal) },
            { label: 'This year', value: formatMoney(expenses.yearTotal) },
          ]}
        />

        <View>
          <SectionLabel
            title="Needs attention"
            actionLabel="See all"
            onAction={() => router.push('/reminders')}
          />
          {attention.length === 0 ? (
            <View style={styles.clearRow}>
              <Ionicons name="checkmark-circle" size={18} color={palette.status.ok} />
              <Text style={styles.clearText}>You're clear — nothing overdue or due soon</Text>
            </View>
          ) : (
            <View>
              {attention.map(({ reminder, vehicle, state }, i) => (
                <AttentionRow
                  key={reminder.id}
                  title={reminder.title}
                  meta={`${vehicle.nickname} · ${dueSummary({
                    dueDate: reminder.dueDate,
                    dueMileage: reminder.dueMileage,
                    currentMileage: vehicle.mileage,
                    today,
                  })}`}
                  state={state}
                  showSeparator={i < attention.length - 1}
                  onPress={() => router.push({ pathname: '/vehicle/[id]', params: { id: vehicle.id } })}
                />
              ))}
            </View>
          )}
        </View>

        <View>
          <SectionLabel
            title="Garage"
            actionLabel={vehicles.length > 3 ? 'See garage' : undefined}
            onAction={vehicles.length > 3 ? () => router.push('/garage') : undefined}
          />
          {garagePreview.map(({ vehicle, score }, i) => (
            <CompactGarageRow
              key={vehicle.id}
              vehicle={vehicle}
              score={score}
              showSeparator={i < garagePreview.length - 1}
              onPress={() => router.push({ pathname: '/vehicle/[id]', params: { id: vehicle.id } })}
            />
          ))}
        </View>

        {recentRecords.length > 0 && (
          <View>
            <SectionLabel title="Recent activity" />
            <Card style={{ paddingVertical: spacing.sm, paddingHorizontal: spacing.md }}>
              {recentRecords.map((r, i) => {
                const kind = serviceTypeDef(r.serviceType).kind;
                const color = kindAccent(kind);
                const metaParts = [
                  r.date,
                  r.mileage != null ? `${r.mileage.toLocaleString()} mi` : null,
                  r.cost != null ? formatMoney(r.cost) : null,
                ].filter(Boolean);
                return (
                  <View
                    key={r.id}
                    style={[styles.rowPad, i < recentRecords.length - 1 && styles.rowDivider]}
                  >
                    <ListRow
                      icon={<IconCircle icon={serviceTypeIcon(r.serviceType)} color={color} />}
                      title={serviceTypeLabel(r.serviceType)}
                      meta={metaParts.join(' · ')}
                    />
                  </View>
                );
              })}
            </Card>
          </View>
        )}

        <View style={styles.quickActions}>
          <Button title="Log service" onPress={() => router.push('/service/log')} style={{ flex: 1 }} />
          <Button
            title="New reminder"
            variant="secondary"
            onPress={() => router.push('/reminder/add')}
            style={{ flex: 1 }}
          />
        </View>
      </ScrollView>
    </Screen>
  );
}

function CompactGarageRow({
  vehicle,
  score,
  showSeparator,
  onPress,
}: {
  vehicle: Vehicle;
  score: number;
  showSeparator?: boolean;
  onPress: () => void;
}) {
  const plate = `${vehicle.year} ${vehicle.make} ${vehicle.model}`.trim();
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={[styles.compactRow, showSeparator && styles.compactRowSep]}
    >
      {vehicle.photoUri ? (
        <Image source={{ uri: vehicle.photoUri }} style={styles.compactPhoto} />
      ) : (
        <View style={[styles.compactPhoto, styles.compactPhotoPlaceholder]}>
          <Ionicons name="car-sport" size={18} color={palette.text.tertiary} />
        </View>
      )}
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text style={styles.compactTitle} numberOfLines={1}>
          {vehicle.nickname}
        </Text>
        <Text style={styles.compactMeta} numberOfLines={1}>
          {formatMileageShort(vehicle.mileage)} · {plate}
        </Text>
      </View>
      <Text style={[styles.compactScore, { color: healthRingColor(score) }]}>{score}</Text>
      <Ionicons name="chevron-forward" size={16} color={palette.text.tertiary} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  clearRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.sm,
  },
  clearText: {
    color: palette.text.secondary,
    fontSize: typography.body.size,
    flex: 1,
  },
  compactRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: spacing.md,
  },
  compactRowSep: {
    borderBottomWidth: 1,
    borderBottomColor: palette.border.subtle,
  },
  compactPhoto: {
    width: 40,
    height: 40,
    borderRadius: radius.sm,
  },
  compactPhotoPlaceholder: {
    backgroundColor: palette.bg.hero,
    alignItems: 'center',
    justifyContent: 'center',
  },
  compactTitle: {
    color: palette.text.primary,
    fontSize: typography.bodyEmphasis.size,
    fontWeight: typography.bodyEmphasis.weight,
  },
  compactMeta: {
    color: palette.text.tertiary,
    fontSize: typography.caption.size,
    marginTop: 2,
  },
  compactScore: {
    fontSize: typography.bodyEmphasis.size,
    fontWeight: typography.bodyEmphasis.weight,
  },
  rowPad: { paddingVertical: spacing.sm },
  rowDivider: {
    borderBottomWidth: 1,
    borderBottomColor: palette.border.subtle,
  },
  quickActions: { flexDirection: 'row', gap: spacing.md },
});
