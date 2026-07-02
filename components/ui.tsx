import React from 'react';
import {
  ActivityIndicator,
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
import { palette, radius, spacing, typography } from '@/lib/theme';

export function Screen({ children, style }: { children: React.ReactNode; style?: StyleProp<ViewStyle> }) {
  return <View style={[styles.screen, style]}>{children}</View>;
}

export function Card({ children, style }: { children: React.ReactNode; style?: StyleProp<ViewStyle> }) {
  return <View style={[styles.card, style]}>{children}</View>;
}

export function SectionHeader({ title, right }: { title: string; right?: React.ReactNode }) {
  return (
    <View style={styles.sectionHeader}>
      <Text style={styles.sectionTitle}>{title.toUpperCase()}</Text>
      {right}
    </View>
  );
}

export function Button({
  title,
  onPress,
  variant = 'primary',
  disabled,
  loading,
  style,
}: {
  title: string;
  onPress: () => void;
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger';
  disabled?: boolean;
  loading?: boolean;
  style?: StyleProp<ViewStyle>;
}) {
  const isPrimary = variant === 'primary';
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      disabled={disabled || loading}
      style={({ pressed }) => [
        styles.button,
        variant === 'primary' && { backgroundColor: pressed ? palette.accent.primaryPressed : palette.accent.primary },
        variant === 'secondary' && styles.buttonSecondary,
        variant === 'ghost' && styles.buttonGhost,
        variant === 'danger' && styles.buttonDanger,
        (disabled || loading) && { opacity: 0.5 },
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={isPrimary ? palette.text.onAccent : palette.text.primary} />
      ) : (
        <Text
          style={[
            styles.buttonText,
            isPrimary && { color: palette.text.onAccent },
            variant === 'danger' && { color: palette.status.overdue },
          ]}
        >
          {title}
        </Text>
      )}
    </Pressable>
  );
}

export function Field({
  label,
  error,
  ...inputProps
}: TextInputProps & { label: string; error?: string }) {
  return (
    <View style={styles.field}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <TextInput
        placeholderTextColor={palette.text.tertiary}
        style={[styles.input, error != null && { borderColor: palette.status.overdue }]}
        {...inputProps}
      />
      {error != null && <Text style={styles.fieldError}>{error}</Text>}
    </View>
  );
}

const DUE_BADGE: Record<DueState, { label: string; color: string } | null> = {
  overdue: { label: 'Overdue', color: palette.status.overdue },
  due_soon: { label: 'Due soon', color: palette.status.dueSoon },
  upcoming: { label: 'Upcoming', color: palette.status.ok },
  no_due: null,
};

export function DueBadge({ state }: { state: DueState }) {
  const config = DUE_BADGE[state];
  if (!config) return null;
  return (
    <View style={[styles.badge, { borderColor: config.color }]}>
      <Text style={[styles.badgeText, { color: config.color }]}>{config.label}</Text>
    </View>
  );
}

export function StatTile({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <Card style={styles.statTile}>
      <Text style={styles.statLabel}>{label}</Text>
      <Text style={styles.statValue}>{value}</Text>
      {hint != null && <Text style={styles.statHint}>{hint}</Text>}
    </Card>
  );
}

export function EmptyState({
  title,
  message,
  action,
}: {
  title: string;
  message: string;
  action?: React.ReactNode;
}) {
  return (
    <View style={styles.empty}>
      <Text style={styles.emptyTitle}>{title}</Text>
      <Text style={styles.emptyMessage}>{message}</Text>
      {action != null && <View style={{ marginTop: spacing.lg }}>{action}</View>}
    </View>
  );
}

export function Chip({
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
      onPress={onPress}
      style={[styles.chip, selected && { backgroundColor: palette.accent.primary, borderColor: palette.accent.primary }]}
    >
      <Text style={[styles.chipText, selected && { color: palette.text.onAccent, fontWeight: '600' }]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: palette.bg.app,
    padding: spacing.screenPadding,
  },
  card: {
    backgroundColor: palette.bg.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: palette.border.subtle,
    padding: spacing.lg,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: spacing.xl,
    marginBottom: spacing.sm,
  },
  sectionTitle: {
    color: palette.text.tertiary,
    fontSize: typography.overline.size,
    fontWeight: typography.overline.weight,
    letterSpacing: typography.overline.letterSpacing,
  },
  button: {
    borderRadius: radius.md,
    paddingVertical: 14,
    paddingHorizontal: spacing.lg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonSecondary: {
    backgroundColor: palette.bg.surfaceRaised,
    borderWidth: 1,
    borderColor: palette.border.default,
  },
  buttonGhost: {
    backgroundColor: 'transparent',
  },
  buttonDanger: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: palette.status.overdue,
  },
  buttonText: {
    color: palette.text.primary,
    fontSize: typography.bodyEmphasis.size,
    fontWeight: typography.bodyEmphasis.weight,
  },
  field: {
    marginBottom: spacing.lg,
  },
  fieldLabel: {
    color: palette.text.secondary,
    fontSize: typography.caption.size,
    marginBottom: spacing.xs,
    fontWeight: '500',
  },
  input: {
    backgroundColor: palette.bg.surface,
    borderWidth: 1,
    borderColor: palette.border.default,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: 12,
    color: palette.text.primary,
    fontSize: typography.body.size,
  },
  fieldError: {
    color: palette.status.overdue,
    fontSize: typography.caption.size,
    marginTop: spacing.xs,
  },
  badge: {
    borderWidth: 1,
    borderRadius: radius.pill,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    alignSelf: 'flex-start',
  },
  badgeText: {
    fontSize: typography.caption.size,
    fontWeight: '600',
  },
  statTile: {
    flex: 1,
    padding: spacing.md,
  },
  statLabel: {
    color: palette.text.tertiary,
    fontSize: typography.caption.size,
  },
  statValue: {
    color: palette.text.primary,
    fontSize: typography.h3.size,
    fontWeight: typography.h3.weight,
    marginTop: spacing.xs,
  },
  statHint: {
    color: palette.text.tertiary,
    fontSize: typography.caption.size,
    marginTop: 2,
  },
  empty: {
    alignItems: 'center',
    paddingVertical: spacing['2xl'],
    paddingHorizontal: spacing.xl,
  },
  emptyTitle: {
    color: palette.text.primary,
    fontSize: typography.h3.size,
    fontWeight: typography.h3.weight,
  },
  emptyMessage: {
    color: palette.text.secondary,
    fontSize: typography.body.size,
    textAlign: 'center',
    marginTop: spacing.sm,
    lineHeight: typography.body.lineHeight,
  },
  chip: {
    borderWidth: 1,
    borderColor: palette.border.default,
    backgroundColor: palette.bg.surface,
    borderRadius: radius.pill,
    paddingHorizontal: spacing.md,
    paddingVertical: 6,
    marginRight: spacing.sm,
    marginBottom: spacing.sm,
  },
  chipText: {
    color: palette.text.secondary,
    fontSize: typography.caption.size,
  },
});
