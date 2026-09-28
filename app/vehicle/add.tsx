import { Stack, useRouter } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import React, { useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { Image, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { BayButton, BayField, BayLink, BayPaint, BayRoom, Slats } from '@/components/bay';
import { bay } from '@/lib/bay';
import { useVehicles } from '@/lib/db/hooks';
import { createVehicle } from '@/lib/db/vehicleRepo';
import { validateVin } from '@/lib/domain/vin';
import { canAddVehicle } from '@/lib/monetization/entitlements';
import { useIsPro } from '@/lib/monetization/purchases';

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
      <BayRoom>
        <View style={styles.pad}>
          <BayPaint>BAY FULL</BayPaint>
          <Text style={styles.hint}>{gate.reason.toUpperCase()}</Text>
          <BayLink title="See Pro" onPress={() => router.push('/paywall')} />
        </View>
      </BayRoom>
    );
  }

  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: bay.room }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <Stack.Screen options={{ title: 'Add vehicle' }} />
      <ScrollView
        style={{ flex: 1, backgroundColor: bay.room }}
        contentContainerStyle={styles.scroll}
        keyboardShouldPersistTaps="handled"
      >
        <Pressable accessibilityRole="button" accessibilityLabel="Add photo" onPress={() => void pickPhoto()}>
          {photoUri ? (
            <Image source={{ uri: photoUri }} style={styles.photo} />
          ) : (
            <View style={styles.photoEmpty}>
              <Slats count={5} />
              <Text style={styles.photoHint}>PULL A PHOTO IN</Text>
            </View>
          )}
        </Pressable>

        <Text style={styles.section}>VEHICLE</Text>
        <Controller
          control={control}
          name="nickname"
          rules={{ required: 'Give your vehicle a name' }}
          render={({ field, fieldState }) => (
            <>
              <BayField
                label="Nickname"
                placeholder="Daily driver"
                value={field.value}
                onChangeText={field.onChange}
              />
              {fieldState.error?.message ? <Text style={styles.err}>{fieldState.error.message}</Text> : null}
            </>
          )}
        />
        <View style={styles.twoCol}>
          <View style={{ flex: 1 }}>
            <Controller
              control={control}
              name="make"
              rules={{ required: 'Required' }}
              render={({ field, fieldState }) => (
                <>
                  <BayField label="Make" placeholder="Honda" value={field.value} onChangeText={field.onChange} />
                  {fieldState.error?.message ? <Text style={styles.err}>{fieldState.error.message}</Text> : null}
                </>
              )}
            />
          </View>
          <View style={{ flex: 1 }}>
            <Controller
              control={control}
              name="model"
              rules={{ required: 'Required' }}
              render={({ field, fieldState }) => (
                <>
                  <BayField label="Model" placeholder="Civic" value={field.value} onChangeText={field.onChange} />
                  {fieldState.error?.message ? <Text style={styles.err}>{fieldState.error.message}</Text> : null}
                </>
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
                <>
                  <BayField
                    label="Year"
                    placeholder="2015"
                    keyboardType="number-pad"
                    value={field.value}
                    onChangeText={field.onChange}
                  />
                  {fieldState.error?.message ? <Text style={styles.err}>{fieldState.error.message}</Text> : null}
                </>
              )}
            />
          </View>
          <View style={{ flex: 1 }}>
            <Controller
              control={control}
              name="trim"
              render={({ field }) => (
                <BayField label="Trim" placeholder="EX-L" value={field.value} onChangeText={field.onChange} />
              )}
            />
          </View>
        </View>
        <Controller
          control={control}
          name="mileage"
          rules={{ required: 'Current mileage is required' }}
          render={({ field, fieldState }) => (
            <>
              <BayField
                label="Mileage"
                placeholder="82000"
                keyboardType="number-pad"
                value={field.value}
                onChangeText={field.onChange}
              />
              {fieldState.error?.message ? <Text style={styles.err}>{fieldState.error.message}</Text> : null}
            </>
          )}
        />

        <Text style={styles.section}>IDENTIFIERS</Text>
        <Controller
          control={control}
          name="licensePlate"
          render={({ field }) => (
            <BayField
              label="License plate"
              placeholder="7ABC123"
              autoCapitalize="characters"
              value={field.value}
              onChangeText={field.onChange}
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
            <>
              <BayField
                label="VIN"
                placeholder="17 characters"
                autoCapitalize="characters"
                value={field.value}
                onChangeText={field.onChange}
              />
              {fieldState.error?.message ? <Text style={styles.err}>{fieldState.error.message}</Text> : null}
            </>
          )}
        />
        <Text style={styles.hint}>WE'LL DECODE MAKE/MODEL WHEN POSSIBLE</Text>

        <Text style={styles.section}>OPTIONAL</Text>
        <Controller
          control={control}
          name="purchaseDate"
          rules={{
            validate: (v) => !v || /^\d{4}-\d{2}-\d{2}$/.test(v) || 'Use YYYY-MM-DD',
          }}
          render={({ field, fieldState }) => (
            <>
              <BayField
                label="Purchase date"
                placeholder="YYYY-MM-DD"
                value={field.value}
                onChangeText={field.onChange}
              />
              {fieldState.error?.message ? <Text style={styles.err}>{fieldState.error.message}</Text> : null}
            </>
          )}
        />
        <Controller
          control={control}
          name="purchasePrice"
          render={({ field }) => (
            <BayField
              label="Purchase price"
              placeholder="12500"
              keyboardType="decimal-pad"
              value={field.value}
              onChangeText={field.onChange}
            />
          )}
        />

        <BayButton title="Save vehicle" onPress={onSubmit} />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  pad: { flex: 1, justifyContent: 'center', padding: 20, gap: 16 },
  scroll: { padding: 20, paddingBottom: 40 },
  photo: { width: '100%', height: 160, marginBottom: 20 },
  photoEmpty: { height: 160, backgroundColor: bay.fallback, justifyContent: 'flex-end', marginBottom: 20 },
  photoHint: {
    color: bay.orange,
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 1.6,
    textAlign: 'center',
    paddingVertical: 16,
    textDecorationLine: 'underline',
  },
  section: {
    color: bay.due,
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 1.4,
    marginTop: 8,
    marginBottom: 10,
  },
  twoCol: { flexDirection: 'row', gap: 16 },
  hint: { color: bay.hint, fontSize: 10, fontWeight: '800', letterSpacing: 0.8, marginBottom: 16, marginTop: -4 },
  err: { color: bay.orange, fontSize: 11, fontWeight: '700', marginTop: -10, marginBottom: 10 },
});
