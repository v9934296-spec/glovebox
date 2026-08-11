import AsyncStorage from '@react-native-async-storage/async-storage';
import * as IntentLauncher from 'expo-intent-launcher';
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import { getActiveWorkspace } from '../db/database';
import { listReminders } from '../db/reminderRepo';
import { getVehicle } from '../db/vehicleRepo';

const ENABLED_KEY = 'glovebox.notifications.enabled';
const SENT_KEY_PREFIX = 'glovebox.notifications.sent:';
const CHANNEL_ID = 'maintenance';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: false,
    shouldSetBadge: false,
  }),
});

export async function notificationsEnabled(): Promise<boolean> { return (await AsyncStorage.getItem(ENABLED_KEY)) === '1'; }

async function requestAndroidAlarmAccessIfNeeded() {
  if (Platform.OS !== 'android' || Number(Platform.Version) < 31) return;
  try { await IntentLauncher.startActivityAsync(IntentLauncher.ActivityAction.REQUEST_SCHEDULE_EXACT_ALARM); } catch { }
}

export async function enableNotifications(): Promise<{ enabled: boolean; reason?: string }> {
  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync(CHANNEL_ID, { name: 'Maintenance reminders', importance: Notifications.AndroidImportance.DEFAULT });
  }
  let permissions = await Notifications.getPermissionsAsync();
  if (!permissions.granted) permissions = await Notifications.requestPermissionsAsync();
  if (!permissions.granted) return { enabled: false, reason: 'Notification permission was not granted.' };
  await requestAndroidAlarmAccessIfNeeded();
  await AsyncStorage.setItem(ENABLED_KEY, '1');
  try { await reconcileMaintenanceNotifications(); }
  catch (e) {
    await AsyncStorage.removeItem(ENABLED_KEY); await cancelGloveboxNotifications();
    return { enabled: false, reason: e instanceof Error ? e.message : 'Could not schedule maintenance reminders on this device.' };
  }
  return { enabled: true };
}

export async function disableNotifications() { await AsyncStorage.removeItem(ENABLED_KEY); await cancelGloveboxNotifications(); }
export async function cancelGloveboxNotifications() {
  const scheduled = await Notifications.getAllScheduledNotificationsAsync();
  await Promise.all(scheduled.filter((n) => n.content.data?.source === 'glovebox').map((n) => Notifications.cancelScheduledNotificationAsync(n.identifier)));
}
function localNineAm(dateIso: string): Date { const [y, m, d] = dateIso.split('-').map(Number); return new Date(y!, m! - 1, d!, 9, 0, 0, 0); }
async function readSent(workspace: string): Promise<Record<string, string>> { try { return JSON.parse((await AsyncStorage.getItem(`${SENT_KEY_PREFIX}${workspace}`)) ?? '{}') as Record<string, string>; } catch { return {}; } }

export async function reconcileMaintenanceNotifications() {
  if (!(await notificationsEnabled())) return;
  const permissions = await Notifications.getPermissionsAsync();
  if (!permissions.granted) return;
  await cancelGloveboxNotifications();
  const workspace = getActiveWorkspace();
  const sent = await readSent(workspace);
  const now = new Date();
  const reminders = listReminders({ status: 'active' });

  for (const reminder of reminders) {
    const vehicle = getVehicle(reminder.vehicleId); if (!vehicle) continue;
    const bodyBase = `${vehicle.nickname}: ${reminder.title}`;
    const signature = `${reminder.dueDate ?? ''}|${reminder.dueMileage ?? ''}`;
    const dueDate = reminder.dueDate ? localNineAm(reminder.dueDate) : null;
    const mileageReached = reminder.dueMileage != null && vehicle.mileage >= reminder.dueMileage;
    const dateReached = dueDate != null && dueDate.getTime() <= now.getTime();
    if ((mileageReached || dateReached) && sent[reminder.id] !== signature) {
      await Notifications.scheduleNotificationAsync({
        content: { title: 'Maintenance due', body: `${bodyBase}${mileageReached && reminder.dueMileage != null ? ` · ${reminder.dueMileage.toLocaleString()} mi` : ''}`, data: { source: 'glovebox', vehicleId: vehicle.id, url: `/vehicle/${vehicle.id}` } },
        trigger: null,
      });
      sent[reminder.id] = signature; continue;
    }
    if (dueDate && dueDate.getTime() > now.getTime()) {
      await Notifications.scheduleNotificationAsync({
        content: { title: 'Maintenance reminder', body: bodyBase, data: { source: 'glovebox', vehicleId: vehicle.id, url: `/vehicle/${vehicle.id}` } },
        trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: dueDate, ...(Platform.OS === 'android' ? { channelId: CHANNEL_ID } : {}) },
      });
    }
  }
  await AsyncStorage.setItem(`${SENT_KEY_PREFIX}${workspace}`, JSON.stringify(sent));
}
