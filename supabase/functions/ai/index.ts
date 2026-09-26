// Glovebox AI proxy (Phase 4) — Supabase Edge Function (Deno).
//
// The app never talks to OpenAI directly: this function holds the API key,
// verifies the signed-in Supabase user, consumes a server-side per-user quota,
// then proxies one of the three supported AI tasks to OpenAI.
//
// Deploy: supabase functions deploy ai

import { withSupabase } from 'npm:@supabase/server@1.8.0';

type Task = 'scan_receipt' | 'explain_repair' | 'check_cost';

type QuotaRow = {
  allowed: boolean;
  reason: string | null;
  retry_after_seconds: number;
  remaining_daily: number;
  remaining_monthly: number;
};

const LIMITS = {
  perMinute: 2,
  perDay: 10,
  perMonth: 100,
  perTaskPerDay: {
    scan_receipt: 3,
    explain_repair: 5,
    check_cost: 5,
  } satisfies Record<Task, number>,
} as const;

const MAX_OUTPUT_TOKENS: Record<Task, number> = {
  scan_receipt: 250,
  explain_repair: 400,
  check_cost: 350,
};

// Roughly 6 MB of raw image data after base64 overhead. This blocks callers
// from bypassing the app and sending arbitrarily large receipt payloads.
const MAX_RECEIPT_BASE64_CHARS = 8_000_000;

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
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Expose-Headers': 'retry-after, x-ratelimit-remaining-day, x-ratelimit-remaining-month',
};

function json(body: unknown, status = 200, extraHeaders: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, ...extraHeaders, 'Content-Type': 'application/json' },
  });
}

function requiredText(value: unknown, field: string, maxLength: number): string {
  if (typeof value !== 'string' || value.trim() === '') {
    throw new Error(`${field} is required`);
  }
  const text = value.trim();
  if (text.length > maxLength) throw new Error(`${field} is too long`);
  return text;
}

function optionalText(value: unknown, field: string, maxLength: number): string | undefined {
  if (value == null || value === '') return undefined;
  if (typeof value !== 'string') throw new Error(`${field} must be text`);
  const text = value.trim();
  if (text === '') return undefined;
  if (text.length > maxLength) throw new Error(`${field} is too long`);
  return text;
}

type VehicleContext = { year?: number; make?: string; model?: string; mileage?: number };

function vehicleContext(value: unknown): VehicleContext | undefined {
  if (value == null) return undefined;
  if (typeof value !== 'object' || Array.isArray(value)) throw new Error('vehicle must be an object');
  const raw = value as Record<string, unknown>;
  const result: VehicleContext = {};

  if (raw.year != null) {
    if (typeof raw.year !== 'number' || !Number.isInteger(raw.year) || raw.year < 1886 || raw.year > 2100) {
      throw new Error('vehicle year is invalid');
    }
    result.year = raw.year;
  }
  const make = optionalText(raw.make, 'vehicle make', 80);
  const model = optionalText(raw.model, 'vehicle model', 80);
  if (make) result.make = make;
  if (model) result.model = model;

  if (raw.mileage != null) {
    if (
      typeof raw.mileage !== 'number' ||
      !Number.isFinite(raw.mileage) ||
      raw.mileage < 0 ||
      raw.mileage > 5_000_000
    ) {
      throw new Error('vehicle mileage is invalid');
    }
    result.mileage = Math.round(raw.mileage);
  }

  return result;
}

function vehicleLine(v: VehicleContext | undefined): string {
  if (!v) return 'an unspecified vehicle';
  const name = [v.year, v.make, v.model].filter(Boolean).join(' ') || 'an unspecified vehicle';
  return v.mileage != null ? `${name} with ${v.mileage} miles` : name;
}

type ChatContent = string | Array<Record<string, unknown>>;

function buildMessages(task: Task, body: Record<string, unknown>): Array<{ role: string; content: ChatContent }> {
  switch (task) {
    case 'scan_receipt': {
      const imageBase64 = requiredText(body.imageBase64, 'imageBase64', MAX_RECEIPT_BASE64_CHARS);
      const mimeType = optionalText(body.mimeType, 'mimeType', 40) ?? 'image/jpeg';
      if (mimeType !== 'image/jpeg' && mimeType !== 'image/png') {
        throw new Error('Only JPEG and PNG receipts are supported');
      }
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
            { type: 'image_url', image_url: { url: `data:${mimeType};base64,${imageBase64}` } },
          ],
        },
      ];
    }
    case 'explain_repair': {
      const serviceLabel = requiredText(body.serviceLabel, 'serviceLabel', 200);
      const vehicle = vehicleContext(body.vehicle);
      const notes = optionalText(body.notes, 'notes', 1200);
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
      const serviceLabel = requiredText(body.serviceLabel, 'serviceLabel', 200);
      const vehicle = vehicleContext(body.vehicle);
      const shopName = optionalText(body.shopName, 'shopName', 120);
      const cost = body.cost;
      if (typeof cost !== 'number' || !Number.isFinite(cost) || cost <= 0 || cost > 1_000_000) {
        throw new Error('cost must be a positive number');
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

function rateLimitMessage(task: Task, reason: string | null): string {
  if (reason === 'minute') return 'AI requests are coming too quickly. Wait a moment and try again.';
  if (reason === 'monthly') return "You've reached this month's AI limit.";
  if (reason === 'task_daily') {
    if (task === 'scan_receipt') return "You've reached today's receipt-scan limit.";
    if (task === 'explain_repair') return "You've reached today's repair-explanation limit.";
    return "You've reached today's price-check limit.";
  }
  return "You've reached today's AI limit.";
}

Deno.serve(
  withSupabase(
    {
      auth: 'user',
      cors: { headers: corsHeaders },
    },
    async (req, ctx) => {
      if (req.method !== 'POST') return json({ error: 'POST only' }, 405);

      const apiKey = Deno.env.get('OPENAI_API_KEY');
      if (!apiKey) {
        return json({ error: 'AI is not configured on the server (missing OPENAI_API_KEY secret)' }, 501);
      }

      const userId = ctx.userClaims?.id;
      if (!userId) return json({ error: 'Invalid or expired session.' }, 401);

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

      let messages: Array<{ role: string; content: ChatContent }>;
      try {
        messages = buildMessages(task, body);
      } catch (e) {
        return json({ error: e instanceof Error ? e.message : 'Bad request' }, 400);
      }

      const { data: quotaData, error: quotaError } = await ctx.supabaseAdmin.rpc('consume_ai_quota', {
        p_user_id: userId,
        p_task: task,
        p_per_minute: LIMITS.perMinute,
        p_daily_total: LIMITS.perDay,
        p_monthly_total: LIMITS.perMonth,
        p_task_daily_limit: LIMITS.perTaskPerDay[task],
      });

      if (quotaError) {
        console.error('AI quota check failed', quotaError.message);
        // Fail closed: if the quota system is unavailable, do not spend model money.
        return json({ error: 'AI is temporarily unavailable. Try again later.' }, 503);
      }

      const quota = (Array.isArray(quotaData) ? quotaData[0] : quotaData) as QuotaRow | null;
      if (!quota) {
        console.error('AI quota check returned no row');
        return json({ error: 'AI is temporarily unavailable. Try again later.' }, 503);
      }

      if (!quota.allowed) {
        const retryAfter = Math.max(1, quota.retry_after_seconds || 1);
        return json(
          {
            error: rateLimitMessage(task, quota.reason),
            code: 'ai_rate_limited',
            retryAfterSeconds: retryAfter,
          },
          429,
          { 'Retry-After': String(retryAfter) },
        );
      }

      const quotaHeaders = {
        'X-RateLimit-Remaining-Day': String(quota.remaining_daily),
        'X-RateLimit-Remaining-Month': String(quota.remaining_monthly),
      };

      const upstream = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
        body: JSON.stringify({
          model: MODEL,
          messages,
          response_format: { type: 'json_object' },
          max_tokens: MAX_OUTPUT_TOKENS[task],
        }),
      });

      if (!upstream.ok) {
        const detail = await upstream.text();
        console.error(`OpenAI error ${upstream.status}: ${detail}`);
        return json(
          { error: 'The AI service is unavailable right now. Try again in a minute.' },
          502,
          quotaHeaders,
        );
      }

      const completion = await upstream.json();
      const content = completion.choices?.[0]?.message?.content;
      if (typeof content !== 'string') {
        return json({ error: 'Empty AI response' }, 502, quotaHeaders);
      }

      try {
        return json(
          {
            task,
            result: JSON.parse(content),
            quota: {
              remainingDaily: quota.remaining_daily,
              remainingMonthly: quota.remaining_monthly,
            },
          },
          200,
          quotaHeaders,
        );
      } catch {
        return json({ error: 'The AI returned an unreadable response. Try again.' }, 502, quotaHeaders);
      }
    },
  ),
);
