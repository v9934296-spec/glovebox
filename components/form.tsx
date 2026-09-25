import React from 'react';
import {
  Pressable,
  StyleSheet,
  Text,
  View,
  type StyleProp,
  type TextStyle,
  type ViewStyle,
} from 'react-native';
import type { DueState } from '@/lib/domain/due';

export const paper = {
  sheet: '#F7F4EE',
  ink: '#111111',
  mute: '#5C5C5C',
  rule: '#111111',
  fill: '#EFEAE0',
} as const;

export function Sheet({
  children,
  style,
}: {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
}) {
  return <View style={[styles.sheet, style]}>{children}</View>;
}

export function FormFrame({ children, style }: { children: React.ReactNode; style?: StyleProp<ViewStyle> }) {
  return <View style={[styles.frame, style]}>{children}</View>;
}

/** Kept so garage / due / ticket tabs still compile. Same object as FormFrame. */
export function Ticket({ children, style }: { children: React.ReactNode; style?: StyleProp<ViewStyle> }) {
  return <View style={[styles.ticket, style]}>{children}</View>;
}

export function BlackBar({ title }: { title: string }) {
  return (
    <View style={styles.blackBar}>
      <Text style={styles.blackBarText}>{title}</Text>
    </View>
  );
}

export function Cell({
  label,
  value,
  flex = 1,
}: {
  label: string;
  value: string;
  flex?: number;
}) {
  return (
    <View style={[styles.cell, { flex }]}>
      <Text style={styles.cellLabel}>{label}</Text>
      <Text style={styles.cellValue} numberOfLines={1}>
        {value || ' '}
      </Text>
    </View>
  );
}

export function Check({
  label,
  on,
  onPress,
}: {
  label: string;
  on: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable onPress={onPress} style={styles.check} accessibilityRole="checkbox" accessibilityState={{ checked: on }}>
      <View style={[styles.box, on && styles.boxOn]}>
        {on ? <Text style={styles.x}>X</Text> : null}
      </View>
      <Text style={styles.checkLabel}>{label}</Text>
    </Pressable>
  );
}

export function Line({
  n,
  job,
  amount,
}: {
  n: number;
  job: string;
  amount: string;
}) {
  return (
    <View style={styles.line}>
      <Text style={styles.lineN}>{n}</Text>
      <Text style={styles.lineJob} numberOfLines={1}>
        {job}
      </Text>
      <Text style={styles.lineAmt}>{amount}</Text>
    </View>
  );
}

export function Rule() {
  return <View style={styles.rule} />;
}

export function Hair() {
  return <View style={styles.hair} />;
}

export function Stamp({ children }: { children: string }) {
  return <Text style={styles.stamp}>{children}</Text>;
}

export function Fine({ children }: { children: React.ReactNode }) {
  return <Text style={styles.fine}>{children}</Text>;
}

export function Ink({ children, style }: { children: string; style?: StyleProp<TextStyle> }) {
  return <Text style={[styles.ink, style]}>{children}</Text>;
}

export function WorkButton({ title, onPress, disabled }: { title: string; onPress: () => void; disabled?: boolean }) {
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => [styles.work, pressed && { opacity: 0.7 }, disabled && { opacity: 0.35 }]}
    >
      <Text style={styles.workText}>{title.toUpperCase()}</Text>
    </Pressable>
  );
}

export function GhostLink({ title, onPress }: { title: string; onPress: () => void }) {
  return (
    <Pressable accessibilityRole="button" onPress={onPress} hitSlop={8}>
      <Text style={styles.link}>{title.toUpperCase()}</Text>
    </Pressable>
  );
}

export function DueMark({ state }: { state: DueState }) {
  if (state === 'no_due') return null;
  const label = state === 'overdue' ? 'OVERDUE' : state === 'due_soon' ? 'DUE' : 'SCHEDULED';
  return <Text style={styles.mark}>{label}</Text>;
}

const styles = StyleSheet.create({
  sheet: { flex: 1, backgroundColor: paper.sheet },
  frame: {
    margin: 12,
    borderWidth: 2,
    borderColor: paper.rule,
    backgroundColor: '#FFFEFA',
  },
  ticket: {
    backgroundColor: '#FFFEFA',
    borderWidth: 1.5,
    borderColor: paper.rule,
    padding: 16,
  },
  blackBar: {
    backgroundColor: paper.ink,
    paddingVertical: 6,
    paddingHorizontal: 10,
  },
  blackBarText: {
    color: '#FFFEFA',
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 1.4,
    textAlign: 'center',
  },
  cell: {
    borderRightWidth: 1,
    borderBottomWidth: 1,
    borderColor: paper.rule,
    paddingHorizontal: 8,
    paddingVertical: 6,
    minHeight: 44,
  },
  cellLabel: {
    color: paper.mute,
    fontSize: 8,
    fontWeight: '700',
    letterSpacing: 0.6,
  },
  cellValue: {
    color: paper.ink,
    fontSize: 13,
    fontWeight: '700',
    marginTop: 2,
  },
  check: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingVertical: 6, paddingRight: 8 },
  box: {
    width: 14,
    height: 14,
    borderWidth: 1,
    borderColor: paper.ink,
    alignItems: 'center',
    justifyContent: 'center',
  },
  boxOn: { backgroundColor: paper.ink },
  x: { color: '#FFFEFA', fontSize: 9, fontWeight: '800', lineHeight: 12 },
  checkLabel: { color: paper.ink, fontSize: 10, fontWeight: '700' },
  line: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderColor: paper.rule,
    minHeight: 28,
    alignItems: 'center',
  },
  lineN: { width: 24, textAlign: 'center', color: paper.ink, fontSize: 11, fontWeight: '700' },
  lineJob: { flex: 1, color: paper.ink, fontSize: 12, paddingRight: 8 },
  lineAmt: { width: 72, textAlign: 'right', paddingRight: 8, color: paper.ink, fontSize: 12, fontWeight: '700' },
  rule: { height: 2, backgroundColor: paper.rule },
  hair: { height: StyleSheet.hairlineWidth, backgroundColor: paper.rule },
  stamp: {
    color: paper.ink,
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 1.2,
  },
  fine: { color: paper.mute, fontSize: 11 },
  ink: { color: paper.ink, fontSize: 14, fontWeight: '700' },
  work: {
    backgroundColor: paper.ink,
    paddingVertical: 14,
    alignItems: 'center',
    margin: 12,
  },
  workText: { color: '#FFFEFA', fontSize: 12, fontWeight: '800', letterSpacing: 1.6 },
  link: {
    color: paper.ink,
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1,
    textDecorationLine: 'underline',
  },
  mark: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 1,
    borderWidth: 1,
    borderColor: paper.ink,
    paddingHorizontal: 6,
    paddingVertical: 2,
    color: paper.ink,
  },
});
