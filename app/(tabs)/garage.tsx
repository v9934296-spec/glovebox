import { Ionicons } from '@expo/vector-icons';
import { Link, useRouter } from 'expo-router';
import React from 'react';
import { FlatList, Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { Button, Card, DueBadge, EmptyState, Screen } from '@/components/ui';
import { useReminders, useServiceRecords, useVehicles } from '@/lib/db/hooks';
import { dueSummary, reminderDueState, todayIso, type DueState } from '@/lib/domain/due';
import { healthScore } from '@/lib/domain/healthScore';
import type { Vehicle } from '@/lib/domain/types';
import { palette, radius, spacing, typography } from '@/lib/theme';

function VehicleCard({ vehicle }: { vehicle: Vehicle }) {
  const router = useRouter();
  const reminders = useReminders({ vehicleId: vehicle.id, status: 'active' });
  const records = useServiceRecords(vehicle.id);
  const today = todayIso();
  const health = healthScore({ vehicle, records, reminders, today });

  let nextDue: { title: string; state: DueState; summary: string } | null = null;
  for (const r of reminders) {
    const state = reminderDueState(r, vehicle.mileage, today);
    if (state === 'no_due') continue;
    const rank = { overdue: 0, due_soon: 1, upcoming: 2, no_due: 3 }[state];
    const currentRank = nextDue ? { overdue: 0, due_soon: 1, upcoming: 2, no_due: 3 }[nextDue.state] : 4;
    if (rank < currentRank) {
      nextDue = {
        title: r.title,
        state,
        summary: dueSummary({ dueDate: r.dueDate, dueMileage: r.dueMileage, currentMileage: vehicle.mileage, today }),
      };
    }
  }

  return (
    <Pressable onPress={() => router.push({ pathname: '/vehicle/[id]', params: { id: vehicle.id } })}>
      <Card style={styles.vehicleCard}>
        <View style={styles.row}>
          {vehicle.photoUri ? (
            <Image source={{ uri: vehicle.photoUri }} style={styles.photo} />
          ) : (
            <View style={[styles.photo, styles.photoPlaceholder]}>
              <Ionicons name="car-sport" size={28} color={palette.text.tertiary} />
            </View>
          )}
          <View style={{ flex: 1, marginLeft: spacing.md }}>
            <Text style={styles.nickname}>{vehicle.nickname}</Text>
            <Text style={styles.subtitle}>
              {vehicle.year} {vehicle.make} {vehicle.model}
              {vehicle.trim ? ` ${vehicle.trim}` : ''}
            </Text>
            <Text style={styles.mileage}>{vehicle.mileage.toLocaleString()} mi</Text>
          </View>
          <View style={styles.healthPill}>
            <Text style={styles.healthValue}>{health.score}</Text>
            <Text style={styles.healthLabel}>{health.label}</Text>
          </View>
        </View>
        {nextDue && (
          <View style={styles.nextDueRow}>
            <DueBadge state={nextDue.state} />
            <Text style={styles.nextDueText} numberOfLines={1}>
              {nextDue.title} · {nextDue.summary}
            </Text>
          </View>
        )}
      </Card>
    </Pressable>
  );
}

export default function GarageScreen() {
  const vehicles = useVehicles();
  const router = useRouter();

  if (vehicles.length === 0) {
    return (
      <Screen>
        <EmptyState
          title="Your garage is empty"
          message="Add your first vehicle to start tracking maintenance, costs, and reminders."
          action={<Button title="Add a vehicle" onPress={() => router.push('/vehicle/add')} />}
        />
      </Screen>
    );
  }

  return (
    <Screen style={{ padding: 0 }}>
      <FlatList
        data={vehicles}
        keyExtractor={(v) => v.id}
        contentContainerStyle={{ padding: spacing.screenPadding, gap: spacing.md }}
        renderItem={({ item }) => <VehicleCard vehicle={item} />}
        ListFooterComponent={
          <Link href="/vehicle/add" asChild>
            <Pressable style={styles.addRow}>
              <Ionicons name="add-circle-outline" size={20} color={palette.accent.primary} />
              <Text style={styles.addText}>Add another vehicle</Text>
            </Pressable>
          </Link>
        }
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  vehicleCard: { gap: spacing.md },
  row: { flexDirection: 'row', alignItems: 'center' },
  photo: { width: 64, height: 64, borderRadius: radius.md },
  photoPlaceholder: {
    backgroundColor: palette.bg.surfaceRaised,
    alignItems: 'center',
    justifyContent: 'center',
  },
  nickname: {
    color: palette.text.primary,
    fontSize: typography.h3.size,
    fontWeight: typography.h3.weight,
  },
  subtitle: { color: palette.text.secondary, fontSize: typography.caption.size, marginTop: 2 },
  mileage: { color: palette.text.tertiary, fontSize: typography.caption.size, marginTop: 2 },
  healthPill: { alignItems: 'center', marginLeft: spacing.sm },
  healthValue: {
    color: palette.accent.primary,
    fontSize: typography.h2.size,
    fontWeight: typography.h2.weight,
  },
  healthLabel: { color: palette.text.tertiary, fontSize: 10 },
  nextDueRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  nextDueText: { color: palette.text.secondary, fontSize: typography.caption.size, flex: 1 },
  addRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.lg,
  },
  addText: { color: palette.accent.primary, fontSize: typography.bodyEmphasis.size, fontWeight: '600' },
});
