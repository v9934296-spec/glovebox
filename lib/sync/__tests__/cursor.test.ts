import {
  INITIAL_PULL_CURSOR,
  parsePullCursor,
  postgrestLiteral,
  serializePullCursor,
} from '../cursor';

describe('sync cursor', () => {
  it('round-trips a compound timestamp/id cursor', () => {
    const cursor = { updatedAt: '2026-07-11T12:00:00.000Z', id: 'row-b' };
    expect(parsePullCursor(serializePullCursor(cursor))).toEqual(cursor);
  });

  it('replays safely when a legacy or corrupt cursor is encountered', () => {
    expect(parsePullCursor('2026-07-11T12:00:00.000Z')).toEqual(INITIAL_PULL_CURSOR);
    expect(parsePullCursor('{broken')).toEqual(INITIAL_PULL_CURSOR);
  });

  it('quotes values used in a PostgREST or expression', () => {
    expect(postgrestLiteral('a"b\\c')).toBe('"a\\"b\\\\c"');
  });
});
