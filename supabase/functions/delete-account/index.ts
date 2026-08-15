// Glovebox account deletion — Supabase Edge Function (Deno).
// Permanently deletes the authenticated user, their cloud rows (via cascade),
// and all media under their folder in glovebox-media.
//
// Deploy: supabase functions deploy delete-account
// Requires service role key (automatically available in Edge Functions).

import { createClient, type SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1';

const MEDIA_BUCKET = 'glovebox-media';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

function isAlreadyGoneStorageError(error: { message?: string; statusCode?: string | number }): boolean {
  const message = (error.message ?? '').toLowerCase();
  const status = String(error.statusCode ?? '');
  return (
    status === '404' ||
    message.includes('not found') ||
    message.includes('does not exist') ||
    message.includes('no such file')
  );
}

/**
 * Collect every file path under `prefix`. Media is stored as
 * `{userId}/{table}/{rowId}.{ext}`, so a single list() is not enough.
 * Throws on list failure so Auth delete cannot proceed with unknown leftovers.
 */
async function listAllMediaPaths(
  admin: SupabaseClient,
  prefix: string,
): Promise<string[]> {
  const { data, error } = await admin.storage.from(MEDIA_BUCKET).list(prefix, { limit: 1000 });
  if (error) {
    if (isAlreadyGoneStorageError(error)) return [];
    throw new Error(`list media failed: ${error.message}`);
  }
  if (!data || data.length === 0) return [];

  const paths: string[] = [];
  for (const item of data) {
    const path = `${prefix}/${item.name}`;
    // Folders have id === null in Supabase Storage listings.
    if (item.id === null) {
      paths.push(...(await listAllMediaPaths(admin, path)));
    } else {
      paths.push(path);
    }
  }
  return paths;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }
  if (req.method !== 'POST') {
    return json({ error: 'POST only' }, 405);
  }

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return json({ error: 'Missing authorization' }, 401);
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

    // Verify the caller's JWT with the anon client
    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const {
      data: { user },
      error: userError,
    } = await userClient.auth.getUser();

    if (userError || !user) {
      return json({ error: 'Invalid or expired session' }, 401);
    }

    const userId = user.id;
    const admin = createClient(supabaseUrl, serviceRoleKey);

    // 1. Delete only this user's media under {userId}/ (nested table folders).
    // Auth delete must not run if listing or removal fails.
    let paths: string[];
    try {
      paths = await listAllMediaPaths(admin, userId);
    } catch (e) {
      console.error(e);
      return json({ error: 'Could not delete account media. Try again later.' }, 500);
    }
    if (paths.length > 0) {
      const { error: removeError } = await admin.storage.from(MEDIA_BUCKET).remove(paths);
      if (removeError && !isAlreadyGoneStorageError(removeError)) {
        console.error('remove media failed', removeError);
        return json({ error: 'Could not delete account media. Try again later.' }, 500);
      }
    }

    // 2. Delete the auth user (cascades to vehicles / service_records / reminders)
    const { error: deleteError } = await admin.auth.admin.deleteUser(userId);
    if (deleteError) {
      console.error('deleteUser failed', deleteError);
      return json({ error: 'Could not delete account. Try again later.' }, 500);
    }

    return json({ ok: true });
  } catch (e) {
    console.error(e);
    return json({ error: 'Unexpected error while deleting account' }, 500);
  }
});
