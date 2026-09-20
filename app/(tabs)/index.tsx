import { useRouter } from 'expo-router';
import React, { useMemo } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { DueWord, Mute, Rule, ShopScreen, SolidButton, TextButton } from '@/components/shop';
import { useAllServiceRecords, useReminders, useVehicles } from '@/lib/db/hooks';
import { dueSummary, reminderDueState, todayIso, type DueState } from '@/lib/domain/due';
import { formatMoney, summarizeExpenses } from '@/lib/domain/expenses';
import type { Reminder, Vehicle } from '@/lib/domain/types';
import { palette, spacing, typography } from '@/lib/theme';

export default function DashboardScreen() {
  const router = useRouter();
  const vehicles = useVehicles();
  const allRecords = useAllServiceRecords();
  const activeReminders = useReminders({ status: 'active' });
  const today = todayIso();

  const next = useMemo(() => {
    const vehicleById = new Map(vehicles.map((v) => [v.id, v]));
    const rank: Record<DueState, number> = { overdue: 0, due_soon: 1, upcoming: 2, no_due: 3 };
    return activeReminders
      .map((reminder) => {
        const vehicle = vehicleById.get(reminder.vehicleId);
        if (!vehicle) return null;
        const state = reminderDueState(reminder, vehicle.mileage, today);
        return { reminder, vehicle, state };
      })
      .filter((e): e is { reminder: Reminder; vehicle: Vehicle; state: DueState } => e != null && e.state !== 'no_due')
      .sort((a, b) => rank[a.state] - rank[b.state])[0] ?? null;
  }, [activeReminders, vehicles, today]);

  const expenses = useMemo(() => summarizeExpenses(allRecords, today), [allRecords, today]);

  if (vehicles.length === 0) {
    return (
      <ShopScreen>
        <View style={styles.empty}>
          <Text style={styles.emptyTitle}>Nothing in the box yet</Text>
          <Text style={styles.emptyBody}>Add the car you actually drive. Logs and reminders wait until then.</Text>
          <SolidButton title="Add a car" onPress={() => router.push('/vehicle/add')} />
        </View>
      </ShopScreen>
    );
  }

  return (
    <ShopScreen style={{ padding: 0 }}>
      <ScrollView contentContainerStyle={styles.page}>
        <View>
          <Mute>This month</Mute>
          <Text style={styles.spend}>{formatMoney(expenses.monthTotal)}</Text>
          <Mute>{`${formatMoney(expenses.yearTotal)} this year`}</Mute>
        </View>

        <Rule />

        {next == null ? (
          <View style={{ gap: spacing.sm }}>
            <Text style={styles.headline}>Nothing due</Text>
            <Mute>No overdue or upcoming work on the books.</Mute>
          </View>
        ) : (
          <Pressable
            accessibilityRole="button"
            onPress={() => router.push({ pathname: '/vehicle/[id]', params: { id: next.vehicle.id } })}
            style={{ gap: spacing.sm }}
          >
            <DueWord state={next.state} />
            <Text style={styles.headline}>{next.reminder.title}</Text>
            <Text style={styles.sub}>
              {next.vehicle.nickname}
              {' · '}
              {dueSummary({
                dueDate: next.reminder.dueDate,
                dueMileage: next.reminder.dueMileage,
                currentMileage: next.vehicle.mileage,
                today,
              })}
            </Text>
          </Pressable>
        )}

        <SolidButton title="Log service" onPress={() => router.push('/service/log')} />

        <View style={styles.rowLinks}>
          <TextButton label="Reminders" onPress={() => router.push('/reminders')} />
          <TextButton label="Garage" onPress={() => router.push('/garage')} tone="mute" />
        </View>
      </ScrollView>
    </ShopScreen>
  );
}

const styles = StyleSheet.create({
  page: {
    padding: spacing.screenPadding,
    paddingBottom: spacing['2xl'],
    gap: spacing.xl,
  },
  spend: {
    color: palette.text.primary,
    fontSize: typography.display.size,
    fontWeight: '600',
    marginTop: 4,
  },
  headline: {
    color: palette.text.primary,
    fontSize: 28,
    fontWeight: '600',
    lineHeight: 34,
  },
  sub: {
    color: palette.text.secondary,
    fontSize: typography.body.size,
    lineHeight: typography.body.lineHeight,
  },
  rowLinks: { flexDirection: 'row', justifyContent: 'space-between' },
  empty: {
    flex: 1,
    justifyContent: 'center',
    padding: spacing.screenPadding,
    gap: spacing.lg,
  },
  emptyTitle: {
    color: palette.text.primary,
    fontSize: typography.hero.size,
    fontWeight: '600',
  },
  emptyBody: {
    color: palette.text.secondary,
    fontSize: typography.body.size,
    lineHeight: typography.body.lineHeight,
  },
});