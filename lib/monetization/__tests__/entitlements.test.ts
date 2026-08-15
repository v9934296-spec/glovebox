import {
  canAddVehicle,
  canAttachReceipt,
  canExportReport,
  canUseAi,
  FREE_LIMITS,
  hasActiveProEntitlement,
  PRO_ENTITLEMENT_ALIAS,
  PRO_ENTITLEMENT_ID,
} from '../entitlements';

describe('hasActiveProEntitlement', () => {
  it('unlocks Pro for the repo entitlement id', () => {
    expect(hasActiveProEntitlement({ [PRO_ENTITLEMENT_ID]: {} })).toBe(true);
  });

  it('unlocks Pro for the RevenueCat dashboard alias', () => {
    expect(hasActiveProEntitlement({ [PRO_ENTITLEMENT_ALIAS]: {} })).toBe(true);
  });

  it('does not unlock when neither identifier is active', () => {
    expect(hasActiveProEntitlement({})).toBe(false);
    expect(hasActiveProEntitlement(undefined)).toBe(false);
    expect(hasActiveProEntitlement({ other: {} })).toBe(false);
  });
});

describe('canAddVehicle', () => {
  it('allows free users under the vehicle limit', () => {
    expect(canAddVehicle(0, false).allowed).toBe(true);
    expect(canAddVehicle(FREE_LIMITS.maxVehicles - 1, false).allowed).toBe(true);
  });

  it('blocks free users at the vehicle limit with a reason', () => {
    const result = canAddVehicle(FREE_LIMITS.maxVehicles, false);
    expect(result.allowed).toBe(false);
    if (!result.allowed) expect(result.reason).toContain('Pro');
  });

  it('blocks free users over the limit (e.g. grandfathered data)', () => {
    expect(canAddVehicle(FREE_LIMITS.maxVehicles + 3, false).allowed).toBe(false);
  });

  it('always allows Pro users', () => {
    expect(canAddVehicle(0, true).allowed).toBe(true);
    expect(canAddVehicle(100, true).allowed).toBe(true);
  });
});

describe('canAttachReceipt', () => {
  it('blocks free users with a reason', () => {
    const result = canAttachReceipt(false);
    expect(result.allowed).toBe(false);
    if (!result.allowed) expect(result.reason).toContain('Pro');
  });

  it('allows Pro users', () => {
    expect(canAttachReceipt(true).allowed).toBe(true);
  });
});

describe('canUseAi', () => {
  it('blocks free users with a reason', () => {
    const result = canUseAi(false);
    expect(result.allowed).toBe(false);
    if (!result.allowed) expect(result.reason).toContain('Pro');
  });

  it('allows Pro users', () => {
    expect(canUseAi(true).allowed).toBe(true);
  });
});

describe('canExportReport', () => {
  it('blocks free users with a reason', () => {
    const result = canExportReport(false);
    expect(result.allowed).toBe(false);
    if (!result.allowed) expect(result.reason).toContain('Pro');
  });

  it('allows Pro users', () => {
    expect(canExportReport(true).allowed).toBe(true);
  });
});
