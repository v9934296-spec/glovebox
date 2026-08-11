import { File } from 'expo-file-system';
import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';
import { FunctionsHttpError } from '@supabase/supabase-js';
import { useAuth } from '../auth/session';
import type { Vehicle } from '../domain/types';
import { getSupabase,isSupabaseConfigured } from '../supabase';
import { ensureAiConsent } from './consent';
import { parseCostCheck,parseReceiptScan,parseRepairExplanation,type CostCheck,type ReceiptScan,type RepairExplanation } from './parse';
export type AiAvailability={available:true}|{available:false;reason:string};
export function aiAvailability():AiAvailability{if(!isSupabaseConfigured)return{available:false,reason:'AI needs the secure cloud service, which is not configured in this build.'};if(useAuth.getState().status!=='signedIn')return{available:false,reason:'Sign in to use Glovebox AI. Your core garage still works offline without an account.'};return{available:true};}
function vehicleContext(v:Vehicle){return{year:v.year,make:v.make,model:v.model,mileage:v.mileage};}
async function invokeAi(body:Record<string,unknown>):Promise<unknown>{if(!(await ensureAiConsent()))throw new Error('AI request cancelled.');const{data,error}=await getSupabase().functions.invoke('ai',{body});if(error){if(error instanceof FunctionsHttpError){const detail=await error.context.json().then((b:{error?:string})=>b.error).catch(()=>undefined);throw new Error(detail??'The AI service is unavailable right now.');}throw new Error('Could not reach the AI service. Check your connection and try again.');}return(data as{result?:unknown})?.result;}
export async function scanReceipt(localImageUri:string):Promise<ReceiptScan>{const context=ImageManipulator.manipulate(localImageUri);context.resize({width:1600,height:null});const rendered=await context.renderAsync();const saved=await rendered.saveAsync({compress:0.72,format:SaveFormat.JPEG});const file=new File(saved.uri);if((file.size??0)>4_500_000)throw new Error('Receipt image is still too large after compression. Crop it and try again.');const imageBase64=await file.base64();return parseReceiptScan(await invokeAi({task:'scan_receipt',imageBase64,mimeType:'image/jpeg'}));}
export async function explainRepair(serviceLabel:string,vehicle:Vehicle,notes?:string):Promise<RepairExplanation>{return parseRepairExplanation(await invokeAi({task:'explain_repair',serviceLabel,vehicle:vehicleContext(vehicle),notes:notes||undefined}));}
export async function checkCost(serviceLabel:string,cost:number,vehicle:Vehicle,shopName?:string):Promise<CostCheck>{return parseCostCheck(await invokeAi({task:'check_cost',serviceLabel,cost,vehicle:vehicleContext(vehicle),shopName:shopName||undefined}));}
