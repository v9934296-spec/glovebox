import { createClient } from 'npm:@supabase/supabase-js@2';

type Task = 'decode' | 'check_recalls';
const MAX_BODY_BYTES = 8_192;
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

type NhtsaVariable = { Variable?: string; Value?: string | null };
function pick(vars: NhtsaVariable[], name: string): string | null { const value = vars.find((x) => x.Variable === name)?.Value; return value != null && value.trim() !== '' && value !== 'Not Applicable' ? value.trim() : null; }
async function sha256(value: string) { const bytes = new TextEncoder().encode(value); const digest = await crypto.subtle.digest('SHA-256', bytes); return Array.from(new Uint8Array(digest)).map((b) => b.toString(16).padStart(2, '0')).join(''); }
async function consumeQuota(req: Request): Promise<boolean> {
  const url = Deno.env.get('SUPABASE_URL'); const anon = Deno.env.get('SUPABASE_ANON_KEY'); if (!url || !anon) return false;
  const forwarded = req.headers.get('cf-connecting-ip') ?? req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown';
  const agent = req.headers.get('user-agent') ?? 'unknown'; const key = await sha256(`${forwarded}|${agent}`); const client = createClient(url, anon);
  const { data, error } = await client.rpc('consume_vin_request', { p_key: key, p_limit: 60 }); return error == null && data === true;
}
async function decodeVin(vin: string) {
  const url = `https://vpic.nhtsa.dot.gov/api/vehicles/decodevin/${encodeURIComponent(vin)}?format=json`; const res = await fetch(url, { signal: AbortSignal.timeout(10_000) }); if (!res.ok) throw new Error(`VIN decode provider error (${res.status})`);
  const body = await res.json(); const vars = (body.Results ?? []) as NhtsaVariable[]; const errorCode = pick(vars, 'Error Code'); const make = pick(vars, 'Make'); const modelYearRaw = pick(vars, 'Model Year');
  return { vin, make, model: pick(vars, 'Model'), modelYear: modelYearRaw ? Number(modelYearRaw) : null, trim: pick(vars, 'Trim'), bodyClass: pick(vars, 'Body Class'), engineCylinders: pick(vars, 'Engine Number of Cylinders'), driveType: pick(vars, 'Drive Type'), fuelType: pick(vars, 'Fuel Type - Primary'), plantCountry: pick(vars, 'Plant Country'), decodable: errorCode === '0' && make != null };
}
async function checkRecalls(make: string, model: string, modelYear: number) {
  const url = `https://api.nhtsa.gov/recalls/recallsByVehicle?make=${encodeURIComponent(make)}&model=${encodeURIComponent(model)}&modelYear=${modelYear}`; const res = await fetch(url, { signal: AbortSignal.timeout(10_000) }); if (!res.ok) throw new Error(`Recall provider error (${res.status})`);
  const body = await res.json(); const results = (body.results ?? []) as Array<Record<string, unknown>>;
  return results.map((r) => ({ id: typeof r.NHTSACampaignNumber === 'string' ? r.NHTSACampaignNumber : '', component: typeof r.Component === 'string' ? r.Component : null, summary: typeof r.Summary === 'string' ? r.Summary : null, consequence: typeof r.Consequence === 'string' ? r.Consequence : null, remedy: typeof r.Remedy === 'string' ? r.Remedy : null, reportedDate: typeof r.ReportReceivedDate === 'string' ? r.ReportReceivedDate : null })).filter((r) => r.id !== '');
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return json({ error: 'POST only' }, 405);
  if (!(await consumeQuota(req))) return json({ error: 'Vehicle lookup limit reached. Try again later.' }, 429);
  const raw = await req.text(); if (new TextEncoder().encode(raw).byteLength > MAX_BODY_BYTES) return json({ error: 'Request too large' }, 413);
  let body: Record<string, unknown>; try { body = JSON.parse(raw) as Record<string, unknown>; } catch { return json({ error: 'Invalid JSON body' }, 400); }
  const task = body.task as Task;
  try {
    if (task === 'decode') { const vin = typeof body.vin === 'string' ? body.vin.trim().toUpperCase() : ''; if (!/^[A-HJ-NPR-Z0-9]{17}$/.test(vin)) return json({ error: 'A valid 17-character VIN is required' }, 400); return json({ task, result: await decodeVin(vin) }); }
    if (task === 'check_recalls') { const make = typeof body.make === 'string' ? body.make.trim().slice(0, 80) : ''; const model = typeof body.model === 'string' ? body.model.trim().slice(0, 80) : ''; const modelYear = typeof body.modelYear === 'number' ? body.modelYear : NaN; if (!make || !model || !Number.isInteger(modelYear) || modelYear < 1900 || modelYear > 2100) return json({ error: 'make, model, and modelYear are required' }, 400); return json({ task, result: await checkRecalls(make, model, modelYear) }); }
    return json({ error: `Unknown task: ${String(body.task)}` }, 400);
  } catch (e) { console.error('vin provider failure', e instanceof Error ? e.message : 'unknown'); return json({ error: 'The vehicle data service is unavailable right now. Try again in a minute.' }, 502); }
});
