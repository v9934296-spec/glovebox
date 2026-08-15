import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React, { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import {
  Button,
  Card,
  DueBadge,
  EmptyState,
  IconCircle,
  kindAccent,
  Screen,
  SectionHeader,
  SegmentedControl,
  serviceTypeIcon,
} from '@/components/ui';
import { useReminders, useVehicles } from '@/lib/db/hooks';
import { completeReminder } from '@/lib/db/reminderRepo';
import { dueSummary, reminderDueState, todayIso, type DueState } from '@/lib/domain/due';
import { serviceTypeDef } from '@/lib/domain/serviceTypes';
import type { Reminder, Vehicle } from '@/lib/domain/types';
import { palette, spacing, typography } from '@/lib/theme';

type Entry = { reminder: Reminder; vehicle: Vehicle; state: DueState };

function reminderAccent(state: DueState): string {
  if (state === 'overdue') return palette.status.overdue;
  if (state === 'due_soon') return palette.status.dueSoon;
  return palette.status.ok;
}

function ReminderRow({ entry }: { entry: Entry }) {
  const router = useRouter();
  const { reminder, vehicle, state } = entry;
  const kind = serviceTypeDef(reminder.category).kind;
  const iconColor = state === 'overdue' ? palette.status.overdue : kindAccent(kind);

  return (
    <Card style={styles.rowCard}>
      <Pressable
        accessibilityRole="button"
        onPress={() => router.push({ pathname: '/vehicle/[id]', params: { id: vehicle.id } })}
        style={styles.rowPress}
      >
        <IconCircle icon={serviceTypeIcon(reminder.category)} color={iconColor} />
        <View style={{ flex: 1, minWidth: 0 }}>
          <View style={styles.rowHeader}>
            <Text style={styles.rowTitle} numberOfLines={1}>
              {reminder.title}
            </Text>
            <DueBadge state={state} />
          </View>
          <Text style={styles.rowMeta} numberOfLines={1}>
            {dueSummary({
              dueDate: reminder.dueDate,
              dueMileage: reminder.dueMileage,
              currentMileage: vehicle.mileage,
              today: todayIso(),
            })}
            {reminder.recurrenceType !== 'none' ? ' · recurring' : ''}
          </Text>
          <Text style={[styles.rowVehicle, { color: reminderAccent(state) }]} numberOfLines={1}>
            {vehicle.nickname}
          </Text>
        </View>
        <Ionicons name="chevron-forward" size={16} color={palette.text.tertiary} />
      </Pressable>
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
  const [filter, setFilter] = useState<'upcoming' | 'all'>('upcoming');

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
  const showCompleted = filter === 'all';

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
        <SegmentedControl
          options={[
            { value: 'upcoming', label: 'Upcoming' },
            { value: 'all', label: 'All' },
          ]}
          value={filter}
          onChange={(v) => setFilter(v === 'all' ? 'all' : 'upcoming')}
        />

        {!hasAny && (
          <EmptyState
            title="Nothing scheduled"
            message="Create reminders for oil changes, registration, insurance — anything your car needs on a schedule."
            action={<Button title="New reminder" onPress={() => router.push('/reminder/add')} />}
          />
        )}

        {hasAny && filter === 'upcoming' && active.length === 0 && (
          <EmptyState title="No upcoming reminders" message="Completed items live under All." />
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

        {showCompleted && completed.length > 0 && (
          <>
            <SectionHeader title="Completed" />
            <View style={styles.group}>
              {completed.map((r) => (
                <Card key={r.id} style={styles.completedCard}>
                  <Text style={styles.rowTitle} numberOfLines={1}>
                    {r.title}
                  </Text>
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
  rowCard: { gap: spacing.md, paddingVertical: spacing.md, paddingHorizontal: spacing.md },
  rowPress: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  rowHeader: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, minWidth: 0 },
  rowTitle: {
    color: palette.text.primary,
    fontSize: typography.bodyEmphasis.size,
    fontWeight: typography.bodyEmphasis.weight,
    flex: 1,
    flexShrink: 1,
  },
  rowMeta: { color: palette.text.tertiary, fontSize: typography.meta.size, marginTop: 2 },
  rowVehicle: { fontSize: typography.meta.size, marginTop: 2, fontWeight: '600' },
  doneButton: { paddingVertical: 8, paddingHorizontal: spacing.md },
  completedCard: { opacity: 0.6, paddingVertical: spacing.md },
});
