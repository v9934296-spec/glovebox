/**
 * VIN normalization/validation, plus pure parsing of the vin Edge Function's
 * decode/recall responses (unit tested, no RN imports). Provider output is
 * untrusted like lib/ai/parse.ts: values are coerced/dropped rather than
 * trusted, so a sloppy response degrades to fewer fields, never a crash.
 */
import type { DecodedVin, Recall } from './types';

export function normalizeVin(raw: string): string {
  return raw.trim().toUpperCase().replace(/[^A-Z0-9]/g, '');
}

// I, O, Q are excluded from VINs (easily confused with 1, 0).
const VIN_FORMAT = /^[A-HJ-NPR-Z0-9]{17}$/;

export function isValidVinFormat(vin: string): boolean {
  return VIN_FORMAT.test(vin);
}

const CHECK_DIGIT_VALUES: Record<string, number> = {
  '0': 0, '1': 1, '2': 2, '3': 3, '4': 4, '5': 5, '6': 6, '7': 7, '8': 8, '9': 9,
  A: 1, B: 2, C: 3, D: 4, E: 5, F: 6, G: 7, H: 8,
  J: 1, K: 2, L: 3, M: 4, N: 5, P: 7, R: 9,
  S: 2, T: 3, U: 4, V: 5, W: 6, X: 7, Y: 8, Z: 9,
};
const CHECK_DIGIT_WEIGHTS = [8, 7, 6, 5, 4, 3, 2, 10, 0, 9, 8, 7, 6, 5, 4, 3, 2];

/**
 * NHTSA/ISO position-9 check digit, required for North American VINs. Not
 * every global VIN follows it, so callers should treat a mismatch as a soft
 * warning rather than an outright rejection.
 */
export function computeCheckDigit(vin: string): string | null {
  if (!isValidVinFormat(vin)) return null;
  let sum = 0;
  for (let i = 0; i < 17; i++) {
    sum += (CHECK_DIGIT_VALUES[vin[i]!] ?? 0) * CHECK_DIGIT_WEIGHTS[i]!;
  }
  const remainder = sum % 11;
  return remainder === 10 ? 'X' : String(remainder);
}

export function hasValidCheckDigit(vin: string): boolean {
  const expected = computeCheckDigit(vin);
  return expected !== null && expected === vin[8];
}

export type VinValidation =
  | { valid: true; vin: string; checkDigitOk: boolean }
  | { valid: false; reason: string };

/** Normalizes and validates a user-entered VIN for on-device feedback. */
export function validateVin(raw: string): VinValidation {
  const vin = normalizeVin(raw);
  if (vin.length !== 17) return { valid: false, reason: 'VIN must be 17 characters' };
  if (!isValidVinFormat(vin)) return { valid: false, reason: 'VIN contains invalid characters' };
  return { valid: true, vin, checkDigitOk: hasValidCheckDigit(vin) };
}

// --- Parsing provider responses ---

function asRecord(raw: unknown): Record<string, unknown> {
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) return {};
  return raw as Record<string, unknown>;
}

function asString(v: unknown): string | null {
  return typeof v === 'string' && v.trim() !== '' ? v.trim() : null;
}

function asYear(v: unknown): number | null {
  const n = typeof v === 'number' ? v : Number(v);
  return Number.isFinite(n) && n >= 1900 && n <= 2100 ? Math.round(n) : null;
}

/** Coerces the Edge Function's decode result; a fallback VIN covers a missing/blank field. */
export function parseDecodedVin(raw: unknown, fallbackVin: string): DecodedVin {
  const r = asRecord(raw);
  return {
    vin: asString(r.vin) ?? fallbackVin,
    make: asString(r.make),
    model: asString(r.model),
    modelYear: asYear(r.modelYear),
    trim: asString(r.trim),
    bodyClass: asString(r.bodyClass),
    engineCylinders: asString(r.engineCylinders),
    driveType: asString(r.driveType),
    fuelType: asString(r.fuelType),
    plantCountry: asString(r.plantCountry),
    decodable: r.decodable === true,
  };
}

/** Short "2019 Honda Civic EX-L" style label, or null when nothing decoded. */
export function decodedVinSummary(d: DecodedVin): string | null {
  const parts = [d.modelYear, d.make, d.model, d.trim].filter(
    (p): p is string | number => p != null && p !== '',
  );
  return parts.length > 0 ? parts.join(' ') : null;
}

/** Coerces the Edge Function's recall list; malformed/duplicate entries are dropped. */
export function parseRecalls(raw: unknown): Recall[] {
  if (!Array.isArray(raw)) return [];
  const seen = new Set<string>();
  const recalls: Recall[] = [];
  for (const item of raw) {
    if (typeof item !== 'object' || item === null) continue;
    const r = item as Record<string, unknown>;
    const id = asString(r.id);
    if (id == null || seen.has(id)) continue;
    seen.add(id);
    recalls.push({
      id,
      component: asString(r.component),
      summary: asString(r.summary),
      consequence: asString(r.consequence),
      remedy: asString(r.remedy),
      reportedDate: asString(r.reportedDate),
    });
  }
  return recalls;
}

export type RecallStatus = 'unknown' | 'none' | 'open';

/** Maps last-checked timestamp + recall list to a UI status ("unknown" until a check has run). */
export function recallStatus(args: { checkedAt: string | null; recalls: Recall[] }): RecallStatus {
  if (args.checkedAt == null) return 'unknown';
  return args.recalls.length > 0 ? 'open' : 'none';
}
