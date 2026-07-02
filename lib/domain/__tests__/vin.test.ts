import {
  decodedVinSummary,
  hasValidCheckDigit,
  isValidVinFormat,
  normalizeVin,
  parseDecodedVin,
  parseRecalls,
  recallStatus,
  validateVin,
} from '../vin';
import type { DecodedVin, Recall } from '../types';

// Real, valid-check-digit VIN (1998 Honda Accord) used as a known-good fixture.
const VALID_VIN = '1HGCM82633A004352';

describe('normalizeVin', () => {
  it('uppercases and strips whitespace/punctuation', () => {
    expect(normalizeVin(' 1hgcm826-33a 004352 ')).toBe(VALID_VIN);
  });
});

describe('isValidVinFormat', () => {
  it('accepts 17-char alphanumeric VINs', () => {
    expect(isValidVinFormat(VALID_VIN)).toBe(true);
  });

  it('rejects wrong length', () => {
    expect(isValidVinFormat('1HGCM8263')).toBe(false);
  });

  it('rejects I, O, Q', () => {
    expect(isValidVinFormat('1HGCM8263IA004352')).toBe(false);
    expect(isValidVinFormat('1HGCM8263OA004352')).toBe(false);
    expect(isValidVinFormat('1HGCM8263QA004352')).toBe(false);
  });
});

describe('hasValidCheckDigit', () => {
  it('validates a real VIN', () => {
    expect(hasValidCheckDigit(VALID_VIN)).toBe(true);
  });

  it('flags a tampered check digit', () => {
    const tampered = `${VALID_VIN.slice(0, 8)}9${VALID_VIN.slice(9)}`;
    expect(hasValidCheckDigit(tampered)).toBe(false);
  });
});

describe('validateVin', () => {
  it('normalizes then validates format', () => {
    expect(validateVin(` ${VALID_VIN.toLowerCase()} `)).toEqual({
      valid: true,
      vin: VALID_VIN,
      checkDigitOk: true,
    });
  });

  it('reports a wrong-length VIN', () => {
    expect(validateVin('SHORTVIN')).toEqual({ valid: false, reason: 'VIN must be 17 characters' });
  });

  it('reports invalid characters at the right length', () => {
    const withO = `${VALID_VIN.slice(0, 16)}O`;
    expect(validateVin(withO)).toEqual({ valid: false, reason: 'VIN contains invalid characters' });
  });

  it('surfaces a bad check digit as valid format but checkDigitOk: false', () => {
    const tampered = `${VALID_VIN.slice(0, 8)}9${VALID_VIN.slice(9)}`;
    expect(validateVin(tampered)).toEqual({ valid: true, vin: tampered, checkDigitOk: false });
  });
});

describe('parseDecodedVin', () => {
  it('coerces a well-formed provider response', () => {
    const result = parseDecodedVin(
      {
        vin: VALID_VIN,
        make: 'Honda',
        model: 'Accord',
        modelYear: '1998',
        trim: 'EX',
        bodyClass: 'Sedan',
        engineCylinders: '6',
        driveType: 'FWD',
        fuelType: 'Gasoline',
        plantCountry: 'UNITED STATES (USA)',
        decodable: true,
      },
      VALID_VIN,
    );
    expect(result).toEqual<DecodedVin>({
      vin: VALID_VIN,
      make: 'Honda',
      model: 'Accord',
      modelYear: 1998,
      trim: 'EX',
      bodyClass: 'Sedan',
      engineCylinders: '6',
      driveType: 'FWD',
      fuelType: 'Gasoline',
      plantCountry: 'UNITED STATES (USA)',
      decodable: true,
    });
  });

  it('degrades to nulls on a malformed/empty response instead of throwing', () => {
    const result = parseDecodedVin(null, VALID_VIN);
    expect(result.vin).toBe(VALID_VIN);
    expect(result.make).toBeNull();
    expect(result.decodable).toBe(false);
  });

  it('drops an out-of-range model year', () => {
    const result = parseDecodedVin({ modelYear: 3000 }, VALID_VIN);
    expect(result.modelYear).toBeNull();
  });
});

describe('decodedVinSummary', () => {
  it('joins the present fields', () => {
    const d: DecodedVin = {
      vin: VALID_VIN,
      make: 'Honda',
      model: 'Accord',
      modelYear: 1998,
      trim: 'EX',
      bodyClass: null,
      engineCylinders: null,
      driveType: null,
      fuelType: null,
      plantCountry: null,
      decodable: true,
    };
    expect(decodedVinSummary(d)).toBe('1998 Honda Accord EX');
  });

  it('returns null when nothing decoded', () => {
    const d: DecodedVin = {
      vin: VALID_VIN,
      make: null,
      model: null,
      modelYear: null,
      trim: null,
      bodyClass: null,
      engineCylinders: null,
      driveType: null,
      fuelType: null,
      plantCountry: null,
      decodable: false,
    };
    expect(decodedVinSummary(d)).toBeNull();
  });
});

describe('parseRecalls', () => {
  it('coerces a well-formed list', () => {
    const result = parseRecalls([
      { id: '23V123000', component: 'AIR BAGS', summary: 'Bad inflator', consequence: 'Injury risk', remedy: 'Free replacement', reportedDate: '2023-05-01' },
    ]);
    expect(result).toEqual<Recall[]>([
      { id: '23V123000', component: 'AIR BAGS', summary: 'Bad inflator', consequence: 'Injury risk', remedy: 'Free replacement', reportedDate: '2023-05-01' },
    ]);
  });

  it('returns empty array for non-array input', () => {
    expect(parseRecalls(null)).toEqual([]);
    expect(parseRecalls({})).toEqual([]);
  });

  it('drops entries without an id and de-dupes by id', () => {
    const result = parseRecalls([
      { id: 'A', summary: 'first' },
      { summary: 'no id' },
      { id: 'A', summary: 'duplicate' },
    ]);
    expect(result).toHaveLength(1);
    expect(result[0]?.summary).toBe('first');
  });
});

describe('recallStatus', () => {
  it('is unknown before any check has run', () => {
    expect(recallStatus({ checkedAt: null, recalls: [] })).toBe('unknown');
  });

  it('is none when checked with no open recalls', () => {
    expect(recallStatus({ checkedAt: '2026-07-01T00:00:00Z', recalls: [] })).toBe('none');
  });

  it('is open when checked with recalls present', () => {
    const recalls: Recall[] = [
      { id: 'A', component: null, summary: null, consequence: null, remedy: null, reportedDate: null },
    ];
    expect(recallStatus({ checkedAt: '2026-07-01T00:00:00Z', recalls })).toBe('open');
  });
});
