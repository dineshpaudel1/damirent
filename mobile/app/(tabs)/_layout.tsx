import { Redirect, Tabs } from 'expo-router';
import { StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useQuery } from '@tanstack/react-query';
import { useAuthStore } from '@/store/auth.store';
import { bookingService } from '@/services/booking.service';
import { Colors, Typography } from '@/constants/theme';
import { useNotificationSocket } from '@/hooks/useNotificationSocket';
import { usePushNotifications } from '@/hooks/usePushNotifications';

type IoniconName = keyof typeof Ionicons.glyphMap;

function TabIcon({
  focused,
  icon,
  iconFocused,
}: {
  focused: boolean;
  icon: IoniconName;
  iconFocused: IoniconName;
}) {
  return (
    <View style={styles.iconWrap}>
      <Ionicons
        name={focused ? iconFocused : icon}
        size={22}
        color={focused ? Colors.tabBarActive : Colors.tabBarInactive}
      />
      {focused && <View style={styles.dot} />}
    </View>
  );
}

export default function TabLayout() {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);

  const { data: notifData } = useQuery({
    queryKey: ['notifications'],
    queryFn: () => bookingService.listNotifications(),
    refetchInterval: 60_000,
    enabled: isAuthenticated,
  });
  const unreadCount = notifData?.results?.filter((n) => !n.is_read).length ?? 0;
  useNotificationSocket(isAuthenticated);
  usePushNotifications(isAuthenticated);

  if (!isAuthenticated) {
    return <Redirect href="/(auth)/login" />;
  }

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle: styles.tabBar,
        tabBarActiveTintColor: Colors.tabBarActive,
        tabBarInactiveTintColor: Colors.tabBarInactive,
        tabBarLabelStyle: styles.tabLabel,
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Home',
          tabBarIcon: ({ focused }) => (
            <TabIcon focused={focused} icon="home-outline" iconFocused="home" />
          ),
        }}
      />
      <Tabs.Screen
        name="search"
        options={{
          title: 'Search',
          tabBarIcon: ({ focused }) => (
            <TabIcon focused={focused} icon="search-outline" iconFocused="search" />
          ),
        }}
      />
      <Tabs.Screen
        name="bookings"
        options={{
          title: 'Bookings',
          tabBarIcon: ({ focused }) => (
            <TabIcon focused={focused} icon="calendar-outline" iconFocused="calendar" />
          ),
        }}
      />
      <Tabs.Screen
        name="inbox"
        options={{
          title: 'Inbox',
          tabBarBadge: unreadCount > 0 ? (unreadCount > 99 ? '99+' : unreadCount) : undefined,
          tabBarBadgeStyle: styles.badge,
          tabBarIcon: ({ focused }) => (
            <TabIcon focused={focused} icon="notifications-outline" iconFocused="notifications" />
          ),
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: 'Profile',
          tabBarIcon: ({ focused }) => (
            <TabIcon focused={focused} icon="person-outline" iconFocused="person" />
          ),
        }}
      />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  tabBar: {
    backgroundColor: Colors.tabBar,
    borderTopColor: Colors.tabBarBorder,
    borderTopWidth: StyleSheet.hairlineWidth,
    height: 62,
    paddingBottom: 8,
    paddingTop: 4,
  },
  tabLabel: {
    fontFamily: Typography.fontFamily.medium,
    fontSize: 10,
  },
  iconWrap: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: 3,
  },
  dot: {
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: Colors.tabBarActive,
  },
  badge: {
    fontSize: 10,
    fontFamily: Typography.fontFamily.bold,
    minWidth: 16,
    height: 16,
    lineHeight: 16,
    paddingHorizontal: 3,
  },
});
