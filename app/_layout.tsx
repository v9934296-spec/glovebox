import * as Notifications from 'expo-notifications';
import { Stack, useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import React, { useEffect, useRef } from 'react';
import { ActivityIndicator, Alert, View } from 'react-native';
import { useAuth } from '@/lib/auth/session';
import { getDb, useDataVersion } from '@/lib/db/database';
import { identifyPurchasesUser, useEntitlements } from '@/lib/monetization/purchases';
import { cancelGloveboxNotifications, reconcileMaintenanceNotifications } from '@/lib/notifications/reminders';
import { startSyncLifecycle } from '@/lib/sync/engine';
import { palette } from '@/lib/theme';

getDb();

export default function RootLayout() {
  const router = useRouter();
  const status = useAuth((s) => s.status);
  const session = useAuth((s) => s.session);
  const needsLocalImportDecision = useAuth((s) => s.needsLocalImportDecision);
  const resolveLocalImport = useAuth((s) => s.resolveLocalImport);
  const initialize = useAuth((s) => s.initialize);
  const initializePurchases = useEntitlements((s) => s.initialize);
  const purchasesStatus = useEntitlements((s) => s.status);
  const dataVersion = useDataVersion((s) => s.version);
  const importPromptOpen = useRef(false);

  useEffect(() => { void initialize(); void initializePurchases(); }, [initialize, initializePurchases]);

  useEffect(() => {
    if (!needsLocalImportDecision || importPromptOpen.current) return;
    importPromptOpen.current = true;
    Alert.alert(
      'Local garage found',
      `This device already has local-only Glovebox data. Move it into ${session?.user.email ?? 'this account'} so it can sync, or keep it separate on this device.`,
      [
        { text: 'Keep separate', onPress: () => { void resolveLocalImport('keep').finally(() => { importPromptOpen.current = false; }); } },
        { text: 'Move to my account', onPress: () => { void resolveLocalImport('move').finally(() => { importPromptOpen.current = false; }); } },
      ],
      { cancelable: false },
    );
  }, [needsLocalImportDecision, resolveLocalImport, session?.user.email]);

  useEffect(() => {
    if (status === 'signedIn' && !needsLocalImportDecision) return startSyncLifecycle();
  }, [status, needsLocalImportDecision, session?.user.id]);

  useEffect(() => {
    if (purchasesStatus !== 'ready' || status === 'loading') return;
    void identifyPurchasesUser(session?.user.id ?? null);
  }, [purchasesStatus, status, session?.user.id]);

  useEffect(() => {
    if ((status === 'signedIn' && !needsLocalImportDecision) || status === 'localOnly') void reconcileMaintenanceNotifications();
    else void cancelGloveboxNotifications();
  }, [status, needsLocalImportDecision, dataVersion]);

  useEffect(() => {
    const openResponse = (response: Notifications.NotificationResponse | null) => {
      const url = response?.notification.request.content.data?.url;
      if (typeof url === 'string' && url.startsWith('/')) router.push(url as never);
    };
    void Notifications.getLastNotificationResponseAsync().then(openResponse);
    const sub = Notifications.addNotificationResponseReceivedListener(openResponse);
    return () => sub.remove();
  }, [router]);

  if (status === 'loading') {
    return <View style={{ flex: 1, backgroundColor: palette.bg.app, alignItems: 'center', justifyContent: 'center' }}><ActivityIndicator color={palette.accent.primary} /></View>;
  }

  const hasAppAccess = status === 'signedIn' || status === 'localOnly';
  return <><StatusBar style="light"/><Stack screenOptions={{headerStyle:{backgroundColor:palette.bg.app},headerTintColor:palette.text.primary,headerTitleStyle:{fontWeight:'600'},contentStyle:{backgroundColor:palette.bg.app}}}>
    <Stack.Protected guard={hasAppAccess}>
      <Stack.Screen name="(tabs)" options={{headerShown:false}}/>
      <Stack.Screen name="vehicle/add" options={{presentation:'modal',title:'Add vehicle'}}/>
      <Stack.Screen name="vehicle/edit" options={{presentation:'modal',title:'Edit vehicle'}}/>
      <Stack.Screen name="vehicle/[id]" options={{title:'Vehicle'}}/>
      <Stack.Screen name="service/add" options={{presentation:'modal',title:'Log service'}}/>
      <Stack.Screen name="service/edit" options={{presentation:'modal',title:'Edit service'}}/>
      <Stack.Screen name="fuel/add" options={{presentation:'modal',title:'Log fuel'}}/>
      <Stack.Screen name="fuel/edit" options={{presentation:'modal',title:'Edit fuel'}}/>
      <Stack.Screen name="reminder/add" options={{presentation:'modal',title:'New reminder'}}/>
      <Stack.Screen name="reminder/edit" options={{presentation:'modal',title:'Edit reminder'}}/>
      <Stack.Screen name="ai/assistant" options={{presentation:'modal',title:'AI assistant'}}/>
      <Stack.Screen name="paywall" options={{presentation:'modal',title:'Glovebox Pro'}}/>
      <Stack.Screen name="legal/privacy" options={{title:'Privacy'}}/>
      <Stack.Screen name="legal/terms" options={{title:'Terms'}}/>
    </Stack.Protected>
    <Stack.Screen name="(auth)" options={{headerShown:false}}/>
  </Stack></>;
}
