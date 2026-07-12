export type PullCursor = { updatedAt: string; id: string };

export const INITIAL_PULL_CURSOR: PullCursor = {
  updatedAt: '1970-01-01T00:00:00Z',
  id: '',
};

export function parsePullCursor(raw: string | null): PullCursor {
  if (!raw) return INITIAL_PULL_CURSOR;
  try {
    const parsed = JSON.parse(raw) as Partial<PullCursor>;
    if (typeof parsed.updatedAt === 'string' && typeof parsed.id === 'string') {
      return { updatedAt: parsed.updatedAt, id: parsed.id };
    }
  } catch {
    // Corrupt or legacy cursor values are safely replayed from epoch.
  }
  return INITIAL_PULL_CURSOR;
}

export function serializePullCursor(cursor: PullCursor): string {
  return JSON.stringify(cursor);
}

/** Quote a value used inside a raw PostgREST `.or()` expression. */
export function postgrestLiteral(value: string): string {
  return `"${value.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`;
}
