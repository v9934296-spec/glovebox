import { Ionicons } from '@expo/vector-icons';
import React, { useState } from 'react';
import {
  ActivityIndicator,
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
import type { DueState } from '@/lib/domain/due';
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
        variant === 'danger' && {
          backgroundColor: pressed ? palette.accent.dangerPressed : palette.accent.danger,
        },
        (disabled || loading) && { opacity: 0.5 },
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={onAccent ? palette.text.onAccent : palette.text.primary} />
      ) : (
        <Text
          style={[
            styles.buttonText,
            onAccent && { color: palette.text.onAccent },
            onDanger && { color: palette.text.primary },
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
    <Pressable accessibilityRole="button" onPress={onPress} style={[styles.photoTile, { height }]}>
      {uri ? (
        <Image source={{ uri }} style={styles.photoTileImage} />
      ) : (
        <View style={styles.photoTileEmpty}>
          <View style={styles.photoTileIconWrap}>
            <Ionicons name={emptyIcon} size={26} color={palette.accent.primary} />
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
      style={[styles.chip, selected && { backgroundColor: palette.accent.primary, borderColor: palette.accent.primary }]}
    >
      <Text style={[styles.chipText, selected && { color: palette.text.onAccent, fontWeight: '600' }]}>{label}</Text>
    </Pressable>
  );
}

export function kindAccent(kind: 'maintenance' | 'repair' | 'admin'): string {
  if (kind === 'repair') return palette.accent.danger;
  if (kind === 'admin') return palette.text.secondary;
  return palette.accent.primary;
}

export function serviceTypeIcon(serviceType: string): React.ComponentProps<typeof Ionicons>['name'] {
  switch (serviceType) {
    case 'oil_change':
      return 'water-outline';
    case 'tire_rotation':
    case 'tires':
      return 'ellipse-outline';
    case 'brakes':
      return 'disc-outline';
    case 'battery':
    case 'spark_plugs':
      return 'flash-outline';
    case 'alignment':
      return 'git-commit-outline';
    case 'transmission':
      return 'cog-outline';
    case 'coolant':
      return 'snow-outline';
    case 'air_filter':
      return 'filter-outline';
    case 'registration':
    case 'insurance':
    case 'smog':
      return 'document-text-outline';
    case 'repair':
      return 'hammer-outline';
    default:
      return 'construct-outline';
  }
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

export function VehicleHeroCard({
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
    <View style={styles.heroContent}>
      <View style={styles.heroTop}>
        {health != null && (
          <View style={styles.heroHealth}>
            <Text style={styles.heroScore}>{health.score}</Text>
            <StatusBadge label={health.label} tone={healthTone(health.label)} />
          </View>
        )}
      </View>
      <View style={styles.heroBottom}>
        <Text style={styles.heroTitle} numberOfLines={1}>
          {title}
        </Text>
        {subtitle != null && subtitle !== '' && (
          <Text style={styles.heroSubtitle} numberOfLines={1}>
            {subtitle}
          </Text>
        )}
        {meta != null && <View style={styles.heroMeta}>{meta}</View>}
        {cta != null && (
          <Pressable accessibilityRole="button" onPress={cta.onPress} style={styles.heroCta}>
            <Text style={styles.heroCtaText}>{cta.label}</Text>
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
        style={[styles.hero, style]}
        imageStyle={styles.heroImage}
        resizeMode="cover"
      >
        <View style={[StyleSheet.absoluteFill, { backgroundColor: palette.bg.app, opacity: 0.32 }]} />
        <View style={styles.heroBottomScrim} />
        {content}
      </ImageBackground>
    );
  }

  return (
    <View style={[styles.hero, styles.heroPlaceholder, style]}>
      <View style={styles.heroPlaceholderIcon}>
        <Ionicons name="car-sport" size={44} color={palette.text.tertiary} />
      </View>
      {content}
    </View>
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
  empty: {
    alignItems: 'center',
    paddingVertical: spacing.xl,
    paddingHorizontal: spacing.lg,
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
  hero: {
    height: 256,
    borderRadius: radius.hero,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: palette.border.subtle,
    justifyContent: 'flex-end',
  },
  heroImage: {
    borderRadius: radius.hero,
  },
  heroPlaceholder: {
    backgroundColor: palette.bg.surfaceRaised,
  },
  heroPlaceholderIcon: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    paddingBottom: 36,
  },
  heroBottomScrim: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: '58%',
    backgroundColor: palette.bg.app,
    opacity: 0.82,
  },
  heroContent: {
    flex: 1,
    justifyContent: 'space-between',
    padding: spacing.lg,
  },
  heroTop: {
    alignItems: 'flex-end',
  },
  heroHealth: {
    alignItems: 'flex-end',
    gap: spacing.xs,
  },
  heroScore: {
    color: palette.accent.primary,
    fontSize: typography.metric.size,
    fontWeight: typography.metric.weight,
  },
  heroBottom: {
    gap: 2,
  },
  heroTitle: {
    color: palette.text.primary,
    fontSize: typography.hero.size,
    fontWeight: typography.hero.weight,
  },
  heroSubtitle: {
    color: palette.text.secondary,
    fontSize: typography.body.size,
  },
  heroMeta: {
    marginTop: 2,
  },
  heroCta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: spacing.sm,
    alignSelf: 'flex-start',
  },
  heroCtaText: {
    color: palette.accent.primary,
    fontSize: typography.caption.size,
    fontWeight: '600',
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
    borderRadius: radius.hero,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: palette.border.subtle,
    backgroundColor: palette.bg.surfaceRaised,
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
    borderStyle: 'dashed',
  },
  photoTileIconWrap: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: palette.bg.raised,
    borderWidth: 1,
    borderColor: palette.border.subtle,
    alignItems: 'center',
    justifyContent: 'center',
  },
  photoTileLabel: {
    color: palette.text.secondary,
    fontSize: typography.bodyEmphasis.size,
    fontWeight: typography.bodyEmphasis.weight,
  },
});
