import { getLegalUrls, normalizeLegalBaseUrl } from '../legal';

describe('normalizeLegalBaseUrl', () => {
  it('returns the origin for a valid https URL', () => {
    expect(normalizeLegalBaseUrl('https://glovebox-legal.up.railway.app')).toBe(
      'https://glovebox-legal.up.railway.app',
    );
  });

  it('strips a path and trailing slash down to the origin', () => {
    expect(normalizeLegalBaseUrl('https://glovebox-legal.up.railway.app/privacy.html')).toBe(
      'https://glovebox-legal.up.railway.app',
    );
    expect(normalizeLegalBaseUrl('https://glovebox-legal.up.railway.app/')).toBe(
      'https://glovebox-legal.up.railway.app',
    );
  });

  it('returns null when missing, blank, or not a URL', () => {
    expect(normalizeLegalBaseUrl(undefined)).toBeNull();
    expect(normalizeLegalBaseUrl('')).toBeNull();
    expect(normalizeLegalBaseUrl('   ')).toBeNull();
    expect(normalizeLegalBaseUrl('not-a-url')).toBeNull();
  });

  it('rejects non-http(s) schemes', () => {
    expect(normalizeLegalBaseUrl('javascript:alert(1)')).toBeNull();
    expect(normalizeLegalBaseUrl('file:///tmp/privacy.html')).toBeNull();
  });
});

describe('getLegalUrls', () => {
  it('builds privacy and terms paths from the origin', () => {
    expect(getLegalUrls('https://glovebox-legal.up.railway.app')).toEqual({
      privacyUrl: 'https://glovebox-legal.up.railway.app/privacy.html',
      termsUrl: 'https://glovebox-legal.up.railway.app/terms.html',
    });
  });

  it('returns null links when the env is missing or invalid', () => {
    expect(getLegalUrls(undefined)).toEqual({ privacyUrl: null, termsUrl: null });
    expect(getLegalUrls('')).toEqual({ privacyUrl: null, termsUrl: null });
    expect(getLegalUrls('nope')).toEqual({ privacyUrl: null, termsUrl: null });
  });
});
