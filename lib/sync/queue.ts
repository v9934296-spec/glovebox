import { getActiveWorkspace, getDb, nowIso } from '../db/database';

export const SYNC_TABLES = ['vehicles', 'service_records', 'reminders', 'fuel_entries'] as const;
export type SyncTable = (typeof SYNC_TABLES)[number];
let onEnqueued: (() => void) | null = null;
export function setOnChangeEnqueued(cb:(()=>void)|null){onEnqueued=cb;}
export function enqueueChange(table:SyncTable,rowId:string){const workspace=getActiveWorkspace();getDb().runSync('INSERT INTO sync_queue(workspace_id,table_name,row_id,queued_at) VALUES(?,?,?,?)',[workspace,table,rowId,nowIso()]);onEnqueued?.();}
export type QueueEntry={id:number;table_name:SyncTable;row_id:string};
export function readQueue():QueueEntry[]{return getDb().getAllSync<QueueEntry>('SELECT id,table_name,row_id FROM sync_queue WHERE workspace_id=? ORDER BY id ASC',[getActiveWorkspace()]);}
export function clearQueueEntries(maxIdInclusive:number,table:SyncTable,rowId:string){getDb().runSync('DELETE FROM sync_queue WHERE workspace_id=? AND id<=? AND table_name=? AND row_id=?',[getActiveWorkspace(),maxIdInclusive,table,rowId]);}
export function clearAllQueueEntries(table:SyncTable,rowId:string){getDb().runSync('DELETE FROM sync_queue WHERE workspace_id=? AND table_name=? AND row_id=?',[getActiveWorkspace(),table,rowId]);}
export function pendingCount():number{const row=getDb().getFirstSync<{n:number}>('SELECT COUNT(DISTINCT table_name || ":" || row_id) AS n FROM sync_queue WHERE workspace_id=?',[getActiveWorkspace()]);return row?.n??0;}
export function getSyncState(key:string):string|null{const row=getDb().getFirstSync<{value:string}>('SELECT value FROM sync_state WHERE key=?',[key]);return row?.value??null;}
export function setSyncState(key:string,value:string){getDb().runSync('INSERT INTO sync_state(key,value) VALUES(?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value',[key,value]);}
export function deleteSyncState(key:string){getDb().runSync('DELETE FROM sync_state WHERE key=?',[key]);}
