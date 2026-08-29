/** Minimal router surface used to leave a pushed screen. */
export type DismissableRouter = {
  canGoBack: () => boolean;
  back: () => void;
  replace: (href: string) => void;
};

/**
 * Leave the current screen. Prefer stack history; if this screen was opened
 * as the first route (deep link / reload), fall back to a known home route
 * instead of a no-op.
 */
export function dismissScreen(router: DismissableRouter, fallback = '/'): void {
  if (router.canGoBack()) {
    router.back();
    return;
  }
  router.replace(fallback);
}
