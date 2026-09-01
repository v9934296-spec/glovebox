import {
  preconditionForRecallCheck,
  recallCheckFailureAlert,
  recallCheckSuccessAlert,
} from '../recallCheck';
import {
  vinDecodeFailureMessage,
  vinServiceFailureKindFromStatus,
  type VinServiceFailureKind,
} from '../errors';

const VALID_VIN = '1HGCM82633A004352';

describe('preconditionForRecallCheck', () => {
  it('requires a VIN before calling the service', () => {
    expect(preconditionForRecallCheck(null)).toEqual({
      ok: false,
      title: 'VIN required',
      message: 'Add or decode the vehicle VIN before checking for recalls.',
    });
    expect(preconditionForRecallCheck('   ')).toEqual({
      ok: false,
      title: 'VIN required',
      message: 'Add or decode the vehicle VIN before checking for recalls.',
    });
  });

  it('rejects an invalid VIN format', () => {
    expect(preconditionForRecallCheck('TOOSHORT')).toEqual({
      ok: false,
      title: 'Invalid VIN',
      message: 'Enter a valid 17-character VIN before checking for recalls.',
    });
  });

  it('accepts a normalized valid VIN', () => {
    expect(preconditionForRecallCheck(` ${VALID_VIN.toLowerCase()} `)).toEqual({
      ok: true,
      vin: VALID_VIN,
    });
  });
});

describe('recallCheckSuccessAlert', () => {
  it('reports no recalls without claiming a VIN-specific open status', () => {
    expect(recallCheckSuccessAlert(0)).toEqual({
      title: 'No recalls found',
      message: 'No recalls were found for this year, make, and model.',
    });
  });

  it('reports one recall', () => {
    expect(recallCheckSuccessAlert(1)).toEqual({
      title: 'Recall found',
      message: '1 recall found for this year, make, and model.',
    });
  });

  it('reports multiple recalls', () => {
    expect(recallCheckSuccessAlert(3)).toEqual({
      title: 'Recall found',
      message: '3 recalls found for this year, make, and model.',
    });
  });
});

describe('recallCheckFailureAlert', () => {
  const cases: Array<[VinServiceFailureKind, string]> = [
    ['invalid_request', 'Vehicle information incomplete'],
    ['auth', 'Recall check unavailable'],
    ['rate_limit', 'Too many requests'],
    ['server', 'Recall service unavailable'],
    ['network', 'Unable to connect'],
    ['unexpected', 'Recall check failed'],
  ];

  it.each(cases)('maps %s failures to the correct alert', (kind, title) => {
    expect(recallCheckFailureAlert(kind).title).toBe(title);
  });
});

describe('vinServiceFailureKindFromStatus', () => {
  it.each([
    [400, 'invalid_request'],
    [422, 'invalid_request'],
    [401, 'auth'],
    [403, 'auth'],
    [429, 'rate_limit'],
    [500, 'server'],
    [502, 'server'],
    [418, 'unexpected'],
  ] as const)('maps status %i to %s', (status, kind) => {
    expect(vinServiceFailureKindFromStatus(status)).toBe(kind);
  });
});

describe('vinDecodeFailureMessage', () => {
  it('never exposes internal failure-kind strings to users', () => {
    const kinds: VinServiceFailureKind[] = [
      'invalid_request',
      'auth',
      'rate_limit',
      'server',
      'network',
      'unexpected',
    ];

    for (const kind of kinds) {
      const message = vinDecodeFailureMessage(kind);
      expect(message.length).toBeGreaterThan(20);
      expect(message).not.toBe(kind);
    }
  });
});
