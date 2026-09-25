import DateTimePicker, { type DateTimePickerEvent } from '@react-native-community/datetimepicker';
import { useRouter } from 'expo-router';
import React, { useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { GhostLink, WorkButton } from '@/components/form';
import { useVehicle } from '@/lib/db/hooks';
import { addDaysIso, formatIsoLong, isoToLocalDate, localDateToIso } from '@/lib/domain/dates';
import { todayIso } from '@/lib/domain/due';
import { serviceTypeDef } from '@/lib/domain/serviceTypes';
import { resolveNextDue, useServiceDraft } from '@/lib/forms/serviceDraft';

export default function LogServiceStepWhen() {
  const router = useRouter();
  const draft = useServiceDraft();
  const vehicle = useVehicle(draft.vehicleId ?? undefined);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [editingNextDue, setEditingNextDue] = useState(false);
  const [showNextDuePicker, setShowNextDuePicker] = useState(false);

  const def = serviceTypeDef(draft.serviceType ?? 'other');
  const nextDue = resolveNextDue(draft);
  const today = todayIso();
  const yesterday = addDaysIso(today, -1);

  function cancel() {
    useServiceDraft.getState().reset();
    router.dismissAll();
  }

  function onDatePicked(event: DateTimePickerEvent, picked?: Date) {
    if (Platform.OS !== 'ios') setShowDatePicker(false);
    if (event.type === 'set' && picked != null) draft.setDate(localDateToIso(picked));
  }

  function onNextDueDatePicked(event: DateTimePickerEvent, picked?: Date) {
    if (Platform.OS !== 'ios') setShowNextDuePicker(false);
    if (event.type === 'set' && picked != null) {
      draft.setNextDueOverride({
        dueDate: localDateToIso(picked),
        dueMileage: nextDue.dueMileage,
      });
    }
  }

  function clearNextDue() {
    draft.setNextDueOverride({ dueDate: null, dueMileage: null });
    setEditingNextDue(false);
    setShowNextDuePicker(false);
  }

  function restoreNextDue() {
    draft.setNextDueOverride(null);
    setEditingNextDue(false);
    setShowNextDuePicker(false);
  }

  const nextDueText = [
    nextDue.dueDate != null ? formatIsoLong(nextDue.dueDate) : null,
    nextDue.dueMileage != null ? nextDue.dueMileage.toLocaleString() + ' MI' : null,
  ]
    .filter((value): value is string => value != null)
    .join('  /  ');

  return (
    <View style={styles.page}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
          <View style={styles.top}>
            <GhostLink title="Back" onPress={() => router.back()} />
            <GhostLink title="Void" onPress={cancel} />
          </View>

          <Text style={styles.brand}>GLOVEBOX</Text>
          <Text style={styles.doc}>REPAIR ORDER  /  DATE & TOTAL</Text>

          <Text style={styles.job}>{def.label.toUpperCase()}</Text>
          {vehicle != null && (
            <Text style={styles.meta}>
              {vehicle.nickname.toUpperCase()}   {vehicle.mileage.toLocaleString()} MI
            </Text>
          )}

          <View style={styles.rule} />

          <Text style={styles.label}>DATE</Text>
          <View style={styles.choiceRow}>
            <Choice
              label="TODAY"
              selected={draft.date === today}
              onPress={() => {
                draft.setDate(today);
                setShowDatePicker(false);
              }}
            />
            <Choice
              label="YESTERDAY"
              selected={draft.date === yesterday}
              onPress={() => {
                draft.setDate(yesterday);
                setShowDatePicker(false);
              }}
            />
            <Choice
              label="PICK DATE"
              selected={draft.date !== today && draft.date !== yesterday}
              onPress={() => setShowDatePicker((value) => !value)}
            />
          </View>
          <Text style={styles.echo}>{formatIsoLong(draft.date).toUpperCase()}</Text>

          {showDatePicker && (
            <View style={styles.pickerWrap}>
              <DateTimePicker
                value={isoToLocalDate(draft.date)}
                mode="date"
                display={Platform.OS === 'ios' ? 'inline' : 'default'}
                maximumDate={new Date()}
                themeVariant="light"
                onChange={onDatePicked}
              />
              {Platform.OS === 'ios' && <GhostLink title="Done" onPress={() => setShowDatePicker(false)} />}
            </View>
          )}

          <View style={styles.rule} />

          <View style={styles.twoCol}>
            <View style={styles.fieldCol}>
              <Text style={styles.label}>ODOMETER</Text>
              <View style={styles.inputLine}>
                <TextInput
                  value={draft.mileage}
                  onChangeText={draft.setMileage}
                  placeholder="0"
                  placeholderTextColor={MUTE}
                  keyboardType="number-pad"
                  accessibilityLabel="Odometer"
                  style={styles.input}
                />
                <Text style={styles.affix}>MI</Text>
              </View>
            </View>

            <View style={styles.fieldCol}>
              <Text style={styles.label}>TOTAL</Text>
              <View style={styles.inputLine}>
                <Text style={styles.affix}>$</Text>
                <TextInput
                  value={draft.cost}
                  onChangeText={draft.setCost}
                  placeholder="0.00"
                  placeholderTextColor={MUTE}
                  keyboardType="decimal-pad"
                  accessibilityLabel="Total cost"
                  style={styles.input}
                />
              </View>
            </View>
          </View>

          <View style={styles.rule} />

          <View style={styles.nextHeader}>
            <View style={{ flex: 1 }}>
              <Text style={styles.label}>NEXT REMINDER</Text>
              <Text style={styles.nextValue}>{nextDueText || 'NO REMINDER SET'}</Text>
            </View>
            <GhostLink
              title={editingNextDue ? 'Close' : 'Change'}
              onPress={() => setEditingNextDue((value) => !value)}
            />
          </View>

          {editingNextDue && (
            <View style={styles.nextEdit}>
              <Text style={styles.label}>REMIND AT MILEAGE</Text>
              <View style={styles.inputLine}>
                <TextInput
                  value={nextDue.dueMileage != null ? String(nextDue.dueMileage) : ''}
                  onChangeText={(raw) => {
                    const digits = raw.replace(/[^\d]/g, '');
                    draft.setNextDueOverride({
                      dueDate: nextDue.dueDate,
                      dueMileage: digits === '' ? null : Number(digits),
                    });
                  }}
                  placeholder="0"
                  placeholderTextColor={MUTE}
                  keyboardType="number-pad"
                  accessibilityLabel="Next reminder mileage"
                  style={styles.input}
                />
                <Text style={styles.affix}>MI</Text>
              </View>

              <View style={styles.nextDateRow}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.label}>REMIND ON DATE</Text>
                  <Text style={styles.nextValue}>
                    {nextDue.dueDate != null ? formatIsoLong(nextDue.dueDate).toUpperCase() : 'NO DATE'}
                  </Text>
                </View>
                <GhostLink title="Pick date" onPress={() => setShowNextDuePicker((value) => !value)} />
              </View>

              {showNextDuePicker && (
                <View style={styles.pickerWrap}>
                  <DateTimePicker
                    value={isoToLocalDate(nextDue.dueDate ?? draft.date)}
                    mode="date"
                    display={Platform.OS === 'ios' ? 'inline' : 'default'}
                    minimumDate={new Date()}
                    themeVariant="light"
                    onChange={onNextDueDatePicked}
                  />
                  {Platform.OS === 'ios' && (
                    <GhostLink title="Done" onPress={() => setShowNextDuePicker(false)} />
                  )}
                </View>
              )}

              <View style={styles.nextActions}>
                <GhostLink title="No reminder" onPress={clearNextDue} />
                <GhostLink title="Use default" onPress={restoreNextDue} />
              </View>
            </View>
          )}
        </ScrollView>

        <WorkButton title="Add shop and notes" onPress={() => router.push('/service/log/extras')} />
      </KeyboardAvoidingView>
    </View>
  );
}

function Choice({
  label,
  selected,
  onPress,
}: {
  label: string;
  selected: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected }}
      onPress={onPress}
      style={[styles.choice, selected && styles.choiceOn]}
    >
      <Text style={[styles.choiceText, selected && styles.choiceTextOn]}>{label}</Text>
    </Pressable>
  );
}

const INK = '#111111';
const MUTE = '#5C5C5C';
const PAGE = '#F4EFE4';

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: PAGE },
  scroll: { paddingHorizontal: 22, paddingTop: 8, paddingBottom: 12 },
  top: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 18 },
  brand: { color: INK, fontSize: 28, fontWeight: '800', letterSpacing: -0.6 },
  doc: { color: INK, fontSize: 12, fontWeight: '800', letterSpacing: 1.5, marginTop: 2, marginBottom: 22 },
  job: { color: INK, fontSize: 20, fontWeight: '800' },
  meta: { color: MUTE, fontSize: 11, fontWeight: '700', letterSpacing: 0.8, marginTop: 4 },
  rule: { height: 1, backgroundColor: INK, marginVertical: 20, opacity: 0.85 },
  label: { color: MUTE, fontSize: 9, fontWeight: '800', letterSpacing: 1.1, marginBottom: 6 },
  choiceRow: { flexDirection: 'row', gap: 8 },
  choice: { flex: 1, borderWidth: 1, borderColor: INK, paddingVertical: 10, alignItems: 'center' },
  choiceOn: { backgroundColor: INK },
  choiceText: { color: INK, fontSize: 10, fontWeight: '800', letterSpacing: 0.7 },
  choiceTextOn: { color: PAGE },
  echo: { color: INK, fontSize: 16, fontWeight: '700', marginTop: 10 },
  pickerWrap: { marginTop: 12, borderTopWidth: 1, borderColor: INK, paddingTop: 8, alignItems: 'center' },
  twoCol: { flexDirection: 'row', gap: 18 },
  fieldCol: { flex: 1 },
  inputLine: { flexDirection: 'row', alignItems: 'baseline', borderBottomWidth: 1, borderColor: INK, minHeight: 42 },
  input: { flex: 1, color: INK, fontSize: 24, fontWeight: '700', paddingVertical: 6 },
  affix: { color: MUTE, fontSize: 12, fontWeight: '800', paddingHorizontal: 4 },
  nextHeader: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  nextValue: { color: INK, fontSize: 14, fontWeight: '700', lineHeight: 20 },
  nextEdit: { marginTop: 16, borderTopWidth: 1, borderColor: INK, paddingTop: 16 },
  nextDateRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, marginTop: 18 },
  nextActions: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 20 },
});
