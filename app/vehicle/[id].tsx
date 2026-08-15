import { Ionicons } from '@expo/vector-icons';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import React, { useState } from 'react';
import { Alert, Image, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
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
  StatTile,
  VehicleHeroCard,
} from '@/components/ui';
import { useReminders, useServiceRecords, useVehicle } from '@/lib/db/hooks';
import { completeReminder, deleteReminder } from '@/lib/db/reminderRepo';
import { deleteServiceRecord } from '@/lib/db/serviceRepo';
import { deleteVehicle, updateVehicleMileage, updateVehicleRecalls, updateVehicleVinDecode } from '@/lib/db/vehicleRepo';
import { dueSummary, reminderDueState, todayIso } from '@/lib/domain/due';
import { formatMoney, summarizeExpenses } from '@/lib/domain/expenses';
import { healthScore } from '@/lib/domain/healthScore';
import { serviceTypeDef, serviceTypeLabel } from '@/lib/domain/serviceTypes';
import { decodedVinSummary, recallStatus } from '@/lib/domain/vin';
import { canExportReport } from '@/lib/monetization/entitlements';
import { useIsPro } from '@/lib/monetization/purchases';
import { shareVehicleReport } from '@/lib/report/export';
import { palette, radius, spacing, typography } from '@/lib/theme';
import { checkRecalls, decodeVin, vinAvailability } from '@/lib/vin/client';

export default function VehicleDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const vehicle = useVehicle(id);
  const records = useServiceRecords(id);
  const reminders = useReminders({ vehicleId: id, status: 'active' });
  const [mileageDraft, setMileageDraft] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);
  const [decoding, setDecoding] = useState(false);
  const [checkingRecalls, setCheckingRecalls] = useState(false);
  const isPro = useIsPro();

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
  const recallState = recallStatus({ checkedAt: vehicle.recallCheckedAt, recalls: vehicle.recalls });
  const decodedSummary = vehicle.vinDecoded ? decodedVinSummary(vehicle.vinDecoded) : null;
  const ymm = `${vehicle.year} ${vehicle.make} ${vehicle.model}${vehicle.trim ? ` ${vehicle.trim}` : ''}`;
  const maintenanceStatus = reminders
    .map((reminder) => ({
      reminder,
      state: reminderDueState(reminder, vehicle.mileage, today),
    }))
    .filter((e) => e.state === 'overdue' || e.state === 'due_soon')
    .sort((a, b) => {
      const rank = { overdue: 0, due_soon: 1, upcoming: 2, no_due: 3 };
      return rank[a.state] - rank[b.state];
    });

  function commitMileage() {
    if (mileageDraft == null || !vehicle) return;
    const n = Number(mileageDraft.replace(/[^\d]/g, ''));
    if (Number.isFinite(n) && n >= 0 && n !== vehicle.mileage) {
      updateVehicleMileage(vehicle.id, n);
    }
    setMileageDraft(null);
  }

  async function exportReport() {
    if (!vehicle || exporting) return;
    const gate = canExportReport(isPro);
    if (!gate.allowed) {
      Alert.alert('Glovebox Pro', gate.reason, [
        { text: 'Not now', style: 'cancel' },
        { text: 'See Pro', onPress: () => router.push('/paywall') },
      ]);
      return;
    }
    setExporting(true);
    try {
      await shareVehicleReport(vehicle, records, reminders);
    } catch (e: unknown) {
      Alert.alert('Export failed', e instanceof Error ? e.message : 'Try again later.');
    } finally {
      setExporting(false);
    }
  }

  async function onDecodeVin() {
    if (!vehicle?.vin || decoding) return;
    const availability = vinAvailability();
    if (!availability.available) {
      Alert.alert('VIN decode unavailable', availability.reason);
      return;
    }
    setDecoding(true);
    try {
      const decoded = await decodeVin(vehicle.vin);
      updateVehicleVinDecode(vehicle.id, vehicle.vin, decoded);
      if (!decoded.decodable) {
        Alert.alert('Could not decode', 'This VIN did not return recognizable vehicle data.');
      }
    } catch (e) {
      Alert.alert('Decode failed', e instanceof Error ? e.message : 'Try again later.');
    } finally {
      setDecoding(false);
    }
  }

  async function onCheckRecalls() {
    if (!vehicle || checkingRecalls) return;
    const availability = vinAvailability();
    if (!availability.available) {
      Alert.alert('Recall check unavailable', availability.reason);
      return;
    }
    setCheckingRecalls(true);
    try {
      const recalls = await checkRecalls(vehicle.make, vehicle.model, vehicle.year);
      updateVehicleRecalls(vehicle.id, recalls);
    } catch (e) {
      Alert.alert('Recall check failed', e instanceof Error ? e.message : 'Try again later.');
    } finally {
      setCheckingRecalls(false);
    }
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
        <VehicleHeroCard
          photoUri={vehicle.photoUri}
          title={vehicle.nickname}
          subtitle={ymm}
          health={{ score: health.score, label: health.label }}
          meta={
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
          }
        />

        <SectionHeader title="Overview" />
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
        <Card style={{ marginTop: spacing.md }}>
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
          title="Decode VIN"
          variant="secondary"
          loading={decoding}
          disabled={!vehicle.vin}
          onPress={() => void onDecodeVin()}
          style={{ marginTop: spacing.md }}
        />
        {decodedSummary != null && (
          <Text style={styles.decodedHint}>Decoded as {decodedSummary}</Text>
        )}

        <SectionHeader title="Maintenance status" />
        {maintenanceStatus.length === 0 ? (
          <Card>
            <View style={styles.allGood}>
              <Ionicons name="checkmark-circle-outline" size={20} color={palette.status.ok} />
              <Text style={styles.allGoodText}>Nothing overdue. You're on top of it.</Text>
            </View>
          </Card>
        ) : (
          <View style={{ gap: spacing.sm }}>
            {maintenanceStatus.map(({ reminder, state }) => (
              <Card key={reminder.id} style={styles.attentionCard}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.recordType}>{reminder.title}</Text>
                  <Text style={styles.recordMeta}>
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
            ))}
          </View>
        )}

        <SectionHeader title="Recalls" />
        <Card>
          <DetailRow
            label="Status"
            value={
              recallState === 'unknown'
                ? 'Not checked yet'
                : recallState === 'none'
                  ? `No open recalls · checked ${vehicle.recallCheckedAt?.slice(0, 10) ?? today}`
                  : `${vehicle.recalls.length} open recall${vehicle.recalls.length > 1 ? 's' : ''}`
            }
            last={recallState !== 'open'}
          />
          {recallState === 'open' &&
            vehicle.recalls.map((r, i) => (
              <View key={r.id} style={[styles.recallItem, i === vehicle.recalls.length - 1 && { borderBottomWidth: 0 }]}>
                <Text style={styles.recallComponent}>{r.component ?? 'Recall'}</Text>
                {r.summary != null && <Text style={styles.recordNotes}>{r.summary}</Text>}
                {r.remedy != null && <Text style={styles.recallRemedy}>Remedy: {r.remedy}</Text>}
              </View>
            ))}
        </Card>
        <Button
          title="Check recalls"
          variant="secondary"
          loading={checkingRecalls}
          onPress={() => void onCheckRecalls()}
          style={{ marginTop: spacing.md }}
        />

        <SectionHeader
          title="Upcoming"
          right={
            <Pressable onPress={() => router.push({ pathname: '/reminder/add', params: { vehicleId: vehicle.id } })}>
              <Text style={styles.link}>New reminder</Text>
            </Pressable>
          }
        />
        {reminders.length === 0 ? (
          <EmptyState
            title="No reminders"
            message="Set up oil change, registration, or insurance reminders so nothing slips."
          />
        ) : (
          <View style={{ gap: spacing.sm }}>
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

        <SectionHeader
          title="Service history"
          right={
            <Pressable onPress={() => router.push({ pathname: '/service/add', params: { vehicleId: vehicle.id } })}>
              <Text style={styles.link}>Log service</Text>
            </Pressable>
          }
        />
        {records.length === 0 ? (
          <EmptyState
            title="No service history"
            message="Log your first oil change, repair, or registration to start building history."
          />
        ) : (
          <View style={{ gap: spacing.sm }}>
            {records.map((r) => {
              const kind = serviceTypeDef(r.serviceType).kind;
              const color = kindAccent(kind);
              return (
                <Card key={r.id} style={styles.recordCard}>
                  <ListRow
                    icon={<IconCircle icon={serviceTypeIcon(r.serviceType)} color={color} size={44} />}
                    title={serviceTypeLabel(r.serviceType)}
                    trailing={
                      r.cost != null ? <Text style={styles.recordCost}>{formatMoney(r.cost)}</Text> : undefined
                    }
                  />
                  <View style={styles.recordDetails}>
                    <DetailRow label="Date" value={r.date} />
                    <DetailRow label="Mileage" value={r.mileage != null ? `${r.mileage.toLocaleString()} mi` : '—'} />
                    <DetailRow label="Cost" value={r.cost != null ? formatMoney(r.cost) : '—'} />
                    <DetailRow label="Shop" value={r.shopName ?? '—'} last={!(r.notes != null && r.notes !== '')} />
                    {r.notes != null && r.notes !== '' && <DetailRow label="Notes" value={r.notes} last />}
                  </View>
                  {r.receiptUri != null && r.receiptUri !== '' && (
                    <Image source={{ uri: r.receiptUri }} style={styles.receiptPreview} />
                  )}
                  {(r.nextDueDate || r.nextDueMileage != null) && (
                    <Text style={styles.recordNext}>
                      Reminder ·{' '}
                      {dueSummary({
                        dueDate: r.nextDueDate,
                        dueMileage: r.nextDueMileage,
                        currentMileage: vehicle.mileage,
                        today,
                      })}
                    </Text>
                  )}
                  <View style={styles.recordActions}>
                    <Pressable
                      onPress={() =>
                        router.push({
                          pathname: '/ai/assistant',
                          params: {
                            vehicleId: vehicle.id,
                            serviceLabel: serviceTypeLabel(r.serviceType),
                            ...(r.cost != null ? { cost: String(r.cost) } : {}),
                          },
                        })
                      }
                      style={styles.recordActionBtn}
                    >
                      <Ionicons name="sparkles-outline" size={16} color={palette.text.tertiary} />
                    </Pressable>
                    <Pressable
                      onPress={() =>
                        Alert.alert('Delete record', 'Remove this service record?', [
                          { text: 'Cancel', style: 'cancel' },
                          { text: 'Delete', style: 'destructive', onPress: () => deleteServiceRecord(r.id) },
                        ])
                      }
                      style={styles.recordActionBtn}
                    >
                      <Ionicons name="trash-outline" size={16} color={palette.status.overdue} />
                    </Pressable>
                  </View>
                </Card>
              );
            })}
          </View>
        )}

        <SectionHeader title="Costs" />
        <MetricCard label="Total Spent" value={formatMoney(expenses.lifetimeTotal)} />
        <View style={[styles.statRow, { marginTop: spacing.md }]}>
          <StatTile label="Maintenance" value={formatMoney(expenses.maintenanceTotal)} />
          <StatTile label="Repairs" value={formatMoney(expenses.repairTotal)} />
        </View>
        <View style={[styles.statRow, { marginTop: spacing.md }]}>
          <StatTile
            label="Cost / mile"
            value={expenses.costPerMile != null ? `$${expenses.costPerMile.toFixed(2)}` : '—'}
          />
          <StatTile label="This year" value={formatMoney(expenses.yearTotal)} />
        </View>
        {(expenses.maintenanceTotal > 0 || expenses.repairTotal > 0 || expenses.adminTotal > 0) && (
          <Card style={{ marginTop: spacing.md }}>
            <Text style={styles.cardTitle}>Spend mix</Text>
            <SpendBar
              parts={[
                { label: 'Maintenance', value: expenses.maintenanceTotal, color: palette.accent.primary },
                { label: 'Repairs', value: expenses.repairTotal, color: palette.accent.danger },
                { label: 'Admin', value: expenses.adminTotal, color: palette.text.tertiary },
              ]}
            />
          </Card>
        )}
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

        <SectionHeader title="AI tools" />
        <Button
          title="Ask AI about a repair"
          variant="secondary"
          onPress={() => router.push({ pathname: '/ai/assistant', params: { vehicleId: vehicle.id } })}
        />

        <SectionHeader title="Report" />
        <Button title="Export PDF report" variant="secondary" loading={exporting} onPress={() => void exportReport()} />
        <Button title="Delete vehicle" variant="danger" onPress={confirmDeleteVehicle} style={{ marginTop: spacing.md }} />
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

function SpendBar({
  parts,
}: {
  parts: Array<{ label: string; value: number; color: string }>;
}) {
  const max = Math.max(...parts.map((p) => p.value), 1);
  return (
    <View style={{ gap: spacing.md }}>
      {parts.map((part) => (
        <View key={part.label}>
          <View style={styles.spendLegend}>
            <Text style={styles.detailLabel}>{part.label}</Text>
            <Text style={styles.detailValue}>{formatMoney(part.value)}</Text>
          </View>
          <View style={styles.spendTrack}>
            <View style={{ flex: part.value, height: 8, backgroundColor: part.color, borderRadius: 99 }} />
            <View style={{ flex: Math.max(max - part.value, 0) }} />
          </View>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  mileage: { color: palette.text.secondary, fontSize: typography.body.size },
  mileageEdit: { color: palette.accent.primary, fontSize: typography.caption.size },
  mileageInput: {
    color: palette.text.primary,
    borderBottomWidth: 1,
    borderBottomColor: palette.accent.primary,
    fontSize: typography.body.size,
    paddingVertical: 2,
    minWidth: 90,
  },
  statRow: { flexDirection: 'row', gap: spacing.md },
  cardTitle: {
    color: palette.text.primary,
    fontSize: typography.bodyEmphasis.size,
    fontWeight: typography.bodyEmphasis.weight,
    marginBottom: spacing.sm,
  },
  reasonText: { color: palette.text.secondary, fontSize: typography.caption.size, lineHeight: 20 },
  decodedHint: {
    color: palette.text.tertiary,
    fontSize: typography.meta.size,
    marginTop: spacing.sm,
  },
  allGood: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  allGoodText: { color: palette.text.secondary, fontSize: typography.body.size, flex: 1 },
  attentionCard: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingVertical: spacing.md },
  link: { color: palette.accent.primary, fontSize: typography.caption.size, fontWeight: '600' },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: spacing.md,
    paddingVertical: spacing.sm,
  },
  detailRowBorder: { borderBottomWidth: 1, borderBottomColor: palette.border.subtle },
  detailLabel: { color: palette.text.secondary, fontSize: typography.body.size },
  detailValue: {
    color: palette.text.primary,
    fontSize: typography.body.size,
    fontWeight: '500',
    flexShrink: 1,
    textAlign: 'right',
  },
  recallItem: {
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: palette.border.subtle,
  },
  recallComponent: {
    color: palette.status.overdue,
    fontSize: typography.bodyEmphasis.size,
    fontWeight: typography.bodyEmphasis.weight,
  },
  recallRemedy: { color: palette.text.secondary, fontSize: typography.caption.size, marginTop: spacing.xs },
  recordHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  recordType: {
    color: palette.text.primary,
    fontSize: typography.bodyEmphasis.size,
    fontWeight: typography.bodyEmphasis.weight,
  },
  recordCost: { color: palette.accent.primary, fontSize: typography.bodyEmphasis.size, fontWeight: '600' },
  recordMeta: { color: palette.text.tertiary, fontSize: typography.meta.size, marginTop: 2 },
  recordNotes: { color: palette.text.secondary, fontSize: typography.caption.size, marginTop: spacing.sm },
  recordNext: { color: palette.status.dueSoon, fontSize: typography.caption.size, marginTop: spacing.sm },
  recordCard: { gap: spacing.sm },
  recordDetails: { marginTop: spacing.xs },
  receiptPreview: {
    width: '100%',
    height: 140,
    borderRadius: radius.md,
    backgroundColor: palette.bg.raised,
    marginTop: spacing.sm,
  },
  recordActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: spacing.sm,
    marginTop: spacing.md,
    paddingTop: spacing.md,
    borderTopWidth: 1,
    borderTopColor: palette.border.subtle,
  },
  recordActionBtn: { padding: spacing.xs },
  reminderActions: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, marginTop: spacing.md },
  reminderDelete: { padding: spacing.sm },
  spendLegend: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 },
  spendTrack: {
    height: 8,
    borderRadius: radius.pill,
    backgroundColor: palette.bg.raised,
    overflow: 'hidden',
    flexDirection: 'row',
  },
});
