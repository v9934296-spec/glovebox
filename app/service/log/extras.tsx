import * as ImagePicker from 'expo-image-picker';
import { useRouter } from 'expo-router';
import React from 'react';
import {
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
import { GhostLink, WorkButton } from '@/components/form';
import { useServiceDraft } from '@/lib/forms/serviceDraft';
import { canAttachReceipt } from '@/lib/monetization/entitlements';
import { useIsPro } from '@/lib/monetization/purchases';

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

  function review() {
    router.push('/service/log/confirm');
  }

  return (
    <View style={styles.page}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
          <View style={styles.top}>
            <GhostLink title="Back" onPress={() => router.back()} />
            <GhostLink title="Void" onPress={cancel} />
          </View>

          <Text style={styles.brand}>GLOVEBOX</Text>
          <Text style={styles.doc}>REPAIR ORDER  /  SHOP NOTES</Text>

          <Text style={styles.label}>SHOP</Text>
          <TextInput
            value={draft.shopName}
            onChangeText={draft.setShopName}
            placeholder="MIKE'S AUTO"
            placeholderTextColor={MUTE}
            accessibilityLabel="Shop name"
            autoCapitalize="words"
            style={styles.lineInput}
          />

          <View style={styles.rule} />

          <Text style={styles.label}>NOTES / REMARKS</Text>
          <TextInput
            value={draft.notes}
            onChangeText={draft.setNotes}
            placeholder="ANYTHING WORTH REMEMBERING LATER"
            placeholderTextColor={MUTE}
            multiline
            accessibilityLabel="Notes"
            style={styles.notes}
          />

          <View style={styles.rule} />

          <Text style={styles.label}>SHOP TICKET</Text>
          <Pressable
            onPress={() => void attachReceipt()}
            accessibilityRole="button"
            style={({ pressed }) => [styles.receiptRow, pressed && { opacity: 0.7 }]}
          >
            {draft.receiptUri != null ? (
              <Image source={{ uri: draft.receiptUri }} style={styles.receiptThumb} />
            ) : (
              <View style={styles.receiptPlaceholder}>
                <Text style={styles.receiptMark}>+</Text>
              </View>
            )}

            <View style={{ flex: 1 }}>
              <Text style={styles.receiptTitle}>
                {draft.receiptUri != null ? 'TICKET ATTACHED' : 'ATTACH RECEIPT PHOTO'}
              </Text>
              <Text style={styles.receiptMeta}>
                {draft.receiptUri != null
                  ? 'TAP TO REPLACE'
                  : isPro
                    ? 'CHOOSE FROM PHOTO LIBRARY'
                    : 'PRO FEATURE'}
              </Text>
            </View>
          </Pressable>

          <View style={styles.reviewNote}>
            <Text style={styles.reviewNoteTitle}>READY FOR THE JACKET</Text>
            <Text style={styles.reviewNoteText}>
              Review the completed ticket before anything is filed to service history.
            </Text>
          </View>
        </ScrollView>

        <WorkButton title="Review ticket" onPress={review} disabled={!draft.serviceType} />
      </KeyboardAvoidingView>
    </View>
  );
}

const INK = '#111111';
const MUTE = '#5C5C5C';
const PAGE = '#F4EFE4';

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: PAGE },
  scroll: { paddingHorizontal: 22, paddingTop: 8, paddingBottom: 12 },
  top: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 18 },
  brand: { color: INK, fontSize: 28, fontWeight: '800', letterSpacing: -0.6 },
  doc: { color: INK, fontSize: 12, fontWeight: '800', letterSpacing: 1.5, marginTop: 2, marginBottom: 28 },
  label: { color: MUTE, fontSize: 9, fontWeight: '800', letterSpacing: 1.1, marginBottom: 6 },
  lineInput: {
    color: INK,
    fontSize: 20,
    fontWeight: '700',
    borderBottomWidth: 1,
    borderColor: INK,
    paddingVertical: 8,
  },
  notes: {
    color: INK,
    fontSize: 16,
    fontWeight: '600',
    lineHeight: 23,
    minHeight: 112,
    borderBottomWidth: 1,
    borderColor: INK,
    paddingVertical: 8,
    textAlignVertical: 'top',
  },
  rule: { height: 1, backgroundColor: INK, marginVertical: 22, opacity: 0.85 },
  receiptRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderWidth: 1,
    borderColor: INK,
    padding: 10,
  },
  receiptThumb: { width: 58, height: 72, borderWidth: 1, borderColor: INK },
  receiptPlaceholder: {
    width: 58,
    height: 72,
    borderWidth: 1,
    borderColor: INK,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#EFEAE0',
  },
  receiptMark: { color: INK, fontSize: 30, fontWeight: '400' },
  receiptTitle: { color: INK, fontSize: 12, fontWeight: '800', letterSpacing: 0.8 },
  receiptMeta: { color: MUTE, fontSize: 9, fontWeight: '700', letterSpacing: 0.6, marginTop: 5 },
  reviewNote: { marginTop: 22, borderTopWidth: 1, borderColor: INK, paddingTop: 14 },
  reviewNoteTitle: { color: INK, fontSize: 10, fontWeight: '800', letterSpacing: 1.1 },
  reviewNoteText: { color: MUTE, fontSize: 11, lineHeight: 17, marginTop: 5 },
});
