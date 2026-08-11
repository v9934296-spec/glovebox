import { Stack } from 'expo-router';
import React from 'react';
import { palette } from '@/lib/theme';

export default function AuthLayout() {
  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: palette.bg.app },
        headerShadowVisible: false,
        headerTintColor: palette.text.primary,
        contentStyle: { backgroundColor: palette.bg.app },
      }}
    >
      <Stack.Screen name="sign-in" options={{ headerShown: false }} />
      <Stack.Screen name="sign-up" options={{ title: 'Create account' }} />
      <Stack.Screen name="forgot-password" options={{ title: 'Reset password' }} />
      <Stack.Screen name="reset-password" options={{ title: 'Choose new password' }} />
    </Stack>
  );
}