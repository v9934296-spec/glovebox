import * as ImagePicker from 'expo-image-picker';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import React, { useCallback, useMemo, useState } from 'react';
import { Alert, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Chip, EmptyState, Screen } from '@/components/ui';
import { FlowHeader, ScanBanner, ServiceTypeGrid, StepProgress } from '@/components/flow';
import { aiAvailability, scanReceipt } from '@/lib/ai/client';
import { isEmptyScan } from '@/lib/ai/parse';
import { useAllServiceRecords, useVehicles } from '@/lib/db/hooks';
import { orderServiceTypes } from '@/lib/domain/serviceTypes';
import { useServiceDraft } from '@/lib/forms/serviceDraft';
import { canUseAi } from '@/lib/monetization/entitlements';
import { useIsPro } from '@/lib/monetization/purchases';
import { palette, spacing, typography } from '@/lib/theme';

const TOTAL_STEPS = 3;

export default function LogServiceStepWhat() {
  const router = useRouter();
  const params = useLocalSearchParams<{ vehicleId?: string }>();
  const vehicles = useVehicles();
  const allRecords = useAllServiceRecords();
  const isPro = useIsPro();
  const [scanning, setScanning] = useState(false);

  const draft = useServiceDraft();
  const activeVehicle = vehicles.find((v) => v.id === draft.vehicleId) ?? null;

  // Seed the draft on entry (and re-seed if the flow is re-opened for another car).
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

  const orderedTypes = useMemo(() => {
    const forVehicle = allRecords
      .filter((r) => r.vehicleId === draft.vehicleId)
      .map((r) => r.serviceType);
    return orderServiceTypes(forVehicle);
  }, [allRecords, draft.vehicleId]);

  function cancel() {
    useServiceDraft.getState().reset();
    router.back();
  }

  function chooseType(id: string) {
    draft.setServiceType(id);
    router.push('/service/log/when');
  }

  async function pickReceiptImage(): Promise<string | null> {
    return new Promise((resolve) => {
      Alert.alert('Scan a receipt', 'Where is it?', [
        {
          text: 'Take a photo',
          onPress: () =>
            void ImagePicker.requestCameraPermissionsAsync().then(async (perm) => {
              if (!perm.granted) {
                Alert.alert('Camera unavailable', 'Allow camera access in Settings to photograph receipts.');
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
            void ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.6 }).then(
              (result) => resolve(result.canceled ? null : (result.assets?.[0]?.uri ?? null)),
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
        Alert.alert("Couldn't read it", 'Nothing usable on that photo. Enter the record yourself.');
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
        <EmptyState title="No vehicles yet" message="Add a car first, then log service against it." />
      </Screen>
    );
  }

  return (
    <Screen style={{ padding: 0 }}>
      <ScrollView
        contentContainerStyle={{ padding: spacing.screenPadding, paddingBottom: spacing['2xl'] }}
        keyboardShouldPersistTaps="handled"
      >
        <FlowHeader step={1} total={TOTAL_STEPS} onCancel={cancel} />
        <StepProgress step={1} total={TOTAL_STEPS} />

        {vehicles.length > 1 && (
          <View style={{ marginBottom: spacing.lg }}>
            <Text style={styles.overline}>VEHICLE</Text>
            <View style={styles.chipWrap}>
              {vehicles.map((v) => (
                <Chip
                  key={v.id}
                  label={v.nickname}
                  selected={v.id === draft.vehicleId}
                  onPress={() => useServiceDraft.getState().start(v)}
                />
              ))}
            </View>
          </View>
        )}

        <Text style={styles.title}>What was done?</Text>
        {activeVehicle != null && (
          <Text style={styles.subtitle}>
            {activeVehicle.year} {activeVehicle.make} {activeVehicle.model}
          </Text>
        )}

        <View style={{ height: spacing.lg }} />
        <ScanBanner onPress={() => void startScan()} locked={!isPro} loading={scanning} />

        <Text style={styles.overline}>OR PICK A SERVICE</Text>
        <ServiceTypeGrid types={orderedTypes} selectedId={draft.serviceType} onSelect={chooseType} />
        <Text style={styles.footnote}>Ordered by what you log most on this car.</Text>
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  title: {
    color: palette.text.primary,
    fontSize: typography.h2.size,
    fontWeight: typography.h2.weight,
  },
  subtitle: {
    color: palette.text.secondary,
    fontSize: typography.caption.size,
    marginTop: spacing.xs,
  },
  overline: {
    color: palette.text.tertiary,
    fontSize: typography.overline.size,
    fontWeight: typography.overline.weight,
    letterSpacing: typography.overline.letterSpacing,
    marginBottom: spacing.sm,
  },
  chipWrap: { flexDirection: 'row', flexWrap: 'wrap' },
  footnote: {
    color: palette.text.tertiary,
    fontSize: typography.caption.size,
    marginTop: spacing.md,
  },
});
