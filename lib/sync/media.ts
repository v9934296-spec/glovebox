import { Directory, File, Paths } from 'expo-file-system';
import { deleteLocalMedia } from '../media/local';
import { getSupabase } from '../supabase';
import type { SyncTable } from './queue';

export const MEDIA_BUCKET = 'glovebox-media';
function isLocalFileUri(uri: string | null): uri is string { return uri != null && uri.startsWith('file:'); }
function extensionOf(uri: string): string { return /\.(\w{2,5})(?:\?.*)?$/.exec(uri)?.[1]?.toLowerCase() ?? 'jpg'; }
function contentTypeFor(ext: string): string { return ext === 'png' ? 'image/png' : ext === 'heic' ? 'image/heic' : 'image/jpeg'; }
export async function uploadRowMedia(userId: string, table: SyncTable, rowId: string, localUri: string | null, version: string): Promise<string | null> {
  if (!isLocalFileUri(localUri)) return null;
  const file = new File(localUri); if (!file.exists) return null;
  const ext = extensionOf(localUri); const stamp = Number.isFinite(Date.parse(version)) ? Date.parse(version) : Date.now(); const path = `${userId}/${table}/${rowId}-${stamp}.${ext}`; const bytes = await file.bytes();
  const { error } = await getSupabase().storage.from(MEDIA_BUCKET).upload(path, bytes.buffer as ArrayBuffer, { contentType: contentTypeFor(ext), upsert: true });
  if (error) throw new Error(`media upload failed (${path}): ${error.message}`);
  return path;
}

export async function cleanupRemoteMediaVersions(userId: string, table: SyncTable, rowId: string, keepPath: string | null): Promise<void> {
  const { data, error } = await getSupabase().storage.from(MEDIA_BUCKET).list(`${userId}/${table}`, { search: rowId });
  if (error) throw new Error(`media list failed: ${error.message}`);
  const paths = (data ?? []).filter((x) => x.name.startsWith(`${rowId}-`) || x.name.startsWith(`${rowId}.`)).map((x) => `${userId}/${table}/${x.name}`).filter((p) => p !== keepPath);
  if (paths.length) { const result = await getSupabase().storage.from(MEDIA_BUCKET).remove(paths); if (result.error) throw new Error(`media cleanup failed: ${result.error.message}`); }
}

export async function deleteRemoteMedia(userId: string, table: SyncTable, rowId: string): Promise<void> {
  const { data, error } = await getSupabase().storage.from(MEDIA_BUCKET).list(`${userId}/${table}`, { search: rowId });
  if (error) throw new Error(`media list failed: ${error.message}`);
  const paths = (data ?? []).filter((x) => x.name.startsWith(`${rowId}-`) || x.name.startsWith(`${rowId}.`)).map((x) => `${userId}/${table}/${x.name}`);
  if (paths.length) { const result = await getSupabase().storage.from(MEDIA_BUCKET).remove(paths); if (result.error) throw new Error(`media delete failed: ${result.error.message}`); }
}
export async function ensureLocalMedia(remotePath: string | null, existingLocalUri: string | null): Promise<string | null> {
  if (remotePath === null) { deleteLocalMedia(existingLocalUri); return null; }
  const mediaDir = new Directory(Paths.document, 'glovebox-media', 'synced');
  if (!mediaDir.exists) mediaDir.create({ intermediates: true, idempotent: true });
  const target = new File(mediaDir, remotePath.replace(/\//g, '_'));
  if (target.exists) { if (existingLocalUri && existingLocalUri !== target.uri) deleteLocalMedia(existingLocalUri); return target.uri; }
  const { data, error } = await getSupabase().storage.from(MEDIA_BUCKET).createSignedUrl(remotePath, 300);
  if (error || !data?.signedUrl) throw new Error(`signed url failed (${remotePath}): ${error?.message ?? 'no url'}`);
  const downloaded = await File.downloadFileAsync(data.signedUrl, target);
  if (existingLocalUri && existingLocalUri !== downloaded.uri) deleteLocalMedia(existingLocalUri);
  return downloaded.uri;
}
