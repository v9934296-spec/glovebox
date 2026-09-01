/**
 * Recall-check UX helpers: client-side VIN gating and user-facing alerts.
 * Network calls live in client.ts; these stay pure for unit tests.
 */
import { isValidVinFormat, normalizeVin } from '../domain/vin';
import type { VinServiceFailureKind } from './errors';

export type RecallCheckPrecondition =
  | { ok: true; vin: string }
  | { ok: false; title: string; message: string };

export type RecallCheckAlert = { title: string; message: string };

/** Blocks the network call when VIN is missing or not 17 valid characters. */
export function preconditionForRecallCheck(vin?: string | null): RecallCheckPrecondition {
  const normalized = normalizeVin(vin ?? '');
  if (!normalized) {
    return {
      ok: false,
      title: 'VIN required',
      message: 'Add or decode the vehicle VIN before checking for recalls.',
    };
  }
  if (!isValidVinFormat(normalized)) {
    return {
      ok: false,
      title: 'Invalid VIN',
      message: 'Enter a valid 17-character VIN before checking for recalls.',
    };
  }
  return { ok: true, vin: normalized };
}

export function recallCheckUnavailableAlert(reason: string): RecallCheckAlert {
  return {
    title: 'Recall check unavailable',
    message: reason,
  };
}

export function recallCheckSuccessAlert(recallCount: number): RecallCheckAlert {
  if (recallCount === 0) {
    return {
      title: 'No recalls found',
      message: 'No recalls were found for this year, make, and model.',
    };
  }
  return {
    title: 'Recall found',
    message: `${recallCount} recall${recallCount === 1 ? '' : 's'} found for this year, make, and model.`,
  };
}

export function recallCheckFailureAlert(kind: VinServiceFailureKind): RecallCheckAlert {
  switch (kind) {
    case 'invalid_request':
      return {
        title: 'Vehicle information incomplete',
        message: 'Check the vehicle year, make, and model, then try again.',
      };
    case 'auth':
      return {
        title: 'Recall check unavailable',
        message: "We couldn't access the recall service right now. Try again later.",
      };
    case 'rate_limit':
      return {
        title: 'Too many requests',
        message: 'The recall service is temporarily busy. Wait a moment and try again.',
      };
    case 'server':
      return {
        title: 'Recall service unavailable',
        message: "We couldn't retrieve recall information right now. Try again later.",
      };
    case 'network':
      return {
        title: 'Unable to connect',
        message: 'Check your internet connection and try again.',
      };
    default:
      return {
        title: 'Recall check failed',
        message: 'Something went wrong while checking recalls. Try again.',
      };
  }
}
