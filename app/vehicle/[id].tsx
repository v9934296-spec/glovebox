import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import React, { useState } from 'react';
import { Alert, Image, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import {
  BayButton,
  BayHair,
  BayLink,
  BayPaint,
  BayPick,
  BayRoom,
  BayRow,
  BayScore,
  HangTag,
  Slats,
} from '@/components/bay';
import { bay } from '@/lib/bay';
import { useReminders, useServiceRecords, useVehicle } from '@/lib/db/hooks';
import { completeReminder, deleteReminder } from '@/lib/db/reminderRepo';
import { deleteServiceRecord } from '@/lib/db/serviceRepo';
import { applyRecallCheck, deleteVehicle, updateVehicleMileage, updateVehicleVinDecode } from '@/lib/db/vehicleRepo';
import { dueSummary, reminderDueState, todayIso } from '@/lib/domain/due';
import { formatMoney, summarizeExpenses } from '@/lib/domain/expenses';
import { healthScore } from '@/lib/domain/healthScore';
import { serviceTypeLabel } from '@/lib/domain/serviceTypes';
import { decodedVinSummary, recallStatus } from '@/lib/domain/vin';
import { canExportReport } from '@/lib/monetization/entitlements';
import { useIsPro } from '@/lib/monetization/purchases';
import { shareVehicleReport } from '@/lib/report/export';
import { VinServiceError, checkRecalls, decodeVin, vinAvailability } from '@/lib/vin/client';
import { vinDecodeFailureMessage } from '@/lib/vin/errors';
import {
  preconditionForRecallCheck,
  recallCheckFailureAlert,
  recallCheckSuccessAlert,
  recallCheckUnavailableAlert,
} from '@/lib/vin/recallCheck';

type Tab = 'overview' | 'maintenance' | 'expenses' | 'reminders';
const TABS: { value: Tab; label: string }[] = [
  { value: 'overview', label: 'Overview' },
  { value: 'maintenance', label: 'Maintenance' },
  { value: 'expenses', label: 'Expenses' },
  { value: 'reminders', label: 'Reminders' },
];

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
      <BayRoom>
        <View style={styles.pad}>
          <BayPaint>BAY —</BayPaint>
          <Text style={styles.mute}>Vehicle not found. It may have been deleted.</Text>
        </View>
      </BayRoom>
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
      const message =
        e instanceof VinServiceError
          ? vinDecodeFailureMessage(e.kind)
          : 'Something went wrong while decoding the VIN. Try again.';
      console.error('[vin] decode failed', e);
      Alert.alert('Decode failed', message);
    } finally {
      setDecoding(false);
    }
  }

  async function onCheckRecalls() {
    if (!vehicle || checkingRecalls) return;

    const precondition = preconditionForRecallCheck(vehicle.vin);
    if (!precondition.ok) {
      Alert.alert(precondition.title, precondition.message);
      return;
    }

    const availability = vinAvailability();
    if (!availability.available) {
      const alert = recallCheckUnavailableAlert(availability.reason);
      Alert.alert(alert.title, alert.message);
      return;
    }

    setCheckingRecalls(true);
    try {
      const recalls = await checkRecalls(vehicle.make, vehicle.model, vehicle.year);
      applyRecallCheck(
        { make: vehicle.make, model: vehicle.model, year: vehicle.year },
        recalls,
        vehicle.id,
      );
      const success = recallCheckSuccessAlert(recalls.length);
      Alert.alert(success.title, success.message);
    } catch (e) {
      const alert =
        e instanceof VinServiceError
          ? recallCheckFailureAlert(e.kind)
          : recallCheckFailureAlert('unexpected');
      console.error('[recalls] check failed', e);
      Alert.alert(alert.title, alert.message);
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

  const recallValue =
    recallState === 'unknown'
      ? 'Not checked yet'
      : recallState === 'none'
        ? `No recalls found · ${vehicle.recallCheckedAt?.slice(0, 10) ?? today}`
        : `${vehicle.recalls.length} found`;

  return (
    <BayRoom>
      <Stack.Screen options={{ title: vehicle.nickname }} />
      <ScrollView contentContainerStyle={styles.scroll}>
        {vehicle.photoUri ? (
          <Image source={{ uri: vehicle.photoUri }} style={styles.hero} />
        ) : (
          <View style={styles.heroFallback}>
            <Slats count={6} />
            <Text style={styles.heroYmm}>{ymm.toUpperCase()}</Text>
          </View>
        )}

        <View style={styles.tagWrap}>
          <HangTag name={vehicle.nickname} miles={`${vehicle.mileage.toLocaleString()} MI`} />
        </View>

        <View style={styles.floor}>
          <BayPaint>{ymm.toUpperCase()}</BayPaint>
          <BayScore score={health.score} />
        </View>

        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Edit mileage"
          onPress={() => setMileageDraft(String(vehicle.mileage))}
          style={styles.odo}
        >
          {mileageDraft == null ? (
            <Text style={styles.odoText}>
              ODO {vehicle.mileage.toLocaleString()} MI  ·  EDIT
            </Text>
          ) : (
            <TextInput
              style={styles.odoInput}
              value={mileageDraft}
              onChangeText={setMileageDraft}
              keyboardType="number-pad"
              autoFocus
              onBlur={commitMileage}
              onSubmitEditing={commitMileage}
            />
          )}
        </Pressable>

        <View style={styles.tabs}>
          {TABS.map((t) => (
            <BayPick key={t.value} label={t.label} selected={tab === t.value} onPress={() => setTab(t.value)} />
          ))}
        </View>

        {tab === 'overview' && (
          <View style={styles.block}>
            <BayRow label="This year" value={formatMoney(expenses.yearTotal)} />
            <BayHair />
            <BayRow label="Lifetime" value={formatMoney(expenses.lifetimeTotal)} />
            <BayHair />
            <BayRow
              label="Cost / mile"
              value={expenses.costPerMile != null ? `$${expenses.costPerMile.toFixed(2)}` : '—'}
            />

            {health.reasons.length > 0 && (
              <View style={{ marginTop: 20 }}>
                <Text style={styles.section}>HEALTH NOTES</Text>
                {health.reasons.map((reason) => (
                  <Text key={reason} style={styles.body}>
                    {reason.toUpperCase()}
                  </Text>
                ))}
              </View>
            )}

            <Text style={styles.section}>DETAILS</Text>
            <BayRow label="License plate" value={vehicle.licensePlate ?? '—'} />
            <BayHair />
            <BayRow label="VIN" value={vehicle.vin ?? '—'} />
            <BayHair />
            <BayRow label="Purchased" value={vehicle.purchaseDate ?? '—'} />
            <BayHair />
            <BayRow
              label="Purchase price"
              value={vehicle.purchasePrice != null ? formatMoney(vehicle.purchasePrice) : '—'}
            />

            <Text style={styles.section}>VIN & RECALLS</Text>
            {decodedSummary != null && (
              <>
                <BayRow label="Decoded" value={decodedSummary} />
                <BayHair />
              </>
            )}
            <BayRow label="Recalls" value={recallValue} />
            {recallState === 'open' &&
              vehicle.recalls.map((r) => (
                <View key={r.id} style={{ paddingVertical: 8 }}>
                  <Text style={styles.recall}>{((r.component ?? 'Recall') as string).toUpperCase()}</Text>
                  {r.summary != null && <Text style={styles.body}>{r.summary}</Text>}
                </View>
              ))}

            <View style={styles.actions}>
              <BayLink
                title={decoding ? 'Decoding…' : 'Decode VIN'}
                onPress={() => void onDecodeVin()}
                disabled={!vehicle.vin || decoding}
                tone="cream"
              />
              <BayLink
                title={checkingRecalls ? 'Checking…' : 'Check recalls'}
                onPress={() => void onCheckRecalls()}
                disabled={checkingRecalls}
                tone="cream"
              />
              <BayLink
                title={exporting ? 'Exporting…' : 'Export PDF'}
                onPress={() => void exportReport()}
                disabled={exporting}
                tone="cream"
              />
              <BayLink
                title="Ask AI"
                onPress={() => router.push({ pathname: '/ai/assistant', params: { vehicleId: vehicle.id } })}
                tone="cream"
              />
              <BayLink title="Delete vehicle" onPress={confirmDeleteVehicle} tone="danger" />
            </View>
          </View>
        )}

        {tab === 'maintenance' && (
          <View style={styles.block}>
            <BayButton
              title="Log service"
              onPress={() => router.push({ pathname: '/service/log', params: { vehicleId: vehicle.id } })}
            />
            {records.length === 0 ? (
              <Text style={styles.mute}>No service history. Log an oil change, repair, or registration.</Text>
            ) : (
              records.map((r, i) => (
                <View key={r.id}>
                  {i > 0 ? <BayHair /> : null}
                  <View style={styles.line}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.lineTitle}>{serviceTypeLabel(r.serviceType).toUpperCase()}</Text>
                      <Text style={styles.body}>
                        {[
                          r.date,
                          r.mileage != null ? `${r.mileage.toLocaleString()} mi` : null,
                          r.shopName,
                        ]
                          .filter(Boolean)
                          .join('  ·  ')}
                      </Text>
                      {(r.nextDueDate || r.nextDueMileage != null) && (
                        <Text style={styles.body}>
                          Next due:{' '}
                          {dueSummary({
                            dueDate: r.nextDueDate,
                            dueMileage: r.nextDueMileage,
                            currentMileage: vehicle.mileage,
                            today,
                          })}
                        </Text>
                      )}
                    </View>
                    {r.cost != null && <Text style={styles.lineAmt}>{formatMoney(r.cost)}</Text>}
                  </View>
                  <View style={styles.lineLinks}>
                    <BayLink
                      title="AI"
                      tone="mute"
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
                    />
                    <BayLink
                      title="Delete"
                      tone="mute"
                      onPress={() =>
                        Alert.alert('Delete record', 'Remove this service record?', [
                          { text: 'Cancel', style: 'cancel' },
                          { text: 'Delete', style: 'destructive', onPress: () => deleteServiceRecord(r.id) },
                        ])
                      }
                    />
                  </View>
                </View>
              ))
            )}
          </View>
        )}

        {tab === 'expenses' && (
          <View style={styles.block}>
            <BayRow label="This month" value={formatMoney(expenses.monthTotal)} />
            <BayHair />
            <BayRow label="This year" value={formatMoney(expenses.yearTotal)} />
            <BayHair />
            <BayRow label="Maintenance" value={formatMoney(expenses.maintenanceTotal)} />
            <BayHair />
            <BayRow label="Repairs" value={formatMoney(expenses.repairTotal)} />
            <BayHair />
            <BayRow label="Admin" value={formatMoney(expenses.adminTotal)} />
            <Text style={styles.section}>BY CATEGORY</Text>
            {expenses.byCategory.length === 0 ? (
              <Text style={styles.mute}>No expenses yet. Costs from service records show up here.</Text>
            ) : (
              expenses.byCategory.map((c, i) => (
                <View key={c.serviceType}>
                  {i > 0 ? <BayHair /> : null}
                  <BayRow label={serviceTypeLabel(c.serviceType)} value={formatMoney(c.total)} />
                </View>
              ))
            )}
          </View>
        )}

        {tab === 'reminders' && (
          <View style={styles.block}>
            <BayButton
              title="New reminder"
              onPress={() => router.push({ pathname: '/reminder/add', params: { vehicleId: vehicle.id } })}
            />
            {reminders.length === 0 ? (
              <Text style={styles.mute}>Nothing scheduled. Oil, registration, insurance — anything on a date.</Text>
            ) : (
              reminders.map((r, i) => {
                const state = reminderDueState(r, vehicle.mileage, today);
                return (
                  <View key={r.id}>
                    {i > 0 ? <BayHair /> : null}
                    <View style={styles.line}>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.lineTitle}>{r.title.toUpperCase()}</Text>
                        <Text style={styles.body}>
                          {dueSummary({
                            dueDate: r.dueDate,
                            dueMileage: r.dueMileage,
                            currentMileage: vehicle.mileage,
                            today,
                          })}
                          {r.recurrenceType !== 'none' ? '  ·  recurring' : ''}
                          {state !== 'no_due' ? `  ·  ${state.replace('_', ' ')}` : ''}
                        </Text>
                      </View>
                    </View>
                    <View style={styles.lineLinks}>
                      <BayLink title="Done" tone="mute" onPress={() => completeReminder(r, vehicle.mileage)} />
                      <BayLink
                        title="Delete"
                        tone="mute"
                        onPress={() =>
                          Alert.alert('Delete reminder', `Delete "${r.title}"?`, [
                            { text: 'Cancel', style: 'cancel' },
                            { text: 'Delete', style: 'destructive', onPress: () => deleteReminder(r.id) },
                          ])
                        }
                      />
                    </View>
                  </View>
                );
              })
            )}
          </View>
        )}
      </ScrollView>
    </BayRoom>
  );
}

const styles = StyleSheet.create({
  pad: { flex: 1, justifyContent: 'center', padding: 20, gap: 12 },
  scroll: { paddingBottom: 40 },
  hero: { width: '100%', height: 220 },
  heroFallback: { height: 180, backgroundColor: bay.fallback, justifyContent: 'flex-end' },
  heroYmm: {
    color: bay.ymm,
    fontSize: 13,
    fontWeight: '800',
    letterSpacing: 1.4,
    textAlign: 'center',
    paddingVertical: 16,
  },
  tagWrap: { position: 'absolute', right: 16, top: 160 },
  floor: {
    paddingHorizontal: 18,
    paddingTop: 16,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    gap: 12,
  },
  odo: { paddingHorizontal: 18, paddingTop: 8 },
  odoText: { color: bay.due, fontSize: 11, fontWeight: '800', letterSpacing: 1.2 },
  odoInput: {
    color: bay.cream,
    borderBottomWidth: 1,
    borderBottomColor: bay.orange,
    fontSize: 16,
    fontWeight: '700',
    paddingVertical: 2,
    minWidth: 90,
  },
  tabs: { flexDirection: 'row', flexWrap: 'wrap', paddingHorizontal: 18, paddingTop: 16 },
  block: { paddingHorizontal: 18, paddingTop: 12, gap: 4 },
  section: {
    color: bay.due,
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 1.4,
    marginTop: 22,
    marginBottom: 6,
  },
  body: { color: bay.ymm, fontSize: 12, marginTop: 2 },
  mute: { color: bay.hint, fontSize: 13, fontWeight: '700', letterSpacing: 0.4, marginTop: 16 },
  recall: { color: bay.orange, fontSize: 13, fontWeight: '800' },
  actions: { marginTop: 24, gap: 14 },
  line: { flexDirection: 'row', gap: 12, paddingVertical: 12 },
  lineTitle: { color: bay.cream, fontSize: 14, fontWeight: '800', letterSpacing: 0.4 },
  lineAmt: { color: bay.cream, fontSize: 14, fontWeight: '800' },
  lineLinks: { flexDirection: 'row', gap: 18, paddingBottom: 8 },
});
