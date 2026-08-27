import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import React, { useMemo, useState } from 'react';
import { ActivityIndicator, Alert, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Button, Chip, EmptyState, Field, PhotoTile, SectionLabel } from '@/components/ui';
import { aiAvailability, scanReceipt } from '@/lib/ai/client';
import { isEmptyScan } from '@/lib/ai/parse';
import { useVehicles } from '@/lib/db/hooks';
import { createServiceRecord } from '@/lib/db/serviceRepo';
import { updateVehicleMileage } from '@/lib/db/vehicleRepo';
import { addMonthsIso, todayIso } from '@/lib/domain/due';
import { SERVICE_TYPES, serviceTypeDef } from '@/lib/domain/serviceTypes';
import { canAttachReceipt, canUseAi } from '@/lib/monetization/entitlements';
import { useIsPro } from '@/lib/monetization/purchases';
import { palette, spacing, typography } from '@/lib/theme';

const fieldLast = { marginBottom: 0 } as const;

export default function AddServiceScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ vehicleId?: string }>();
  const vehicles = useVehicles();
  const [vehicleId, setVehicleId] = useState<string | undefined>(params.vehicleId ?? vehicles[0]?.id);
  const vehicle = vehicles.find((v) => v.id === vehicleId);

  const [serviceType, setServiceType] = useState('oil_change');
  const [date, setDate] = useState(todayIso());
  const [mileage, setMileage] = useState(vehicle ? String(vehicle.mileage) : '');
  const [cost, setCost] = useState('');
  const [shopName, setShopName] = useState('');
  const [notes, setNotes] = useState('');
  const [receiptUri, setReceiptUri] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const suggestedNextDue = useMemo(() => {
    const def = serviceTypeDef(serviceType);
    const m = Number(mileage.replace(/[^\d]/g, ''));
    return {
      date: def.defaultIntervalMonths && /^\d{4}-\d{2}-\d{2}$/.test(date) ? addMonthsIso(date, def.defaultIntervalMonths) : null,
      mileage: def.defaultIntervalMiles && Number.isFinite(m) && m > 0 ? m + def.defaultIntervalMiles : null,
    };
  }, [serviceType, date, mileage]);

  const [nextDueDate, setNextDueDate] = useState<string>('');
  const [nextDueMileage, setNextDueMileage] = useState<string>('');
  const [nextDueTouched, setNextDueTouched] = useState(false);

  const effectiveNextDueDate = nextDueTouched ? nextDueDate : (suggestedNextDue.date ?? '');
  const effectiveNextDueMileage = nextDueTouched ? nextDueMileage : (suggestedNextDue.mileage != null ? String(suggestedNextDue.mileage) : '');

  const isPro = useIsPro();

  async function pickReceipt() {
    const gate = canAttachReceipt(isPro);
    if (!gate.allowed) {
      Alert.alert('Glovebox Pro', gate.reason, [
        { text: 'Not now', style: 'cancel' },
        { text: 'See Pro', onPress: () => router.push('/paywall') },
      ]);
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.7 });
    const uri = result.assets?.[0]?.uri;
    if (!result.canceled && uri) setReceiptUri(uri);
  }

  const [scanning, setScanning] = useState(false);

  async function scanAttachedReceipt() {
    if (!receiptUri || scanning) return;
    const gate = canUseAi(isPro);
    if (!gate.allowed) {
      Alert.alert('Glovebox Pro', gate.reason, [
        { text: 'Not now', style: 'cancel' },
        { text: 'See Pro', onPress: () => router.push('/paywall') },
      ]);
      return;
    }
    const availability = aiAvailability();
    if (!availability.available) {
      Alert.alert('AI unavailable', availability.reason);
      return;
    }
    setScanning(true);
    try {
      const scan = await scanReceipt(receiptUri);
      if (isEmptyScan(scan)) {
        Alert.alert('Nothing found', "Couldn't read any details from that photo. Enter the record manually.");
        return;
      }
      if (scan.serviceType != null) setServiceType(scan.serviceType);
      if (scan.date != null) setDate(scan.date);
      if (scan.cost != null) setCost(String(scan.cost));
      if (scan.shopName != null) setShopName(scan.shopName);
      if (scan.mileage != null) setMileage(String(scan.mileage));
      if (scan.summary != null && notes.trim() === '') setNotes(scan.summary);
    } catch (e: unknown) {
      Alert.alert('Scan failed', e instanceof Error ? e.message : 'Try again later.');
    } finally {
      setScanning(false);
    }
  }

  function save() {
    if (!vehicle) return;
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      setError('Date must be YYYY-MM-DD');
      return;
    }
    if (effectiveNextDueDate && !/^\d{4}-\d{2}-\d{2}$/.test(effectiveNextDueDate)) {
      setError('Next due date must be YYYY-MM-DD');
      return;
    }
    const mileageNum = mileage ? Number(mileage.replace(/[^\d]/g, '')) : null;
    createServiceRecord({
      vehicleId: vehicle.id,
      serviceType,
      date,
      mileage: mileageNum,
      cost: cost ? Number(cost.replace(/[^\d.]/g, '')) : null,
      shopName: shopName.trim() || null,
      notes: notes.trim() || null,
      receiptUri,
      nextDueDate: effectiveNextDueDate || null,
      nextDueMileage: effectiveNextDueMileage ? Number(effectiveNextDueMileage.replace(/[^\d]/g, '')) : null,
    });
    if (mileageNum != null && mileageNum > vehicle.mileage) {
      updateVehicleMileage(vehicle.id, mileageNum);
    }
    router.back();
  }

  if (vehicles.length === 0) {
    return (
      <View style={styles.screen}>
        <EmptyState title="No vehicles" message="Add a vehicle first, then log service against it." />
      </View>
    );
  }

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <Stack.Screen
        options={{
          title: 'Add Service',
          headerLeft: () => (
            <Pressable accessibilityRole="button" onPress={() => router.back()} hitSlop={8} style={{ paddingHorizontal: spacing.xs }}>
              <Text style={styles.headerCancel}>Cancel</Text>
            </Pressable>
          ),
          headerRight: () => (
            <Pressable accessibilityRole="button" onPress={save} hitSlop={8} style={{ paddingHorizontal: spacing.xs }}>
              <Text style={styles.headerSave}>Save</Text>
            </Pressable>
          ),
        }}
      />
      <ScrollView
        style={styles.screen}
        contentContainerStyle={{ padding: spacing.screenPadding, paddingBottom: spacing['2xl'], gap: spacing.xl }}
        keyboardShouldPersistTaps="handled"
      >
        {vehicles.length > 1 && (
          <>
            <SectionLabel title="Vehicle" />
            <View style={styles.chipWrap}>
              {vehicles.map((v) => (
                <Chip key={v.id} label={v.nickname} selected={v.id === vehicleId} onPress={() => setVehicleId(v.id)} />
              ))}
            </View>
          </>
        )}

        <SectionLabel title="What" />
        <View style={styles.chipWrap}>
          {SERVICE_TYPES.map((t) => (
            <Chip key={t.id} label={t.label} selected={t.id === serviceType} onPress={() => setServiceType(t.id)} />
          ))}
        </View>

        <SectionLabel title="Details" />
        <View style={styles.twoCol}>
          <View style={{ flex: 1 }}>
            <Field label="Date" placeholder="YYYY-MM-DD" value={date} onChangeText={setDate} containerStyle={fieldLast} />
          </View>
          <View style={{ flex: 1 }}>
            <Field
              label="Mileage"
              placeholder="82000"
              keyboardType="number-pad"
              value={mileage}
              onChangeText={setMileage}
              containerStyle={fieldLast}
            />
          </View>
        </View>
        <View style={[styles.twoCol, { marginTop: spacing.md }]}>
          <View style={{ flex: 1 }}>
            <Field
              label="Cost"
              placeholder="79.99"
              keyboardType="decimal-pad"
              value={cost}
              onChangeText={setCost}
              containerStyle={fieldLast}
            />
          </View>
          <View style={{ flex: 1 }}>
            <Field
              label="Shop"
              placeholder="Joe's Auto"
              value={shopName}
              onChangeText={setShopName}
              containerStyle={fieldLast}
            />
          </View>
        </View>
        <Field
          label="Notes"
          placeholder="Parts used, what was done…"
          value={notes}
          onChangeText={setNotes}
          multiline
          containerStyle={{ marginTop: spacing.md, marginBottom: 0 }}
        />

        <SectionLabel title="Receipt" />
        {isPro ? (
          <>
            <PhotoTile
              uri={receiptUri}
              emptyLabel="Add photo"
              emptyIcon="receipt-outline"
              onPress={() => void pickReceipt()}
              height={160}
            />
            {receiptUri != null && (
              <Pressable onPress={() => void scanAttachedReceipt()} disabled={scanning} style={styles.scanRow}>
                {scanning ? (
                  <ActivityIndicator size="small" color={palette.accent.primary} />
                ) : (
                  <Text style={styles.scanText}>Scan receipt</Text>
                )}
              </Pressable>
            )}
          </>
        ) : (
          <Pressable
            onPress={() => router.push('/paywall')}
            style={styles.proLockRow}
          >
            <Ionicons name="lock-closed-outline" size={18} color={palette.text.tertiary} />
            <View style={{ flex: 1 }}>
              <Text style={styles.proLockTitle}>Receipt photo</Text>
              <Text style={styles.proLockMeta}>Pro</Text>
            </View>
          </Pressable>
        )}

        <SectionLabel title="Next due" />
        <View style={styles.twoCol}>
          <View style={{ flex: 1 }}>
            <Field
              label="Next due date"
              placeholder="YYYY-MM-DD"
              value={effectiveNextDueDate}
              onChangeText={(t) => {
                setNextDueTouched(true);
                setNextDueDate(t);
                setNextDueMileage(effectiveNextDueMileage);
              }}
              containerStyle={fieldLast}
            />
          </View>
          <View style={{ flex: 1 }}>
            <Field
              label="Next due mileage"
              placeholder="87000"
              keyboardType="number-pad"
              value={effectiveNextDueMileage}
              onChangeText={(t) => {
                setNextDueTouched(true);
                setNextDueMileage(t);
                setNextDueDate(effectiveNextDueDate);
              }}
              containerStyle={fieldLast}
            />
          </View>
        </View>

        {error != null && <Text style={styles.error}>{error}</Text>}
        <Button title="Save service" onPress={save} style={{ marginTop: spacing.xl }} />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: palette.bg.app },
  chipWrap: { flexDirection: 'row', flexWrap: 'wrap' },
  twoCol: { flexDirection: 'row', gap: spacing.md },
  headerCancel: { color: palette.text.secondary, fontSize: typography.body.size },
  headerSave: { color: palette.accent.primary, fontSize: typography.bodyEmphasis.size, fontWeight: '700' },
  scanRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginTop: spacing.sm,
    paddingVertical: spacing.sm,
  },
  scanText: { color: palette.accent.primary, fontSize: typography.body.size, fontWeight: '500' },
  proLockRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: palette.border.subtle,
  },
  proLockTitle: {
    color: palette.text.primary,
    fontSize: typography.bodyEmphasis.size,
    fontWeight: typography.bodyEmphasis.weight,
  },
  proLockMeta: { color: palette.text.tertiary, fontSize: typography.caption.size, marginTop: 2 },
  error: { color: palette.status.overdue, fontSize: typography.caption.size },
});
