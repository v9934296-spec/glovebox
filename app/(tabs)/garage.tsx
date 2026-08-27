import { useRouter } from 'expo-router';
import React, { useMemo } from 'react';
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { Button, EmptyState, Screen, VehicleHeroCard } from '@/components/ui';
import { useAllServiceRecords, useReminders, useVehicles } from '@/lib/db/hooks';
import { dueSummary, reminderDueState, todayIso, type DueState } from '@/lib/domain/due';
import { healthScore } from '@/lib/domain/healthScore';
import type { Reminder, Vehicle } from '@/lib/domain/types';
import { palette, spacing, typography } from '@/lib/theme';

const DUE_RANK: Record<DueState, number> = { overdue: 0, due_soon: 1, upcoming: 2, no_due: 3 };

function nextDueFor(
  vehicle: Vehicle,
  reminders: Reminder[],
  today: string,
): { title: string; summary: string; state: DueState } | null {
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
      <Screen>
        <EmptyState
          title="Nothing in the garage yet"
          message="Add a car to start logging service, costs, and what’s due."
          icon="car-outline"
          action={<Button title="Add your car" onPress={() => router.push('/vehicle/add')} />}
        />
      </Screen>
    );
  }

  return (
    <Screen style={{ padding: 0 }}>
      <FlatList
        data={sorted}
        keyExtractor={(item) => item.vehicle.id}
        contentContainerStyle={{
          padding: spacing.screenPadding,
          gap: spacing.md,
          paddingBottom: spacing['2xl'],
        }}
        renderItem={({ item }) => {
          const { vehicle, health, nextDue } = item;
          const plate = `${vehicle.year} ${vehicle.make} ${vehicle.model}${
            vehicle.trim ? ` ${vehicle.trim}` : ''
          }`;
          return (
            <VehicleHeroCard
              photoUri={vehicle.photoUri}
              nickname={vehicle.nickname}
              plate={plate}
              mileage={`${vehicle.mileage.toLocaleString()} mi`}
              healthScore={health.score}
              nextDue={nextDue}
              onPress={() => router.push({ pathname: '/vehicle/[id]', params: { id: vehicle.id } })}
            />
          );
        }}
        ListFooterComponent={
          <Pressable
            accessibilityRole="button"
            onPress={() => router.push('/vehicle/add')}
            style={styles.addAnother}
          >
            <Text style={styles.addAnotherText}>Add another vehicle</Text>
          </Pressable>
        }
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  addAnother: {
    alignItems: 'center',
    paddingVertical: spacing.lg,
    marginTop: spacing.sm,
  },
  addAnotherText: {
    color: palette.accent.primary,
    fontSize: typography.bodyEmphasis.size,
    fontWeight: typography.bodyEmphasis.weight,
  },
});
