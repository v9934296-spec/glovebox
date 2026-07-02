/**
 * Pure parsing/normalization of AI responses (unit tested, no RN imports).
 * The model is asked for strict JSON, but responses are still untrusted:
 * values are coerced where reasonable and dropped (null) where not, so a
 * sloppy model answer degrades to fewer prefilled fields, never a crash.
 */
import { asString } from '../domain/coerce';
import { SERVICE_TYPES } from '../domain/serviceTypes';

export class AiParseError extends Error {
  constructor() {
    super('The AI returned an unreadable response. Try again.');
    this.name = 'AiParseError';
  }
}

function asRecord(raw: unknown): Record<string, unknown> {
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) throw new AiParseError();
  return raw as Record<string, unknown>;
}

/** Accepts numbers or numeric strings like "82.50" / "$1,234.56". */
function asNumber(v: unknown): number | null {
  if (typeof v === 'number' && Number.isFinite(v)) return v;
  if (typeof v === 'string') {
    const n = Number(v.replace(/[$,\s]/g, ''));
    if (Number.isFinite(n) && v.trim() !== '') return n;
  }
  return null;
}

function asInt(v: unknown): number | null {
  const n = asNumber(v);
  return n != null && n >= 0 ? Math.round(n) : null;
}

function asIsoDate(v: unknown): string | null {
  const s = asString(v);
  return s != null && /^\d{4}-\d{2}-\d{2}$/.test(s) ? s : null;
}

function asStringArray(v: unknown, max: number): string[] {
  if (!Array.isArray(v)) return [];
  return v.map(asString).filter((s): s is string => s != null).slice(0, max);
}

function asEnum<T extends string>(v: unknown, values: readonly T[], fallback: T): T {
  const s = asString(v)?.toLowerCase();
  return (values as readonly string[]).includes(s ?? '') ? (s as T) : fallback;
}

// --- Receipt scan ---

export type ReceiptScan = {
  /** A valid id from the service catalog, or null when the model was unsure. */
  serviceType: string | null;
  date: string | null;
  cost: number | null;
  shopName: string | null;
  mileage: number | null;
  summary: string | null;
};

const serviceTypeIds = new Set(SERVICE_TYPES.map((t) => t.id));

export function parseReceiptScan(raw: unknown): ReceiptScan {
  const r = asRecord(raw);
  const serviceType = asString(r.serviceType);
  return {
    serviceType: serviceType != null && serviceTypeIds.has(serviceType) ? serviceType : null,
    date: asIsoDate(r.date),
    cost: asNumber(r.cost),
    shopName: asString(r.shopName),
    mileage: asInt(r.mileage),
    summary: asString(r.summary),
  };
}

/** True when a scan found nothing usable (so the UI can say so instead of silently doing nothing). */
export function isEmptyScan(scan: ReceiptScan): boolean {
  return Object.values(scan).every((v) => v === null);
}

// --- Repair explanation ---

export const urgencies = ['routine', 'soon', 'urgent'] as const;
export type Urgency = (typeof urgencies)[number];

export const diyDifficulties = ['easy', 'moderate', 'pro-only'] as const;
export type DiyDifficulty = (typeof diyDifficulties)[number];

export type RepairExplanation = {
  summary: string;
  whatItIs: string;
  urgency: Urgency;
  urgencyWhy: string | null;
  diyDifficulty: DiyDifficulty;
  questionsForShop: string[];
};

export function parseRepairExplanation(raw: unknown): RepairExplanation {
  const r = asRecord(raw);
  const summary = asString(r.summary);
  const whatItIs = asString(r.whatItIs);
  // Without the actual explanation the card would be empty — treat as unreadable.
  if (summary === null && whatItIs === null) throw new AiParseError();
  return {
    summary: summary ?? whatItIs!,
    whatItIs: whatItIs ?? summary!,
    urgency: asEnum(r.urgency, urgencies, 'routine'),
    urgencyWhy: asString(r.urgencyWhy),
    diyDifficulty: asEnum(r.diyDifficulty, diyDifficulties, 'moderate'),
    questionsForShop: asStringArray(r.questionsForShop, 4),
  };
}

// --- Cost check ---

export const costVerdicts = ['low', 'fair', 'high'] as const;
export type CostVerdict = (typeof costVerdicts)[number];

export type CostCheck = {
  verdict: CostVerdict;
  typicalLow: number | null;
  typicalHigh: number | null;
  explanation: string;
  tips: string[];
};

export function parseCostCheck(raw: unknown): CostCheck {
  const r = asRecord(raw);
  const explanation = asString(r.explanation);
  const verdict = asString(r.verdict)?.toLowerCase();
  if (explanation === null || !(costVerdicts as readonly string[]).includes(verdict ?? '')) {
    throw new AiParseError();
  }
  let low = asNumber(r.typicalLow);
  let high = asNumber(r.typicalHigh);
  if (low != null && high != null && low > high) [low, high] = [high, low];
  return {
    verdict: verdict as CostVerdict,
    typicalLow: low,
    typicalHigh: high,
    explanation,
    tips: asStringArray(r.tips, 3),
  };
}
