/**
 * Shared building blocks for multi-step flows.
 * Every color/size comes from lib/theme; nothing here talks to the database.
 */
import { Ionicons } from '@expo/vector-icons';
import DateTimePicker, { type DateTimePickerEvent } from '@react-native-community/datetimepicker';
import React, { useState } from 'react';
import {
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
  type KeyboardTypeOptions,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { addDaysIso, formatIsoLong, isoToLocalDate, localDateToIso } from '@/lib/domain/dates';
import { todayIso } from '@/lib/domain/due';
import type { ServiceTypeDef } from '@/lib/domain/serviceTypes';
import { palette, radius, spacing, typography } from '@/lib/theme';

type IconName = React.ComponentProps<typeof Ionicons>['name'];

/** Domain files keep icons as plain strings; widen at the render boundary. */
export function icon(name: string): IconName {
  return name as IconName;
}

export function StepProgress({ step, total }: { step: number; total: number }) {
  return (
    <View
      style={styles.progress}
      accessibilityRole="progressbar"
      accessibilityLabel={`Step ${step} of ${total}`}
    >
      {Array.from({ length: total }, (_, i) => (
        <View
          key={i}
          style={[styles.progressBar, i < step && { backgroundColor: palette.accent.primary }]}
        />
      ))}
    </View>
  );
}

export function FlowHeader({
  step,
  total,
  onBack,
  onCancel,
}: {
  step: number;
  total: number;
  onBack?: () => void;
  onCancel: () => void;
}) {
  return (
    <View style={styles.flowHeader}>
      <Pressable
        onPress={onBack}
        disabled={onBack == null}
        hitSlop={12}
        accessibilityRole="button"
        accessibilityLabel="Back"
        style={{ opacity: onBack == null ? 0 : 1 }}
      >
        <Ionicons name="chevron-back" size={24} color={palette.text.primary} />
      </Pressable>
      <Text style={styles.stepCount}>
        Step {step} of {total}
      </Text>
      <Pressable onPress={onCancel} hitSlop={12} accessibilityRole="button">
        <Text style={styles.cancelText}>Cancel</Text>
      </Pressable>
    </View>
  );
}

export function ServiceTypeGrid({
  types,
  selectedId,
  onSelect,
}: {
  types: ServiceTypeDef[];
  selectedId: string | null;
  onSelect: (id: string) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const visible = expanded ? types : types.slice(0, 5);

  return (
    <View style={styles.grid}>
      {visible.map((type) => {
        const selected = type.id === selectedId;
        return (
          <Pressable
            key={type.id}
            onPress={() => onSelect(type.id)}
            accessibilityRole="button"
            accessibilityState={{ selected }}
            style={({ pressed }) => [
              styles.gridTile,
              selected && styles.gridTileSelected,
              pressed && { opacity: 0.7 },
            ]}
          >
            <Ionicons
              name={icon(type.icon)}
              size={24}
              color={selected ? palette.accent.primary : palette.text.secondary}
            />
            <Text
              style={[styles.gridLabel, selected && { color: palette.text.primary }]}
              numberOfLines={2}
            >
              {type.label}
            </Text>
          </Pressable>
        );
      })}
      {!expanded && (
        <Pressable
          onPress={() => setExpanded(true)}
          accessibilityRole="button"
          accessibilityLabel="Show all service types"
          style={({ pressed }) => [styles.gridTile, pressed && { opacity: 0.7 }]}
        >
          <Ionicons name="ellipsis-horizontal" size={24} color={palette.text.secondary} />
          <Text style={styles.gridLabel}>More</Text>
        </Pressable>
      )}
    </View>
  );
}

export function ScanBanner({
  onPress,
  locked,
  loading,
}: {
  onPress: () => void;
  locked: boolean;
  loading?: boolean;
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={loading}
      accessibilityRole="button"
      style={({ pressed }) => [styles.scanBanner, pressed && { opacity: 0.85 }]}
    >
      <Ionicons name="camera-outline" size={22} color={palette.accent.primary} />
      <View style={{ flex: 1 }}>
        <Text style={styles.scanTitle}>{loading ? 'Reading receipt…' : 'Scan a receipt'}</Text>
        <Text style={styles.scanSubtitle}>Fills the whole record in</Text>
      </View>
      {locked && (
        <View style={styles.proPill}>
          <Text style={styles.proPillText}>Pro</Text>
        </View>
      )}
    </Pressable>
  );
}

export function DateChips({ value, onChange }: { value: string; onChange: (iso: string) => void }) {
  const [picking, setPicking] = useState(false);
  const today = todayIso();
  const yesterday = addDaysIso(today, -1);

  function onPicked(event: DateTimePickerEvent, picked?: Date) {
    if (Platform.OS !== 'ios') setPicking(false);
    if (event.type === 'set' && picked) onChange(localDateToIso(picked));
  }

  const isCustom = value !== today && value !== yesterday;

  return (
    <View>
      <View style={styles.chipRow}>
        <DateChip label="Today" selected={value === today} onPress={() => onChange(today)} />
        <DateChip label="Yesterday" selected={value === yesterday} onPress={() => onChange(yesterday)} />
        <Pressable
          onPress={() => setPicking((p) => !p)}
          accessibilityRole="button"
          accessibilityLabel="Pick a date"
          accessibilityState={{ selected: isCustom }}
          style={[styles.dateChip, styles.dateChipIcon, isCustom && styles.dateChipSelected]}
        >
          <Ionicons
            name="calendar-outline"
            size={18}
            color={isCustom ? palette.text.onAccent : palette.text.secondary}
          />
        </Pressable>
      </View>
      {isCustom && !picking && <Text style={styles.dateEcho}>{formatIsoLong(value)}</Text>}
      {picking && (
        <View style={styles.pickerWrap}>
          <DateTimePicker
            value={isoToLocalDate(value)}
            mode="date"
            display={Platform.OS === 'ios' ? 'inline' : 'default'}
            maximumDate={new Date()}
            themeVariant="dark"
            accentColor={palette.accent.primary}
            onChange={onPicked}
          />
          {Platform.OS === 'ios' && (
            <Pressable onPress={() => setPicking(false)} accessibilityRole="button" hitSlop={8}>
              <Text style={styles.pickerDone}>Done</Text>
            </Pressable>
          )}
        </View>
      )}
    </View>
  );
}

function DateChip({
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
      accessibilityRole="button"
      accessibilityState={{ selected }}
      style={[styles.dateChip, { flex: 1 }, selected && styles.dateChipSelected]}
    >
      <Text style={[styles.dateChipText, selected && styles.dateChipTextSelected]}>{label}</Text>
    </Pressable>
  );
}

/** Large single-value input — the odometer and cost fields on step 2. */
export function BigValueField({
  label,
  value,
  onChangeText,
  placeholder,
  prefix,
  suffix,
  hint,
  keyboardType = 'number-pad',
  emphasized,
}: {
  label: string;
  value: string;
  onChangeText: (next: string) => void;
  placeholder?: string;
  prefix?: string;
  suffix?: string;
  hint?: string;
  keyboardType?: KeyboardTypeOptions;
  emphasized?: boolean;
}) {
  return (
    <View style={{ marginBottom: spacing.lg }}>
      <Text style={styles.overline}>{label.toUpperCase()}</Text>
      <View style={[styles.bigField, emphasized === true && { borderColor: palette.border.default }]}>
        {prefix != null && <Text style={styles.bigAffix}>{prefix}</Text>}
        <TextInput
          value={value}
          onChangeText={onChangeText}
          placeholder={placeholder}
          placeholderTextColor={palette.text.tertiary}
          keyboardType={keyboardType}
          accessibilityLabel={label}
          style={styles.bigInput}
        />
        {suffix != null && <Text style={styles.bigAffix}>{suffix}</Text>}
      </View>
      {hint != null && <Text style={styles.hint}>{hint}</Text>}
    </View>
  );
}

/** The "we'll remind you" confirmable sentence. */
export function NextDueCard({
  dueDate,
  dueMileage,
  summary,
  onChange,
}: {
  dueDate: string | null;
  dueMileage: number | null;
  summary: string;
  onChange: () => void;
}) {
  const hasAny = dueDate != null || dueMileage != null;
  return (
    <View style={styles.nextDue}>
      <View style={styles.nextDueTop}>
        <Ionicons name="notifications-outline" size={16} color={palette.accent.primary} />
        <Text style={styles.nextDueLabel}>NEXT REMINDER</Text>
      </View>
      <Text style={styles.nextDueValue}>{hasAny ? summary : 'No reminder for this one'}</Text>
      <Pressable onPress={onChange} hitSlop={8} accessibilityRole="button">
        <Text style={styles.nextDueChange}>{hasAny ? 'Change' : 'Add one'}</Text>
      </Pressable>
    </View>
  );
}

/** Read-back row for the scan-confirm screen. The dot marks AI-filled values. */
export function ReviewRow({
  label,
  value,
  aiFilled,
  missing,
  onPress,
  last,
}: {
  label: string;
  value: string;
  aiFilled?: boolean;
  missing?: boolean;
  onPress: () => void;
  last?: boolean;
}) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${label}: ${value}${aiFilled === true ? ', filled from the receipt' : ''}`}
      style={({ pressed }) => [styles.reviewRow, last !== true && styles.reviewBorder, pressed && { opacity: 0.7 }]}
    >
      <Text style={styles.reviewLabel}>{label}</Text>
      <View style={styles.reviewValueWrap}>
        <Text style={[styles.reviewValue, missing === true && { color: palette.text.tertiary }]}>{value}</Text>
        {aiFilled === true && <View style={styles.aiDot} />}
      </View>
    </Pressable>
  );
}

export function FlowFooter({
  primaryLabel,
  onPrimary,
  primaryDisabled,
  secondaryLabel,
  onSecondary,
  style,
}: {
  primaryLabel: string;
  onPrimary: () => void;
  primaryDisabled?: boolean;
  secondaryLabel?: string;
  onSecondary?: () => void;
  style?: StyleProp<ViewStyle>;
}) {
  return (
    <View style={[styles.footer, style]}>
      {secondaryLabel != null && onSecondary != null && (
        <Pressable
          onPress={onSecondary}
          accessibilityRole="button"
          style={({ pressed }) => [styles.footerSecondary, pressed && { opacity: 0.7 }]}
        >
          <Text style={styles.footerSecondaryText}>{secondaryLabel}</Text>
        </Pressable>
      )}
      <Pressable
        onPress={onPrimary}
        disabled={primaryDisabled}
        accessibilityRole="button"
        style={({ pressed }) => [
          styles.footerPrimary,
          pressed && { backgroundColor: palette.accent.primaryPressed },
          primaryDisabled === true && { opacity: 0.4 },
        ]}
      >
        <Text style={styles.footerPrimaryText}>{primaryLabel}</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  progress: { flexDirection: 'row', gap: spacing.xs, marginBottom: spacing.lg },
  progressBar: { flex: 1, height: 3, borderRadius: 2, backgroundColor: palette.border.subtle },
  flowHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.lg,
  },
  stepCount: {
    color: palette.text.secondary,
    fontSize: typography.bodyEmphasis.size,
    fontWeight: typography.bodyEmphasis.weight,
  },
  cancelText: { color: palette.text.secondary, fontSize: typography.body.size },
  overline: {
    color: palette.text.tertiary,
    fontSize: typography.overline.size,
    fontWeight: typography.overline.weight,
    letterSpacing: typography.overline.letterSpacing,
    marginBottom: spacing.sm,
  },
  hint: { color: palette.text.tertiary, fontSize: typography.caption.size, marginTop: spacing.xs },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  gridTile: {
    width: '31%',
    minHeight: 84,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.xs,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: palette.border.subtle,
    backgroundColor: palette.bg.surface,
  },
  gridTileSelected: {
    borderColor: palette.accent.primary,
    backgroundColor: palette.bg.surfaceRaised,
  },
  gridLabel: {
    color: palette.text.secondary,
    fontSize: typography.caption.size,
    textAlign: 'center',
  },
  scanBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.lg,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: palette.border.default,
    backgroundColor: palette.bg.surface,
    marginBottom: spacing.xl,
  },
  scanTitle: {
    color: palette.text.primary,
    fontSize: typography.bodyEmphasis.size,
    fontWeight: typography.bodyEmphasis.weight,
  },
  scanSubtitle: { color: palette.text.secondary, fontSize: typography.caption.size, marginTop: 2 },
  proPill: {
    borderRadius: radius.label,
    borderWidth: 1,
    borderColor: palette.accent.primary,
    paddingHorizontal: spacing.sm,
    paddingVertical: 3,
    backgroundColor: palette.accent.soft,
  },
  proPillText: {
    color: palette.accent.primary,
    fontSize: typography.overline.size,
    fontWeight: typography.overline.weight,
    letterSpacing: 0.6,
    textTransform: 'uppercase',
  },
  chipRow: { flexDirection: 'row', gap: spacing.sm },
  dateChip: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    borderRadius: radius.md,
    backgroundColor: palette.bg.surface,
    borderWidth: 1,
    borderColor: palette.border.subtle,
  },
  dateChipIcon: { width: 52 },
  dateChipSelected: {
    backgroundColor: palette.accent.primary,
    borderColor: palette.accent.primary,
  },
  dateChipText: { color: palette.text.secondary, fontSize: typography.body.size },
  dateChipTextSelected: { color: palette.text.onAccent, fontWeight: '600' },
  dateEcho: { color: palette.text.secondary, fontSize: typography.caption.size, marginTop: spacing.sm },
  pickerWrap: {
    marginTop: spacing.sm,
    borderRadius: radius.md,
    backgroundColor: palette.bg.surface,
    paddingBottom: spacing.sm,
    alignItems: 'center',
  },
  pickerDone: {
    color: palette.accent.primary,
    fontSize: typography.bodyEmphasis.size,
    fontWeight: '600',
    paddingVertical: spacing.sm,
  },
  bigField: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: palette.bg.surface,
    borderWidth: 1,
    borderColor: palette.border.subtle,
    borderRadius: radius.md,
    paddingHorizontal: spacing.lg,
  },
  bigInput: {
    flex: 1,
    color: palette.text.primary,
    fontSize: 26,
    fontWeight: '600',
    paddingVertical: 14,
  },
  bigAffix: { color: palette.text.tertiary, fontSize: typography.body.size },
  nextDue: {
    backgroundColor: palette.bg.surface,
    borderLeftWidth: 3,
    borderLeftColor: palette.accent.primary,
    borderWidth: 1,
    borderRadius: radius.md,
    borderColor: palette.border.subtle,
    padding: spacing.lg,
    marginBottom: spacing.lg,
  },
  nextDueTop: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs, marginBottom: spacing.xs },
  nextDueLabel: {
    color: palette.accent.primary,
    fontSize: typography.overline.size,
    fontWeight: typography.overline.weight,
    letterSpacing: typography.overline.letterSpacing,
  },
  nextDueValue: { color: palette.text.primary, fontSize: typography.body.size },
  nextDueChange: {
    color: palette.accent.primary,
    fontSize: typography.caption.size,
    fontWeight: '600',
    marginTop: spacing.sm,
  },
  reviewRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 14,
    paddingHorizontal: spacing.lg,
  },
  reviewBorder: { borderBottomWidth: 1, borderBottomColor: palette.border.subtle },
  reviewLabel: { color: palette.text.tertiary, fontSize: typography.caption.size },
  reviewValueWrap: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, flexShrink: 1 },
  reviewValue: { color: palette.text.primary, fontSize: typography.body.size, textAlign: 'right' },
  aiDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: palette.accent.primary },
  footer: { flexDirection: 'row', gap: spacing.md, marginTop: spacing.xl },
  footerSecondary: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: palette.border.default,
  },
  footerSecondaryText: { color: palette.text.secondary, fontSize: typography.bodyEmphasis.size },
  footerPrimary: {
    flex: 2,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    borderRadius: radius.md,
    backgroundColor: palette.accent.primary,
  },
  footerPrimaryText: {
    color: palette.text.onAccent,
    fontSize: typography.bodyEmphasis.size,
    fontWeight: '700',
  },
});
