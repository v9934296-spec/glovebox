import { Stack } from 'expo-router';
import React from 'react';
import { paper } from '@/components/form';

export default function LogServiceLayout() {
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: paper.sheet },
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
