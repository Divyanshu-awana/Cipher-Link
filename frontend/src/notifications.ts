import { Platform } from "react-native";
import * as Notifications from "expo-notifications";
import AsyncStorage from "@react-native-async-storage/async-storage";

const MUTED_KEY = "muted_convs_v1";

// Foreground presentation — show a banner/alert even when app is open
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
    // Legacy keys for older SDKs
    shouldShowAlert: true,
  }),
});

let permissionRequested = false;

export async function ensureNotificationPermission(): Promise<boolean> {
  try {
    const existing = await Notifications.getPermissionsAsync();
    if (existing.granted) return true;
    if (permissionRequested && !existing.canAskAgain) return false;
    permissionRequested = true;
    const req = await Notifications.requestPermissionsAsync({
      ios: {
        allowAlert: true,
        allowBadge: true,
        allowSound: true,
      },
    });
    if (Platform.OS === "android") {
      await Notifications.setNotificationChannelAsync("messages", {
        name: "Messages",
        importance: Notifications.AndroidImportance.HIGH,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: "#1A73E8",
        sound: "default",
      });
    }
    return !!req.granted;
  } catch {
    return false;
  }
}

export async function showLocalNotification(opts: {
  title: string;
  body: string;
  data?: Record<string, any>;
  convId?: string;
}) {
  try {
    // Respect mute list
    if (opts.convId) {
      const raw = (await AsyncStorage.getItem(MUTED_KEY)) || "[]";
      const muted: string[] = JSON.parse(raw);
      if (muted.includes(opts.convId)) return;
    }
    await Notifications.scheduleNotificationAsync({
      content: {
        title: opts.title,
        body: opts.body,
        data: opts.data || {},
        sound: "default",
      },
      trigger: null, // immediate
    });
  } catch {}
}

export async function setConvMuted(convId: string, muted: boolean) {
  try {
    const raw = (await AsyncStorage.getItem(MUTED_KEY)) || "[]";
    const list: string[] = JSON.parse(raw);
    const next = muted
      ? Array.from(new Set([...list, convId]))
      : list.filter((x) => x !== convId);
    await AsyncStorage.setItem(MUTED_KEY, JSON.stringify(next));
  } catch {}
}

export async function clearConvNotifications() {
  try {
    await Notifications.dismissAllNotificationsAsync();
    await Notifications.setBadgeCountAsync(0);
  } catch {}
}
