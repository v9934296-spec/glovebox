/**
 * PDF generation + share sheet for the vehicle history report.
 * Everything runs on-device (expo-print renders the HTML), so unlike
 * sync/AI this Pro feature works offline and in local-only mode.
 */
import { File, Paths } from 'expo-file-system';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import { todayIso } from '../domain/due';
import type { Reminder, ServiceRecord, Vehicle } from '../domain/types';
import { buildVehicleReportHtml } from './html';

function reportFileName(vehicle: Vehicle, today: string): string {
  const slug = `${vehicle.year}-${vehicle.make}-${vehicle.model}`.replace(/[^\w-]+/g, '-');
  return `Glovebox-${slug}-${today}.pdf`;
}

/** Generate the report PDF and open the system share sheet. */
export async function shareVehicleReport(
  vehicle: Vehicle,
  records: ServiceRecord[],
  reminders: Reminder[],
): Promise<void> {
  const today = todayIso();
  const html = buildVehicleReportHtml({ vehicle, records, reminders, today });
  const { uri } = await Print.printToFileAsync({ html });

  // Move the randomly-named print output to a friendly name; the share
  // sheet and receiving apps show the file name to the user.
  let shareUri = uri;
  try {
    const target = new File(Paths.cache, reportFileName(vehicle, today));
    if (target.exists) target.delete();
    new File(uri).move(target);
    shareUri = target.uri;
  } catch {
    // Renaming is cosmetic; fall back to the original file.
  }

  if (!(await Sharing.isAvailableAsync())) {
    throw new Error('Sharing is not available on this device.');
  }
  await Sharing.shareAsync(shareUri, {
    mimeType: 'application/pdf',
    dialogTitle: 'Share vehicle report',
    UTI: 'com.adobe.pdf',
  });
}
