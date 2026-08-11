import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useMemo, useState } from 'react';
import { ActivityIndicator, Alert, Image, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Button, Chip, EmptyState, Field, SectionHeader } from '@/components/ui';
import { aiAvailability, scanReceipt } from '@/lib/ai/client';
import { isEmptyScan } from '@/lib/ai/parse';
import { useVehicles } from '@/lib/db/hooks';
import { createServiceRecord } from '@/lib/db/serviceRepo';
import { upsertMaintenanceReminder } from '@/lib/db/reminderRepo';
import { updateVehicleMileage } from '@/lib/db/vehicleRepo';
import { addMonthsIso, todayIso } from '@/lib/domain/due';
import { isValidIsoDate } from '@/lib/domain/date';
import { persistLocalMedia } from '@/lib/media/local';
import { SERVICE_TYPES, serviceTypeDef } from '@/lib/domain/serviceTypes';
import { canAttachReceipt, canUseAi } from '@/lib/monetization/entitlements';
import { useIsPro } from '@/lib/monetization/purchases';
import { palette, radius, spacing, typography } from '@/lib/theme';

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
      date: def.defaultIntervalMonths && isValidIsoDate(date) ? addMonthsIso(date, def.defaultIntervalMonths) : null,
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

  async function save() {
    if (!vehicle) return;
    if (!isValidIsoDate(date)) {
      setError('Enter a real date as YYYY-MM-DD');
      return;
    }
    if (effectiveNextDueDate && !isValidIsoDate(effectiveNextDueDate)) {
      setError('Next due date must be a real date as YYYY-MM-DD');
      return;
    }
    const mileageNum = mileage ? Number(mileage.replace(/[^\d]/g, '')) : null;
    const savedReceiptUri = await persistLocalMedia(receiptUri, 'receipts');
    createServiceRecord({
      vehicleId: vehicle.id,
      serviceType,
      date,
      mileage: mileageNum,
      cost: cost ? Number(cost.replace(/[^\d.]/g, '')) : null,
      shopName: shopName.trim() || null,
      notes: notes.trim() || null,
      receiptUri: savedReceiptUri,
      nextDueDate: effectiveNextDueDate || null,
      nextDueMileage: effectiveNextDueMileage ? Number(effectiveNextDueMileage.replace(/[^\d]/g, '')) : null,
    });
    if (mileageNum != null && mileageNum > vehicle.mileage) {
      updateVehicleMileage(vehicle.id, mileageNum);
    }
    upsertMaintenanceReminder({ vehicleId: vehicle.id, title: serviceTypeDef(serviceType).label, category: serviceType, dueDate: effectiveNextDueDate || null, dueMileage: effectiveNextDueMileage ? Number(effectiveNextDueMileage.replace(/[^\d]/g, '')) : null });
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
      <ScrollView
        style={styles.screen}
        contentContainerStyle={{ padding: spacing.screenPadding, paddingBottom: spacing['2xl'] }}
        keyboardShouldPersistTaps="handled"
      >
        {vehicles.length > 1 && (
          <>
            <SectionHeader title="Vehicle" />
            <View style={styles.chipWrap}>
              {vehicles.map((v) => (
                <Chip key={v.id} label={v.nickname} selected={v.id === vehicleId} onPress={() => setVehicleId(v.id)} />
              ))}
            </View>
          </>
        )}

        <SectionHeader title="Service type" />
        <View style={styles.chipWrap}>
          {SERVICE_TYPES.map((t) => (
            <Chip key={t.id} label={t.label} selected={t.id === serviceType} onPress={() => setServiceType(t.id)} />
          ))}
        </View>

        <SectionHeader title="Details" />
        <View style={styles.twoCol}>
          <View style={{ flex: 1 }}>
            <Field label="Date" placeholder="YYYY-MM-DD" value={date} onChangeText={setDate} />
          </View>
          <View style={{ flex: 1 }}>
            <Field label="Mileage" placeholder="82000" keyboardType="number-pad" value={mileage} onChangeText={setMileage} />
          </View>
        </View>
        <View style={styles.twoCol}>
          <View style={{ flex: 1 }}>
            <Field label="Cost" placeholder="79.99" keyboardType="decimal-pad" value={cost} onChangeText={setCost} />
          </View>
          <View style={{ flex: 1 }}>
            <Field label="Shop / mechanic" placeholder="Joe's Auto" value={shopName} onChangeText={setShopName} />
          </View>
        </View>
        <Field label="Notes" placeholder="Parts used, what was done…" value={notes} onChangeText={setNotes} multiline />

        <Pressable onPress={pickReceipt} style={styles.receiptRow}>
          {receiptUri ? (
            <Image source={{ uri: receiptUri }} style={styles.receiptThumb} />
          ) : (
            <Ionicons name="receipt-outline" size={20} color={palette.accent.primary} />
          )}
          <Text style={styles.receiptText}>{receiptUri ? 'Change receipt photo' : 'Attach receipt photo'}</Text>
          {!isPro && (
            <View style={styles.proBadge}>
              <Text style={styles.proBadgeText}>PRO</Text>
            </View>
          )}
        </Pressable>

        {receiptUri != null && (
          <Pressable onPress={() => void scanAttachedReceipt()} disabled={scanning} style={styles.receiptRow}>
            {scanning ? (
              <ActivityIndicator size="small" color={palette.accent.primary} />
            ) : (
              <Ionicons name="sparkles-outline" size={20} color={palette.accent.primary} />
            )}
            <Text style={styles.receiptText}>{scanning ? 'Reading receipt…' : 'Scan receipt to fill this form'}</Text>
          </Pressable>
        )}

        <SectionHeader title="Next due (prefilled from service type)" />
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
            />
          </View>
        </View>

        {error != null && <Text style={styles.error}>{error}</Text>}
        <Button title="Save record" onPress={() => void save()} style={{ marginTop: spacing.sm }} />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: palette.bg.app },
  chipWrap: { flexDirection: 'row', flexWrap: 'wrap' },
  twoCol: { flexDirection: 'row', gap: spacing.md },
  receiptRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.sm,
  },
  receiptThumb: { width: 40, height: 40, borderRadius: radius.sm },
  receiptText: { color: palette.accent.primary, fontSize: typography.body.size, fontWeight: '500' },
  proBadge: {
    borderWidth: 1,
    borderColor: palette.accent.primary,
    borderRadius: radius.pill,
    paddingHorizontal: spacing.sm,
    paddingVertical: 1,
  },
  proBadgeText: {
    color: palette.accent.primary,
    fontSize: typography.overline.size,
    fontWeight: typography.overline.weight,
    letterSpacing: typography.overline.letterSpacing,
  },
  error: { color: palette.status.overdue, fontSize: typography.caption.size, marginBottom: spacing.sm },
});