import Constants from 'expo-constants';
import { Platform } from 'react-native';
import { DEFAULT_SETTINGS, STORAGE_KEYS } from '../constants/config';
import { FinancialReport, ShopSettings } from '../types/report';
import { Transaction } from '../types/transaction';
import { formatCurrency } from '../utils/calculations';
import { readJson } from './localStore';

type NotificationsModule = typeof import('expo-notifications');

const isExpoGo = Constants.executionEnvironment === 'storeClient';

let cachedModule: NotificationsModule | null = null;
let moduleUnavailable = false;
let handlerConfigured = false;
let permissionGranted = false;

function getNotifications(): NotificationsModule | null {
  if (isExpoGo || moduleUnavailable) return null;
  if (cachedModule) return cachedModule;
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    cachedModule = require('expo-notifications') as NotificationsModule;
    return cachedModule;
  } catch (error) {
    moduleUnavailable = true;
    console.warn('[BarberSync] Notifications are not available in this runtime.', error);
    return null;
  }
}

export function notificationsSupported(): boolean {
  return getNotifications() !== null;
}

export async function initNotifications(): Promise<boolean> {
  const Notifications = getNotifications();
  if (!Notifications) {
    console.log('[BarberSync] Running in Expo Go: notifications are disabled. Use a development build to enable them.');
    return false;
  }
  try {
    if (!handlerConfigured) {
      Notifications.setNotificationHandler({
        handleNotification: async () =>
          ({
            shouldShowAlert: true,
            shouldPlaySound: false,
            shouldSetBadge: false,
            shouldShowBanner: true,
            shouldShowList: true,
          }) as never,
      });
      handlerConfigured = true;
    }

    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync('default', {
        name: 'BarberSync',
        importance: Notifications.AndroidImportance.DEFAULT,
      });
    }

    const current = await Notifications.getPermissionsAsync();
    let status = current.status;
    if (status !== 'granted') {
      status = (await Notifications.requestPermissionsAsync()).status;
    }
    permissionGranted = status === 'granted';
    return permissionGranted;
  } catch (error) {
    console.warn('[BarberSync] Notifications could not be initialized.', error);
    return false;
  }
}

export const END_OF_DAY_HOUR = 20;
const END_OF_DAY_ID = 'barbersync-end-of-day';

async function currentSettings(): Promise<ShopSettings> {
  return readJson<ShopSettings>(STORAGE_KEYS.cachedSettings, DEFAULT_SETTINGS);
}

async function alertsEnabled(): Promise<boolean> {
  return (await currentSettings()).notificationsEnabled;
}

async function notify(title: string, body: string): Promise<void> {
  const Notifications = getNotifications();
  if (!Notifications || !permissionGranted) return;
  try {
    await Notifications.scheduleNotificationAsync({ content: { title, body }, trigger: null });
  } catch (error) {
    console.warn('[BarberSync] Could not show notification.', error);
  }
}

export async function notifyNewTransaction(transaction: Transaction): Promise<void> {
  if (!(await alertsEnabled())) return;
  await notify(
    'New transaction recorded',
    `${transaction.serviceName} by ${transaction.barberName} - ${formatCurrency(transaction.amount)} (${transaction.paymentMethod})`
  );
}

export async function notifyGcashPending(transaction: Transaction): Promise<void> {
  if (!(await alertsEnabled())) return;
  await notify(
    'GCash payment needs verification',
    `${transaction.customerName} - ${formatCurrency(transaction.amount)} - Ref ${transaction.gcashReference ?? 'n/a'}`
  );
}

export async function notifySyncCompleted(count: number): Promise<void> {
  if (count <= 0) return;
  if (!(await alertsEnabled())) return;
  await notify('Sync completed', `${count} offline transaction${count === 1 ? '' : 's'} uploaded.`);
}

export async function notifyEndOfDaySummary(report: FinancialReport): Promise<void> {
  const settings = await currentSettings();
  if (!settings.notificationsEnabled || !settings.endOfDaySummaryEnabled) return;
  await notify(
    "Today's summary",
    `${report.transactionCount} services - Revenue ${formatCurrency(report.grossRevenue)} - Shop ${formatCurrency(report.shopShare)}`
  );
}

export async function syncEndOfDaySchedule(settings: ShopSettings): Promise<void> {
  const Notifications = getNotifications();
  if (!Notifications) return;

  try {
    await Notifications.cancelScheduledNotificationAsync(END_OF_DAY_ID);
  } catch {
  }

  if (!settings.notificationsEnabled || !settings.endOfDaySummaryEnabled) return;

  try {
    await Notifications.scheduleNotificationAsync({
      identifier: END_OF_DAY_ID,
      content: {
        title: "Today's summary is ready",
        body: 'Open BarberSync to review revenue, payouts and pending GCash.',
      },
      trigger: { type: 'daily', hour: END_OF_DAY_HOUR, minute: 0 } as never,
    });
  } catch (error) {
    console.warn('[BarberSync] Could not schedule the end-of-day summary.', error);
  }
}

export async function getPushToken(): Promise<string | null> {
  const Notifications = getNotifications();
  const projectId = process.env.EXPO_PUBLIC_EAS_PROJECT_ID;
  if (!Notifications || !projectId) return null;
  try {
    const token = await Notifications.getExpoPushTokenAsync({ projectId });
    return token.data;
  } catch (error) {
    console.warn('[BarberSync] Push token unavailable (needs a development build).', error);
    return null;
  }
}