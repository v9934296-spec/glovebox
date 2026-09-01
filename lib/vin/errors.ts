export type VinServiceFailureKind =
  | 'invalid_request'
  | 'auth'
  | 'rate_limit'
  | 'server'
  | 'unexpected'
  | 'network';

export class VinServiceError extends Error {
  readonly kind: VinServiceFailureKind;

  constructor(kind: VinServiceFailureKind, message?: string) {
    super(message ?? kind);
    this.name = 'VinServiceError';
    this.kind = kind;
  }
}

/** Maps transport status without assuming which VIN operation was requested. */
export function vinServiceFailureKindFromStatus(status: number): VinServiceFailureKind {
  if (status === 400 || status === 422) return 'invalid_request';
  if (status === 401 || status === 403) return 'auth';
  if (status === 429) return 'rate_limit';
  if (status >= 500) return 'server';
  return 'unexpected';
}

export function vinDecodeFailureMessage(kind: VinServiceFailureKind): string {
  switch (kind) {
    case 'invalid_request':
      return 'Check the VIN and try again.';
    case 'auth':
      return 'VIN decoding is unavailable right now. Try again later.';
    case 'rate_limit':
      return 'The VIN service is temporarily busy. Wait a moment and try again.';
    case 'server':
      return 'The vehicle data service is unavailable right now. Try again later.';
    case 'network':
      return 'Check your internet connection and try again.';
    default:
      return 'Something went wrong while decoding the VIN. Try again.';
  }
}
