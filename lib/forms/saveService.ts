/**
 * Commits the log-service draft. Kept out of the store so the store stays
 * free of database imports, and out of the screens so every exit path from
 * the flow writes the record exactly the same way.
 */
import { createServiceRecord } from '../db/serviceRepo';
import { updateVehicleMileage } from '../db/vehicleRepo';
import { getVehicle } from '../db/vehicleRepo';
import { draftMileage, useServiceDraft, validateDraft } from './serviceDraft';

export type SaveResult = { ok: true } | { ok: false; reason: string };

/**
 * Validates, writes, rolls the odometer forward when the entry is higher, and
 * clears the draft. Guards against a double-tap committing two records.
 */
export function saveServiceDraft(): SaveResult {
  const store = useServiceDraft.getState();
  if (store.saving) return { ok: false, reason: 'Already saving.' };

  const validation = validateDraft(store);
  if (!validation.ok) return validation;

  store.setSaving(true);
  try {
    createServiceRecord(validation.record);

    const entered = draftMileage(store);
    const vehicle = store.vehicleId != null ? getVehicle(store.vehicleId) : null;
    if (entered != null && vehicle != null && entered > vehicle.mileage) {
      updateVehicleMileage(vehicle.id, entered);
    }

    store.reset();
    return { ok: true };
  } catch (e) {
    return { ok: false, reason: e instanceof Error ? e.message : 'Could not save that record.' };
  } finally {
    useServiceDraft.getState().setSaving(false);
  }
}
