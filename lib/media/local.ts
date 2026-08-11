import { Directory, File, Paths } from 'expo-file-system';

const ROOT_NAME = 'glovebox-media';
function mediaRoot(): Directory {
  const dir = new Directory(Paths.document, ROOT_NAME);
  if (!dir.exists) dir.create({ intermediates: true, idempotent: true });
  return dir;
}
function extension(uri: string): string {
  return /\.(png|jpe?g|heic)(?:\?.*)?$/i.exec(uri)?.[1]?.toLowerCase() ?? 'jpg';
}
export async function persistLocalMedia(uri: string | null, kind: 'vehicles' | 'receipts'): Promise<string | null> {
  if (!uri) return null;
  if (uri.includes(`/${ROOT_NAME}/`)) return uri;
  const dir = new Directory(mediaRoot(), kind);
  if (!dir.exists) dir.create({ intermediates: true, idempotent: true });
  const target = new File(dir, `${Date.now()}-${Math.random().toString(36).slice(2, 10)}.${extension(uri)}`);
  const source = new File(uri);
  if (!source.exists) throw new Error('Selected image is no longer available. Choose it again.');
  source.copy(target);
  return target.uri;
}
export function deleteLocalMedia(uri: string | null | undefined) {
  if (!uri || !uri.includes(`/${ROOT_NAME}/`)) return;
  try { const file = new File(uri); if (file.exists) file.delete(); } catch { }
}
export function purgeLocalMedia() {
  try { const dir = new Directory(Paths.document, ROOT_NAME); if (dir.exists) dir.delete(); } catch { }
}
