import Constants from 'expo-constants';
import React from 'react';
import { Alert, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Button, Card, Screen, SectionHeader } from '@/components/ui';
import { resetAllData } from '@/lib/db/database';
import { useVehicles } from '@/lib/db/hooks';
import { palette, spacing, typography } from '@/lib/theme';

export default function SettingsScreen() {
  const vehicles = useVehicles();

  function confirmReset() {
    Alert.alert(
      'Erase all data',
      'This permanently deletes every vehicle, service record, and reminder on this device. There is no undo.',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Erase everything', style: 'destructive', onPress: () => resetAllData() },
      ],
    );
  }

  return (
    <Screen style={{ padding: 0 }}>
      <ScrollView contentContainerStyle={{ padding: spacing.screenPadding, paddingBottom: spacing['2xl'] }}>
        <SectionHeader title="Units" />
        <Card>
          <Row label="Distance" value="Miles" />
          <Row label="Currency" value="USD" last />
        </Card>
        <Text style={styles.hint}>Metric units and other currencies are coming with cloud sync.</Text>

        <SectionHeader title="Coming soon" />
        <Card>
          <Row label="Cloud sync & accounts" value="Phase 2" />
          <Row label="Notifications" value="Phase 2" />
          <Row label="Glovebox Pro" value="Phase 3" />
          <Row label="PDF vehicle report" value="Phase 5" last />
        </Card>

        <SectionHeader title="Data" />
        <Card>
          <Row label="Vehicles on this device" value={String(vehicles.length)} last />
        </Card>
        <Button title="Erase all data" variant="danger" onPress={confirmReset} style={{ marginTop: spacing.lg }} />

        <Text style={styles.version}>
          Glovebox {Constants.expoConfig?.version ?? ''} · local-only build, your data never leaves this device
        </Text>
      </ScrollView>
    </Screen>
  );
}

function Row({ label, value, last }: { label: string; value: string; last?: boolean }) {
  return (
    <View style={[styles.row, !last && styles.rowBorder]}>
      <Text style={styles.rowLabel}>{label}</Text>
      <Text style={styles.rowValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: spacing.sm },
  rowBorder: { borderBottomWidth: 1, borderBottomColor: palette.border.subtle },
  rowLabel: { color: palette.text.primary, fontSize: typography.body.size },
  rowValue: { color: palette.text.tertiary, fontSize: typography.body.size },
  hint: { color: palette.text.tertiary, fontSize: typography.caption.size, marginTop: spacing.sm },
  version: {
    color: palette.text.tertiary,
    fontSize: typography.caption.size,
    textAlign: 'center',
    marginTop: spacing['2xl'],
  },
});
