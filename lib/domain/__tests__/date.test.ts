import { isValidIsoDate } from '../date';
describe('isValidIsoDate',()=>{it('accepts valid calendar dates',()=>{expect(isValidIsoDate('2024-02-29')).toBe(true);expect(isValidIsoDate('2026-08-11')).toBe(true);});it('rejects impossible dates',()=>{expect(isValidIsoDate('2026-02-30')).toBe(false);expect(isValidIsoDate('2026-99-88')).toBe(false);expect(isValidIsoDate('08/11/2026')).toBe(false);});});
