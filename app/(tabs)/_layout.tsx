import { Ionicons } from '@expo/vector-icons';
import { Tabs, useRouter } from 'expo-router';
import React from 'react';
import { Pressable } from 'react-native';
import { palette } from '@/lib/theme';

function HeaderAddButton({ label, href }: { label: string; href: '/vehicle/add' | '/reminder/add' }) {
  const router = useRouter();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={() => router.push(href)}
      style={{ marginRight: 12, padding: 4 }}
      hitSlop={8}
    >
      <Ionicons name="add" size={26} color={palette.accent.primary} />
    </Pressable>
  );
}

export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{
        headerStyle: { backgroundColor: palette.bg.app },
        headerShadowVisible: false,
        headerTintColor: palette.text.primary,
        headerTitleStyle: { fontWeight: '700', fontSize: 22 },
        tabBarStyle: {
          backgroundColor: palette.bg.raised,
          borderTopColor: palette.border.subtle,
          borderTopWidth: 1,
        },
        tabBarActiveTintColor: palette.accent.primary,
        tabBarInactiveTintColor: palette.text.tertiary,
        tabBarLabelStyle: { fontSize: 11, fontWeight: '600' },
        sceneStyle: { backgroundColor: palette.bg.app },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Glovebox',
          tabBarLabel: 'Overview',
          tabBarIcon: ({ color, size }) => <Ionicons name="speedometer-outline" size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="garage"
        options={{
          title: 'My Garage',
          tabBarLabel: 'Garage',
          headerRight: () => <HeaderAddButton label="Add vehicle" href="/vehicle/add" />,
          tabBarIcon: ({ color, size }) => <Ionicons name="car-sport-outline" size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="reminders"
        options={{
          title: 'Reminders',
          tabBarLabel: 'Reminders',
          headerRight: () => <HeaderAddButton label="New reminder" href="/reminder/add" />,
          tabBarIcon: ({ color, size }) => <Ionicons name="notifications-outline" size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          title: 'Settings',
          tabBarLabel: 'More',
          tabBarIcon: ({ color, size }) => <Ionicons name="ellipsis-horizontal-circle-outline" size={size} color={color} />,
        }}
      />
    </Tabs>
  );
}
