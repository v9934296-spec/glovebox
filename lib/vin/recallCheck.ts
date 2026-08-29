/**
 * Recall-check UX helpers: client-side VIN gating and user-facing alerts.
 * Network calls live in client.ts; these stay pure for unit tests.
 */
import { isValidVinFormat, normalizeVin } from '../domain/vin';

export type RecallCheckPrecondition =
  | { ok: true; vin: string }
  | { ok: false; title: string; message: string };

export type RecallCheckFailureKind =
  | 'invalid_vin_server'
  | 'auth'
  | 'rate_limit'
  | 'server'
  | 'unexpected'
  | 'network';

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
      title: 'No open recalls found',
      message: 'No open recalls were found for this vehicle.',
    };
  }
  return {
    title: 'Recall found',
    message: `${recallCount} open recall${recallCount === 1 ? '' : 's'} found for this vehicle.`,
  };
}

export function recallCheckFailureAlert(kind: RecallCheckFailureKind): RecallCheckAlert {
  switch (kind) {
    case 'invalid_vin_server':
      return {
        title: 'Invalid VIN',
        message: 'The recall service could not recognize this VIN. Check it and try again.',
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

/** Maps an HTTP status from the vin Edge Function to a failure kind. */
export function recallCheckFailureKindFromStatus(status: number): RecallCheckFailureKind {
  if (status === 400 || status === 422) return 'invalid_vin_server';
  if (status === 401 || status === 403) return 'auth';
  if (status === 429) return 'rate_limit';
  if (status >= 500) return 'server';
  return 'unexpected';
}
