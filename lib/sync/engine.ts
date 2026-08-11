import * as Network from 'expo-network';
import { AppState } from 'react-native';
import { create } from 'zustand';
import { currentUserId } from '../auth/session';
import { bumpDataVersion,getActiveWorkspace,getDb,nowIso,userWorkspaceId } from '../db/database';
import { deleteLocalMedia } from '../media/local';
import { getSupabase,isSupabaseConfigured } from '../supabase';
import { cleanupRemoteMediaVersions,deleteRemoteMedia,ensureLocalMedia,uploadRowMedia } from './media';
import { coalesceQueue,cursorAfter,localUpsertSql,parseCursor,type SyncCursor } from './merge';
import { clearAllQueueEntries,clearQueueEntries,enqueueChange,getSyncState,pendingCount,readQueue,setOnChangeEnqueued,setSyncState,SYNC_TABLES,type SyncTable } from './queue';

type LocalRow=Record<string,string|number|null>;
type TableConfig={columns:string[];mediaLocalColumn?:string;mediaCloudColumn?:string;rpc:string};
const TABLE_CONFIG:Record<SyncTable,TableConfig>={
  vehicles:{columns:['id','nickname','make','model','year','trim','vin','license_plate','mileage','purchase_date','purchase_price','vin_decoded_at','vin_decode_json','recall_checked_at','recall_json','created_at','updated_at','deleted_at'],mediaLocalColumn:'photo_uri',mediaCloudColumn:'photo_path',rpc:'glovebox_sync_upsert_vehicles'},
  service_records:{columns:['id','vehicle_id','service_type','date','mileage','cost','shop_name','notes','next_due_date','next_due_mileage','created_at','updated_at','deleted_at'],mediaLocalColumn:'receipt_uri',mediaCloudColumn:'receipt_path',rpc:'glovebox_sync_upsert_service_records'},
  reminders:{columns:['id','vehicle_id','title','category','due_date','due_mileage','recurrence_type','recurrence_interval_months','recurrence_interval_miles','status','completed_at','created_at','updated_at','deleted_at'],rpc:'glovebox_sync_upsert_reminders'},
  fuel_entries:{columns:['id','vehicle_id','date','mileage','gallons','total_cost','station','notes','full_tank','created_at','updated_at','deleted_at'],rpc:'glovebox_sync_upsert_fuel_entries'},
};

type SyncStatusState={syncing:boolean;lastSyncedAt:string|null;pending:number;error:string|null};
export const useSyncStatus=create<SyncStatusState>(()=>({syncing:false,lastSyncedAt:null,pending:0,error:null}));
function stateKey(userId:string,key:string){return `${key}:${userId}`;}
function refreshStatus(partial?:Partial<SyncStatusState>){const userId=currentUserId();useSyncStatus.setState({pending:pendingCount(),lastSyncedAt:userId?getSyncState(stateKey(userId,'lastSyncedAt')):null,...partial});}
function getLocalRow(table:SyncTable,rowId:string):LocalRow|null{return getDb().getFirstSync<LocalRow>(`SELECT * FROM ${table} WHERE id=? AND workspace_id=?`,[rowId,getActiveWorkspace()]);}
function backfillIfNeeded(userId:string){const key=stateKey(userId,'backfilled');if(getSyncState(key)==='1')return;const workspace=userWorkspaceId(userId);if(getActiveWorkspace()!==workspace)throw new Error('Sync workspace mismatch');for(const table of SYNC_TABLES){const rows=getDb().getAllSync<{id:string}>(`SELECT id FROM ${table} WHERE workspace_id=?`,[workspace]);for(const row of rows)enqueueChange(table,row.id);}setSyncState(key,'1');}

async function pushQueue(userId:string){
  const changes=coalesceQueue(readQueue()); if(changes.length===0)return; const supabase=getSupabase();
  for(const table of SYNC_TABLES){
    const tableChanges=changes.filter(c=>c.table===table); if(tableChanges.length===0)continue;
    const cfg=TABLE_CONFIG[table]; const payloads:Record<string,unknown>[]=[];
    for(const change of tableChanges){
      const row=getLocalRow(table,change.rowId); if(!row){clearQueueEntries(change.maxQueueId,table,change.rowId);continue;}
      const payload:Record<string,unknown>={}; for(const col of cfg.columns)payload[col]=row[col]??null;
      if(cfg.mediaLocalColumn&&cfg.mediaCloudColumn){
        const localUri=(row[cfg.mediaLocalColumn] as string|null)??null;
        payload[cfg.mediaCloudColumn]=row.deleted_at===null?await uploadRowMedia(userId,table,change.rowId,localUri,String(row.updated_at??nowIso())):null;
      }
      payloads.push(payload);
    }
    if(payloads.length>0){const{error}=await supabase.rpc(cfg.rpc,{p_rows:payloads});if(error)throw new Error(`push ${table} failed: ${error.message}`);}
    if(cfg.mediaCloudColumn){
      for(const change of tableChanges){
        const { data, error } = await supabase.from(table).select(`${cfg.mediaCloudColumn},deleted_at`).eq('id', change.rowId).maybeSingle();
        if(error)throw new Error(`media reconciliation failed: ${error.message}`);
        const remote=data as Record<string,unknown>|null;
        if(!remote||remote.deleted_at!=null)await deleteRemoteMedia(userId,table,change.rowId);
        else await cleanupRemoteMediaVersions(userId,table,change.rowId,(remote[cfg.mediaCloudColumn] as string|null)??null);
      }
    }
    for(const change of tableChanges)clearQueueEntries(change.maxQueueId,table,change.rowId);
  }
}

function cursorFilter(cursor:SyncCursor):string{if(!cursor.id)return `updated_at.gte.${cursor.updatedAt}`;return `updated_at.gt.${cursor.updatedAt},and(updated_at.eq.${cursor.updatedAt},id.gt.${cursor.id})`;}
async function pullChanges(userId:string){const supabase=getSupabase(),PAGE_SIZE=1000,workspace=userWorkspaceId(userId);let applied=0;for(const table of SYNC_TABLES){const cfg=TABLE_CONFIG[table],cursorKey=stateKey(userId,`cursor:${table}`);let cursor=parseCursor(getSyncState(cursorKey));for(;;){const {data,error}=await supabase.from(table).select('*').or(cursorFilter(cursor)).order('updated_at',{ascending:true}).order('id',{ascending:true}).limit(PAGE_SIZE);if(error)throw new Error(`pull ${table} failed: ${error.message}`);const rows=(data??[]) as LocalRow[];if(rows.length===0)break;const pendingIds=new Set(readQueue().filter(e=>e.table_name===table).map(e=>e.row_id));for(const remote of rows){const id=remote.id as string,remoteUpdated=remote.updated_at as string;cursor=cursorAfter(cursor,{id,updated_at:remoteUpdated});const local=getLocalRow(table,id);const localTs=local?.updated_at as string|null|undefined;const localTime=localTs?Date.parse(localTs):NaN,remoteTime=Date.parse(remoteUpdated);const hasPending=pendingIds.has(id);
        if(local&&hasPending&&!Number.isNaN(localTime)&&!Number.isNaN(remoteTime)&&remoteTime<=localTime)continue;
        if(local&&hasPending&&remoteTime>localTime)clearAllQueueEntries(table,id);
        if(local&&!hasPending&&!Number.isNaN(localTime)&&!Number.isNaN(remoteTime)&&remoteTime<localTime)continue;
        const values:LocalRow={workspace_id:workspace};for(const col of cfg.columns)values[col]=(remote[col] as string|number|null)??null;if(cfg.mediaLocalColumn&&cfg.mediaCloudColumn){const remotePath=(remote[cfg.mediaCloudColumn] as string|null)??null;const existing=(local?.[cfg.mediaLocalColumn] as string|null)??null;if(remote.deleted_at===null)values[cfg.mediaLocalColumn]=await ensureLocalMedia(remotePath,existing);else{deleteLocalMedia(existing);values[cfg.mediaLocalColumn]=null;}}
        const cols=Object.keys(values);getDb().runSync(localUpsertSql(table,cols),cols.map(c=>values[c]??null));applied+=1;
      }setSyncState(cursorKey,JSON.stringify(cursor));if(rows.length<PAGE_SIZE)break;}}
  if(applied>0)bumpDataVersion();}

let syncing=false,syncAgainRequested=false;
export async function syncNow():Promise<void>{if(!isSupabaseConfigured)return;const userId=currentUserId();if(!userId||getActiveWorkspace()!==userWorkspaceId(userId))return;if(syncing){syncAgainRequested=true;return;}syncing=true;useSyncStatus.setState({syncing:true,error:null});try{const network=await Network.getNetworkStateAsync();if(network.isConnected===false)return;backfillIfNeeded(userId);await pullChanges(userId);await pushQueue(userId);await pullChanges(userId);setSyncState(stateKey(userId,'lastSyncedAt'),nowIso());}catch(e){useSyncStatus.setState({error:e instanceof Error?e.message:'Sync failed'});}finally{syncing=false;refreshStatus({syncing:false});if(syncAgainRequested){syncAgainRequested=false;void syncNow();}}}
const DEBOUNCE_MS=3000;let debounceTimer:ReturnType<typeof setTimeout>|null=null;
function scheduleSync(){refreshStatus();if(debounceTimer)clearTimeout(debounceTimer);debounceTimer=setTimeout(()=>{debounceTimer=null;void syncNow();},DEBOUNCE_MS);}
export function startSyncLifecycle():()=>void{setOnChangeEnqueued(scheduleSync);const subscription=AppState.addEventListener('change',state=>{if(state==='active')void syncNow();});refreshStatus();void syncNow();return()=>{setOnChangeEnqueued(null);subscription.remove();if(debounceTimer){clearTimeout(debounceTimer);debounceTimer=null;}};}
