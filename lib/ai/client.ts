/**
 * Client for the `ai` Supabase Edge Function (see supabase/functions/ai).
 * Like sync, AI is a cloud feature: it needs Supabase configured and a
 * signed-in user (the function verifies the JWT). Screens call
 * `aiAvailability()` first and explain the reason when unavailable.
 */
import { File } from 'expo-file-system';
import { FunctionsHttpError } from '@supabase/supabase-js';
import { useAuth } from '../auth/session';
import type { Vehicle } from '../domain/types';
import { getSupabase, isSupabaseConfigured } from '../supabase';
import {
  parseCostCheck,
  parseReceiptScan,
  parseRepairExplanation,
  type CostCheck,
  type ReceiptScan,
  type RepairExplanation,
} from './parse';

export type AiAvailability = { available: true } | { available: false; reason: string };

export function aiAvailability(): AiAvailability {
  if (!isSupabaseConfigured) {
    return { available: false, reason: 'AI features need the cloud backend, which is not configured in this build.' };
  }
  if (useAuth.getState().status !== 'signedIn') {
    return { available: false, reason: 'Sign in to your Glovebox account to use AI features.' };
  }
  return { available: true };
}

/** Vehicle context shared with the model so answers fit the actual car. */
function vehicleContext(v: Vehicle) {
  return { year: v.year, make: v.make, model: v.model, mileage: v.mileage };
}

async function invokeAi(body: Record<string, unknown>): Promise<unknown> {
  const { data, error } = await getSupabase().functions.invoke('ai', { body });
  if (error) {
    // The function returns { error: string } bodies with useful messages
    // (e.g. "AI is not configured on the server"); surface those directly.
    if (error instanceof FunctionsHttpError) {
      const detail = await error.context
        .json()
        .then((b: { error?: string }) => b.error)
        .catch(() => undefined);
      throw new Error(detail ?? 'The AI service is unavailable right now. Try again in a minute.');
    }
    throw new Error('Could not reach the AI service. Check your connection and try again.');
  }
  return (data as { result?: unknown })?.result;
}

/** Extract a service record draft from a photo of a receipt/invoice. */
export async function scanReceipt(localImageUri: string): Promise<ReceiptScan> {
  const imageBase64 = await new File(localImageUri).base64();
  const mimeType = localImageUri.toLowerCase().includes('.png') ? 'image/png' : 'image/jpeg';
  return parseReceiptScan(await invokeAi({ task: 'scan_receipt', imageBase64, mimeType }));
}

/** Plain-language explanation of a service/repair for this vehicle. */
export async function explainRepair(serviceLabel: string, vehicle: Vehicle, notes?: string): Promise<RepairExplanation> {
  return parseRepairExplanation(
    await invokeAi({ task: 'explain_repair', serviceLabel, vehicle: vehicleContext(vehicle), notes: notes || undefined }),
  );
}

/** Is this quote reasonable for this vehicle? */
export async function checkCost(
  serviceLabel: string,
  cost: number,
  vehicle: Vehicle,
  shopName?: string,
): Promise<CostCheck> {
  return parseCostCheck(
    await invokeAi({ task: 'check_cost', serviceLabel, cost, vehicle: vehicleContext(vehicle), shopName: shopName || undefined }),
  );
}
