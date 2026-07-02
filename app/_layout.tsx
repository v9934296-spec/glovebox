import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import React from 'react';
import { getDb } from '@/lib/db/database';
import { palette } from '@/lib/theme';

// Open + migrate the database before first render.
getDb();

export default function RootLayout() {
  return (
    <>
      <StatusBar style="light" />
      <Stack
        screenOptions={{
          headerStyle: { backgroundColor: palette.bg.app },
          headerTintColor: palette.text.primary,
          headerTitleStyle: { fontWeight: '600' },
          contentStyle: { backgroundColor: palette.bg.app },
        }}
      >
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="vehicle/add" options={{ presentation: 'modal', title: 'Add vehicle' }} />
        <Stack.Screen name="vehicle/[id]" options={{ title: 'Vehicle' }} />
        <Stack.Screen name="service/add" options={{ presentation: 'modal', title: 'Log service' }} />
        <Stack.Screen name="reminder/add" options={{ presentation: 'modal', title: 'New reminder' }} />
      </Stack>
    </>
  );
}
