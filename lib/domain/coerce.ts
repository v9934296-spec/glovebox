/**
 * Tiny, shared value-coercion helpers for parsing untrusted external input
 * (AI responses, provider API payloads). Kept minimal — only extract a helper
 * here once it's identical across two or more parsers; don't grow this into
 * a general utility belt.
 */

export function asString(v: unknown): string | null {
  return typeof v === 'string' && v.trim() !== '' ? v.trim() : null;
}
