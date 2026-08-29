import { Ionicons } from '@expo/vector-icons';
import { type Href, useRouter } from 'expo-router';
import React from 'react';
import { Platform, Pressable } from 'react-native';
import { dismissScreen } from '@/lib/nav';
import { palette } from '@/lib/theme';

/** Header control that pops the stack, or replaces to `fallback` if there is no history. */
export function HeaderBackButton({ fallback = '/' }: { fallback?: Href }) {
  const router = useRouter();
  function onBack() {
    dismissScreen(
      {
        canGoBack: () => router.canGoBack(),
        back: () => router.back(),
        replace: (href) => {
          router.replace(href as Href);
        },
      },
      typeof fallback === 'string' ? fallback : '/',
    );
  }
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="Go back"
      hitSlop={12}
      onPress={onBack}
      style={{
        paddingHorizontal: Platform.OS === 'ios' ? 4 : 8,
        marginLeft: Platform.OS === 'android' ? 4 : 0,
      }}
    >
      <Ionicons
        name={Platform.OS === 'ios' ? 'chevron-back' : 'arrow-back'}
        size={26}
        color={palette.text.primary}
      />
    </Pressable>
  );
}
