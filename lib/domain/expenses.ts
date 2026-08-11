import { serviceTypeDef } from './serviceTypes';
import type { FuelEntry, ServiceRecord } from './types';

export type ExpenseSummary = {
  monthTotal: number; yearTotal: number; lifetimeTotal: number; costPerMile: number | null;
  byCategory: Array<{ serviceType: string; total: number }>;
  maintenanceTotal: number; repairTotal: number; adminTotal: number; fuelTotal: number;
};

export function summarizeExpenses(records: ServiceRecord[], today: string, fuelEntries: FuelEntry[] = []): ExpenseSummary {
  const [yearStr, monthStr] = today.split('-'); const monthPrefix = `${yearStr}-${monthStr}`; const yearPrefix = `${yearStr}-`;
  let monthTotal=0,yearTotal=0,lifetimeTotal=0,maintenanceTotal=0,repairTotal=0,adminTotal=0,fuelTotal=0;
  const categoryTotals=new Map<string,number>(); const mileages:number[]=[];
  const add=(date:string,value:number)=>{lifetimeTotal+=value;if(date.startsWith(yearPrefix))yearTotal+=value;if(date.startsWith(monthPrefix))monthTotal+=value;};
  for(const r of records){const c=r.cost??0;add(r.date,c);const kind=serviceTypeDef(r.serviceType).kind;if(kind==='repair')repairTotal+=c;else if(kind==='admin')adminTotal+=c;else maintenanceTotal+=c;categoryTotals.set(r.serviceType,(categoryTotals.get(r.serviceType)??0)+c);if(r.mileage!=null)mileages.push(r.mileage);}
  for(const f of fuelEntries){add(f.date,f.totalCost);fuelTotal+=f.totalCost;categoryTotals.set('fuel',(categoryTotals.get('fuel')??0)+f.totalCost);mileages.push(f.mileage);}
  let costPerMile:number|null=null;if(mileages.length>=2){const span=Math.max(...mileages)-Math.min(...mileages);if(span>0)costPerMile=lifetimeTotal/span;}
  const byCategory=[...categoryTotals.entries()].map(([serviceType,total])=>({serviceType,total})).sort((a,b)=>b.total-a.total);
  return{monthTotal,yearTotal,lifetimeTotal,costPerMile,byCategory,maintenanceTotal,repairTotal,adminTotal,fuelTotal};
}
export function formatMoney(n:number):string{return n.toLocaleString('en-US',{style:'currency',currency:'USD',maximumFractionDigits:n%1===0?0:2});}
