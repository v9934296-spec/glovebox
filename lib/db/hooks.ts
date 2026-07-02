import { useMemo } from 'react';
import type { Reminder, ServiceRecord, Vehicle } from '../domain/types';
import { useDataVersion } from './database';
import { listReminders } from './reminderRepo';
import { listAllServiceRecords, listServiceRecords } from './serviceRepo';
import { getVehicle, listVehicles } from './vehicleRepo';

/** Screens re-run these queries whenever any repo writes (data version bump). */
export function useVehicles(): Vehicle[] {
  const version = useDataVersion((s) => s.version);
  return useMemo(() => listVehicles(), [version]);
}

export function useVehicle(id: string | undefined): Vehicle | null {
  const version = useDataVersion((s) => s.version);
  return useMemo(() => (id ? getVehicle(id) : null), [id, version]);
}

export function useServiceRecords(vehicleId: string | undefined): ServiceRecord[] {
  const version = useDataVersion((s) => s.version);
  return useMemo(() => (vehicleId ? listServiceRecords(vehicleId) : []), [vehicleId, version]);
}

export function useAllServiceRecords(): ServiceRecord[] {
  const version = useDataVersion((s) => s.version);
  return useMemo(() => listAllServiceRecords(), [version]);
}

export function useReminders(filter?: { vehicleId?: string; status?: Reminder['status'] }): Reminder[] {
  const version = useDataVersion((s) => s.version);
  return useMemo(
    () => listReminders(filter),
    [filter?.vehicleId, filter?.status, version],
  );
}
