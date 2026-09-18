import { useRouter } from 'expo-router';
import React, { useMemo } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Button, Card, EmptyState, ReminderListRow, Screen, SectionLabel } from '@/components/ui';
import { useReminders, useVehicles } from '@/lib/db/hooks';
import { completeReminder } from '@/lib/db/reminderRepo';
import { dueSummary, reminderDueState, todayIso, type DueState } from '@/lib/domain/due';
import type { Reminder, Vehicle } from '@/lib/domain/types';
import { palette, spacing, typography } from '@/lib/theme';

type Entry = { reminder: Reminder; vehicle: Vehicle; state: DueState };

export default function RemindersScreen() {
  const router = useRouter();
  const vehicles = useVehicles();
  const active = useReminders({ status: 'active' });
  const completed = useReminders({ status: 'completed' });
  const today = todayIso();

  const grouped = useMemo(() => {
    const vehicleById = new Map(vehicles.map((v) => [v.id, v]));
    const groups: Record<'overdue' | 'due_soon' | 'upcoming', Entry[]> = {
      overdue: [],
      due_soon: [],
      upcoming: [],
    };
    for (const reminder of active) {
      const vehicle = vehicleById.get(reminder.vehicleId);
      if (!vehicle) continue;
      const state = reminderDueState(reminder, vehicle.mileage, today);
      if (state === 'no_due') groups.upcoming.push({ reminder, vehicle, state: 'upcoming' });
      else groups[state].push({ reminder, vehicle, state });
    }
    return groups;
  }, [active, vehicles, today]);

  const hasAny = active.length > 0 || completed.length > 0;

  if (vehicles.length === 0) {
    return (
      <Screen>
        <EmptyState
          title="No vehicles yet"
          message="Add a vehicle in Garage, then set reminders."
          icon="car-outline"
          action={
            <Pressable onPress={() => router.push('/garage')}>
              <Text style={styles.textLink}>Go to Garage</Text>
            </Pressable>
          }
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
          gap: spacing.section,
        }}
      >
        <Button title="New reminder" onPress={() => router.push('/reminder/add')} />

        {!hasAny ? (
          <EmptyState
            title="Nothing scheduled"
            message="Oil, registration, insurance — anything on a schedule."
            icon="notifications-outline"
          />
        ) : (
          <>
            {grouped.overdue.length > 0 && (
              <ReminderGroup title="Overdue" entries={grouped.overdue} />
            )}
            {grouped.due_soon.length > 0 && (
              <ReminderGroup title="Due soon" entries={grouped.due_soon} />
            )}
            {grouped.upcoming.length > 0 && (
              <ReminderGroup title="Upcoming" entries={grouped.upcoming} />
            )}
            {completed.length > 0 && (
              <View>
                <SectionLabel title="Completed" />
                <Card style={styles.groupCard}>
                  {completed.map((r, i) => (
                    <ReminderListRow
                      key={r.id}
                      title={r.title}
                      meta={`completed ${r.completedAt?.slice(0, 10) ?? ''}`}
                      completed
                      showSeparator={i < completed.length - 1}
                    />
                  ))}
                </Card>
              </View>
            )}
          </>
        )}
      </ScrollView>
    </Screen>
  );
}

function ReminderGroup({ title, entries }: { title: string; entries: Entry[] }) {
  const router = useRouter();
  const today = todayIso();
  return (
    <View>
      <SectionLabel title={title} />
      <Card style={styles.groupCard}>
        {entries.map((e, i) => (
          <ReminderListRow
            key={e.reminder.id}
            title={e.reminder.title}
            meta={`${e.vehicle.nickname} · ${dueSummary({
              dueDate: e.reminder.dueDate,
              dueMileage: e.reminder.dueMileage,
              currentMileage: e.vehicle.mileage,
              today,
            })}${e.reminder.recurrenceType !== 'none' ? ' · recurring' : ''}`}
            state={e.state}
            showSeparator={i < entries.length - 1}
            onPress={() => router.push({ pathname: '/vehicle/[id]', params: { id: e.vehicle.id } })}
            onDone={() => completeReminder(e.reminder, e.vehicle.mileage)}
          />
        ))}
      </Card>
    </View>
  );
}

const styles = StyleSheet.create({
  groupCard: {
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.md,
  },
  textLink: {
    color: palette.accent.primary,
    fontSize: typography.bodyEmphasis.size,
    fontWeight: '600',
  },
});
