import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React from 'react';
import { FlatList, Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { Button, Card, DueBadge, EmptyState, Screen, StatusBadge, healthTone } from '@/components/ui';
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

  const subtitle = `${vehicle.year} ${vehicle.make} ${vehicle.model}${vehicle.trim ? ` ${vehicle.trim}` : ''}`;

  return (
    <Pressable
      accessibilityRole="button"
      onPress={() => router.push({ pathname: '/vehicle/[id]', params: { id: vehicle.id } })}
    >
      <Card style={styles.vehicleCard}>
        <View style={styles.row}>
          {vehicle.photoUri ? (
            <Image source={{ uri: vehicle.photoUri }} style={styles.photo} />
          ) : (
            <View style={[styles.photo, styles.photoPlaceholder]}>
              <Ionicons name="car-sport" size={22} color={palette.text.tertiary} />
            </View>
          )}
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text style={styles.nickname} numberOfLines={1}>
              {vehicle.nickname}
            </Text>
            <Text style={styles.subtitle} numberOfLines={1}>
              {subtitle}
            </Text>
            <Text style={styles.mileage}>{vehicle.mileage.toLocaleString()} mi</Text>
          </View>
          <View style={styles.healthCol}>
            <Text style={styles.healthValue}>{health.score}</Text>
            <StatusBadge label={health.label} tone={healthTone(health.label)} />
          </View>
          <Ionicons name="chevron-forward" size={16} color={palette.text.tertiary} />
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
        contentContainerStyle={{ padding: spacing.screenPadding, gap: spacing.sm, paddingBottom: spacing['2xl'] }}
        renderItem={({ item }) => <VehicleCard vehicle={item} />}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  vehicleCard: { gap: spacing.md, paddingVertical: spacing.md, paddingHorizontal: spacing.md },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  photo: { width: 56, height: 56, borderRadius: radius.md },
  photoPlaceholder: {
    backgroundColor: palette.bg.surfaceRaised,
    borderWidth: 1,
    borderColor: palette.border.subtle,
    alignItems: 'center',
    justifyContent: 'center',
  },
  nickname: {
    color: palette.text.primary,
    fontSize: typography.bodyEmphasis.size,
    fontWeight: typography.bodyEmphasis.weight,
  },
  subtitle: { color: palette.text.secondary, fontSize: typography.meta.size, marginTop: 2 },
  mileage: { color: palette.text.tertiary, fontSize: typography.meta.size, marginTop: 2 },
  healthCol: { alignItems: 'flex-end', gap: 4 },
  healthValue: {
    color: palette.accent.primary,
    fontSize: typography.h3.size,
    fontWeight: '700',
  },
  nextDueRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  nextDueText: { color: palette.text.secondary, fontSize: typography.meta.size, flex: 1 },
});
