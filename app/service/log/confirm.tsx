import { useRouter } from 'expo-router';
import React from 'react';
import { Alert, Image, ScrollView, StyleSheet, Text, View } from 'react-native';
import {
  BlackBar,
  Cell,
  Check,
  FormFrame,
  GhostLink,
  Line,
  Sheet,
  WorkButton,
} from '@/components/form';
import { useVehicle } from '@/lib/db/hooks';
import { formatIsoLong } from '@/lib/domain/dates';
import { formatMoney } from '@/lib/domain/expenses';
import { serviceTypeLabel } from '@/lib/domain/serviceTypes';
import { draftCost, draftMileage, useServiceDraft } from '@/lib/forms/serviceDraft';
import { saveServiceDraft } from '@/lib/forms/saveService';

const BOXES: { id: string; label: string }[] = [
  { id: 'oil_change', label: 'OIL' },
  { id: 'spark_plugs', label: 'TUNE UP' },
  { id: 'brakes', label: 'BRAKES' },
  { id: 'tires', label: 'TIRES' },
  { id: 'repair', label: 'DIAGNOSTIC' },
  { id: 'other', label: 'OTHER' },
];

export default function LogServiceConfirm() {
  const router = useRouter();
  const draft = useServiceDraft();
  const vehicle = useVehicle(draft.vehicleId ?? undefined);
  const mileage = draftMileage(draft);
  const cost = draftCost(draft);
  const job = draft.serviceType ? serviceTypeLabel(draft.serviceType).toUpperCase() : '';
  const ymm = vehicle
    ? String(vehicle.year) +
      ' ' +
      vehicle.make +
      ' ' +
      vehicle.model +
      (vehicle.trim ? ' ' + vehicle.trim : '')
    : '';
  const boxed = BOXES.map((b) => b.id);
  const typeOn = (id: string) =>
    draft.serviceType === id ||
    (id === 'other' && draft.serviceType != null && !boxed.includes(draft.serviceType));

  function cancel() {
    useServiceDraft.getState().reset();
    router.dismissAll();
  }

  function save() {
    const result = saveServiceDraft();
    if (!result.ok) {
      Alert.alert('Not filed', result.reason);
      return;
    }
    router.dismissAll();
  }

  return (
    <Sheet>
      <ScrollView contentContainerStyle={styles.scroll}>
        <View style={styles.top}>
          <GhostLink title="Back" onPress={() => router.back()} />
          <GhostLink title="Void" onPress={cancel} />
        </View>

        <View style={styles.stage}>
          <FormFrame>
            <View style={styles.head}>
              <View style={{ flex: 1, paddingRight: 76 }}>
                <Text style={styles.shop}>GLOVEBOX</Text>
                <Text style={styles.shopSub}>SERVICE JACKET</Text>
              </View>
              <Text style={styles.docTitle}>AUTOMOTIVE{'\n'}REPAIR</Text>
            </View>

            <View style={styles.row}>
              <Cell label="YEAR MAKE AND MODEL" value={ymm.toUpperCase()} flex={1.5} />
              <Cell label="ODOMETER" value={mileage != null ? mileage.toLocaleString() : ''} flex={0.8} />
            </View>
            <View style={styles.row}>
              <Cell label="DATE" value={formatIsoLong(draft.date).toUpperCase()} />
              <Cell label="SHOP" value={draft.shopName.trim().toUpperCase()} />
            </View>

            <View style={styles.checks}>
              {BOXES.map((b) => (
                <Check key={b.id} label={b.label} on={typeOn(b.id)} onPress={() => draft.setServiceType(b.id)} />
              ))}
            </View>

            <BlackBar title="DESCRIPTION OF WORK" />
            <Line n={1} job={job} amount={cost != null ? formatMoney(cost) : ''} />
            <Line n={2} job="" amount="" />

            <View style={styles.totalRow}>
              <View style={styles.notes}>
                <Text style={styles.notesLabel}>NOTES / REMARKS</Text>
                <Text style={styles.notesVal}>{draft.notes.trim() || ' '}</Text>
              </View>
              <View style={styles.totalBox}>
                <Text style={styles.notesLabel}>TOTAL</Text>
                <Text style={styles.total}>{cost != null ? formatMoney(cost) : '—'}</Text>
              </View>
            </View>
          </FormFrame>

          {draft.receiptUri != null && <Image source={{ uri: draft.receiptUri }} style={styles.staple} />}
        </View>

        <WorkButton title={draft.saving ? 'Filing…' : 'File ticket'} onPress={save} disabled={draft.saving || !draft.serviceType} />
      </ScrollView>
    </Sheet>
  );
}

const styles = StyleSheet.create({
  scroll: { paddingBottom: 32 },
  top: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 8,
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  stage: { position: 'relative' },
  head: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    padding: 10,
    borderBottomWidth: 2,
    borderColor: '#111',
  },
  shop: { fontSize: 16, fontWeight: '800', color: '#111' },
  shopSub: { fontSize: 9, letterSpacing: 1.2, color: '#5C5C5C', marginTop: 2 },
  docTitle: { fontSize: 13, fontWeight: '800', color: '#111', textAlign: 'right', letterSpacing: 1 },
  row: { flexDirection: 'row' },
  checks: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: 8,
    paddingVertical: 6,
    borderBottomWidth: 1,
    borderColor: '#111',
  },
  totalRow: { flexDirection: 'row', borderTopWidth: 2, borderColor: '#111' },
  notes: { flex: 1, padding: 10, minHeight: 64 },
  notesLabel: { color: '#5C5C5C', fontSize: 8, fontWeight: '700', letterSpacing: 0.6 },
  notesVal: { color: '#111', fontSize: 13, fontWeight: '700', marginTop: 4 },
  totalBox: {
    width: 118,
    borderLeftWidth: 2,
    borderColor: '#111',
    padding: 10,
    justifyContent: 'flex-end',
  },
  total: { color: '#111', fontSize: 22, fontWeight: '800', marginTop: 2 },
  staple: {
    position: 'absolute',
    right: 22,
    top: 14,
    width: 64,
    height: 80,
    borderWidth: 1,
    borderColor: '#111',
    backgroundColor: '#EFEAE0',
  },
});
