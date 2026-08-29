import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import React, { useEffect } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { AppErrorBoundary } from '@/components/AppErrorBoundary';
import { HeaderBackButton } from '@/components/HeaderBackButton';
import { canAccessApp } from '@/lib/auth/ownership';
import { useAuth } from '@/lib/auth/session';
import { getDb } from '@/lib/db/database';
import { identifyPurchasesUser, useEntitlements } from '@/lib/monetization/purchases';
import { startSyncLifecycle } from '@/lib/sync/engine';
import { palette } from '@/lib/theme';

// Open + migrate the database before first render.
getDb();

export default function RootLayout() {
  return (
    <AppErrorBoundary>
      <RootLayoutContent />
    </AppErrorBoundary>
  );
}

function RootLayoutContent() {
  const status = useAuth((s) => s.status);
  const session = useAuth((s) => s.session);
  const initialize = useAuth((s) => s.initialize);
  const initializePurchases = useEntitlements((s) => s.initialize);
  const purchasesStatus = useEntitlements((s) => s.status);

  useEffect(() => {
    void initialize();
    void initializePurchases();
  }, [initialize, initializePurchases]);

  useEffect(() => {
    if (status === 'signedIn') {
      return startSyncLifecycle();
    }
  }, [status]);

  // Keep the RevenueCat identity in step with the Supabase account so Pro
  // follows the user across devices.
  useEffect(() => {
    if (purchasesStatus !== 'ready' || status === 'loading') return;
    void identifyPurchasesUser(session?.user.id ?? null);
  }, [purchasesStatus, status, session?.user.id]);

  if (status === 'loading') {
    return (
      <View style={{ flex: 1, backgroundColor: palette.bg.app, alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator color={palette.accent.primary} />
      </View>
    );
  }

  const hasAppAccess = canAccessApp(status);

  return (
    <>
      <StatusBar style="light" />
      <Stack
        screenOptions={{
          headerStyle: { backgroundColor: palette.bg.app },
          headerTintColor: palette.text.primary,
          headerTitleStyle: { fontWeight: '600' },
          contentStyle: { backgroundColor: palette.bg.app },
          headerBackVisible: false,
          headerLeft: () => <HeaderBackButton />,
        }}
      >
        <Stack.Protected guard={hasAppAccess}>
          <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
          <Stack.Screen name="vehicle/add" options={{ presentation: 'modal', title: 'Add vehicle' }} />
          <Stack.Screen name="vehicle/[id]" options={{ title: 'Vehicle' }} />
          <Stack.Screen name="service/log" options={{ presentation: 'modal', headerShown: false }} />
          <Stack.Screen name="reminder/add" options={{ presentation: 'modal', title: 'New reminder' }} />
          <Stack.Screen name="ai/assistant" options={{ presentation: 'modal', title: 'AI assistant' }} />
          <Stack.Screen name="paywall" options={{ presentation: 'modal', title: 'Glovebox Pro' }} />
        </Stack.Protected>
        <Stack.Screen name="(auth)" options={{ headerShown: false }} />
      </Stack>
    </>
  );
}
