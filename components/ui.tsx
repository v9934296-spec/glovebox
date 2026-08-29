import { Ionicons } from '@expo/vector-icons';
import React, { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Animated,
  Easing,
  Image,
  ImageBackground,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
  type StyleProp,
  type TextInputProps,
  type ViewStyle,
} from 'react-native';
import Svg, { Circle } from 'react-native-svg';
import type { DueState } from '@/lib/domain/due';
import { serviceTypeIcon as catalogIcon } from '@/lib/domain/serviceTypes';
import { palette, radius, spacing, typography } from '@/lib/theme';

export function Screen({ children, style }: { children: React.ReactNode; style?: StyleProp<ViewStyle> }) {
  return <View style={[styles.screen, style]}>{children}</View>;
}

export function Card({
  children,
  style,
  raised,
}: {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  raised?: boolean;
}) {
  return <View style={[styles.card, raised && styles.cardRaised, style]}>{children}</View>;
}

/** Legacy uppercase overline header — keep for forms / other tabs. */
export function SectionHeader({ title, right }: { title: string; right?: React.ReactNode }) {
  return (
    <View style={styles.sectionHeader}>
      <Text style={styles.sectionTitle}>{title.toUpperCase()}</Text>
      {right}
    </View>
  );
}

/** Sentence-case section label for Dashboard / Garage. */
export function SectionLabel({
  title,
  actionLabel,
  onAction,
}: {
  title: string;
  actionLabel?: string;
  onAction?: () => void;
}) {
  return (
    <View style={styles.sectionLabel}>
      <Text style={styles.sectionLabelTitle}>{title}</Text>
      {actionLabel != null && onAction != null && (
        <Pressable accessibilityRole="button" onPress={onAction} hitSlop={8}>
          <Text style={styles.sectionLabelAction}>{actionLabel}</Text>
        </Pressable>
      )}
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
  const onAccent = variant === 'primary';
  const onDanger = variant === 'danger';
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
        variant === 'danger' && [styles.buttonDanger, pressed && { opacity: 0.85 }],
        (disabled || loading) && { opacity: 0.5 },
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator
          color={onAccent ? palette.text.onAccent : onDanger ? palette.accent.danger : palette.text.primary}
        />
      ) : (
        <Text
          style={[
            styles.buttonText,
            onAccent && { color: palette.text.onAccent },
            onDanger && { color: palette.accent.danger },
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
  onFocus,
  onBlur,
  containerStyle,
  ...inputProps
}: TextInputProps & { label: string; error?: string; containerStyle?: StyleProp<ViewStyle> }) {
  const [focused, setFocused] = useState(false);
  return (
    <View style={[styles.field, containerStyle]}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <TextInput
        placeholderTextColor={palette.text.tertiary}
        {...inputProps}
        onFocus={(e) => {
          setFocused(true);
          onFocus?.(e);
        }}
        onBlur={(e) => {
          setFocused(false);
          onBlur?.(e);
        }}
        style={[
          styles.input,
          focused && styles.inputFocused,
          error != null && { borderColor: palette.status.overdue },
          inputProps.style,
        ]}
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

export type BadgeTone = 'ok' | 'warn' | 'danger' | 'neutral';

export function healthTone(label: string): BadgeTone {
  if (label === 'Needs attention') return 'danger';
  if (label === 'Fair') return 'warn';
  return 'ok';
}

const TONE_COLOR: Record<BadgeTone, string> = {
  ok: palette.accent.primary,
  warn: palette.status.dueSoon,
  danger: palette.status.overdue,
  neutral: palette.text.secondary,
};

export function StatusBadge({ label, tone = 'ok' }: { label: string; tone?: BadgeTone }) {
  const color = TONE_COLOR[tone];
  return (
    <View style={[styles.badge, { borderColor: color }]}>
      <Text style={[styles.badgeText, { color }]}>{label}</Text>
    </View>
  );
}

export function MetricCard({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <Card raised style={styles.statTile}>
      <Text style={styles.statLabel}>{label}</Text>
      <Text style={styles.statValue} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7}>
        {value}
      </Text>
      {hint != null && <Text style={styles.statHint}>{hint}</Text>}
    </Card>
  );
}

export function StatTile({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return <MetricCard label={label} value={value} hint={hint} />;
}

/** Borderless metric strip — 2 or 3 equal cells. */
export function MetricStrip({ items }: { items: Array<{ label: string; value: string }> }) {
  return (
    <View style={styles.metricStrip}>
      {items.map((item, i) => (
        <React.Fragment key={item.label}>
          {i > 0 && <View style={styles.metricStripDivider} />}
          <View style={styles.metricStripCell}>
            <Text style={styles.metricStripLabel}>{item.label}</Text>
            <Text style={styles.metricStripValue} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.65}>
              {item.value}
            </Text>
          </View>
        </React.Fragment>
      ))}
    </View>
  );
}

/** Reminder / vehicle-reminder list row — left bar, optional Done. */
export function ReminderListRow({
  title,
  meta,
  state,
  completed,
  onPress,
  onDone,
  showSeparator,
}: {
  title: string;
  meta: string;
  state?: DueState;
  completed?: boolean;
  onPress?: () => void;
  onDone?: () => void;
  showSeparator?: boolean;
}) {
  const bar =
    completed || state == null || state === 'upcoming' || state === 'no_due'
      ? 'transparent'
      : state === 'overdue'
        ? palette.status.overdue
        : palette.status.dueSoon;

  const body = (
    <View style={[styles.reminderListRow, showSeparator && styles.reminderListSep, completed && { opacity: 0.55 }]}>
      <View style={[styles.attentionBar, { backgroundColor: bar }]} />
      <View style={styles.reminderListBody}>
        <View style={styles.reminderListHeader}>
          <Text style={styles.attentionTitle} numberOfLines={1}>
            {title}
          </Text>
          {!completed && state != null && state !== 'no_due' && <DueBadge state={state} />}
        </View>
        <Text style={styles.attentionMeta} numberOfLines={2}>
          {meta}
        </Text>
        {onDone != null && !completed && (
          <Pressable
            accessibilityRole="button"
            onPress={onDone}
            style={styles.reminderDoneBtn}
            hitSlop={6}
          >
            <Text style={styles.reminderDoneText}>Done</Text>
          </Pressable>
        )}
      </View>
    </View>
  );

  if (onPress) {
    return (
      <Pressable accessibilityRole="button" onPress={onPress}>
        {body}
      </Pressable>
    );
  }
  return body;
}

export function DetailRow({ label, value, last }: { label: string; value: string; last?: boolean }) {
  return (
    <View style={[styles.detailRow, !last && styles.detailRowBorder]}>
      <Text style={styles.detailLabel}>{label}</Text>
      <Text style={styles.detailValue}>{value}</Text>
    </View>
  );
}

function attentionBarColor(state: DueState): string {
  if (state === 'overdue') return palette.status.overdue;
  if (state === 'due_soon') return palette.status.dueSoon;
  return 'transparent';
}

/** Full-width attention row — left signal bar, no card chrome. */
export function AttentionRow({
  title,
  meta,
  state,
  onPress,
  showSeparator,
}: {
  title: string;
  meta: string;
  state: DueState;
  onPress: () => void;
  showSeparator?: boolean;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={[styles.attentionRow, showSeparator && styles.attentionRowSep]}
    >
      <View style={[styles.attentionBar, { backgroundColor: attentionBarColor(state) }]} />
      <View style={styles.attentionBody}>
        <Text style={styles.attentionTitle} numberOfLines={1}>
          {title}
        </Text>
        <Text style={styles.attentionMeta} numberOfLines={1}>
          {meta}
        </Text>
      </View>
      <DueBadge state={state} />
      <Ionicons name="chevron-forward" size={16} color={palette.text.tertiary} />
    </Pressable>
  );
}

export function healthRingColor(score: number): string {
  // Mid band uses dueSoon (amber) so it stays distinct from ok/CTA green.
  if (score >= 80) return palette.status.ok;
  if (score >= 50) return palette.status.dueSoon;
  return palette.status.overdue;
}

/** 44pt health ring — arc draws 0→score on first mount. */
export function HealthRing({ score, size = 44 }: { score: number; size?: number }) {
  const stroke = 3;
  const radiusPx = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radiusPx;
  const clamped = Math.max(0, Math.min(100, score));
  const color = healthRingColor(clamped);
  const progress = useRef(new Animated.Value(0)).current;
  const [dashOffset, setDashOffset] = useState(circumference);

  useEffect(() => {
    progress.setValue(0);
    const id = progress.addListener(({ value }) => {
      setDashOffset(circumference * (1 - value));
    });
    Animated.timing(progress, {
      toValue: clamped / 100,
      duration: 400,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: false,
    }).start();
    return () => progress.removeListener(id);
  }, [clamped, circumference, progress]);

  return (
    <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
      <Svg width={size} height={size} style={StyleSheet.absoluteFill}>
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={radiusPx}
          stroke={palette.border.subtle}
          strokeWidth={stroke}
          fill="none"
        />
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={radiusPx}
          stroke={color}
          strokeWidth={stroke}
          fill="none"
          strokeDasharray={`${circumference} ${circumference}`}
          strokeDashoffset={dashOffset}
          strokeLinecap="round"
          rotation="-90"
          origin={`${size / 2}, ${size / 2}`}
        />
      </Svg>
      <Text style={styles.healthRingScore}>{Math.round(clamped)}</Text>
    </View>
  );
}

export function EmptyState({
  title,
  message,
  action,
  icon = null,
}: {
  title: string;
  message: string;
  action?: React.ReactNode;
  icon?: React.ComponentProps<typeof Ionicons>['name'] | null;
}) {
  return (
    <View style={styles.empty}>
      {icon != null && (
        <Ionicons name={icon} size={64} color={palette.text.tertiary} style={{ marginBottom: spacing.lg }} />
      )}
      <Text style={styles.emptyTitle}>{title}</Text>
      <Text style={styles.emptyMessage}>{message}</Text>
      {action != null && <View style={{ marginTop: spacing.xl }}>{action}</View>}
    </View>
  );
}

export function SegmentedControl({
  options,
  value,
  onChange,
}: {
  options: Array<{ value: string; label: string }>;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <View style={styles.segment}>
      {options.map((opt) => {
        const selected = opt.value === value;
        return (
          <Pressable
            key={opt.value}
            accessibilityRole="button"
            onPress={() => onChange(opt.value)}
            style={[styles.segmentItem, selected && styles.segmentItemSelected]}
          >
            <Text style={[styles.segmentText, selected && styles.segmentTextSelected]}>{opt.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

export function PhotoTile({
  uri,
  emptyLabel = 'Add photo',
  emptyIcon = 'camera-outline',
  onPress,
  height = 200,
}: {
  uri: string | null;
  emptyLabel?: string;
  emptyIcon?: React.ComponentProps<typeof Ionicons>['name'];
  onPress: () => void;
  height?: number;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={[styles.photoTile, { height }, uri ? styles.photoTileFilled : null]}
    >
      {uri ? (
        <Image source={{ uri }} style={styles.photoTileImage} />
      ) : (
        <View style={styles.photoTileEmpty}>
          <View style={styles.photoTileIconWrap}>
            <Ionicons name={emptyIcon} size={26} color={palette.text.tertiary} />
          </View>
          <Text style={styles.photoTileLabel}>{emptyLabel}</Text>
        </View>
      )}
    </Pressable>
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
      style={[styles.chip, selected && styles.chipSelected]}
    >
      <Text style={[styles.chipText, selected && styles.chipTextSelected]}>{label}</Text>
    </Pressable>
  );
}

export function kindAccent(kind: 'maintenance' | 'repair' | 'admin'): string {
  if (kind === 'repair') return palette.accent.danger;
  if (kind === 'admin') return palette.text.secondary;
  return palette.accent.primary;
}

export function serviceTypeIcon(serviceType: string): React.ComponentProps<typeof Ionicons>['name'] {
  return catalogIcon(serviceType) as React.ComponentProps<typeof Ionicons>['name'];
}

export function IconCircle({
  icon,
  color,
  size = 36,
}: {
  icon: React.ComponentProps<typeof Ionicons>['name'];
  color: string;
  size?: number;
}) {
  return (
    <View style={[styles.iconCircle, { width: size, height: size, borderRadius: size / 2 }]}>
      <View style={[StyleSheet.absoluteFill, { backgroundColor: color, opacity: 0.16, borderRadius: size / 2 }]} />
      <Ionicons name={icon} size={Math.round(size * 0.48)} color={color} />
    </View>
  );
}

export function ListRow({
  icon,
  title,
  meta,
  trailing,
  onPress,
  showChevron,
  enclosed,
}: {
  icon?: React.ReactNode;
  title: string;
  meta?: string;
  trailing?: React.ReactNode;
  onPress?: () => void;
  showChevron?: boolean;
  enclosed?: boolean;
}) {
  const row = (
    <View style={styles.listRow}>
      {icon}
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text style={styles.listRowTitle} numberOfLines={1}>
          {title}
        </Text>
        {meta != null && meta !== '' && (
          <Text style={styles.listRowMeta} numberOfLines={1}>
            {meta}
          </Text>
        )}
      </View>
      {trailing}
      {showChevron ? <Ionicons name="chevron-forward" size={16} color={palette.text.tertiary} /> : null}
    </View>
  );
  const body = enclosed ? <Card style={styles.listRowCard}>{row}</Card> : row;
  if (onPress) {
    return (
      <Pressable accessibilityRole="button" onPress={onPress}>
        {body}
      </Pressable>
    );
  }
  return body;
}

/** Full-bleed photo hero — used on vehicle detail (unchanged pattern). */
export function VehicleCoverHero({
  photoUri,
  title,
  subtitle,
  meta,
  health,
  cta,
  style,
}: {
  photoUri: string | null | undefined;
  title: string;
  subtitle?: string;
  meta?: React.ReactNode;
  health?: { score: number; label: string };
  cta?: { label: string; onPress: () => void };
  style?: StyleProp<ViewStyle>;
}) {
  const content = (
    <View style={styles.coverContent}>
      <View style={styles.coverTop}>
        {health != null && (
          <View style={styles.coverHealth}>
            <Text style={styles.coverScore}>{health.score}</Text>
            <StatusBadge label={health.label} tone={healthTone(health.label)} />
          </View>
        )}
      </View>
      <View style={styles.coverBottom}>
        <Text style={styles.coverTitle} numberOfLines={1}>
          {title}
        </Text>
        {subtitle != null && subtitle !== '' && (
          <Text style={styles.coverSubtitle} numberOfLines={1}>
            {subtitle}
          </Text>
        )}
        {meta != null && <View style={styles.coverMeta}>{meta}</View>}
        {cta != null && (
          <Pressable accessibilityRole="button" onPress={cta.onPress} style={styles.coverCta}>
            <Text style={styles.coverCtaText}>{cta.label}</Text>
            <Ionicons name="chevron-forward" size={14} color={palette.accent.primary} />
          </Pressable>
        )}
      </View>
    </View>
  );

  if (photoUri) {
    return (
      <ImageBackground
        source={{ uri: photoUri }}
        style={[styles.cover, style]}
        imageStyle={styles.coverImage}
        resizeMode="cover"
      >
        <View style={[StyleSheet.absoluteFill, { backgroundColor: palette.bg.app, opacity: 0.32 }]} />
        <View style={styles.coverBottomScrim} />
        {content}
      </ImageBackground>
    );
  }

  return (
    <View style={[styles.cover, styles.coverPlaceholder, style]}>
      <View style={styles.coverPlaceholderIcon}>
        <Ionicons name="car-sport" size={44} color={palette.text.tertiary} />
      </View>
      {content}
    </View>
  );
}

/** Garage vehicle hero — photo plate + identity + health ring + next-due footer. */
export function VehicleHeroCard({
  photoUri,
  nickname,
  plate,
  mileage,
  healthScore: score,
  nextDue,
  onPress,
  style,
}: {
  photoUri: string | null | undefined;
  nickname: string;
  plate: string;
  mileage: string;
  healthScore: number;
  nextDue?: { title: string; summary: string; state: DueState } | null;
  onPress: () => void;
  style?: StyleProp<ViewStyle>;
}) {
  return (
    <Pressable accessibilityRole="button" onPress={onPress} style={style}>
      <View style={styles.vhCard}>
        <View style={styles.vhTop}>
          {photoUri ? (
            <Image source={{ uri: photoUri }} style={styles.vhPhoto} />
          ) : (
            <View style={[styles.vhPhoto, styles.vhPhotoPlaceholder]}>
              <Ionicons name="car-sport" size={28} color={palette.text.tertiary} />
            </View>
          )}
          <View style={styles.vhIdentity}>
            <Text style={styles.vhNickname} numberOfLines={1}>
              {nickname}
            </Text>
            <Text style={styles.vhPlate} numberOfLines={1}>
              {plate}
            </Text>
            <Text style={styles.vhMileage} numberOfLines={1}>
              {mileage}
            </Text>
          </View>
          <HealthRing score={score} />
        </View>
        {nextDue != null && (
          <View style={styles.vhFooter}>
            <View style={[styles.vhFooterBar, { backgroundColor: attentionBarColor(nextDue.state) }]} />
            <Text style={styles.vhFooterText} numberOfLines={1}>
              {nextDue.title} · {nextDue.summary}
            </Text>
          </View>
        )}
      </View>
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
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: palette.border.subtle,
    padding: spacing.lg,
  },
  cardRaised: {
    backgroundColor: palette.bg.surfaceRaised,
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
  sectionLabel: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.sm,
  },
  sectionLabelTitle: {
    color: palette.text.primary,
    fontSize: typography.bodyEmphasis.size,
    fontWeight: typography.bodyEmphasis.weight,
    lineHeight: typography.bodyEmphasis.lineHeight,
  },
  sectionLabelAction: {
    color: palette.accent.primary,
    fontSize: typography.caption.size,
    fontWeight: '600',
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
    borderColor: palette.accent.danger,
  },
  buttonText: {
    color: palette.text.primary,
    fontSize: typography.bodyEmphasis.size,
    fontWeight: typography.bodyEmphasis.weight,
  },
  reminderListRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    minHeight: 56,
    gap: spacing.sm,
    paddingVertical: spacing.sm,
    paddingRight: spacing.xs,
  },
  reminderListSep: {
    borderBottomWidth: 1,
    borderBottomColor: palette.border.subtle,
  },
  reminderListBody: {
    flex: 1,
    minWidth: 0,
  },
  reminderListHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  reminderDoneBtn: {
    alignSelf: 'flex-start',
    marginTop: spacing.sm,
    paddingVertical: 6,
    paddingHorizontal: spacing.md,
    borderRadius: radius.sm,
    backgroundColor: palette.bg.surfaceRaised,
    borderWidth: 1,
    borderColor: palette.border.default,
  },
  reminderDoneText: {
    color: palette.text.primary,
    fontSize: typography.caption.size,
    fontWeight: '600',
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: spacing.md,
    paddingVertical: spacing.sm,
  },
  detailRowBorder: { borderBottomWidth: 1, borderBottomColor: palette.border.subtle },
  detailLabel: { color: palette.text.secondary, fontSize: typography.body.size },
  detailValue: {
    color: palette.text.primary,
    fontSize: typography.body.size,
    fontWeight: '500',
    flexShrink: 1,
    textAlign: 'right',
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
    backgroundColor: palette.bg.raised,
    borderWidth: 1,
    borderColor: palette.border.default,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: 12,
    color: palette.text.primary,
    fontSize: typography.body.size,
  },
  inputFocused: {
    borderColor: palette.accent.primary,
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
    fontSize: typography.meta.size,
    fontWeight: '600',
  },
  statTile: {
    flex: 1,
    minWidth: 0,
    padding: spacing.md,
  },
  statLabel: {
    color: palette.text.tertiary,
    fontSize: typography.overline.size,
    fontWeight: typography.overline.weight,
    letterSpacing: typography.overline.letterSpacing,
    textTransform: 'uppercase',
  },
  statValue: {
    color: palette.text.primary,
    fontSize: typography.metric.size,
    fontWeight: typography.metric.weight,
    marginTop: spacing.xs,
  },
  statHint: {
    color: palette.text.tertiary,
    fontSize: typography.meta.size,
    marginTop: 2,
  },
  metricStrip: {
    flexDirection: 'row',
    alignItems: 'stretch',
    minHeight: 64,
  },
  metricStripCell: {
    flex: 1,
    justifyContent: 'center',
    paddingVertical: spacing.sm,
  },
  metricStripDivider: {
    width: 1,
    backgroundColor: palette.border.subtle,
    marginVertical: spacing.xs,
  },
  metricStripLabel: {
    color: palette.text.tertiary,
    fontSize: typography.overline.size,
    fontWeight: typography.overline.weight,
    letterSpacing: typography.overline.letterSpacing,
    textTransform: 'uppercase',
  },
  metricStripValue: {
    color: palette.text.primary,
    fontSize: typography.h2.size,
    fontWeight: typography.h2.weight,
    lineHeight: typography.h2.lineHeight,
    marginTop: 2,
  },
  attentionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 56,
    gap: spacing.sm,
    paddingVertical: spacing.sm,
    paddingRight: spacing.xs,
  },
  attentionRowSep: {
    borderBottomWidth: 1,
    borderBottomColor: palette.border.subtle,
  },
  attentionBar: {
    width: 3,
    alignSelf: 'stretch',
    borderRadius: 2,
    marginVertical: 4,
  },
  attentionBody: {
    flex: 1,
    minWidth: 0,
  },
  attentionTitle: {
    color: palette.text.primary,
    fontSize: typography.bodyEmphasis.size,
    fontWeight: typography.bodyEmphasis.weight,
  },
  attentionMeta: {
    color: palette.text.tertiary,
    fontSize: typography.caption.size,
    marginTop: 2,
  },
  healthRingScore: {
    color: palette.text.primary,
    fontSize: typography.bodyEmphasis.size,
    fontWeight: typography.bodyEmphasis.weight,
  },
  empty: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.xl,
    paddingHorizontal: spacing.lg,
  },
  emptyTitle: {
    color: palette.text.primary,
    fontSize: typography.h3.size,
    fontWeight: typography.h3.weight,
    textAlign: 'center',
  },
  emptyMessage: {
    color: palette.text.secondary,
    fontSize: typography.body.size,
    textAlign: 'center',
    marginTop: spacing.sm,
    lineHeight: typography.body.lineHeight,
    maxWidth: 280,
  },
  chip: {
    borderWidth: 1,
    borderColor: palette.border.subtle,
    backgroundColor: palette.bg.surfaceRaised,
    borderRadius: radius.pill,
    paddingHorizontal: spacing.md,
    paddingVertical: 6,
    marginRight: spacing.sm,
    marginBottom: spacing.sm,
  },
  chipSelected: {
    backgroundColor: palette.accent.soft,
    borderColor: palette.accent.primary,
  },
  chipText: {
    color: palette.text.secondary,
    fontSize: typography.caption.size,
  },
  chipTextSelected: {
    color: palette.accent.primary,
    fontWeight: '600',
  },
  iconCircle: {
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  listRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  listRowCard: {
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.md,
  },
  listRowTitle: {
    color: palette.text.primary,
    fontSize: typography.bodyEmphasis.size,
    fontWeight: typography.bodyEmphasis.weight,
  },
  listRowMeta: {
    color: palette.text.tertiary,
    fontSize: typography.meta.size,
    marginTop: 2,
  },
  cover: {
    height: 256,
    borderRadius: radius.hero,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: palette.border.subtle,
    justifyContent: 'flex-end',
  },
  coverImage: {
    borderRadius: radius.hero,
  },
  coverPlaceholder: {
    backgroundColor: palette.bg.surfaceRaised,
  },
  coverPlaceholderIcon: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    paddingBottom: 36,
  },
  coverBottomScrim: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: '58%',
    backgroundColor: palette.bg.app,
    opacity: 0.82,
  },
  coverContent: {
    flex: 1,
    justifyContent: 'space-between',
    padding: spacing.lg,
  },
  coverTop: {
    alignItems: 'flex-end',
  },
  coverHealth: {
    alignItems: 'flex-end',
    gap: spacing.xs,
  },
  coverScore: {
    color: palette.accent.primary,
    fontSize: typography.metric.size,
    fontWeight: typography.metric.weight,
  },
  coverBottom: {
    gap: 2,
  },
  coverTitle: {
    color: palette.text.primary,
    fontSize: typography.hero.size,
    fontWeight: typography.hero.weight,
  },
  coverSubtitle: {
    color: palette.text.secondary,
    fontSize: typography.body.size,
  },
  coverMeta: {
    marginTop: 2,
  },
  coverCta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: spacing.sm,
    alignSelf: 'flex-start',
  },
  coverCtaText: {
    color: palette.accent.primary,
    fontSize: typography.caption.size,
    fontWeight: '600',
  },
  vhCard: {
    backgroundColor: palette.bg.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: palette.border.subtle,
    padding: spacing.lg,
    gap: spacing.md,
  },
  vhTop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  vhPhoto: {
    width: 96,
    height: 96,
    borderRadius: radius.md,
  },
  vhPhotoPlaceholder: {
    backgroundColor: palette.bg.hero,
    alignItems: 'center',
    justifyContent: 'center',
  },
  vhIdentity: {
    flex: 1,
    minWidth: 0,
    gap: 2,
  },
  vhNickname: {
    color: palette.text.primary,
    fontSize: typography.plate.size,
    fontWeight: typography.plate.weight,
    lineHeight: typography.plate.lineHeight,
  },
  vhPlate: {
    color: palette.text.secondary,
    fontSize: typography.caption.size,
    lineHeight: typography.caption.lineHeight,
  },
  vhMileage: {
    color: palette.text.tertiary,
    fontSize: typography.caption.size,
    lineHeight: typography.caption.lineHeight,
  },
  vhFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: palette.border.subtle,
    paddingTop: spacing.md,
  },
  vhFooterBar: {
    width: 3,
    height: 16,
    borderRadius: 2,
  },
  vhFooterText: {
    flex: 1,
    color: palette.text.secondary,
    fontSize: typography.caption.size,
  },
  segment: {
    flexDirection: 'row',
    backgroundColor: palette.bg.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: palette.border.subtle,
    padding: 3,
  },
  segmentItem: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: spacing.sm,
    borderRadius: radius.sm,
  },
  segmentItemSelected: {
    backgroundColor: palette.bg.surfaceRaised,
  },
  segmentText: {
    color: palette.text.tertiary,
    fontSize: typography.caption.size,
    fontWeight: '600',
  },
  segmentTextSelected: {
    color: palette.accent.primary,
  },
  photoTile: {
    width: '100%',
    borderRadius: radius.lg,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: palette.border.default,
    borderStyle: 'dashed',
    backgroundColor: palette.bg.surface,
  },
  photoTileFilled: {
    borderStyle: 'solid',
    borderColor: palette.border.subtle,
  },
  photoTileImage: {
    width: '100%',
    height: '100%',
  },
  photoTileEmpty: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
  },
  photoTileIconWrap: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: palette.bg.hero,
    alignItems: 'center',
    justifyContent: 'center',
  },
  photoTileLabel: {
    color: palette.text.secondary,
    fontSize: typography.bodyEmphasis.size,
    fontWeight: typography.bodyEmphasis.weight,
  },
});
