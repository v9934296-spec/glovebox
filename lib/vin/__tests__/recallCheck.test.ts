import {
  preconditionForRecallCheck,
  recallCheckFailureAlert,
  recallCheckFailureKindFromStatus,
  recallCheckSuccessAlert,
} from '../recallCheck';

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
  it('reports no recalls', () => {
    expect(recallCheckSuccessAlert(0)).toEqual({
      title: 'No open recalls found',
      message: 'No open recalls were found for this vehicle.',
    });
  });

  it('reports one recall', () => {
    expect(recallCheckSuccessAlert(1)).toEqual({
      title: 'Recall found',
      message: '1 open recall found for this vehicle.',
    });
  });

  it('reports multiple recalls', () => {
    expect(recallCheckSuccessAlert(3)).toEqual({
      title: 'Recall found',
      message: '3 open recalls found for this vehicle.',
    });
  });
});

describe('recallCheckFailureAlert', () => {
  it('maps network failures', () => {
    expect(recallCheckFailureAlert('network').title).toBe('Unable to connect');
  });
});

describe('recallCheckFailureKindFromStatus', () => {
  it('maps common HTTP statuses', () => {
    expect(recallCheckFailureKindFromStatus(400)).toBe('invalid_vin_server');
    expect(recallCheckFailureKindFromStatus(401)).toBe('auth');
    expect(recallCheckFailureKindFromStatus(429)).toBe('rate_limit');
    expect(recallCheckFailureKindFromStatus(502)).toBe('server');
    expect(recallCheckFailureKindFromStatus(418)).toBe('unexpected');
  });
});
