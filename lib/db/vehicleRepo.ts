import type { DecodedVin, NewVehicle, Recall, Vehicle } from '../domain/types';
import { enqueueChange } from '../sync/queue';
import { deleteLocalMedia } from '../media/local';
import { bumpDataVersion, getActiveWorkspace, getDb, newId, nowIso } from './database';

type VehicleRow = {
  id:string; nickname:string; make:string; model:string; year:number; trim:string|null; vin:string|null;
  license_plate:string|null; mileage:number; purchase_date:string|null; purchase_price:number|null; photo_uri:string|null;
  vin_decoded_at:string|null; vin_decode_json:string|null; recall_checked_at:string|null; recall_json:string|null;
  created_at:string; updated_at:string;
};
function parseJson<T>(raw:string|null,fallback:T):T { if(raw==null)return fallback; try{return JSON.parse(raw) as T;}catch{return fallback;} }
function fromRow(r:VehicleRow):Vehicle { return { id:r.id,nickname:r.nickname,make:r.make,model:r.model,year:r.year,trim:r.trim,vin:r.vin,
  licensePlate:r.license_plate,mileage:r.mileage,purchaseDate:r.purchase_date,purchasePrice:r.purchase_price,photoUri:r.photo_uri,
  vinDecodedAt:r.vin_decoded_at,vinDecoded:parseJson<DecodedVin|null>(r.vin_decode_json,null),recallCheckedAt:r.recall_checked_at,
  recalls:parseJson<Recall[]>(r.recall_json,[]),createdAt:r.created_at,updatedAt:r.updated_at }; }
export function listVehicles():Vehicle[]{ return getDb().getAllSync<VehicleRow>(
  'SELECT * FROM vehicles WHERE workspace_id=? AND deleted_at IS NULL ORDER BY created_at ASC',[getActiveWorkspace()]).map(fromRow); }
export function getVehicle(id:string):Vehicle|null{ const row=getDb().getFirstSync<VehicleRow>(
  'SELECT * FROM vehicles WHERE id=? AND workspace_id=? AND deleted_at IS NULL',[id,getActiveWorkspace()]); return row?fromRow(row):null; }
export function createVehicle(input:NewVehicle):Vehicle{
  const id=newId(),ts=nowIso(),workspace=getActiveWorkspace();
  getDb().runSync(`INSERT INTO vehicles (id,workspace_id,nickname,make,model,year,trim,vin,license_plate,mileage,purchase_date,purchase_price,photo_uri,created_at,updated_at)
    VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,[id,workspace,input.nickname,input.make,input.model,input.year,input.trim,input.vin,input.licensePlate,input.mileage,input.purchaseDate,input.purchasePrice,input.photoUri,ts,ts]);
  enqueueChange('vehicles',id); bumpDataVersion(); return {...input,id,vinDecodedAt:null,vinDecoded:null,recallCheckedAt:null,recalls:[],createdAt:ts,updatedAt:ts};
}
export function updateVehicle(id:string,input:Pick<NewVehicle,'nickname'|'make'|'model'|'year'|'trim'|'vin'|'licensePlate'|'purchaseDate'|'purchasePrice'|'photoUri'>){
  const previous=getVehicle(id); const ts=nowIso(); getDb().runSync(`UPDATE vehicles SET nickname=?,make=?,model=?,year=?,trim=?,vin=?,license_plate=?,purchase_date=?,purchase_price=?,photo_uri=?,
    vin_decoded_at=CASE WHEN vin IS ? THEN vin_decoded_at ELSE NULL END,vin_decode_json=CASE WHEN vin IS ? THEN vin_decode_json ELSE NULL END,
    recall_checked_at=CASE WHEN vin IS ? THEN recall_checked_at ELSE NULL END,recall_json=CASE WHEN vin IS ? THEN recall_json ELSE NULL END,updated_at=?
    WHERE id=? AND workspace_id=?`,[input.nickname,input.make,input.model,input.year,input.trim,input.vin,input.licensePlate,input.purchaseDate,input.purchasePrice,input.photoUri,input.vin,input.vin,input.vin,input.vin,ts,id,getActiveWorkspace()]);
  enqueueChange('vehicles',id); if(previous?.photoUri&&previous.photoUri!==input.photoUri)deleteLocalMedia(previous.photoUri); bumpDataVersion();
}
export function updateVehicleMileage(id:string,mileage:number){ getDb().runSync('UPDATE vehicles SET mileage=?,updated_at=? WHERE id=? AND workspace_id=?',[mileage,nowIso(),id,getActiveWorkspace()]); enqueueChange('vehicles',id); bumpDataVersion(); }
export function updateVehicleVinDecode(id:string,vin:string,decoded:DecodedVin){ const ts=nowIso(); getDb().runSync('UPDATE vehicles SET vin=?,vin_decoded_at=?,vin_decode_json=?,updated_at=? WHERE id=? AND workspace_id=?',[vin,ts,JSON.stringify(decoded),ts,id,getActiveWorkspace()]); enqueueChange('vehicles',id); bumpDataVersion(); }
export function updateVehicleRecalls(id:string,recalls:Recall[]){ const ts=nowIso(); getDb().runSync('UPDATE vehicles SET recall_checked_at=?,recall_json=?,updated_at=? WHERE id=? AND workspace_id=?',[ts,JSON.stringify(recalls),ts,id,getActiveWorkspace()]); enqueueChange('vehicles',id); bumpDataVersion(); }
export function deleteVehicle(id:string){
  const previous=getVehicle(id); const db=getDb(),ts=nowIso(),w=getActiveWorkspace();
  const receiptRows=db.getAllSync<{receipt_uri:string|null}>('SELECT receipt_uri FROM service_records WHERE vehicle_id=? AND workspace_id=? AND deleted_at IS NULL',[id,w]);
  const children={ service_records:db.getAllSync<{id:string}>('SELECT id FROM service_records WHERE vehicle_id=? AND workspace_id=? AND deleted_at IS NULL',[id,w]),
    reminders:db.getAllSync<{id:string}>('SELECT id FROM reminders WHERE vehicle_id=? AND workspace_id=? AND deleted_at IS NULL',[id,w]),
    fuel_entries:db.getAllSync<{id:string}>('SELECT id FROM fuel_entries WHERE vehicle_id=? AND workspace_id=? AND deleted_at IS NULL',[id,w]) };
  db.withTransactionSync(()=>{ db.runSync('UPDATE vehicles SET deleted_at=?,updated_at=? WHERE id=? AND workspace_id=?',[ts,ts,id,w]);
    db.runSync('UPDATE service_records SET deleted_at=?,updated_at=? WHERE vehicle_id=? AND workspace_id=? AND deleted_at IS NULL',[ts,ts,id,w]);
    db.runSync('UPDATE reminders SET deleted_at=?,updated_at=? WHERE vehicle_id=? AND workspace_id=? AND deleted_at IS NULL',[ts,ts,id,w]);
    db.runSync('UPDATE fuel_entries SET deleted_at=?,updated_at=? WHERE vehicle_id=? AND workspace_id=? AND deleted_at IS NULL',[ts,ts,id,w]); });
  enqueueChange('vehicles',id); for(const r of children.service_records)enqueueChange('service_records',r.id); for(const r of children.reminders)enqueueChange('reminders',r.id); for(const r of children.fuel_entries)enqueueChange('fuel_entries',r.id); deleteLocalMedia(previous?.photoUri); for(const r of receiptRows)deleteLocalMedia(r.receipt_uri); bumpDataVersion();
}
