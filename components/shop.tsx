import React from 'react';
import {
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
  type StyleProp,
  type TextInputProps,
  type ViewStyle,
} from 'react-native';
import type { DueState } from '@/lib/domain/due';
import { palette, spacing, typography } from '@/lib/theme';

export function ShopScreen({
  children,
  style,
}: {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
}) {
  return <View style={[styles.screen, style]}>{children}</View>;
}

export function Rule() {
  return <View style={styles.rule} />;
}

export function Mute({ children }: { children: string }) {
  return <Text style={styles.mute}>{children}</Text>;
}

export function DueWord({ state }: { state: DueState }) {
  if (state === 'no_due') return null;
  const color =
    state === 'overdue' ? palette.status.overdue : state === 'due_soon' ? palette.status.dueSoon : palette.text.tertiary;
  const label = state === 'overdue' ? 'Overdue' : state === 'due_soon' ? 'Soon' : 'Later';
  return <Text style={[styles.dueWord, { color }]}>{label}</Text>;
}

export function TextButton({
  label,
  onPress,
  tone = 'accent',
}: {
  label: string;
  onPress: () => void;
  tone?: 'accent' | 'danger' | 'mute';
}) {
  const color =
    tone === 'danger' ? palette.accent.danger : tone === 'mute' ? palette.text.tertiary : palette.accent.primary;
  return (
    <Pressable onPress={onPress} hitSlop={8} accessibilityRole="button">
      <Text style={[styles.textBtn, { color }]}>{label}</Text>
    </Pressable>
  );
}

export function SolidButton({
  title,
  onPress,
  disabled,
}: {
  title: string;
  onPress: () => void;
  disabled?: boolean;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => [
        styles.solid,
        pressed && { backgroundColor: palette.accent.primaryPressed },
        disabled && { opacity: 0.45 },
      ]}
    >
      <Text style={styles.solidText}>{title}</Text>
    </Pressable>
  );
}

export function ShopField({ label, ...input }: { label: string } & TextInputProps) {
  return (
    <View style={styles.field}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <TextInput
        placeholderTextColor={palette.text.tertiary}
        {...input}
        style={[styles.fieldInput, input.style]}
      />
    </View>
  );
}

export function ShopPick({
  label,
  selected,
  onPress,
}: {
  label: string;
  selected: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected }}
      onPress={onPress}
      style={styles.pick}
    >
      <Text style={[styles.pickText, selected && styles.pickOn]}>{label}</Text>
    </Pressable>
  );
}

export function ShopRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.row}>
      <Text style={styles.rowLabel}>{label}</Text>
      <Text style={styles.rowValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: palette.bg.app },
  rule: { height: StyleSheet.hairlineWidth, backgroundColor: palette.border.subtle },
  mute: {
    color: palette.text.tertiary,
    fontSize: typography.caption.size,
    lineHeight: typography.caption.lineHeight,
  },
  dueWord: { fontSize: typography.caption.size, fontWeight: '600' },
  textBtn: { fontSize: typography.bodyEmphasis.size, fontWeight: '600' },
  solid: {
    backgroundColor: palette.accent.primary,
    paddingVertical: 14,
    paddingHorizontal: spacing.lg,
    alignItems: 'center',
  },
  solidText: {
    color: palette.text.onAccent,
    fontSize: typography.bodyEmphasis.size,
    fontWeight: '600',
  },
  field: { gap: 4, marginBottom: spacing.md },
  fieldLabel: {
    color: palette.text.tertiary,
    fontSize: typography.overline.size,
    fontWeight: '500',
  },
  fieldInput: {
    color: palette.text.primary,
    fontSize: typography.body.size,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: palette.border.subtle,
    paddingVertical: 8,
  },
  pick: { paddingVertical: 6, paddingRight: 12 },
  pickText: { color: palette.text.tertiary, fontSize: typography.caption.size, fontWeight: '600' },
  pickOn: { color: palette.text.primary },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: spacing.md,
    paddingVertical: spacing.md,
  },
  rowLabel: { color: palette.text.primary, fontSize: typography.body.size },
  rowValue: { color: palette.text.tertiary, fontSize: typography.body.size, flexShrink: 1, textAlign: 'right' },
});