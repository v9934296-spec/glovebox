import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React, { useMemo } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import {
  Button,
  Card,
  DueBadge,
  EmptyState,
  IconCircle,
  kindAccent,
  ListRow,
  MetricCard,
  Screen,
  SectionHeader,
  serviceTypeIcon,
  VehicleHeroCard,
} from '@/components/ui';
import { useAllServiceRecords, useReminders, useVehicles } from '@/lib/db/hooks';
import { dueSummary, reminderDueState, todayIso, type DueState } from '@/lib/domain/due';
import { formatMoney, summarizeExpenses } from '@/lib/domain/expenses';
import { healthScore } from '@/lib/domain/healthScore';
import { serviceTypeDef, serviceTypeLabel } from '@/lib/domain/serviceTypes';
import { palette, spacing, typography } from '@/lib/theme';

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
  const hero = vehicles[0];
  const heroHealth = useMemo(() => {
    if (!hero) return null;
    const records = allRecords.filter((r) => r.vehicleId === hero.id);
    const reminders = activeReminders.filter((r) => r.vehicleId === hero.id);
    return healthScore({ vehicle: hero, records, reminders, today });
  }, [hero, allRecords, activeReminders, today]);

  if (vehicles.length === 0) {
    return (
      <Screen>
        <EmptyState
          title="Welcome to Glovebox"
          message="Your car's memory, maintenance plan, and repair history in one app. Add your first vehicle to get started."
          action={<Button title="Add your vehicle" onPress={() => router.push('/vehicle/add')} />}
        />
      </Screen>
    );
  }

  return (
    <Screen style={{ padding: 0 }}>
      <ScrollView contentContainerStyle={{ padding: spacing.screenPadding, paddingBottom: spacing['2xl'] }}>
        {hero != null && heroHealth != null && (
          <VehicleHeroCard
            photoUri={hero.photoUri}
            title={hero.nickname}
            subtitle={`${hero.year} ${hero.make} ${hero.model}`}
            meta={
              <Text style={styles.heroMileage}>{hero.mileage.toLocaleString()} mi</Text>
            }
            health={{ score: heroHealth.score, label: heroHealth.label }}
            cta={{ label: 'View Garage', onPress: () => router.push('/garage') }}
          />
        )}

        <SectionHeader
          title="Needs attention"
          right={
            <Pressable onPress={() => router.push('/reminders')}>
              <Text style={styles.link}>All reminders</Text>
            </Pressable>
          }
        />
        {attention.length === 0 ? (
          <Card>
            <View style={styles.allGood}>
              <Ionicons name="checkmark-circle-outline" size={20} color={palette.status.ok} />
              <Text style={styles.allGoodText}>Nothing overdue. You're on top of it.</Text>
            </View>
          </Card>
        ) : (
          <View style={{ gap: spacing.sm }}>
            {attention.map(({ reminder, vehicle, state }) => (
              <Pressable
                key={reminder.id}
                onPress={() => router.push({ pathname: '/vehicle/[id]', params: { id: vehicle.id } })}
              >
                <Card style={styles.attentionCard}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.attentionTitle}>{reminder.title}</Text>
                    <Text style={styles.attentionMeta}>
                      {vehicle.nickname} ·{' '}
                      {dueSummary({
                        dueDate: reminder.dueDate,
                        dueMileage: reminder.dueMileage,
                        currentMileage: vehicle.mileage,
                        today,
                      })}
                    </Text>
                  </View>
                  <DueBadge state={state} />
                </Card>
              </Pressable>
            ))}
          </View>
        )}

        <SectionHeader title="Overview" />
        <View style={styles.statRow}>
          <MetricCard label="Total Spent" value={formatMoney(expenses.lifetimeTotal)} />
          <MetricCard label="Services" value={String(allRecords.length)} />
        </View>

        {recentRecords.length > 0 && (
          <>
            <SectionHeader title="Recent services" />
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
          </>
        )}

        <View style={styles.quickActions}>
          <Button title="Log service" onPress={() => router.push('/service/add')} style={{ flex: 1 }} />
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

const styles = StyleSheet.create({
  statRow: { flexDirection: 'row', gap: spacing.md },
  link: { color: palette.accent.primary, fontSize: typography.caption.size, fontWeight: '600' },
  allGood: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  allGoodText: { color: palette.text.secondary, fontSize: typography.body.size, flex: 1 },
  attentionCard: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingVertical: spacing.md },
  attentionTitle: {
    color: palette.text.primary,
    fontSize: typography.bodyEmphasis.size,
    fontWeight: typography.bodyEmphasis.weight,
  },
  attentionMeta: { color: palette.text.tertiary, fontSize: typography.meta.size, marginTop: 2 },
  heroMileage: { color: palette.text.secondary, fontSize: typography.body.size },
  rowPad: { paddingVertical: spacing.sm },
  rowDivider: {
    borderBottomWidth: 1,
    borderBottomColor: palette.border.subtle,
  },
  quickActions: { flexDirection: 'row', gap: spacing.md, marginTop: spacing.xl },
});
