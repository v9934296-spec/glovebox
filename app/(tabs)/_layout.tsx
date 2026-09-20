import { Ionicons } from '@expo/vector-icons';
import { Tabs, useRouter } from 'expo-router';
import React from 'react';
import { Pressable, StyleSheet, Text } from 'react-native';
import { palette } from '@/lib/theme';

function HeaderAdd({ label, href }: { label: string; href: '/vehicle/add' | '/reminder/add' }) {
  const router = useRouter();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={() => router.push(href)}
      style={{ marginRight: 16, padding: 4 }}
      hitSlop={8}
    >
      <Text style={{ color: palette.accent.primary, fontSize: 16, fontWeight: '600' }}>{label}</Text>
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
        headerTitleStyle: { fontWeight: '600', fontSize: 18 },
        tabBarStyle: {
          backgroundColor: palette.bg.raised,
          borderTopColor: palette.border.subtle,
          borderTopWidth: StyleSheet.hairlineWidth,
        },
        tabBarActiveTintColor: palette.text.primary,
        tabBarInactiveTintColor: palette.text.tertiary,
        tabBarLabelStyle: { fontSize: 11, fontWeight: '500' },
        sceneStyle: { backgroundColor: palette.bg.app },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Overview',
          tabBarLabel: 'Overview',
          tabBarIcon: ({ color, size }) => <Ionicons name="reader-outline" size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="garage"
        options={{
          title: 'Garage',
          tabBarLabel: 'Garage',
          headerRight: () => <HeaderAdd label="Add car" href="/vehicle/add" />,
          tabBarIcon: ({ color, size }) => <Ionicons name="car-outline" size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="reminders"
        options={{
          title: 'Reminders',
          tabBarLabel: 'Reminders',
          headerRight: () => <HeaderAdd label="Add" href="/reminder/add" />,
          tabBarIcon: ({ color, size }) => <Ionicons name="time-outline" size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          title: 'Settings',
          tabBarLabel: 'Settings',
          tabBarIcon: ({ color, size }) => <Ionicons name="settings-outline" size={size} color={color} />,
        }}
      />
    </Tabs>
  );
}