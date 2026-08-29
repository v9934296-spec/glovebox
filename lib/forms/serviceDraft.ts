/**
 * Draft state for the multi-step "log service" flow.
 *
 * Each step is its own route, so the in-progress record lives here rather than
 * in screen state. `start()` seeds it from the vehicle; `reset()` runs on save
 * or cancel so a re-entry never inherits a stale draft.
 *
 * All numeric parsing happens here (once, safely) instead of in each screen —
 * `Number('1.2.3')` is NaN and must never reach SQLite.
 */
import { create } from 'zustand';
import type { ReceiptScan } from '../ai/parse';
import { addMonthsIso, todayIso } from '../domain/due';
import { isIsoDate } from '../domain/dates';
import { serviceTypeDef } from '../domain/serviceTypes';
import type { NewServiceRecord, Vehicle } from '../domain/types';

/** Fields the receipt scanner filled in, so the UI can mark them. */
export type AiField = 'serviceType' | 'date' | 'cost' | 'shopName' | 'mileage' | 'notes';

export type NextDue = { dueDate: string | null; dueMileage: number | null };

type DraftState = {
  vehicleId: string | null;
  serviceType: string | null;
  date: string;
  mileage: string;
  cost: string;
  shopName: string;
  notes: string;
  receiptUri: string | null;
  /** Owner-overridden next-due; null means "use the interval suggestion". */
  nextDueOverride: NextDue | null;
  aiFields: AiField[];
  saving: boolean;

  start: (vehicle: Vehicle) => void;
  setServiceType: (id: string) => void;
  setDate: (iso: string) => void;
  setMileage: (raw: string) => void;
  setCost: (raw: string) => void;
  setShopName: (raw: string) => void;
  setNotes: (raw: string) => void;
  setReceiptUri: (uri: string | null) => void;
  setNextDueOverride: (next: NextDue | null) => void;
  applyScan: (scan: ReceiptScan) => void;
  setSaving: (saving: boolean) => void;
  reset: () => void;
};

const EMPTY = {
  vehicleId: null,
  serviceType: null,
  date: todayIso(),
  mileage: '',
  cost: '',
  shopName: '',
  notes: '',
  receiptUri: null,
  nextDueOverride: null,
  aiFields: [] as AiField[],
  saving: false,
};

function withAiField(existing: AiField[], field: AiField): AiField[] {
  return existing.includes(field) ? existing : [...existing, field];
}

export const useServiceDraft = create<DraftState>((set, get) => ({
  ...EMPTY,

  start: (vehicle) =>
    set({
      ...EMPTY,
      date: todayIso(),
      vehicleId: vehicle.id,
      mileage: vehicle.mileage > 0 ? String(vehicle.mileage) : '',
    }),

  setServiceType: (id) => set({ serviceType: id }),
  setDate: (iso) => set({ date: iso }),
  setMileage: (raw) => set({ mileage: raw.replace(/[^\d]/g, '') }),
  setCost: (raw) => set({ cost: raw.replace(/[^\d.]/g, '') }),
  setShopName: (raw) => set({ shopName: raw }),
  setNotes: (raw) => set({ notes: raw }),
  setReceiptUri: (uri) => set({ receiptUri: uri }),
  setNextDueOverride: (next) => set({ nextDueOverride: next }),
  setSaving: (saving) => set({ saving }),

  applyScan: (scan) => {
    const state = get();
    let ai = state.aiFields;
    const patch: Partial<DraftState> = {};

    if (scan.serviceType != null) {
      patch.serviceType = scan.serviceType;
      ai = withAiField(ai, 'serviceType');
    }
    if (scan.date != null && isIsoDate(scan.date)) {
      patch.date = scan.date;
      ai = withAiField(ai, 'date');
    }
    if (scan.cost != null && Number.isFinite(scan.cost)) {
      patch.cost = String(scan.cost);
      ai = withAiField(ai, 'cost');
    }
    if (scan.shopName != null) {
      patch.shopName = scan.shopName;
      ai = withAiField(ai, 'shopName');
    }
    if (scan.mileage != null && Number.isFinite(scan.mileage)) {
      patch.mileage = String(scan.mileage);
      ai = withAiField(ai, 'mileage');
    }
    if (scan.summary != null && state.notes.trim() === '') {
      patch.notes = scan.summary;
      ai = withAiField(ai, 'notes');
    }

    set({ ...patch, aiFields: ai });
  },

  reset: () => set({ ...EMPTY, date: todayIso() }),
}));

// --- Pure derivations (exported for tests and for screens to read) ---

export type DraftSnapshot = Pick<
  DraftState,
  'serviceType' | 'date' | 'mileage' | 'cost' | 'shopName' | 'notes' | 'receiptUri' | 'nextDueOverride'
>;

/** Odometer as a number, or null when blank/unparseable. */
export function draftMileage(draft: Pick<DraftSnapshot, 'mileage'>): number | null {
  if (draft.mileage.trim() === '') return null;
  const n = Number(draft.mileage);
  return Number.isFinite(n) && n >= 0 ? Math.round(n) : null;
}

/** Cost as a number, or null when blank/unparseable ("1.2.3" is not 1.2). */
export function draftCost(draft: Pick<DraftSnapshot, 'cost'>): number | null {
  const raw = draft.cost.trim();
  if (raw === '') return null;
  if (!/^\d*\.?\d*$/.test(raw)) return null;
  const n = Number(raw);
  return Number.isFinite(n) && n >= 0 ? n : null;
}

/**
 * Next due from the service type's default interval, unless the owner
 * overrode it. This is what the flow shows as a confirmable sentence instead
 * of two blank text inputs.
 */
export function resolveNextDue(draft: DraftSnapshot): NextDue {
  if (draft.nextDueOverride != null) return draft.nextDueOverride;
  if (draft.serviceType == null) return { dueDate: null, dueMileage: null };
  const def = serviceTypeDef(draft.serviceType);
  const mileage = draftMileage(draft);
  return {
    dueDate:
      def.defaultIntervalMonths != null && isIsoDate(draft.date)
        ? addMonthsIso(draft.date, def.defaultIntervalMonths)
        : null,
    dueMileage:
      def.defaultIntervalMiles != null && mileage != null ? mileage + def.defaultIntervalMiles : null,
  };
}

export type DraftValidation = { ok: true; record: NewServiceRecord } | { ok: false; reason: string };

/** Final gate before the write. Screens never build a NewServiceRecord themselves. */
export function validateDraft(draft: DraftState): DraftValidation {
  if (draft.vehicleId == null) return { ok: false, reason: 'Pick a vehicle first.' };
  if (draft.serviceType == null) return { ok: false, reason: 'Pick what was done.' };
  if (!isIsoDate(draft.date)) return { ok: false, reason: "That date isn't valid." };
  if (draft.cost.trim() !== '' && draftCost(draft) == null) {
    return { ok: false, reason: "That cost isn't a number." };
  }

  const next = resolveNextDue(draft);
  return {
    ok: true,
    record: {
      vehicleId: draft.vehicleId,
      serviceType: draft.serviceType,
      date: draft.date,
      mileage: draftMileage(draft),
      cost: draftCost(draft),
      shopName: draft.shopName.trim() || null,
      notes: draft.notes.trim() || null,
      receiptUri: draft.receiptUri,
      nextDueDate: next.dueDate,
      nextDueMileage: next.dueMileage,
    },
  };
}
