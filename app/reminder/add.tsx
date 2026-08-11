import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Button, Chip, EmptyState, Field, SectionHeader } from '@/components/ui';
import { useVehicles } from '@/lib/db/hooks';
import { createReminder } from '@/lib/db/reminderRepo';
import { serviceTypeDef, SERVICE_TYPES } from '@/lib/domain/serviceTypes';
import { isValidIsoDate } from '@/lib/domain/date';
import type { RecurrenceType } from '@/lib/domain/types';
import { palette, spacing, typography } from '@/lib/theme';

const RECURRENCE_OPTIONS: Array<{ id: RecurrenceType; label: string }> = [
  { id: 'none', label: 'One time' },
  { id: 'date', label: 'By time' },
  { id: 'mileage', label: 'By miles' },
  { id: 'both', label: 'Time or miles' },
];

export default function AddReminderScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ vehicleId?: string }>();
  const vehicles = useVehicles();
  const [vehicleId, setVehicleId] = useState<string | undefined>(params.vehicleId ?? vehicles[0]?.id);
  const vehicle = vehicles.find((v) => v.id === vehicleId);

  const [category, setCategory] = useState('oil_change');
  const [title, setTitle] = useState('Oil change');
  const [titleTouched, setTitleTouched] = useState(false);
  const [dueDate, setDueDate] = useState('');
  const [dueMileage, setDueMileage] = useState('');
  const [recurrence, setRecurrence] = useState<RecurrenceType>('none');
  const [intervalMonths, setIntervalMonths] = useState('');
  const [intervalMiles, setIntervalMiles] = useState('');
  const [error, setError] = useState<string | null>(null);

  function selectCategory(id: string) {
    setCategory(id);
    if (!titleTouched) setTitle(serviceTypeDef(id).label);
    const def = serviceTypeDef(id);
    if (def.defaultIntervalMonths && !intervalMonths) setIntervalMonths(String(def.defaultIntervalMonths));
    if (def.defaultIntervalMiles && !intervalMiles) setIntervalMiles(String(def.defaultIntervalMiles));
  }

  function save() {
    if (!vehicle) return;
    if (!title.trim()) {
      setError('Title is required');
      return;
    }
    if (dueDate && !isValidIsoDate(dueDate)) {
      setError('Due date must be a real YYYY-MM-DD date');
      return;
    }
    if (!dueDate && !dueMileage) {
      setError('Set a due date, due mileage, or both');
      return;
    }
    const wantsDate = recurrence === 'date' || recurrence === 'both';
    const wantsMiles = recurrence === 'mileage' || recurrence === 'both';
    if (wantsDate && !intervalMonths) {
      setError('Set the repeat interval in months');
      return;
    }
    if (wantsMiles && !intervalMiles) {
      setError('Set the repeat interval in miles');
      return;
    }
    createReminder({
      vehicleId: vehicle.id,
      title: title.trim(),
      category,
      dueDate: dueDate || null,
      dueMileage: dueMileage ? Number(dueMileage.replace(/[^\d]/g, '')) : null,
      recurrenceType: recurrence,
      recurrenceIntervalMonths: wantsDate ? Number(intervalMonths) : null,
      recurrenceIntervalMiles: wantsMiles ? Number(intervalMiles.replace(/[^\d]/g, '')) : null,
    });
    router.back();
  }

  if (vehicles.length === 0) {
    return (
      <View style={styles.screen}>
        <EmptyState title="No vehicles" message="Add a vehicle first, then create reminders for it." />
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

        <SectionHeader title="What for" />
        <View style={styles.chipWrap}>
          {SERVICE_TYPES.map((t) => (
            <Chip key={t.id} label={t.label} selected={t.id === category} onPress={() => selectCategory(t.id)} />
          ))}
        </View>

        <Field
          label="Title"
          placeholder="Oil change"
          value={title}
          onChangeText={(t) => {
            setTitleTouched(true);
            setTitle(t);
          }}
        />

        <SectionHeader title="Due" />
        <View style={styles.twoCol}>
          <View style={{ flex: 1 }}>
            <Field label="Due date" placeholder="YYYY-MM-DD" value={dueDate} onChangeText={setDueDate} />
          </View>
          <View style={{ flex: 1 }}>
            <Field
              label="Due mileage"
              placeholder={vehicle ? String(vehicle.mileage + 5000) : '85000'}
              keyboardType="number-pad"
              value={dueMileage}
              onChangeText={setDueMileage}
            />
          </View>
        </View>

        <SectionHeader title="Repeats" />
        <View style={styles.chipWrap}>
          {RECURRENCE_OPTIONS.map((o) => (
            <Chip key={o.id} label={o.label} selected={recurrence === o.id} onPress={() => setRecurrence(o.id)} />
          ))}
        </View>
        {(recurrence === 'date' || recurrence === 'both') && (
          <Field
            label="Every N months"
            placeholder="6"
            keyboardType="number-pad"
            value={intervalMonths}
            onChangeText={setIntervalMonths}
          />
        )}
        {(recurrence === 'mileage' || recurrence === 'both') && (
          <Field
            label="Every N miles"
            placeholder="5000"
            keyboardType="number-pad"
            value={intervalMiles}
            onChangeText={setIntervalMiles}
          />
        )}

        {error != null && <Text style={styles.error}>{error}</Text>}
        <Button title="Create reminder" onPress={save} style={{ marginTop: spacing.sm }} />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: palette.bg.app },
  chipWrap: { flexDirection: 'row', flexWrap: 'wrap' },
  twoCol: { flexDirection: 'row', gap: spacing.md },
  error: { color: palette.status.overdue, fontSize: typography.caption.size, marginBottom: spacing.sm },
});