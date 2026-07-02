/**
 * Client for the `vin` Supabase Edge Function (see supabase/functions/vin).
 * Like AI, VIN decode/recall lookups are a cloud feature: they need Supabase
 * configured. Unlike AI, this is a free core utility (no Pro gate, no sign-in
 * requirement) — screens call `vinAvailability()` first and explain why the
 * feature is unavailable otherwise.
 */
import { FunctionsHttpError } from '@supabase/supabase-js';
import { parseDecodedVin, parseRecalls } from '../domain/vin';
import type { DecodedVin, Recall } from '../domain/types';
import { getSupabase, isSupabaseConfigured } from '../supabase';

export type VinAvailability = { available: true } | { available: false; reason: string };

export function vinAvailability(): VinAvailability {
  if (!isSupabaseConfigured) {
    return {
      available: false,
      reason: 'VIN decode and recall checks need the cloud backend, which is not configured in this build.',
    };
  }
  return { available: true };
}

async function invokeVin(body: Record<string, unknown>): Promise<unknown> {
  const { data, error } = await getSupabase().functions.invoke('vin', { body });
  if (error) {
    if (error instanceof FunctionsHttpError) {
      const detail = await error.context
        .json()
        .then((b: { error?: string }) => b.error)
        .catch(() => undefined);
      throw new Error(detail ?? 'The vehicle data service is unavailable right now. Try again in a minute.');
    }
    throw new Error('Could not reach the vehicle data service. Check your connection and try again.');
  }
  return (data as { result?: unknown })?.result;
}

/** Decodes a VIN via the NHTSA vPIC provider. `vin` must already be normalized/validated. */
export async function decodeVin(vin: string): Promise<DecodedVin> {
  return parseDecodedVin(await invokeVin({ task: 'decode', vin }), vin);
}

/** Looks up open NHTSA recalls for a make/model/year. */
export async function checkRecalls(make: string, model: string, modelYear: number): Promise<Recall[]> {
  return parseRecalls(await invokeVin({ task: 'check_recalls', make, model, modelYear }));
}
