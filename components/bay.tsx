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
import { bay } from '@/lib/bay';

export function BayRoom({
  children,
  style,
}: {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
}) {
  return <View style={[styles.room, style]}>{children}</View>;
}

export function Slats({ count = 6 }: { count?: number }) {
  return (
    <View style={styles.slats}>
      {Array.from({ length: count }).map((_, i) => (
        <View key={i} style={styles.slat} />
      ))}
    </View>
  );
}

export function HangTag({ name, miles }: { name: string; miles: string }) {
  return (
    <View style={styles.tag}>
      <Text style={styles.tagName}>{name.toUpperCase()}</Text>
      <Text style={styles.tagMi}>{miles.toUpperCase()}</Text>
    </View>
  );
}

export function BayPaint({ children }: { children: string }) {
  return <Text style={styles.bayPaint}>{children}</Text>;
}

export function BayScore({ score }: { score: number }) {
  return (
    <View style={styles.scoreWrap}>
      <Text style={styles.scoreLabel}>HEALTH</Text>
      <Text style={styles.score}>{score}</Text>
    </View>
  );
}

export function BayHair() {
  return <View style={styles.hair} />;
}

export function BayLink({
  title,
  onPress,
  tone = 'orange',
  disabled,
}: {
  title: string;
  onPress: () => void;
  tone?: 'orange' | 'cream' | 'mute' | 'danger';
  disabled?: boolean;
}) {
  const color =
    tone === 'cream'
      ? bay.cream
      : tone === 'mute'
        ? bay.due
        : tone === 'danger'
          ? bay.orange
          : bay.orange;
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      disabled={disabled}
      hitSlop={8}
      style={disabled ? { opacity: 0.35 } : undefined}
    >
      <Text style={[styles.link, { color }]}>{title.toUpperCase()}</Text>
    </Pressable>
  );
}

export function BayButton({
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
      style={({ pressed }) => [styles.work, pressed && { opacity: 0.75 }, disabled && { opacity: 0.35 }]}
    >
      <Text style={styles.workText}>{title.toUpperCase()}</Text>
    </Pressable>
  );
}

export function BayField({
  label,
  ...input
}: { label: string } & TextInputProps) {
  return (
    <View style={styles.field}>
      <Text style={styles.fieldLabel}>{label.toUpperCase()}</Text>
      <TextInput
        placeholderTextColor={bay.due}
        {...input}
        style={[styles.fieldInput, input.style]}
      />
    </View>
  );
}

export function BayPick({
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
      <Text style={[styles.pickText, selected && styles.pickOn]}>{label.toUpperCase()}</Text>
    </Pressable>
  );
}

export function BayRow({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <View style={styles.row}>
      <Text style={styles.rowLabel}>{label.toUpperCase()}</Text>
      <Text style={styles.rowValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  room: { flex: 1, backgroundColor: bay.room },
  slats: { paddingTop: 8, paddingHorizontal: 10, gap: 4 },
  slat: { height: 10, backgroundColor: bay.slat },
  tag: {
    backgroundColor: bay.cream,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderWidth: 1,
    borderColor: bay.ink,
  },
  tagName: {
    color: bay.ink,
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 1.1,
  },
  tagMi: {
    color: bay.mute,
    fontSize: 11,
    fontWeight: '700',
    marginTop: 2,
  },
  bayPaint: {
    color: bay.paint,
    fontSize: 32,
    fontWeight: '800',
    letterSpacing: 3,
  },
  scoreWrap: { alignItems: 'flex-end' },
  scoreLabel: {
    color: bay.due,
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 1.4,
  },
  score: {
    color: bay.orange,
    fontSize: 40,
    fontWeight: '800',
    fontStyle: 'italic',
    lineHeight: 44,
  },
  hair: { height: StyleSheet.hairlineWidth, backgroundColor: bay.due },
  link: {
    fontSize: 13,
    fontWeight: '800',
    letterSpacing: 1.6,
    textDecorationLine: 'underline',
  },
  work: {
    backgroundColor: bay.orange,
    paddingVertical: 14,
    alignItems: 'center',
  },
  workText: {
    color: bay.cream,
    fontSize: 13,
    fontWeight: '800',
    letterSpacing: 1.6,
  },
  field: { gap: 4, marginBottom: 14 },
  fieldLabel: {
    color: bay.due,
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 1.2,
  },
  fieldInput: {
    color: bay.cream,
    fontSize: 16,
    fontWeight: '700',
    borderBottomWidth: 1,
    borderBottomColor: bay.slat,
    paddingVertical: 6,
  },
  pick: { paddingVertical: 6, paddingRight: 12 },
  pickText: {
    color: bay.due,
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1,
  },
  pickOn: {
    color: bay.cream,
    textDecorationLine: 'underline',
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
    paddingVertical: 10,
  },
  rowLabel: {
    color: bay.due,
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.8,
    flexShrink: 0,
  },
  rowValue: {
    color: bay.cream,
    fontSize: 13,
    fontWeight: '700',
    flex: 1,
    textAlign: 'right',
  },
});
