import { createClient } from 'npm:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

async function removeFolder(admin: ReturnType<typeof createClient>, bucket: string, prefix: string) {
  // Always read offset 0 after deleting a page. Advancing the offset would skip
  // objects because the remaining list shifts left after each deletion.
  for (;;) {
    const { data, error } = await admin.storage.from(bucket).list(prefix, { limit: 100, offset: 0 });
    if (error) throw error;
    const paths = (data ?? []).filter((x) => x.name).map((x) => `${prefix}/${x.name}`);
    if (paths.length === 0) break;
    const result = await admin.storage.from(bucket).remove(paths);
    if (result.error) throw result.error;
    if ((data ?? []).length < 100) break;
  }
}

async function deleteRevenueCatCustomer(userId: string) {
  const apiKey = Deno.env.get('REVENUECAT_SERVER_API_KEY');
  if (!apiKey) throw new Error('RevenueCat account deletion is not configured');
  const response = await fetch(`https://api.revenuecat.com/v1/subscribers/${encodeURIComponent(userId)}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    signal: AbortSignal.timeout(8000),
  });
  if (!response.ok && response.status !== 404) {
    throw new Error(`RevenueCat customer deletion failed (${response.status})`);
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return json({ error: 'POST only' }, 405);

  const url = Deno.env.get('SUPABASE_URL');
  const anon = Deno.env.get('SUPABASE_ANON_KEY');
  const service = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!url || !anon || !service) return json({ error: 'Account deletion is not configured' }, 501);

  const auth = req.headers.get('Authorization');
  if (!auth) return json({ error: 'Authentication required' }, 401);
  const client = createClient(url, anon, { global: { headers: { Authorization: auth } } });
  const { data: { user }, error: userError } = await client.auth.getUser();
  if (userError || !user) return json({ error: 'Authentication required' }, 401);

  let body: { confirm?: boolean } = {};
  try { body = await req.json(); } catch { return json({ error: 'Invalid JSON' }, 400); }
  if (body.confirm !== true) return json({ error: 'Deletion must be explicitly confirmed' }, 400);

  const admin = createClient(url, service);
  try {
    // Delete the third-party customer first. A retry is safe (404 is accepted),
    // and we avoid deleting user media before confirming RevenueCat is reachable.
    await deleteRevenueCatCustomer(user.id);
    await removeFolder(admin, 'glovebox-media', `${user.id}/vehicles`);
    await removeFolder(admin, 'glovebox-media', `${user.id}/service_records`);
    const { error } = await admin.auth.admin.deleteUser(user.id);
    if (error) throw error;
    return json({ deleted: true });
  } catch (e) {
    console.error('delete-account failed', e instanceof Error ? e.message : 'unknown');
    return json({ error: 'Could not delete the account completely. Try again.' }, 500);
  }
});
