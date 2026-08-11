export const PRO_ENTITLEMENT_ID='pro';
export const FREE_LIMITS={maxVehicles:3} as const;
export type GateResult={allowed:true}|{allowed:false;reason:string};
export function canAddVehicle(count:number,isPro:boolean):GateResult{if(isPro||count<FREE_LIMITS.maxVehicles)return{allowed:true};return{allowed:false,reason:`The free plan includes ${FREE_LIMITS.maxVehicles} vehicles. Pro unlocks an unlimited garage plus the receipt vault, AI repair/quote tools, and export reports.`};}
export function canAttachReceipt(isPro:boolean):GateResult{return isPro?{allowed:true}:{allowed:false,reason:'The receipt vault is Pro. Your maintenance log, fuel log, reminders, and Health Score stay free.'};}
export function canUseAi(isPro:boolean):GateResult{return isPro?{allowed:true}:{allowed:false,reason:'Repair explanations, quote checks, and AI receipt scanning are Pro tools. Your core garage still works offline for free.'};}
export function canExportReport(isPro:boolean):GateResult{return isPro?{allowed:true}:{allowed:false,reason:'Shareable PDF ownership reports are a Pro feature.'};}
export const PRO_FEATURES:ReadonlyArray<{title:string;detail:string}>=[
 {title:'Unlimited garage',detail:`Go beyond the ${FREE_LIMITS.maxVehicles} free vehicles`},
 {title:'Receipt vault + AI scan',detail:'Keep service proof and turn receipt photos into structured records'},
 {title:'Repair explainer',detail:'Understand what a shop is recommending before you approve work'},
 {title:'Quote check',detail:'Get a practical price sanity-check with questions to ask the shop'},
 {title:'Ownership report',detail:'Export a polished maintenance, fuel, and cost history when you need it'},
];
