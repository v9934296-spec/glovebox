import { Directory, File, Paths } from 'expo-file-system';
import { getSupabase } from '../supabase';
import type { SyncTable } from './queue';

export const MEDIA_BUCKET = 'glovebox-media';

function isLocalFileUri(uri: string | null): uri is string {
  return uri != null && uri.startsWith('file:');
}

function extensionOf(uri: string): string {
  const match = /\.(\w{2,5})(?:\?.*)?$/.exec(uri);
  return match?.[1]?.toLowerCase() ?? 'jpg';
}

function contentTypeFor(ext: string): string {
  return ext === 'png' ? 'image/png' : ext === 'heic' ? 'image/heic' : 'image/jpeg';
}

/**
 * Upload a row's local image (if any) to the owner's folder in Storage.
 * Deterministic path per row means re-uploads simply overwrite.
 * Returns the storage path to store in the cloud row, or null when no media.
 */
export async function uploadRowMedia(
  userId: string,
  table: SyncTable,
  rowId: string,
  localUri: string | null,
): Promise<string | null> {
  if (!isLocalFileUri(localUri)) return null;
  const file = new File(localUri);
  if (!file.exists) return null;
  const ext = extensionOf(localUri);
  const path = `${userId}/${table}/${rowId}.${ext}`;
  const bytes = await file.bytes();
  const { error } = await getSupabase()
    .storage.from(MEDIA_BUCKET)
    .upload(path, bytes.buffer as ArrayBuffer, { contentType: contentTypeFor(ext), upsert: true });
  if (error) throw new Error(`media upload failed (${path}): ${error.message}`);
  return path;
}

/**
 * Make sure a pulled row's media exists locally. Downloads via a short-lived
 * signed URL into the app's document directory. Returns the local file URI to
 * store on the row, or the existing one when it is already present.
 */
export async function ensureLocalMedia(
  remotePath: string | null,
  existingLocalUri: string | null,
): Promise<string | null> {
  if (remotePath === null) return null;
  if (isLocalFileUri(existingLocalUri) && new File(existingLocalUri).exists) {
    return existingLocalUri;
  }
  const { data, error } = await getSupabase()
    .storage.from(MEDIA_BUCKET)
    .createSignedUrl(remotePath, 300);
  if (error || !data?.signedUrl) {
    throw new Error(`signed url failed (${remotePath}): ${error?.message ?? 'no url'}`);
  }
  const mediaDir = new Directory(Paths.document, 'media');
  if (!mediaDir.exists) mediaDir.create({ intermediates: true, idempotent: true });
  const fileName = remotePath.replace(/\//g, '_');
  const target = new File(mediaDir, fileName);
  if (target.exists) target.delete();
  const downloaded = await File.downloadFileAsync(data.signedUrl, target);
  return downloaded.uri;
}
