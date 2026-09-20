import { useRouter } from 'expo-router';
import React, { useMemo } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { DueWord, Mute, Rule, ShopScreen, SolidButton, TextButton } from '@/components/shop';
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

  const groups = useMemo(() => {
    const vehicleById = new Map(vehicles.map((v) => [v.id, v]));
    const out: Record<'overdue' | 'due_soon' | 'upcoming', Entry[]> = {
      overdue: [],
      due_soon: [],
      upcoming: [],
    };
    for (const reminder of active) {
      const vehicle = vehicleById.get(reminder.vehicleId);
      if (!vehicle) continue;
      const state = reminderDueState(reminder, vehicle.mileage, today);
      if (state === 'no_due') out.upcoming.push({ reminder, vehicle, state: 'upcoming' });
      else out[state].push({ reminder, vehicle, state });
    }
    return out;
  }, [active, vehicles, today]);

  if (vehicles.length === 0) {
    return (
      <ShopScreen>
        <View style={styles.empty}>
          <Text style={styles.emptyTitle}>No cars, no reminders</Text>
          <TextButton label="Go to Garage" onPress={() => router.push('/garage')} />
        </View>
      </ShopScreen>
    );
  }

  const empty = active.length === 0 && completed.length === 0;

  return (
    <ShopScreen style={{ padding: 0 }}>
      <ScrollView contentContainerStyle={styles.page}>
        <SolidButton title="New reminder" onPress={() => router.push('/reminder/add')} />

        {empty ? (
          <Mute>Oil, registration, insurance — anything on a calendar or an odometer.</Mute>
        ) : (
          <>
            <Group title="Overdue" entries={groups.overdue} />
            <Group title="Soon" entries={groups.due_soon} />
            <Group title="Later" entries={groups.upcoming} />
            {completed.length > 0 && (
              <View style={{ gap: spacing.md }}>
                <Text style={styles.groupTitle}>Done</Text>
                {completed.map((r) => (
                  <Text key={r.id} style={styles.doneLine}>
                    {r.title}
                    {r.completedAt ? ` · ${r.completedAt.slice(0, 10)}` : ''}
                  </Text>
                ))}
              </View>
            )}
          </>
        )}
      </ScrollView>
    </ShopScreen>
  );
}

function Group({ title, entries }: { title: string; entries: Entry[] }) {
  const router = useRouter();
  const today = todayIso();
  if (entries.length === 0) return null;
  return (
    <View>
      <Text style={styles.groupTitle}>{title}</Text>
      {entries.map((e, i) => (
        <View key={e.reminder.id}>
          {i > 0 ? <Rule /> : null}
          <View style={styles.row}>
            <Pressable
              style={{ flex: 1, gap: 2 }}
              onPress={() => router.push({ pathname: '/vehicle/[id]', params: { id: e.vehicle.id } })}
            >
              <View style={styles.titleRow}>
                <Text style={styles.title}>{e.reminder.title}</Text>
                <DueWord state={e.state} />
              </View>
              <Mute>
                {`${e.vehicle.nickname} · ${dueSummary({
                  dueDate: e.reminder.dueDate,
                  dueMileage: e.reminder.dueMileage,
                  currentMileage: e.vehicle.mileage,
                  today,
                })}`}
              </Mute>
            </Pressable>
            <TextButton
              label="Done"
              tone="mute"
              onPress={() => completeReminder(e.reminder, e.vehicle.mileage)}
            />
          </View>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  page: {
    padding: spacing.screenPadding,
    paddingBottom: spacing['2xl'],
    gap: spacing.section,
  },
  groupTitle: {
    color: palette.text.tertiary,
    fontSize: typography.overline.size,
    fontWeight: '500',
    marginBottom: spacing.sm,
  },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingVertical: spacing.md },
  titleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.md },
  title: { color: palette.text.primary, fontSize: typography.bodyEmphasis.size, fontWeight: '600', flex: 1 },
  doneLine: { color: palette.text.tertiary, fontSize: typography.caption.size, paddingVertical: 4 },
  empty: { flex: 1, justifyContent: 'center', padding: spacing.screenPadding, gap: spacing.lg },
  emptyTitle: { color: palette.text.primary, fontSize: typography.hero.size, fontWeight: '600' },
});