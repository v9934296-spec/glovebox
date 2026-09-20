import { useRouter } from 'expo-router';
import React, { useMemo } from 'react';
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { DueWord, Mute, Rule, ShopScreen, SolidButton } from '@/components/shop';
import { useAllServiceRecords, useReminders, useVehicles } from '@/lib/db/hooks';
import { dueSummary, reminderDueState, todayIso, type DueState } from '@/lib/domain/due';
import { healthScore } from '@/lib/domain/healthScore';
import type { Reminder, Vehicle } from '@/lib/domain/types';
import { palette, spacing, typography } from '@/lib/theme';

const DUE_RANK: Record<DueState, number> = { overdue: 0, due_soon: 1, upcoming: 2, no_due: 3 };

function nextDueFor(vehicle: Vehicle, reminders: Reminder[], today: string) {
  let best: { title: string; summary: string; state: DueState } | null = null;
  for (const r of reminders) {
    const state = reminderDueState(r, vehicle.mileage, today);
    if (state === 'no_due') continue;
    if (!best || DUE_RANK[state] < DUE_RANK[best.state]) {
      best = {
        title: r.title,
        state,
        summary: dueSummary({
          dueDate: r.dueDate,
          dueMileage: r.dueMileage,
          currentMileage: vehicle.mileage,
          today,
        }),
      };
    }
  }
  return best;
}

export default function GarageScreen() {
  const vehicles = useVehicles();
  const allRecords = useAllServiceRecords();
  const activeReminders = useReminders({ status: 'active' });
  const router = useRouter();
  const today = todayIso();

  const sorted = useMemo(() => {
    const enriched = vehicles.map((vehicle) => {
      const reminders = activeReminders.filter((r) => r.vehicleId === vehicle.id);
      const records = allRecords.filter((r) => r.vehicleId === vehicle.id);
      const health = healthScore({ vehicle, records, reminders, today });
      const nextDue = nextDueFor(vehicle, reminders, today);
      const sortKey = nextDue ? DUE_RANK[nextDue.state] : 4;
      return { vehicle, health, nextDue, sortKey };
    });
    return enriched.sort((a, b) => {
      if (a.sortKey !== b.sortKey) return a.sortKey - b.sortKey;
      return a.vehicle.nickname.localeCompare(b.vehicle.nickname);
    });
  }, [vehicles, activeReminders, allRecords, today]);

  if (vehicles.length === 0) {
    return (
      <ShopScreen>
        <View style={styles.empty}>
          <Text style={styles.emptyTitle}>Garage is empty</Text>
          <Text style={styles.emptyBody}>One car is enough to start a log.</Text>
          <SolidButton title="Add a car" onPress={() => router.push('/vehicle/add')} />
        </View>
      </ShopScreen>
    );
  }

  return (
    <ShopScreen style={{ padding: 0 }}>
      <FlatList
        data={sorted}
        keyExtractor={(item) => item.vehicle.id}
        contentContainerStyle={styles.list}
        ItemSeparatorComponent={Rule}
        renderItem={({ item }) => {
          const { vehicle, health, nextDue } = item;
          const plate = `${vehicle.year} ${vehicle.make} ${vehicle.model}`;
          return (
            <Pressable
              accessibilityRole="button"
              onPress={() => router.push({ pathname: '/vehicle/[id]', params: { id: vehicle.id } })}
              style={styles.row}
            >
              <View style={{ flex: 1, minWidth: 0, gap: 2 }}>
                <Text style={styles.name}>{vehicle.nickname}</Text>
                <Mute>{`${vehicle.mileage.toLocaleString()} mi · ${plate}`}</Mute>
                {nextDue ? (
                  <Text style={styles.next}>
                    {nextDue.title} · {nextDue.summary}
                  </Text>
                ) : (
                  <Mute>Nothing scheduled</Mute>
                )}
              </View>
              <View style={{ alignItems: 'flex-end', gap: 4 }}>
                {nextDue ? <DueWord state={nextDue.state} /> : null}
                <Text style={styles.score}>{health.score}</Text>
              </View>
            </Pressable>
          );
        }}
        ListFooterComponent={
          <Pressable onPress={() => router.push('/vehicle/add')} style={styles.footer}>
            <Text style={styles.footerText}>Add another car</Text>
          </Pressable>
        }
      />
    </ShopScreen>
  );
}

const styles = StyleSheet.create({
  list: { paddingHorizontal: spacing.screenPadding, paddingBottom: spacing['2xl'] },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.lg,
    gap: spacing.md,
  },
  name: { color: palette.text.primary, fontSize: typography.h3.size, fontWeight: '600' },
  next: { color: palette.text.secondary, fontSize: typography.caption.size, marginTop: 2 },
  score: { color: palette.text.tertiary, fontSize: typography.caption.size },
  footer: { alignItems: 'center', paddingVertical: spacing.xl },
  footerText: { color: palette.accent.primary, fontSize: typography.bodyEmphasis.size, fontWeight: '600' },
  empty: { flex: 1, justifyContent: 'center', padding: spacing.screenPadding, gap: spacing.lg },
  emptyTitle: { color: palette.text.primary, fontSize: typography.hero.size, fontWeight: '600' },
  emptyBody: { color: palette.text.secondary, fontSize: typography.body.size },
});