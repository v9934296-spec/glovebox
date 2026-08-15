/**
 * Pure entitlement logic for Glovebox Pro (unit tested, no RN imports).
 * The free tier keeps the core tracker useful; Pro removes limits and
 * unlocks power features. All gating decisions flow through here so the
 * rules live in one place.
 */

export const PRO_ENTITLEMENT_ID = 'pro';

/** Alternate dashboard identifier from RevenueCat’s snippet; either unlocks Pro. */
export const PRO_ENTITLEMENT_ALIAS = 'Create a project called glovebox Pro';

/**
 * True when CustomerInfo has Glovebox Pro via either entitlement identifier.
 * Pure so it can be unit-tested without the native Purchases module.
 */
export function hasActiveProEntitlement(
  active: Record<string, unknown> | null | undefined,
): boolean {
  if (active == null) return false;
  return active[PRO_ENTITLEMENT_ID] != null || active[PRO_ENTITLEMENT_ALIAS] != null;
}

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

export function canExportReport(isPro: boolean): GateResult {
  if (isPro) return { allowed: true };
  return {
    allowed: false,
    reason: 'The PDF vehicle history report is a Glovebox Pro feature. Upgrade to export a shareable service record.',
  };
}

/** Marketing copy shown on the paywall and in Settings. */
export const PRO_FEATURES: ReadonlyArray<{ title: string; detail: string }> = [
  { title: 'Unlimited garage', detail: `Track more than ${FREE_LIMITS.maxVehicles} vehicles` },
  { title: 'Receipt photos', detail: 'Attach receipts to every service record' },
  { title: 'AI receipt scanner', detail: 'Snap a receipt and the service record fills itself in' },
  { title: 'AI repair assistant', detail: 'Plain-language explanations and fair-price checks for any repair' },
  { title: 'PDF vehicle history', detail: 'Export a polished service report — great when selling' },
];
