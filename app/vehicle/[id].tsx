import { Ionicons } from '@expo/vector-icons';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import React, { useState } from 'react';
import { Alert, Image, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import {
  Button,
  Card,
  DetailRow,
  EmptyState,
  HealthRing,
  MetricStrip,
  ReminderListRow,
  Screen,
  SectionLabel,
  SegmentedControl,
} from '@/components/ui';
import { useReminders, useServiceRecords, useVehicle } from '@/lib/db/hooks';
import { completeReminder, deleteReminder } from '@/lib/db/reminderRepo';
import { deleteServiceRecord } from '@/lib/db/serviceRepo';
import { deleteVehicle, updateVehicleMileage, updateVehicleRecalls, updateVehicleVinDecode } from '@/lib/db/vehicleRepo';
import { dueSummary, reminderDueState, todayIso } from '@/lib/domain/due';
import { formatMoney, summarizeExpenses } from '@/lib/domain/expenses';
import { healthScore } from '@/lib/domain/healthScore';
import { serviceTypeLabel } from '@/lib/domain/serviceTypes';
import { decodedVinSummary, recallStatus } from '@/lib/domain/vin';
import { canExportReport } from '@/lib/monetization/entitlements';
import { useIsPro } from '@/lib/monetization/purchases';
import { shareVehicleReport } from '@/lib/report/export';
import { palette, radius, spacing, typography } from '@/lib/theme';
import { checkRecalls, decodeVin, vinAvailability } from '@/lib/vin/client';

type Tab = 'overview' | 'maintenance' | 'expenses' | 'reminders';
const BLOCK = 28;

export default function VehicleDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const vehicle = useVehicle(id);
  const records = useServiceRecords(id);
  const reminders = useReminders({ vehicleId: id, status: 'active' });
  const [tab, setTab] = useState<Tab>('overview');
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
        <View style={styles.header}>
          {vehicle.photoUri ? (
            <Image source={{ uri: vehicle.photoUri }} style={styles.headerPhoto} />
          ) : (
            <View style={[styles.headerPhoto, styles.headerPhotoPlaceholder]}>
              <Ionicons name="car-sport" size={28} color={palette.text.tertiary} />
            </View>
          )}
          <View style={styles.headerIdentity}>
            <Text style={styles.headerTitle} numberOfLines={2}>
              {ymm}
            </Text>
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
          <HealthRing score={health.score} size={48} />
        </View>

        <View style={styles.segmentWrap}>
          <SegmentedControl
            options={[
              { value: 'overview', label: 'Overview' },
              { value: 'maintenance', label: 'Maintenance' },
              { value: 'expenses', label: 'Expenses' },
              { value: 'reminders', label: 'Reminders' },
            ]}
            value={tab}
            onChange={(v) => setTab(v as Tab)}
          />
        </View>

        {tab === 'overview' && (
          <View style={{ gap: BLOCK }}>
            <MetricStrip
              items={[
                { label: 'This year', value: formatMoney(expenses.yearTotal) },
                { label: 'Lifetime', value: formatMoney(expenses.lifetimeTotal) },
                {
                  label: 'Cost / mile',
                  value: expenses.costPerMile != null ? `$${expenses.costPerMile.toFixed(2)}` : '—',
                },
              ]}
            />

            {health.reasons.length > 0 && (
              <Card>
                <Text style={styles.cardTitle}>Health notes</Text>
                {health.reasons.map((reason) => (
                  <Text key={reason} style={styles.reasonText}>
                    • {reason}
                  </Text>
                ))}
              </Card>
            )}

            <View>
              <SectionLabel title="Details" />
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
            </View>

            <View>
              <SectionLabel title="VIN & recalls" />
              <Card>
                {decodedSummary != null && <DetailRow label="Decoded" value={decodedSummary} />}
                <DetailRow
                  label="Recalls"
                  value={
                    recallState === 'unknown'
                      ? 'Not checked yet'
                      : recallState === 'none'
                        ? `No open recalls · ${vehicle.recallCheckedAt?.slice(0, 10) ?? today}`
                        : `${vehicle.recalls.length} open`
                  }
                  last={recallState !== 'open'}
                />
                {recallState === 'open' &&
                  vehicle.recalls.map((r, i) => (
                    <View
                      key={r.id}
                      style={[styles.recallItem, i === vehicle.recalls.length - 1 && { borderBottomWidth: 0 }]}
                    >
                      <Text style={styles.recallComponent}>{r.component ?? 'Recall'}</Text>
                      {r.summary != null && <Text style={styles.recordNotes}>{r.summary}</Text>}
                    </View>
                  ))}
              </Card>
            </View>

            <View style={{ gap: spacing.md }}>
              <View style={styles.rowActions}>
                <Button
                  title="Decode VIN"
                  variant="secondary"
                  loading={decoding}
                  disabled={!vehicle.vin}
                  onPress={() => void onDecodeVin()}
                  style={{ flex: 1 }}
                />
                <Button
                  title="Check recalls"
                  variant="secondary"
                  loading={checkingRecalls}
                  onPress={() => void onCheckRecalls()}
                  style={{ flex: 1 }}
                />
              </View>
              <Button title="Export PDF" variant="secondary" loading={exporting} onPress={() => void exportReport()} />
              <Button
                title="Ask AI"
                variant="secondary"
                onPress={() => router.push({ pathname: '/ai/assistant', params: { vehicleId: vehicle.id } })}
              />
              <Button
                title="Delete vehicle"
                variant="danger"
                onPress={confirmDeleteVehicle}
                style={{ marginTop: spacing.lg }}
              />
            </View>
          </View>
        )}

        {tab === 'maintenance' && (
          <View style={{ gap: BLOCK }}>
            <Button
              title="Log service"
              onPress={() => router.push({ pathname: '/service/add', params: { vehicleId: vehicle.id } })}
            />
            {records.length === 0 ? (
              <EmptyState
                title="No service history"
                message="Log an oil change, repair, or registration to build history."
                icon="construct-outline"
              />
            ) : (
              <View>
                {records.map((r, i) => (
                  <View key={r.id} style={[styles.serviceRow, i < records.length - 1 && styles.serviceRowSep]}>
                    <View style={styles.serviceRowTop}>
                      <Text style={styles.serviceTitle} numberOfLines={1}>
                        {serviceTypeLabel(r.serviceType)}
                      </Text>
                      {r.cost != null && <Text style={styles.serviceCost}>{formatMoney(r.cost)}</Text>}
                    </View>
                    <Text style={styles.serviceMeta} numberOfLines={1}>
                      {[
                        r.date,
                        r.mileage != null ? `${r.mileage.toLocaleString()} mi` : null,
                        r.shopName,
                      ]
                        .filter(Boolean)
                        .join(' · ')}
                    </Text>
                    {(r.nextDueDate || r.nextDueMileage != null) && (
                      <Text style={styles.serviceNext}>
                        Next due:{' '}
                        {dueSummary({
                          dueDate: r.nextDueDate,
                          dueMileage: r.nextDueMileage,
                          currentMileage: vehicle.mileage,
                          today,
                        })}
                      </Text>
                    )}
                    <View style={styles.serviceIcons}>
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
                        hitSlop={8}
                      >
                        <Ionicons name="sparkles-outline" size={18} color={palette.text.tertiary} />
                      </Pressable>
                      <Pressable
                        onPress={() =>
                          Alert.alert('Delete record', 'Remove this service record?', [
                            { text: 'Cancel', style: 'cancel' },
                            { text: 'Delete', style: 'destructive', onPress: () => deleteServiceRecord(r.id) },
                          ])
                        }
                        hitSlop={8}
                      >
                        <Ionicons name="trash-outline" size={18} color={palette.text.tertiary} />
                      </Pressable>
                    </View>
                  </View>
                ))}
              </View>
            )}
          </View>
        )}

        {tab === 'expenses' && (
          <View style={{ gap: BLOCK }}>
            <MetricStrip
              items={[
                { label: 'This month', value: formatMoney(expenses.monthTotal) },
                { label: 'This year', value: formatMoney(expenses.yearTotal) },
              ]}
            />
            <MetricStrip
              items={[
                { label: 'Maintenance', value: formatMoney(expenses.maintenanceTotal) },
                { label: 'Repairs', value: formatMoney(expenses.repairTotal) },
                { label: 'Admin', value: formatMoney(expenses.adminTotal) },
              ]}
            />
            <View>
              <SectionLabel title="By category" />
              {expenses.byCategory.length === 0 ? (
                <EmptyState
                  title="No expenses yet"
                  message="Costs from service records show up here."
                  icon={null}
                />
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
          </View>
        )}

        {tab === 'reminders' && (
          <View style={{ gap: BLOCK }}>
            <Button
              title="New reminder"
              onPress={() => router.push({ pathname: '/reminder/add', params: { vehicleId: vehicle.id } })}
            />
            {reminders.length === 0 ? (
              <EmptyState
                title="Nothing scheduled"
                message="Oil, registration, insurance — anything on a schedule."
                icon="notifications-outline"
              />
            ) : (
              <View>
                {reminders.map((r, i) => {
                  const state = reminderDueState(r, vehicle.mileage, today);
                  return (
                    <ReminderListRow
                      key={r.id}
                      title={r.title}
                      meta={`${dueSummary({
                        dueDate: r.dueDate,
                        dueMileage: r.dueMileage,
                        currentMileage: vehicle.mileage,
                        today,
                      })}${r.recurrenceType !== 'none' ? ' · recurring' : ''}`}
                      state={state === 'no_due' ? 'upcoming' : state}
                      showSeparator={i < reminders.length - 1}
                      onDone={() => completeReminder(r, vehicle.mileage)}
                      onPress={() =>
                        Alert.alert('Delete reminder', `Delete "${r.title}"?`, [
                          { text: 'Cancel', style: 'cancel' },
                          { text: 'Delete', style: 'destructive', onPress: () => deleteReminder(r.id) },
                        ])
                      }
                    />
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

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  headerPhoto: {
    width: 72,
    height: 72,
    borderRadius: radius.md,
  },
  headerPhotoPlaceholder: {
    backgroundColor: palette.bg.hero,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerIdentity: { flex: 1, minWidth: 0, gap: 4 },
  headerTitle: {
    color: palette.text.primary,
    fontSize: typography.h3.size,
    fontWeight: typography.h3.weight,
    lineHeight: typography.h3.lineHeight,
  },
  mileage: { color: palette.text.secondary, fontSize: typography.caption.size },
  mileageEdit: { color: palette.accent.primary, fontSize: typography.caption.size },
  mileageInput: {
    color: palette.text.primary,
    borderBottomWidth: 1,
    borderBottomColor: palette.accent.primary,
    fontSize: typography.body.size,
    paddingVertical: 2,
    minWidth: 90,
  },
  segmentWrap: { marginVertical: spacing.lg },
  cardTitle: {
    color: palette.text.primary,
    fontSize: typography.bodyEmphasis.size,
    fontWeight: typography.bodyEmphasis.weight,
    marginBottom: spacing.sm,
  },
  reasonText: { color: palette.text.secondary, fontSize: typography.caption.size, lineHeight: 20 },
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
  recordNotes: { color: palette.text.secondary, fontSize: typography.caption.size, marginTop: spacing.xs },
  rowActions: { flexDirection: 'row', gap: spacing.md },
  serviceRow: { paddingVertical: spacing.md },
  serviceRowSep: { borderBottomWidth: 1, borderBottomColor: palette.border.subtle },
  serviceRowTop: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  serviceTitle: {
    flex: 1,
    color: palette.text.primary,
    fontSize: typography.bodyEmphasis.size,
    fontWeight: typography.bodyEmphasis.weight,
  },
  serviceCost: {
    color: palette.text.primary,
    fontSize: typography.bodyEmphasis.size,
    fontWeight: '600',
  },
  serviceMeta: { color: palette.text.tertiary, fontSize: typography.caption.size, marginTop: 2 },
  serviceNext: { color: palette.text.secondary, fontSize: typography.caption.size, marginTop: 4 },
  serviceIcons: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: spacing.md,
    marginTop: spacing.sm,
  },
});
