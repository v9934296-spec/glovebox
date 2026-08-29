/**
 * Fatal-render reporting. Swap the body for Sentry/Bugsnag when a DSN is wired;
 * until then we always log so production crashes are still visible in device logs.
 */
export function reportFatalError(error: unknown, componentStack?: string | null): void {
  const err = error instanceof Error ? error : new Error(String(error));
  console.error('[Glovebox] render error', err.message, err.stack, componentStack ?? '');
}
