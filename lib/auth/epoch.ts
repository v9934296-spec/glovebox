/**
 * Compare-and-swap for auth epoch: apply `next` only if `expected` still
 * matches the live counter. Used inside Zustand updaters so the check and
 * the write are one synchronous step.
 */
export function applyIfEpochMatches<S>(
  expectedEpoch: number,
  liveEpoch: number,
  previous: S,
  next: S,
): S {
  return expectedEpoch === liveEpoch ? next : previous;
}
