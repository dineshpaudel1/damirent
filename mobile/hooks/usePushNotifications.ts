import { useEffect } from 'react';
import { Platform } from 'react-native';
import { authService } from '@/services/auth.service';

/**
 * Registers this device for Expo push notifications and syncs the token
 * to the backend. Silently no-ops if expo-notifications is not installed.
 *
 * @param enabled - pass `isAuthenticated` so we only register when logged in
 */
export function usePushNotifications(enabled: boolean): void {
  useEffect(() => {
    if (!enabled) return;

    async function register() {
      try {
        // Dynamic import so the app doesn't crash if expo-notifications isn't installed.
        // Install with: npx expo install expo-notifications
        /* eslint-disable import/no-unresolved */
        // @ts-expect-error expo-notifications is an optional peer dependency
        const Notifications = await import('expo-notifications').catch(() => null);
        /* eslint-enable import/no-unresolved */
        if (!Notifications) return;

        // Request permission
        const { status: existingStatus } = await Notifications.getPermissionsAsync();
        let finalStatus = existingStatus;
        if (existingStatus !== 'granted') {
          const { status } = await Notifications.requestPermissionsAsync();
          finalStatus = status;
        }
        if (finalStatus !== 'granted') return;

        // Get Expo push token — projectId should match your EAS project
        const tokenData = await Notifications.getExpoPushTokenAsync({
          projectId: undefined, // Replace with your EAS project ID string, e.g. 'abc-123'
        });
        const token = tokenData.data;

        // Register with backend
        await authService.registerPushToken(token);

        // Configure how notifications are displayed while the app is in the foreground
        Notifications.setNotificationHandler({
          handleNotification: async () => ({
            shouldShowAlert: true,
            shouldPlaySound: true,
            shouldSetBadge: true,
          }),
        });

        // Android requires an explicit notification channel
        if (Platform.OS === 'android') {
          await Notifications.setNotificationChannelAsync('default', {
            name: 'default',
            importance: Notifications.AndroidImportance.MAX,
            vibrationPattern: [0, 250, 250, 250],
          });
        }
      } catch (err) {
        // Push is non-critical — swallow errors so the app keeps working
        console.warn('[usePushNotifications] Registration failed:', err);
      }
    }

    void register();
  }, [enabled]);
}
