import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import React, { useEffect } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { useAuth } from '@/lib/auth/session';
import { getDb } from '@/lib/db/database';
import { startSyncLifecycle } from '@/lib/sync/engine';
import { palette } from '@/lib/theme';

// Open + migrate the database before first render.
getDb();

export default function RootLayout() {
  const status = useAuth((s) => s.status);
  const initialize = useAuth((s) => s.initialize);

  useEffect(() => {
    void initialize();
  }, [initialize]);

  useEffect(() => {
    if (status === 'signedIn') {
      return startSyncLifecycle();
    }
  }, [status]);

  if (status === 'loading') {
    return (
      <View style={{ flex: 1, backgroundColor: palette.bg.app, alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator color={palette.accent.primary} />
      </View>
    );
  }

  const hasAppAccess = status === 'signedIn' || status === 'localOnly';

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
        <Stack.Protected guard={hasAppAccess}>
          <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
          <Stack.Screen name="vehicle/add" options={{ presentation: 'modal', title: 'Add vehicle' }} />
          <Stack.Screen name="vehicle/[id]" options={{ title: 'Vehicle' }} />
          <Stack.Screen name="service/add" options={{ presentation: 'modal', title: 'Log service' }} />
          <Stack.Screen name="reminder/add" options={{ presentation: 'modal', title: 'New reminder' }} />
        </Stack.Protected>
        <Stack.Screen name="(auth)" options={{ headerShown: false }} />
      </Stack>
    </>
  );
}
