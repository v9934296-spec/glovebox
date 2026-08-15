/**
 * Client teardown after the delete-account Edge Function succeeds.
 * Session is cleared first so a later local-wipe failure cannot leave
 * a deleted user's JWT active.
 */
export async function runPostDeletionTeardown(steps: {
  clearSession: () => Promise<void>;
  cleanupLocal: () => Promise<void>;
}): Promise<void> {
  await steps.clearSession();
  try {
    await steps.cleanupLocal();
  } catch {
    // Local cache wipe is best-effort after the session is already dead.
  }
}
