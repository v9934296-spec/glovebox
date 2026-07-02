import { Ionicons } from '@expo/vector-icons';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import React, { useState } from 'react';
import { Alert, Image, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { Button, Card, DueBadge, EmptyState, Screen, SectionHeader, StatTile } from '@/components/ui';
import { useReminders, useServiceRecords, useVehicle } from '@/lib/db/hooks';
import { completeReminder, deleteReminder } from '@/lib/db/reminderRepo';
import { deleteServiceRecord } from '@/lib/db/serviceRepo';
import { deleteVehicle, updateVehicleMileage } from '@/lib/db/vehicleRepo';
import { dueSummary, reminderDueState, todayIso } from '@/lib/domain/due';
import { formatMoney, summarizeExpenses } from '@/lib/domain/expenses';
import { healthScore } from '@/lib/domain/healthScore';
import { serviceTypeLabel } from '@/lib/domain/serviceTypes';
import { palette, radius, spacing, typography } from '@/lib/theme';

const TABS = ['Overview', 'Maintenance', 'Expenses', 'Reminders'] as const;
type Tab = (typeof TABS)[number];

export default function VehicleDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const vehicle = useVehicle(id);
  const records = useServiceRecords(id);
  const reminders = useReminders({ vehicleId: id, status: 'active' });
  const [tab, setTab] = useState<Tab>('Overview');
  const [mileageDraft, setMileageDraft] = useState<string | null>(null);

  if (!vehicle) {
    return (
      <Screen>
        <EmptyState title="Vehicle not found" message="It may have been deleted." />
      </Screen>
    );
  }

  const today = todayIso();
  const health = healthScore({ vehicle, records, reminders, today });
  const expenses = summarizeExpenses(records, today);

  function commitMileage() {
    if (mileageDraft == null || !vehicle) return;
    const n = Number(mileageDraft.replace(/[^\d]/g, ''));
    if (Number.isFinite(n) && n >= 0 && n !== vehicle.mileage) {
      updateVehicleMileage(vehicle.id, n);
    }
    setMileageDraft(null);
  }

  function confirmDeleteVehicle() {
    if (!vehicle) return;
    Alert.alert('Delete vehicle', `Delete ${vehicle.nickname} and all its records? This cannot be undone.`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: () => {
          deleteVehicle(vehicle.id);
          router.back();
        },
      },
    ]);
  }

  return (
    <Screen style={{ padding: 0 }}>
      <Stack.Screen options={{ title: vehicle.nickname }} />
      <ScrollView contentContainerStyle={{ padding: spacing.screenPadding, paddingBottom: spacing['2xl'] }}>
        <View style={styles.header}>
          {vehicle.photoUri ? (
            <Image source={{ uri: vehicle.photoUri }} style={styles.photo} />
          ) : (
            <View style={[styles.photo, styles.photoPlaceholder]}>
              <Ionicons name="car-sport" size={32} color={palette.text.tertiary} />
            </View>
          )}
          <View style={{ flex: 1, marginLeft: spacing.md }}>
            <Text style={styles.title}>
              {vehicle.year} {vehicle.make} {vehicle.model}
            </Text>
            {vehicle.trim != null && <Text style={styles.subtitle}>{vehicle.trim}</Text>}
            <Pressable onPress={() => setMileageDraft(String(vehicle.mileage))}>
              {mileageDraft == null ? (
                <Text style={styles.mileage}>
                  {vehicle.mileage.toLocaleString()} mi <Text style={styles.mileageEdit}>edit</Text>
                </Text>
              ) : (
                <TextInput
                  style={styles.mileageInput}
                  value={mileageDraft}
                  onChangeText={setMileageDraft}
                  keyboardType="number-pad"
                  autoFocus
                  onBlur={commitMileage}
                  onSubmitEditing={commitMileage}
                />
              )}
            </Pressable>
          </View>
          <View style={styles.healthPill}>
            <Text style={styles.healthValue}>{health.score}</Text>
            <Text style={styles.healthLabel}>{health.label}</Text>
          </View>
        </View>

        <View style={styles.tabs}>
          {TABS.map((t) => (
            <Pressable key={t} onPress={() => setTab(t)} style={[styles.tab, tab === t && styles.tabActive]}>
              <Text style={[styles.tabText, tab === t && styles.tabTextActive]}>{t}</Text>
            </Pressable>
          ))}
        </View>

        {tab === 'Overview' && (
          <View>
            <View style={styles.statRow}>
              <StatTile label="This year" value={formatMoney(expenses.yearTotal)} />
              <StatTile label="Lifetime" value={formatMoney(expenses.lifetimeTotal)} />
              <StatTile
                label="Cost / mile"
                value={expenses.costPerMile != null ? `$${expenses.costPerMile.toFixed(2)}` : '—'}
              />
            </View>
            {health.reasons.length > 0 && (
              <Card style={{ marginTop: spacing.md }}>
                <Text style={styles.cardTitle}>Health notes</Text>
                {health.reasons.map((reason) => (
                  <Text key={reason} style={styles.reasonText}>
                    • {reason}
                  </Text>
                ))}
              </Card>
            )}
            <SectionHeader title="Details" />
            <Card>
              <DetailRow label="License plate" value={vehicle.licensePlate ?? '—'} />
              <DetailRow label="VIN" value={vehicle.vin ?? '—'} />
              <DetailRow label="Purchased" value={vehicle.purchaseDate ?? '—'} />
              <DetailRow
                label="Purchase price"
                value={vehicle.purchasePrice != null ? formatMoney(vehicle.purchasePrice) : '—'}
                last
              />
            </Card>
            <Button
              title="Delete vehicle"
              variant="danger"
              onPress={confirmDeleteVehicle}
              style={{ marginTop: spacing.xl }}
            />
          </View>
        )}

        {tab === 'Maintenance' && (
          <View>
            <Button
              title="Log service"
              onPress={() => router.push({ pathname: '/service/add', params: { vehicleId: vehicle.id } })}
            />
            {records.length === 0 ? (
              <EmptyState
                title="No service history"
                message="Log your first oil change, repair, or registration to start building history."
              />
            ) : (
              <View style={{ gap: spacing.sm, marginTop: spacing.lg }}>
                {records.map((r) => (
                  <Card key={r.id}>
                    <View style={styles.recordHeader}>
                      <Text style={styles.recordType}>{serviceTypeLabel(r.serviceType)}</Text>
                      <Text style={styles.recordCost}>{r.cost != null ? formatMoney(r.cost) : ''}</Text>
                    </View>
                    <Text style={styles.recordMeta}>
                      {r.date}
                      {r.mileage != null ? ` · ${r.mileage.toLocaleString()} mi` : ''}
                      {r.shopName ? ` · ${r.shopName}` : ''}
                    </Text>
                    {r.notes != null && r.notes !== '' && <Text style={styles.recordNotes}>{r.notes}</Text>}
                    {(r.nextDueDate || r.nextDueMileage != null) && (
                      <Text style={styles.recordNext}>
                        Next due:{' '}
                        {dueSummary({
                          dueDate: r.nextDueDate,
                          dueMileage: r.nextDueMileage,
                          currentMileage: vehicle.mileage,
                          today,
                        })}
                      </Text>
                    )}
                    <Pressable
                      onPress={() =>
                        Alert.alert('Delete record', 'Remove this service record?', [
                          { text: 'Cancel', style: 'cancel' },
                          { text: 'Delete', style: 'destructive', onPress: () => deleteServiceRecord(r.id) },
                        ])
                      }
                      style={styles.recordDelete}
                    >
                      <Ionicons name="trash-outline" size={16} color={palette.text.tertiary} />
                    </Pressable>
                  </Card>
                ))}
              </View>
            )}
          </View>
        )}

        {tab === 'Expenses' && (
          <View>
            <View style={styles.statRow}>
              <StatTile label="This month" value={formatMoney(expenses.monthTotal)} />
              <StatTile label="This year" value={formatMoney(expenses.yearTotal)} />
            </View>
            <View style={[styles.statRow, { marginTop: spacing.md }]}>
              <StatTile label="Maintenance" value={formatMoney(expenses.maintenanceTotal)} />
              <StatTile label="Repairs" value={formatMoney(expenses.repairTotal)} />
              <StatTile label="Admin" value={formatMoney(expenses.adminTotal)} />
            </View>
            <SectionHeader title="By category" />
            {expenses.byCategory.length === 0 ? (
              <EmptyState title="No expenses yet" message="Costs from service records show up here." />
            ) : (
              <Card>
                {expenses.byCategory.map((c, i) => (
                  <DetailRow
                    key={c.serviceType}
                    label={serviceTypeLabel(c.serviceType)}
                    value={formatMoney(c.total)}
                    last={i === expenses.byCategory.length - 1}
                  />
                ))}
              </Card>
            )}
          </View>
        )}

        {tab === 'Reminders' && (
          <View>
            <Button
              title="New reminder"
              onPress={() => router.push({ pathname: '/reminder/add', params: { vehicleId: vehicle.id } })}
            />
            {reminders.length === 0 ? (
              <EmptyState
                title="No reminders"
                message="Set up oil change, registration, or insurance reminders so nothing slips."
              />
            ) : (
              <View style={{ gap: spacing.sm, marginTop: spacing.lg }}>
                {reminders.map((r) => {
                  const state = reminderDueState(r, vehicle.mileage, today);
                  return (
                    <Card key={r.id}>
                      <View style={styles.recordHeader}>
                        <Text style={styles.recordType}>{r.title}</Text>
                        <DueBadge state={state} />
                      </View>
                      <Text style={styles.recordMeta}>
                        {dueSummary({
                          dueDate: r.dueDate,
                          dueMileage: r.dueMileage,
                          currentMileage: vehicle.mileage,
                          today,
                        })}
                        {r.recurrenceType !== 'none' ? ' · recurring' : ''}
                      </Text>
                      <View style={styles.reminderActions}>
                        <Button
                          title="Mark done"
                          variant="secondary"
                          onPress={() => completeReminder(r, vehicle.mileage)}
                          style={{ flex: 1 }}
                        />
                        <Pressable
                          onPress={() =>
                            Alert.alert('Delete reminder', `Delete "${r.title}"?`, [
                              { text: 'Cancel', style: 'cancel' },
                              { text: 'Delete', style: 'destructive', onPress: () => deleteReminder(r.id) },
                            ])
                          }
                          style={styles.reminderDelete}
                        >
                          <Ionicons name="trash-outline" size={18} color={palette.text.tertiary} />
                        </Pressable>
                      </View>
                    </Card>
                  );
                })}
              </View>
            )}
          </View>
        )}
      </ScrollView>
    </Screen>
  );
}

function DetailRow({ label, value, last }: { label: string; value: string; last?: boolean }) {
  return (
    <View style={[styles.detailRow, !last && styles.detailRowBorder]}>
      <Text style={styles.detailLabel}>{label}</Text>
      <Text style={styles.detailValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center' },
  photo: { width: 72, height: 72, borderRadius: radius.lg },
  photoPlaceholder: {
    backgroundColor: palette.bg.surface,
    borderWidth: 1,
    borderColor: palette.border.subtle,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: { color: palette.text.primary, fontSize: typography.h3.size, fontWeight: typography.h3.weight },
  subtitle: { color: palette.text.secondary, fontSize: typography.caption.size },
  mileage: { color: palette.text.secondary, fontSize: typography.body.size, marginTop: spacing.xs },
  mileageEdit: { color: palette.accent.primary, fontSize: typography.caption.size },
  mileageInput: {
    color: palette.text.primary,
    borderBottomWidth: 1,
    borderBottomColor: palette.accent.primary,
    fontSize: typography.body.size,
    paddingVertical: 2,
    minWidth: 90,
  },
  healthPill: { alignItems: 'center' },
  healthValue: { color: palette.accent.primary, fontSize: typography.h1.size, fontWeight: typography.h1.weight },
  healthLabel: { color: palette.text.tertiary, fontSize: 10 },
  tabs: {
    flexDirection: 'row',
    backgroundColor: palette.bg.surface,
    borderRadius: radius.md,
    padding: 3,
    marginVertical: spacing.lg,
  },
  tab: { flex: 1, alignItems: 'center', paddingVertical: spacing.sm, borderRadius: radius.sm },
  tabActive: { backgroundColor: palette.bg.surfaceRaised },
  tabText: { color: palette.text.tertiary, fontSize: typography.caption.size, fontWeight: '500' },
  tabTextActive: { color: palette.text.primary },
  statRow: { flexDirection: 'row', gap: spacing.md },
  cardTitle: {
    color: palette.text.primary,
    fontSize: typography.bodyEmphasis.size,
    fontWeight: typography.bodyEmphasis.weight,
    marginBottom: spacing.sm,
  },
  reasonText: { color: palette.text.secondary, fontSize: typography.caption.size, lineHeight: 20 },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: spacing.sm,
  },
  detailRowBorder: { borderBottomWidth: 1, borderBottomColor: palette.border.subtle },
  detailLabel: { color: palette.text.secondary, fontSize: typography.body.size },
  detailValue: { color: palette.text.primary, fontSize: typography.body.size, fontWeight: '500' },
  recordHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  recordType: {
    color: palette.text.primary,
    fontSize: typography.bodyEmphasis.size,
    fontWeight: typography.bodyEmphasis.weight,
  },
  recordCost: { color: palette.accent.primary, fontSize: typography.bodyEmphasis.size, fontWeight: '600' },
  recordMeta: { color: palette.text.tertiary, fontSize: typography.caption.size, marginTop: 2 },
  recordNotes: { color: palette.text.secondary, fontSize: typography.caption.size, marginTop: spacing.sm },
  recordNext: { color: palette.status.dueSoon, fontSize: typography.caption.size, marginTop: spacing.sm },
  recordDelete: { position: 'absolute', right: spacing.md, bottom: spacing.md, padding: spacing.xs },
  reminderActions: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, marginTop: spacing.md },
  reminderDelete: { padding: spacing.sm },
});
