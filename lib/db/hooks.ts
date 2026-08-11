import { useMemo } from 'react';
import type { FuelEntry,Reminder,ServiceRecord,Vehicle } from '../domain/types';
import { useDataVersion } from './database';
import { listFuelEntries } from './fuelRepo';
import { listReminders } from './reminderRepo';
import { listAllServiceRecords,listServiceRecords } from './serviceRepo';
import { getVehicle,listVehicles } from './vehicleRepo';
export function useVehicles():Vehicle[]{const v=useDataVersion(s=>s.version);return useMemo(()=>listVehicles(),[v]);}
export function useVehicle(id:string|undefined):Vehicle|null{const v=useDataVersion(s=>s.version);return useMemo(()=>id?getVehicle(id):null,[id,v]);}
export function useServiceRecords(vehicleId:string|undefined):ServiceRecord[]{const v=useDataVersion(s=>s.version);return useMemo(()=>vehicleId?listServiceRecords(vehicleId):[],[vehicleId,v]);}
export function useAllServiceRecords():ServiceRecord[]{const v=useDataVersion(s=>s.version);return useMemo(()=>listAllServiceRecords(),[v]);}
export function useFuelEntries(vehicleId?:string):FuelEntry[]{const v=useDataVersion(s=>s.version);return useMemo(()=>listFuelEntries(vehicleId),[vehicleId,v]);}
export function useReminders(filter?:{vehicleId?:string;status?:Reminder['status']}):Reminder[]{const v=useDataVersion(s=>s.version);return useMemo(()=>listReminders(filter),[filter?.vehicleId,filter?.status,v]);}
