import { useRouter } from 'expo-router';
import React, { useMemo } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { Button, Card, DueBadge, EmptyState, Screen, SectionHeader } from '@/components/ui';
import { useReminders, useVehicles } from '@/lib/db/hooks';
import { completeReminder } from '@/lib/db/reminderRepo';
import { dueSummary, reminderDueState, todayIso, type DueState } from '@/lib/domain/due';
import type { Reminder, Vehicle } from '@/lib/domain/types';
import { palette, spacing, typography } from '@/lib/theme';

type Entry = { reminder: Reminder; vehicle: Vehicle; state: DueState };

function ReminderRow({ entry }: { entry: Entry }) {
  const { reminder, vehicle, state } = entry;
  return (
    <Card style={styles.rowCard}>
      <View style={{ flex: 1 }}>
        <View style={styles.rowHeader}>
          <Text style={styles.rowTitle}>{reminder.title}</Text>
          <DueBadge state={state} />
        </View>
        <Text style={styles.rowMeta}>
          {vehicle.nickname} ·{' '}
          {dueSummary({
            dueDate: reminder.dueDate,
            dueMileage: reminder.dueMileage,
            currentMileage: vehicle.mileage,
            today: todayIso(),
          })}
          {reminder.recurrenceType !== 'none' ? ' · recurring' : ''}
        </Text>
      </View>
      <Button
        title="Done"
        variant="secondary"
        onPress={() => completeReminder(reminder, vehicle.mileage)}
        style={styles.doneButton}
      />
    </Card>
  );
}

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
          message="Add a vehicle in the Garage tab, then set up maintenance reminders."
        />
      </Screen>
    );
  }

  return (
    <Screen style={{ padding: 0 }}>
      <ScrollView contentContainerStyle={{ padding: spacing.screenPadding, paddingBottom: spacing['2xl'] }}>
        <Button title="New reminder" onPress={() => router.push('/reminder/add')} />

        {!hasAny && (
          <EmptyState
            title="Nothing scheduled"
            message="Create reminders for oil changes, registration, insurance — anything your car needs on a schedule."
          />
        )}

        {grouped.overdue.length > 0 && (
          <>
            <SectionHeader title="Overdue" />
            <View style={styles.group}>
              {grouped.overdue.map((e) => (
                <ReminderRow key={e.reminder.id} entry={e} />
              ))}
            </View>
          </>
        )}

        {grouped.due_soon.length > 0 && (
          <>
            <SectionHeader title="Due soon" />
            <View style={styles.group}>
              {grouped.due_soon.map((e) => (
                <ReminderRow key={e.reminder.id} entry={e} />
              ))}
            </View>
          </>
        )}

        {grouped.upcoming.length > 0 && (
          <>
            <SectionHeader title="Upcoming" />
            <View style={styles.group}>
              {grouped.upcoming.map((e) => (
                <ReminderRow key={e.reminder.id} entry={e} />
              ))}
            </View>
          </>
        )}

        {completed.length > 0 && (
          <>
            <SectionHeader title="Completed" />
            <View style={styles.group}>
              {completed.map((r) => (
                <Card key={r.id} style={{ opacity: 0.6 }}>
                  <Text style={styles.rowTitle}>{r.title}</Text>
                  <Text style={styles.rowMeta}>completed {r.completedAt?.slice(0, 10) ?? ''}</Text>
                </Card>
              ))}
            </View>
          </>
        )}
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  group: { gap: spacing.sm },
  rowCard: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  rowHeader: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  rowTitle: {
    color: palette.text.primary,
    fontSize: typography.bodyEmphasis.size,
    fontWeight: typography.bodyEmphasis.weight,
  },
  rowMeta: { color: palette.text.tertiary, fontSize: typography.caption.size, marginTop: 2 },
  doneButton: { paddingVertical: 8, paddingHorizontal: spacing.md },
});
