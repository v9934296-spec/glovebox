/**
 * Pure entitlement logic for Glovebox Pro (unit tested, no RN imports).
 * The free tier keeps the core tracker useful; Pro removes limits and
 * unlocks power features. All gating decisions flow through here so the
 * rules live in one place.
 */

export const PRO_ENTITLEMENT_ID = 'pro';

export const FREE_LIMITS = {
  /** Vehicles a free user can keep in the garage. */
  maxVehicles: 2,
} as const;

export type GateResult = { allowed: true } | { allowed: false; reason: string };

export function canAddVehicle(vehicleCount: number, isPro: boolean): GateResult {
  if (isPro || vehicleCount < FREE_LIMITS.maxVehicles) return { allowed: true };
  return {
    allowed: false,
    reason: `The free plan is limited to ${FREE_LIMITS.maxVehicles} vehicles. Upgrade to Glovebox Pro for an unlimited garage.`,
  };
}

export function canAttachReceipt(isPro: boolean): GateResult {
  if (isPro) return { allowed: true };
  return {
    allowed: false,
    reason: 'Receipt photos are a Glovebox Pro feature. Upgrade to keep every receipt with its service record.',
  };
}

export function canUseAi(isPro: boolean): GateResult {
  if (isPro) return { allowed: true };
  return {
    allowed: false,
    reason: 'AI tools — receipt scanning, repair explanations, and price checks — are a Glovebox Pro feature.',
  };
}

/** Marketing copy shown on the paywall and in Settings. */
export const PRO_FEATURES: ReadonlyArray<{ title: string; detail: string }> = [
  { title: 'Unlimited garage', detail: `Track more than ${FREE_LIMITS.maxVehicles} vehicles` },
  { title: 'Receipt photos', detail: 'Attach receipts to every service record' },
  { title: 'AI receipt scanner', detail: 'Snap a receipt and the service record fills itself in' },
  { title: 'AI repair assistant', detail: 'Plain-language explanations and fair-price checks for any repair' },
  { title: 'PDF vehicle history', detail: 'Coming in a future update — included in Pro' },
];
