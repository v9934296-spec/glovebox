import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { useRouter } from 'expo-router';
import React from 'react';
import {
  Alert,
  Image,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Screen } from '@/components/ui';
import { FlowFooter, FlowHeader, StepProgress } from '@/components/flow';
import { useServiceDraft } from '@/lib/forms/serviceDraft';
import { saveServiceDraft } from '@/lib/forms/saveService';
import { canAttachReceipt } from '@/lib/monetization/entitlements';
import { useIsPro } from '@/lib/monetization/purchases';
import { palette, radius, spacing, typography } from '@/lib/theme';

const TOTAL_STEPS = 3;

export default function LogServiceStepExtras() {
  const router = useRouter();
  const draft = useServiceDraft();
  const isPro = useIsPro();

  function cancel() {
    useServiceDraft.getState().reset();
    router.dismissAll();
  }

  async function attachReceipt() {
    const gate = canAttachReceipt(isPro);
    if (!gate.allowed) {
      router.push('/paywall');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.6 });
    const uri = result.assets?.[0]?.uri;
    if (!result.canceled && uri != null) draft.setReceiptUri(uri);
  }

  function save() {
    const result = saveServiceDraft();
    if (!result.ok) {
      Alert.alert('Not saved', result.reason);
      return;
    }
    router.dismissAll();
  }

  return (
    <Screen style={{ padding: 0 }}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          contentContainerStyle={{ padding: spacing.screenPadding, paddingBottom: spacing['2xl'] }}
          keyboardShouldPersistTaps="handled"
        >
          <FlowHeader step={3} total={TOTAL_STEPS} onBack={() => router.back()} onCancel={cancel} />
          <StepProgress step={3} total={TOTAL_STEPS} />

          <Text style={styles.title}>Anything else?</Text>
          <Text style={styles.subtitle}>All optional — you can save right now.</Text>

          <View style={{ height: spacing.xl }} />

          <Text style={styles.overline}>SHOP</Text>
          <TextInput
            value={draft.shopName}
            onChangeText={draft.setShopName}
            placeholder="Mike's Auto"
            placeholderTextColor={palette.text.tertiary}
            accessibilityLabel="Shop name"
            style={styles.input}
          />

          <View style={{ height: spacing.lg }} />

          <Text style={styles.overline}>NOTES</Text>
          <TextInput
            value={draft.notes}
            onChangeText={draft.setNotes}
            placeholder="Anything worth remembering later"
            placeholderTextColor={palette.text.tertiary}
            multiline
            accessibilityLabel="Notes"
            style={[styles.input, styles.multiline]}
          />

          <View style={{ height: spacing.lg }} />

          <Pressable
            onPress={() => void attachReceipt()}
            accessibilityRole="button"
            style={({ pressed }) => [styles.receiptRow, pressed && { opacity: 0.8 }]}
          >
            {draft.receiptUri != null ? (
              <Image source={{ uri: draft.receiptUri }} style={styles.receiptThumb} />
            ) : (
              <View style={styles.receiptPlaceholder}>
                <Ionicons name="attach-outline" size={20} color={palette.text.secondary} />
              </View>
            )}
            <Text style={styles.receiptText}>
              {draft.receiptUri != null ? 'Change receipt photo' : 'Attach receipt photo'}
            </Text>
            {!isPro && (
              <View style={styles.proPill}>
                <Text style={styles.proPillText}>Pro</Text>
              </View>
            )}
          </Pressable>

          <FlowFooter
            primaryLabel={draft.saving ? 'Saving…' : 'Save record'}
            onPrimary={save}
            primaryDisabled={draft.saving}
            secondaryLabel="Skip"
            onSecondary={save}
          />
        </ScrollView>
      </KeyboardAvoidingView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  title: {
    color: palette.text.primary,
    fontSize: typography.h2.size,
    fontWeight: typography.h2.weight,
  },
  subtitle: {
    color: palette.text.secondary,
    fontSize: typography.body.size,
    marginTop: spacing.xs,
  },
  overline: {
    color: palette.text.tertiary,
    fontSize: typography.overline.size,
    fontWeight: typography.overline.weight,
    letterSpacing: typography.overline.letterSpacing,
    marginBottom: spacing.sm,
  },
  input: {
    backgroundColor: palette.bg.surface,
    borderWidth: 1,
    borderColor: palette.border.subtle,
    borderRadius: radius.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: 14,
    color: palette.text.primary,
    fontSize: typography.body.size,
  },
  multiline: { minHeight: 88, textAlignVertical: 'top' },
  receiptRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.md,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: palette.border.subtle,
    backgroundColor: palette.bg.surface,
  },
  receiptThumb: { width: 44, height: 44, borderRadius: radius.sm },
  receiptPlaceholder: {
    width: 44,
    height: 44,
    borderRadius: radius.sm,
    backgroundColor: palette.bg.surfaceRaised,
    alignItems: 'center',
    justifyContent: 'center',
  },
  receiptText: { flex: 1, color: palette.text.primary, fontSize: typography.body.size },
  proPill: {
    borderRadius: radius.pill,
    paddingHorizontal: spacing.sm,
    paddingVertical: 3,
    backgroundColor: palette.accent.primary,
  },
  proPillText: { color: palette.text.onAccent, fontSize: 11, fontWeight: '700' },
});
