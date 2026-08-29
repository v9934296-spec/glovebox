import { applyIfEpochMatches } from '../epoch';

type Snap = { status: 'signedOut' | 'signedIn'; session: { user: { id: string } } | null };

describe('applyIfEpochMatches', () => {
  const signedOut: Snap = { status: 'signedOut', session: null };
  const signedIn: Snap = { status: 'signedIn', session: { user: { id: 'u1' } } };

  it('commits when the captured epoch is still current', () => {
    expect(applyIfEpochMatches(3, 3, signedOut, signedIn)).toBe(signedIn);
  });

  it('keeps previous state when a newer epoch has already landed', () => {
    expect(applyIfEpochMatches(3, 4, signedOut, signedIn)).toBe(signedOut);
  });

  it('rejects a stale signed-in write after sign-out bumps the epoch', () => {
    const liveEpoch = 2;
    const enterSignedInEpoch = 1;
    expect(applyIfEpochMatches(enterSignedInEpoch, liveEpoch, signedOut, signedIn)).toEqual(
      signedOut,
    );
  });
});
