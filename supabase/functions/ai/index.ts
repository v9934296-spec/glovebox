// Glovebox AI proxy (Phase 4) — Supabase Edge Function (Deno).
//
// The app never talks to OpenAI directly: this function holds the API key
// (set with `supabase secrets set OPENAI_API_KEY=sk-...`) and exposes three
// tasks over one endpoint. JWT verification is on by default, so only
// signed-in Glovebox users can call it.
//
// Deploy: supabase functions deploy ai

type Task = 'scan_receipt' | 'explain_repair' | 'check_cost';

// Mirrors lib/domain/serviceTypes.ts — the scanner must answer with one of
// these ids (or null) so the app can prefill the service-type chips.
const SERVICE_TYPE_IDS = [
  'oil_change', 'tire_rotation', 'tires', 'brakes', 'battery', 'alignment',
  'transmission', 'coolant', 'spark_plugs', 'air_filter', 'registration',
  'insurance', 'smog', 'repair', 'other',
];

const MODEL = Deno.env.get('OPENAI_MODEL') ?? 'gpt-4o-mini';

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

type VehicleContext = { year?: number; make?: string; model?: string; mileage?: number };

function vehicleLine(v: VehicleContext | undefined): string {
  if (!v) return 'an unspecified vehicle';
  const name = [v.year, v.make, v.model].filter(Boolean).join(' ') || 'an unspecified vehicle';
  return v.mileage ? `${name} with ${v.mileage} miles` : name;
}

type ChatContent = string | Array<Record<string, unknown>>;

function buildMessages(task: Task, body: Record<string, unknown>): Array<{ role: string; content: ChatContent }> {
  switch (task) {
    case 'scan_receipt': {
      const { imageBase64, mimeType } = body as { imageBase64?: string; mimeType?: string };
      if (!imageBase64) throw new Error('imageBase64 is required for scan_receipt');
      return [
        {
          role: 'system',
          content:
            'You extract structured data from photos of auto-shop receipts and invoices. ' +
            'Respond with a JSON object with exactly these keys: ' +
            `serviceType (the single best match from ${JSON.stringify(SERVICE_TYPE_IDS)}, or null), ` +
            'date (service date as YYYY-MM-DD, or null), ' +
            'cost (grand total paid as a number, or null), ' +
            'shopName (business name, or null), ' +
            'mileage (odometer reading as an integer, or null), ' +
            'summary (one short sentence describing the work done, or null). ' +
            'Use null for anything not clearly present. Never invent values.',
        },
        {
          role: 'user',
          content: [
            { type: 'text', text: 'Extract the service record from this receipt.' },
            { type: 'image_url', image_url: { url: `data:${mimeType ?? 'image/jpeg'};base64,${imageBase64}` } },
          ],
        },
      ];
    }
    case 'explain_repair': {
      const { serviceLabel, vehicle, notes } = body as {
        serviceLabel?: string;
        vehicle?: VehicleContext;
        notes?: string;
      };
      if (!serviceLabel) throw new Error('serviceLabel is required for explain_repair');
      return [
        {
          role: 'system',
          content:
            'You are a trustworthy mechanic explaining car work to a non-expert owner. Be concrete and calm; no scare tactics. ' +
            'Respond with a JSON object with exactly these keys: ' +
            'summary (one-sentence plain-language answer to "what is this?"), ' +
            'whatItIs (2-4 sentences: what the work involves and why cars need it), ' +
            "urgency (one of 'routine', 'soon', 'urgent'), " +
            'urgencyWhy (one sentence justifying the urgency), ' +
            "diyDifficulty (one of 'easy', 'moderate', 'pro-only'), " +
            'questionsForShop (array of 2-4 short questions the owner should ask the shop).',
        },
        {
          role: 'user',
          content:
            `Explain "${serviceLabel}" for ${vehicleLine(vehicle)}.` +
            (notes ? ` Owner's notes: ${notes}` : ''),
        },
      ];
    }
    case 'check_cost': {
      const { serviceLabel, cost, vehicle, shopName } = body as {
        serviceLabel?: string;
        cost?: number;
        vehicle?: VehicleContext;
        shopName?: string;
      };
      if (!serviceLabel || typeof cost !== 'number') {
        throw new Error('serviceLabel and cost are required for check_cost');
      }
      return [
        {
          role: 'system',
          content:
            'You estimate whether a quoted price for car work in the United States is reasonable. ' +
            'Consider typical parts + labor for the vehicle described. ' +
            'Respond with a JSON object with exactly these keys: ' +
            "verdict (one of 'low', 'fair', 'high'), " +
            'typicalLow (number, low end of the typical price range in USD), ' +
            'typicalHigh (number, high end of the typical price range in USD), ' +
            'explanation (2-3 sentences on what drives the price and how this quote compares), ' +
            'tips (array of 1-3 short, practical tips to save money or verify the work).',
        },
        {
          role: 'user',
          content:
            `Is $${cost} a fair price for "${serviceLabel}" on ${vehicleLine(vehicle)}?` +
            (shopName ? ` Quoted by: ${shopName}.` : ''),
        },
      ];
    }
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return json({ error: 'POST only' }, 405);

  const apiKey = Deno.env.get('OPENAI_API_KEY');
  if (!apiKey) return json({ error: 'AI is not configured on the server (missing OPENAI_API_KEY secret)' }, 501);

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return json({ error: 'Invalid JSON body' }, 400);
  }

  const task = body.task as Task;
  if (task !== 'scan_receipt' && task !== 'explain_repair' && task !== 'check_cost') {
    return json({ error: `Unknown task: ${String(body.task)}` }, 400);
  }

  let messages;
  try {
    messages = buildMessages(task, body);
  } catch (e) {
    return json({ error: e instanceof Error ? e.message : 'Bad request' }, 400);
  }

  const upstream = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({
      model: MODEL,
      messages,
      response_format: { type: 'json_object' },
      max_tokens: 700,
    }),
  });

  if (!upstream.ok) {
    const detail = await upstream.text();
    console.error(`OpenAI error ${upstream.status}: ${detail}`);
    return json({ error: 'The AI service is unavailable right now. Try again in a minute.' }, 502);
  }

  const completion = await upstream.json();
  const content = completion.choices?.[0]?.message?.content;
  if (typeof content !== 'string') return json({ error: 'Empty AI response' }, 502);

  try {
    return json({ task, result: JSON.parse(content) });
  } catch {
    return json({ error: 'The AI returned an unreadable response. Try again.' }, 502);
  }
});
