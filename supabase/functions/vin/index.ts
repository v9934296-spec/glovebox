// Glovebox VIN decode + recall lookup proxy (Phase 6) — Supabase Edge Function (Deno).
//
// The app never calls NHTSA directly: this function centralizes the provider
// integration (vPIC decode + Recalls API) so response shaping and rate-limit
// handling live in one place and can change without an app release. Both
// NHTSA APIs are public and keyless, so this function holds no secrets — it
// exists to isolate provider logic, not credentials.
//
// Deploy: supabase functions deploy vin

type Task = 'decode' | 'check_recalls';

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

type NhtsaVariable = { Variable?: string; Value?: string | null };

function pick(vars: NhtsaVariable[], name: string): string | null {
  const v = vars.find((x) => x.Variable === name)?.Value;
  return v != null && v.trim() !== '' && v !== 'Not Applicable' ? v.trim() : null;
}

async function decodeVin(vin: string) {
  const url = `https://vpic.nhtsa.dot.gov/api/vehicles/decodevin/${encodeURIComponent(vin)}?format=json`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`VIN decode provider error (${res.status})`);
  const body = await res.json();
  const vars = (body.Results ?? []) as NhtsaVariable[];
  const errorCode = pick(vars, 'Error Code');
  const make = pick(vars, 'Make');
  const modelYearRaw = pick(vars, 'Model Year');
  return {
    vin,
    make,
    model: pick(vars, 'Model'),
    modelYear: modelYearRaw ? Number(modelYearRaw) : null,
    trim: pick(vars, 'Trim'),
    bodyClass: pick(vars, 'Body Class'),
    engineCylinders: pick(vars, 'Engine Number of Cylinders'),
    driveType: pick(vars, 'Drive Type'),
    fuelType: pick(vars, 'Fuel Type - Primary'),
    plantCountry: pick(vars, 'Plant Country'),
    // Error Code "0" is vPIC's own "decoded cleanly" signal.
    decodable: errorCode === '0' && make != null,
  };
}

async function checkRecalls(make: string, model: string, modelYear: number) {
  const url = `https://api.nhtsa.gov/recalls/recallsByVehicle?make=${encodeURIComponent(make)}&model=${encodeURIComponent(model)}&modelYear=${modelYear}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Recall provider error (${res.status})`);
  const body = await res.json();
  const results = (body.results ?? []) as Array<Record<string, unknown>>;
  return results
    .map((r) => ({
      id: typeof r.NHTSACampaignNumber === 'string' ? r.NHTSACampaignNumber : '',
      component: typeof r.Component === 'string' ? r.Component : null,
      summary: typeof r.Summary === 'string' ? r.Summary : null,
      consequence: typeof r.Consequence === 'string' ? r.Consequence : null,
      remedy: typeof r.Remedy === 'string' ? r.Remedy : null,
      reportedDate: typeof r.ReportReceivedDate === 'string' ? r.ReportReceivedDate : null,
    }))
    .filter((r) => r.id !== '');
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return json({ error: 'POST only' }, 405);

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return json({ error: 'Invalid JSON body' }, 400);
  }

  const task = body.task as Task;

  try {
    if (task === 'decode') {
      const vin = typeof body.vin === 'string' ? body.vin.trim().toUpperCase() : '';
      if (!/^[A-HJ-NPR-Z0-9]{17}$/.test(vin)) {
        return json({ error: 'A valid 17-character VIN is required' }, 400);
      }
      return json({ task, result: await decodeVin(vin) });
    }
    if (task === 'check_recalls') {
      const { make, model, modelYear } = body as { make?: string; model?: string; modelYear?: number };
      if (!make || !model || typeof modelYear !== 'number') {
        return json({ error: 'make, model, and modelYear are required' }, 400);
      }
      return json({ task, result: await checkRecalls(make, model, modelYear) });
    }
    return json({ error: `Unknown task: ${String(body.task)}` }, 400);
  } catch (e) {
    console.error(e);
    return json({ error: 'The vehicle data service is unavailable right now. Try again in a minute.' }, 502);
  }
});
