import * as ImagePicker from 'expo-image-picker';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import React, { useCallback, useMemo, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { EmptyState, Screen } from '@/components/ui';
import { GhostLink, WorkButton } from '@/components/form';
import { aiAvailability, scanReceipt } from '@/lib/ai/client';
import { isEmptyScan } from '@/lib/ai/parse';
import { useAllServiceRecords, useVehicles } from '@/lib/db/hooks';
import { orderServiceTypes, serviceTypeLabel } from '@/lib/domain/serviceTypes';
import { useServiceDraft } from '@/lib/forms/serviceDraft';
import { canUseAi } from '@/lib/monetization/entitlements';
import { useIsPro } from '@/lib/monetization/purchases';

export default function LogServiceStepWhat() {
  const router = useRouter();
  const params = useLocalSearchParams<{ vehicleId?: string }>();
  const vehicles = useVehicles();
  const allRecords = useAllServiceRecords();
  const isPro = useIsPro();
  const [scanning, setScanning] = useState(false);
  const draft = useServiceDraft();
  const car = vehicles.find((v) => v.id === draft.vehicleId) ?? null;

  useFocusEffect(
    useCallback(() => {
      const wanted = params.vehicleId ?? vehicles[0]?.id;
      const current = useServiceDraft.getState().vehicleId;
      if (wanted != null && current !== wanted) {
        const vehicle = vehicles.find((v) => v.id === wanted);
        if (vehicle) useServiceDraft.getState().start(vehicle);
      }
    }, [params.vehicleId, vehicles]),
  );

  const types = useMemo(() => {
    const forVehicle = allRecords.filter((r) => r.vehicleId === draft.vehicleId).map((r) => r.serviceType);
    return orderServiceTypes(forVehicle);
  }, [allRecords, draft.vehicleId]);

  function cancel() {
    useServiceDraft.getState().reset();
    router.back();
  }

  async function pickReceiptImage(): Promise<string | null> {
    return new Promise((resolve) => {
      Alert.alert('Staple a shop ticket', 'Where is it?', [
        {
          text: 'Take a photo',
          onPress: () =>
            void ImagePicker.requestCameraPermissionsAsync().then(async (perm) => {
              if (!perm.granted) {
                Alert.alert('Camera unavailable', 'Allow camera access in Settings.');
                resolve(null);
                return;
              }
              const result = await ImagePicker.launchCameraAsync({ quality: 0.6 });
              resolve(result.canceled ? null : (result.assets?.[0]?.uri ?? null));
            }),
        },
        {
          text: 'Choose from library',
          onPress: () =>
            void ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.6 }).then((result) =>
              resolve(result.canceled ? null : (result.assets?.[0]?.uri ?? null)),
            ),
        },
        { text: 'Cancel', style: 'cancel', onPress: () => resolve(null) },
      ]);
    });
  }

  async function startScan() {
    if (scanning) return;
    const gate = canUseAi(isPro);
    if (!gate.allowed) {
      router.push('/paywall');
      return;
    }
    const availability = aiAvailability();
    if (!availability.available) {
      Alert.alert('Scanning unavailable', availability.reason);
      return;
    }
    const uri = await pickReceiptImage();
    if (uri == null) return;
    setScanning(true);
    draft.setReceiptUri(uri);
    try {
      const scan = await scanReceipt(uri);
      if (isEmptyScan(scan)) {
        Alert.alert("Couldn't read it", 'Mark the job on the sheet.');
        return;
      }
      draft.applyScan(scan);
      router.push('/service/log/confirm');
    } catch (e: unknown) {
      Alert.alert('Scan failed', e instanceof Error ? e.message : 'Try again later.');
    } finally {
      setScanning(false);
    }
  }

  if (vehicles.length === 0) {
    return (
      <Screen>
        <EmptyState title="No vehicles yet" message="Add a car first, then write a repair order." />
      </Screen>
    );
  }

  const ymm = car ? \`\${car.year}  \${car.make.toUpperCase()}  \${car.model.toUpperCase()}\` : '';
  const job = draft.serviceType ? serviceTypeLabel(draft.serviceType).toUpperCase() : '';

  return (
    <View style={styles.page}>
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        <View style={styles.top}>
          <GhostLink title="Void" onPress={cancel} />
          <GhostLink
            title={scanning ? 'Reading…' : isPro ? 'Staple ticket' : 'Staple ticket (pro)'}
            onPress={() => void startScan()}
          />
        </View>

        <Text style={styles.brand}>GLOVEBOX</Text>
        <Text style={styles.doc}>REPAIR ORDER</Text>

        <Text style={styles.ymm}>{ymm}</Text>
        {car != null && (
          <Text style={styles.meta}>
            {car.nickname.toUpperCase()}   {car.mileage.toLocaleString()} MI
          </Text>
        )}

        {vehicles.length > 1 && (
          <View style={styles.units}>
            {vehicles.map((v) => (
              <Text
                key={v.id}
                onPress={() => useServiceDraft.getState().start(v)}
                style={[styles.unit, v.id === draft.vehicleId && styles.unitOn]}
              >
                {v.nickname.toUpperCase()}
              </Text>
            ))}
          </View>
        )}

        <View style={styles.rule} />

        <View style={styles.marks}>
          {types.map((t) => {
            const on = draft.serviceType === t.id;
            return (
              <Pressable key={t.id} onPress={() => draft.setServiceType(t.id)} style={styles.mark}>
                <Text style={[styles.markBox, on && styles.markBoxOn]}>{on ? 'X' : ' '}</Text>
                <Text style={[styles.markLabel, on && styles.markLabelOn]}>{t.label.toUpperCase()}</Text>
              </Pressable>
            );
          })}
        </View>

        <View style={styles.rule} />

        <Text style={styles.written}>{job || ' '}</Text>
        <View style={styles.underline} />
      </ScrollView>

      <WorkButton
        title="Write date and total"
        onPress={() => router.push('/service/log/when')}
        disabled={!draft.serviceType}
      />
    </View>
  );
}

const INK = '#111111';
const MUTE = '#5C5C5C';
const PAGE = '#F4EFE4';

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: PAGE },
  scroll: { paddingHorizontal: 22, paddingTop: 8, paddingBottom: 12 },
  top: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 18 },
  brand: {
    color: INK,
    fontSize: 28,
    fontWeight: '800',
    letterSpacing: -0.6,
  },
  doc: {
    color: INK,
    fontSize: 13,
    fontWeight: '800',
    letterSpacing: 2,
    marginTop: 2,
    marginBottom: 22,
  },
  ymm: {
    color: INK,
    fontSize: 18,
    fontWeight: '700',
  },
  meta: {
    color: MUTE,
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.8,
    marginTop: 4,
  },
  units: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginTop: 14 },
  unit: { color: MUTE, fontSize: 11, fontWeight: '700', letterSpacing: 0.8 },
  unitOn: { color: INK, textDecorationLine: 'underline' },
  rule: {
    height: 1,
    backgroundColor: INK,
    marginVertical: 20,
    opacity: 0.85,
  },
  marks: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  mark: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 4, paddingRight: 8 },
  markBox: {
    width: 14,
    height: 14,
    borderWidth: 1,
    borderColor: INK,
    textAlign: 'center',
    fontSize: 10,
    fontWeight: '800',
    lineHeight: 13,
    color: INK,
  },
  markBoxOn: { backgroundColor: INK, color: PAGE },
  markLabel: { color: INK, fontSize: 11, fontWeight: '700' },
  markLabelOn: { textDecorationLine: 'underline' },
  written: {
    color: INK,
    fontSize: 22,
    fontWeight: '700',
    minHeight: 28,
  },
  underline: {
    height: 1,
    backgroundColor: INK,
    marginTop: 4,
  },
});
