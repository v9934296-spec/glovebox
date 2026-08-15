/**
 * Public legal URLs (Railway static site). Missing or invalid
 * EXPO_PUBLIC_LEGAL_BASE_URL yields nulls so the UI never opens a dead link.
 */

export type LegalUrls = {
  privacyUrl: string | null;
  termsUrl: string | null;
};

/** Normalize a configured base to its origin, or null if unusable. */
export function normalizeLegalBaseUrl(raw: string | undefined): string | null {
  const value = raw?.trim() ?? '';
  if (value === '') return null;
  try {
    const url = new URL(value);
    if (url.protocol !== 'http:' && url.protocol !== 'https:') return null;
    if (url.hostname === '') return null;
    return url.origin;
  } catch {
    return null;
  }
}

export function getLegalUrls(raw: string | undefined = process.env.EXPO_PUBLIC_LEGAL_BASE_URL): LegalUrls {
  const origin = normalizeLegalBaseUrl(raw);
  if (origin == null) return { privacyUrl: null, termsUrl: null };
  return {
    privacyUrl: `${origin}/privacy.html`,
    termsUrl: `${origin}/terms.html`,
  };
}

export const { privacyUrl, termsUrl } = getLegalUrls();
