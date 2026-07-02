import {
  AiParseError,
  isEmptyScan,
  parseCostCheck,
  parseReceiptScan,
  parseRepairExplanation,
} from '../parse';

describe('parseReceiptScan', () => {
  it('keeps well-formed fields', () => {
    const scan = parseReceiptScan({
      serviceType: 'oil_change',
      date: '2026-06-14',
      cost: 89.5,
      shopName: "Joe's Auto",
      mileage: 82000,
      summary: 'Full synthetic oil change',
    });
    expect(scan).toEqual({
      serviceType: 'oil_change',
      date: '2026-06-14',
      cost: 89.5,
      shopName: "Joe's Auto",
      mileage: 82000,
      summary: 'Full synthetic oil change',
    });
  });

  it('drops a service type that is not in the catalog', () => {
    expect(parseReceiptScan({ serviceType: 'flux_capacitor' }).serviceType).toBeNull();
  });

  it('drops malformed dates and coerces numeric strings', () => {
    const scan = parseReceiptScan({ date: '06/14/2026', cost: '$1,234.56', mileage: '82,000' });
    expect(scan.date).toBeNull();
    expect(scan.cost).toBe(1234.56);
    expect(scan.mileage).toBe(82000);
  });

  it('treats empty strings and wrong types as missing', () => {
    const scan = parseReceiptScan({ shopName: '  ', cost: 'a lot', mileage: -5, summary: 42 });
    expect(scan).toEqual({ serviceType: null, date: null, cost: null, shopName: null, mileage: null, summary: null });
    expect(isEmptyScan(scan)).toBe(true);
  });

  it('rejects non-object payloads', () => {
    expect(() => parseReceiptScan('receipt says $40')).toThrow(AiParseError);
    expect(() => parseReceiptScan([1, 2])).toThrow(AiParseError);
  });
});

describe('parseRepairExplanation', () => {
  it('keeps a complete answer', () => {
    const out = parseRepairExplanation({
      summary: 'Brake pads press on the rotors to stop the car.',
      whatItIs: 'Pads wear down over time and are replaced as a set per axle.',
      urgency: 'soon',
      urgencyWhy: 'Worn pads reduce braking power.',
      diyDifficulty: 'moderate',
      questionsForShop: ['Are the rotors reusable?', 'What pad brand do you install?'],
    });
    expect(out.urgency).toBe('soon');
    expect(out.diyDifficulty).toBe('moderate');
    expect(out.questionsForShop).toHaveLength(2);
  });

  it('falls back to safe defaults for unknown enum values', () => {
    const out = parseRepairExplanation({ summary: 'x', whatItIs: 'y', urgency: 'PANIC', diyDifficulty: 'trivial' });
    expect(out.urgency).toBe('routine');
    expect(out.diyDifficulty).toBe('moderate');
  });

  it('fills summary/whatItIs from each other when one is missing', () => {
    expect(parseRepairExplanation({ summary: 'only summary' }).whatItIs).toBe('only summary');
    expect(parseRepairExplanation({ whatItIs: 'only body' }).summary).toBe('only body');
  });

  it('throws when there is no usable text at all', () => {
    expect(() => parseRepairExplanation({ urgency: 'routine' })).toThrow(AiParseError);
  });

  it('caps and cleans the questions list', () => {
    const out = parseRepairExplanation({
      summary: 's',
      whatItIs: 'w',
      questionsForShop: ['a', 2, '', 'b', 'c', 'd', 'e'],
    });
    expect(out.questionsForShop).toEqual(['a', 'b', 'c', 'd']);
  });
});

describe('parseCostCheck', () => {
  it('keeps a complete verdict', () => {
    const out = parseCostCheck({
      verdict: 'fair',
      typicalLow: 250,
      typicalHigh: 400,
      explanation: 'Parts run $120 and labor 1.5 hours.',
      tips: ['Ask for the old parts back'],
    });
    expect(out.verdict).toBe('fair');
    expect(out.typicalLow).toBe(250);
    expect(out.typicalHigh).toBe(400);
  });

  it('swaps an inverted range', () => {
    const out = parseCostCheck({ verdict: 'high', typicalLow: 400, typicalHigh: 250, explanation: 'x' });
    expect(out.typicalLow).toBe(250);
    expect(out.typicalHigh).toBe(400);
  });

  it('accepts numeric strings for the range', () => {
    const out = parseCostCheck({ verdict: 'low', typicalLow: '$250', typicalHigh: '400', explanation: 'x' });
    expect(out.typicalLow).toBe(250);
    expect(out.typicalHigh).toBe(400);
  });

  it('throws without a verdict or explanation', () => {
    expect(() => parseCostCheck({ verdict: 'maybe', explanation: 'x' })).toThrow(AiParseError);
    expect(() => parseCostCheck({ verdict: 'fair' })).toThrow(AiParseError);
  });
});
