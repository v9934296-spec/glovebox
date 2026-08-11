import { File, Paths } from 'expo-file-system';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import { todayIso } from '../domain/due';
import type { FuelEntry, Reminder, ServiceRecord, Vehicle } from '../domain/types';
import { buildVehicleReportHtml } from './html';
function reportFileName(vehicle:Vehicle,today:string){return `Glovebox-${`${vehicle.year}-${vehicle.make}-${vehicle.model}`.replace(/[^\w-]+/g,'-')}-${today}.pdf`;}
export async function shareVehicleReport(vehicle:Vehicle,records:ServiceRecord[],reminders:Reminder[],fuelEntries:FuelEntry[]=[]):Promise<void>{const today=todayIso();const html=buildVehicleReportHtml({vehicle,records,reminders,fuelEntries,today});const{uri}=await Print.printToFileAsync({html});let shareUri=uri;try{const target=new File(Paths.cache,reportFileName(vehicle,today));if(target.exists)target.delete();new File(uri).move(target);shareUri=target.uri;}catch{}if(!(await Sharing.isAvailableAsync()))throw new Error('Sharing is not available on this device.');await Sharing.shareAsync(shareUri,{mimeType:'application/pdf',dialogTitle:'Share vehicle report',UTI:'com.adobe.pdf'});}
