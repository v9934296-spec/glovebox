import { Stack } from 'expo-router';
import React from 'react';
import { palette } from '@/lib/theme';

/** Each step owns its own header (FlowHeader), so the native one stays hidden. */
export default function LogServiceLayout() {
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: palette.bg.app },
        animation: 'slide_from_right',
      }}
    >
      <Stack.Screen name="index" />
      <Stack.Screen name="when" />
      <Stack.Screen name="extras" />
      <Stack.Screen name="confirm" />
    </Stack>
  );
}
