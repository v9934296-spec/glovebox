import { summarizeExpenses } from '../expenses';
import type { FuelEntry } from '../types';
const fuel=(overrides:Partial<FuelEntry>={}):FuelEntry=>({id:'f1',vehicleId:'v1',date:'2026-08-01',mileage:10000,gallons:10,totalCost:40,station:'Shell',notes:null,fullTank:true,createdAt:'2026-08-01T00:00:00Z',updatedAt:'2026-08-01T00:00:00Z',...overrides});
describe('fuel ownership cost',()=>{it('includes fuel in month, year, lifetime and category totals',()=>{const s=summarizeExpenses([],'2026-08-11',[fuel()]);expect(s.monthTotal).toBe(40);expect(s.yearTotal).toBe(40);expect(s.lifetimeTotal).toBe(40);expect(s.fuelTotal).toBe(40);expect(s.byCategory[0]).toEqual({serviceType:'fuel',total:40});});});
