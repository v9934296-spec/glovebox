import { Stack, useRouter } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import React, { useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, View } from 'react-native';
import { Button, Card, EmptyState, Field, PhotoTile, Screen, SectionHeader } from '@/components/ui';
import { useVehicles } from '@/lib/db/hooks';
import { createVehicle } from '@/lib/db/vehicleRepo';
import { validateVin } from '@/lib/domain/vin';
import { canAddVehicle } from '@/lib/monetization/entitlements';
import { useIsPro } from '@/lib/monetization/purchases';
import { palette, spacing } from '@/lib/theme';

type FormValues = {
  nickname: string;
  make: string;
  model: string;
  year: string;
  trim: string;
  mileage: string;
  licensePlate: string;
  vin: string;
  purchaseDate: string;
  purchasePrice: string;
};

const CURRENT_YEAR = new Date().getFullYear();
const fieldGap = { marginBottom: spacing.md } as const;
const fieldLast = { marginBottom: 0 } as const;

export default function AddVehicleScreen() {
  const router = useRouter();
  const vehicles = useVehicles();
  const isPro = useIsPro();
  const gate = canAddVehicle(vehicles.length, isPro);
  const [photoUri, setPhotoUri] = useState<string | null>(null);
  const { control, handleSubmit } = useForm<FormValues>({
    defaultValues: {
      nickname: '',
      make: '',
      model: '',
      year: '',
      trim: '',
      mileage: '',
      licensePlate: '',
      vin: '',
      purchaseDate: '',
      purchasePrice: '',
    },
  });

  async function pickPhoto() {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      quality: 0.7,
      allowsEditing: true,
      aspect: [4, 3],
    });
    const uri = result.assets?.[0]?.uri;
    if (!result.canceled && uri) setPhotoUri(uri);
  }

  const onSubmit = handleSubmit((values) => {
    const vinInput = values.vin.trim();
    const vinCheck = vinInput ? validateVin(vinInput) : null;
    // Normalize a well-formed VIN; otherwise keep the raw entry (rare — react-hook-form
    // already blocks submit on a validation error) rather than silently dropping it.
    const vin = vinCheck?.valid ? vinCheck.vin : vinInput || null;
    createVehicle({
      nickname: values.nickname.trim(),
      make: values.make.trim(),
      model: values.model.trim(),
      year: Number(values.year),
      trim: values.trim.trim() || null,
      vin,
      licensePlate: values.licensePlate.trim() || null,
      mileage: Number(values.mileage.replace(/[^\d]/g, '') || 0),
      purchaseDate: values.purchaseDate.trim() || null,
      purchasePrice: values.purchasePrice ? Number(values.purchasePrice.replace(/[^\d.]/g, '')) : null,
      photoUri,
      vinDecodedAt: null,
      vinDecoded: null,
      recallCheckedAt: null,
      recalls: [],
    });
    router.back();
  });

  if (!gate.allowed) {
    return (
      <Screen>
        <EmptyState
          title="Garage is full (free plan)"
          message={gate.reason}
          action={
            <View style={{ gap: spacing.md }}>
              <Button title="Upgrade to Pro" onPress={() => router.push('/paywall')} />
              <Button title="Not now" variant="ghost" onPress={() => router.back()} />
            </View>
          }
        />
      </Screen>
    );
  }

  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: palette.bg.app }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <Stack.Screen options={{ title: 'Add vehicle' }} />
      <ScrollView
        style={{ flex: 1, backgroundColor: palette.bg.app }}
        contentContainerStyle={{ padding: spacing.screenPadding, paddingBottom: spacing['2xl'] }}
        keyboardShouldPersistTaps="handled"
      >
        <PhotoTile uri={photoUri} emptyLabel="Add photo" onPress={() => void pickPhoto()} height={220} />

        <SectionHeader title="Basics" />
        <Card>
          <Controller
            control={control}
            name="nickname"
            rules={{ required: 'Give your vehicle a name' }}
            render={({ field, fieldState }) => (
              <Field
                label="Nickname"
                placeholder="e.g. Daily driver"
                value={field.value}
                onChangeText={field.onChange}
                error={fieldState.error?.message}
                containerStyle={fieldGap}
              />
            )}
          />
          <View style={styles.twoCol}>
            <View style={{ flex: 1 }}>
              <Controller
                control={control}
                name="make"
                rules={{ required: 'Required' }}
                render={({ field, fieldState }) => (
                  <Field
                    label="Make"
                    placeholder="Honda"
                    value={field.value}
                    onChangeText={field.onChange}
                    error={fieldState.error?.message}
                    containerStyle={fieldGap}
                  />
                )}
              />
            </View>
            <View style={{ flex: 1 }}>
              <Controller
                control={control}
                name="model"
                rules={{ required: 'Required' }}
                render={({ field, fieldState }) => (
                  <Field
                    label="Model"
                    placeholder="Civic"
                    value={field.value}
                    onChangeText={field.onChange}
                    error={fieldState.error?.message}
                    containerStyle={fieldGap}
                  />
                )}
              />
            </View>
          </View>
          <View style={styles.twoCol}>
            <View style={{ flex: 1 }}>
              <Controller
                control={control}
                name="year"
                rules={{
                  required: 'Required',
                  validate: (v) => {
                    const n = Number(v);
                    return (n >= 1900 && n <= CURRENT_YEAR + 1) || 'Invalid year';
                  },
                }}
                render={({ field, fieldState }) => (
                  <Field
                    label="Year"
                    placeholder="2015"
                    keyboardType="number-pad"
                    value={field.value}
                    onChangeText={field.onChange}
                    error={fieldState.error?.message}
                    containerStyle={fieldGap}
                  />
                )}
              />
            </View>
            <View style={{ flex: 1 }}>
              <Controller
                control={control}
                name="trim"
                render={({ field }) => (
                  <Field
                    label="Trim (optional)"
                    placeholder="EX-L"
                    value={field.value}
                    onChangeText={field.onChange}
                    containerStyle={fieldGap}
                  />
                )}
              />
            </View>
          </View>
          <Controller
            control={control}
            name="mileage"
            rules={{ required: 'Current mileage is required' }}
            render={({ field, fieldState }) => (
              <Field
                label="Current mileage"
                placeholder="82000"
                keyboardType="number-pad"
                value={field.value}
                onChangeText={field.onChange}
                error={fieldState.error?.message}
                containerStyle={fieldLast}
              />
            )}
          />
        </Card>

        <SectionHeader title="Identification (optional)" />
        <Card>
          <Controller
            control={control}
            name="licensePlate"
            render={({ field }) => (
              <Field
                label="License plate"
                placeholder="7ABC123"
                autoCapitalize="characters"
                value={field.value}
                onChangeText={field.onChange}
                containerStyle={fieldGap}
              />
            )}
          />
          <Controller
            control={control}
            name="vin"
            rules={{
              validate: (v) => {
                if (!v.trim()) return true;
                const check = validateVin(v);
                return check.valid || check.reason;
              },
            }}
            render={({ field, fieldState }) => (
              <Field
                label="VIN"
                placeholder="17 characters"
                autoCapitalize="characters"
                value={field.value}
                onChangeText={field.onChange}
                error={fieldState.error?.message}
                containerStyle={fieldLast}
              />
            )}
          />
        </Card>

        <SectionHeader title="Purchase (optional)" />
        <Card>
          <Controller
            control={control}
            name="purchaseDate"
            rules={{
              validate: (v) => !v || /^\d{4}-\d{2}-\d{2}$/.test(v) || 'Use YYYY-MM-DD',
            }}
            render={({ field, fieldState }) => (
              <Field
                label="Purchase date"
                placeholder="YYYY-MM-DD"
                value={field.value}
                onChangeText={field.onChange}
                error={fieldState.error?.message}
                containerStyle={fieldGap}
              />
            )}
          />
          <Controller
            control={control}
            name="purchasePrice"
            render={({ field }) => (
              <Field
                label="Purchase price"
                placeholder="12500"
                keyboardType="decimal-pad"
                value={field.value}
                onChangeText={field.onChange}
                containerStyle={fieldLast}
              />
            )}
          />
        </Card>

        <Button title="Add vehicle" onPress={onSubmit} style={{ marginTop: spacing.xl }} />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  twoCol: { flexDirection: 'row', gap: spacing.md },
});
