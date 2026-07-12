// Glovebox AI proxy — authenticated, Pro-only, quota-limited Supabase Edge Function.
//
// Required secrets:
//   OPENAI_API_KEY
//   REVENUECAT_SECRET_API_KEY
// Optional:
//   OPENAI_MODEL (default gpt-4o-mini)
//   AI_DAILY_LIMIT (default 25)
//
// Deploy after applying supabase/migrations/0004_ai_security.sql.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.110.0';

type Task = 'scan_receipt' | 'explain_repair' | 'check_cost';

const SERVICE_TYPE_IDS = [
  'oil_change', 'tire_rotation', 'tires', 'brakes', 'battery', 'alignment',
  'transmission', 'coolant', 'spark_plugs', 'air_filter', 'registration',
  'insurance', 'smog', 'repair', 'other',
];

const MODEL = Deno.env.get('OPENAI_MODEL') ?? 'gpt-4o-mini';
const DAILY_LIMIT = Math.max(1, Number(Deno.env.get('AI_DAILY_LIMIT') ?? '25') || 25);
const MAX_REQUEST_BYTES = 8_000_000;
const MAX_IMAGE_BASE64_CHARS = 7_000_000;
const OPENAI_TIMEOUT_MS = 25_000;
const REVENUECAT_TIMEOUT_MS = 7_000;

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

function requiredEnv(name: string): string {
  const value = Deno.env.get(name)?.trim();
  if (!value) throw new Error(`Server configuration is missing ${name}`);
  return value;
}

function fetchWithTimeout(url: string, init: RequestInit, timeoutMs: number): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  return fetch(url, { ...init, signal: controller.signal }).finally(() => clearTimeout(timer));
}

type VehicleContext = { year?: number; make?: string; model?: string; mileage?: number };

function vehicleLine(v: VehicleContext | undefined): string {
  if (!v) return 'an unspecified vehicle';
  const name = [v.year, v.make, v.model].filter(Boolean).join(' ') || 'an unspecified vehicle';
  return v.mileage ? `${name} with ${v.mileage} miles` : name;
}

function boundedString(value: unknown, field: string, max: number, required = false): string | undefined {
  if (value == null || value === '') {
    if (required) throw new Error(`${field} is required`);
    return undefined;
  }
  if (typeof value !== 'string') throw new Error(`${field} must be a string`);
  const trimmed = value.trim();
  if (required && !trimmed) throw new Error(`${field} is required`);
  if (trimmed.length > max) throw new Error(`${field} is too long`);
  return trimmed || undefined;
}

function validateVehicle(value: unknown): VehicleContext | undefined {
  if (value == null) return undefined;
  if (typeof value !== 'object' || Array.isArray(value)) throw new Error('vehicle must be an object');
  const input = value as Record<string, unknown>;
  const vehicle: VehicleContext = {};
  if (typeof input.year === 'number' && Number.isInteger(input.year) && input.year >= 1886 && input.year <= 2100) {
    vehicle.year = input.year;
  }
  vehicle.make = boundedString(input.make, 'vehicle.make', 80);
  vehicle.model = boundedString(input.model, 'vehicle.model', 80);
  if (typeof input.mileage === 'number' && Number.isFinite(input.mileage) && input.mileage >= 0) {
    vehicle.mileage = Math.round(input.mileage);
  }
  return vehicle;
}

type ChatContent = string | Array<Record<string, unknown>>;

function buildMessages(task: Task, body: Record<string, unknown>): Array<{ role: string; content: ChatContent }> {
  switch (task) {
    case 'scan_receipt': {
      const imageBase64 = boundedString(body.imageBase64, 'imageBase64', MAX_IMAGE_BASE64_CHARS, true)!;
      const mimeType = boundedString(body.mimeType, 'mimeType', 40) ?? 'image/jpeg';
      if (!['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif'].includes(mimeType)) {
        throw new Error('Unsupported receipt image type');
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
      const serviceLabel = boundedString(body.serviceLabel, 'serviceLabel', 240, true)!;
      const notes = boundedString(body.notes, 'notes', 2_000);
      const vehicle = validateVehicle(body.vehicle);
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
      const serviceLabel = boundedString(body.serviceLabel, 'serviceLabel', 240, true)!;
      const shopName = boundedString(body.shopName, 'shopName', 160);
      const vehicle = validateVehicle(body.vehicle);
      const cost = body.cost;
      if (typeof cost !== 'number' || !Number.isFinite(cost) || cost <= 0 || cost > 1_000_000) {
        throw new Error('cost must be a positive number');
      }
      return [
        {
          role: 'system',
          content:
            'You provide a rough, non-authoritative estimate of whether a quoted price for car work in the United States is reasonable. ' +
            'Regional labor rates, parts quality, taxes, and shop type can materially change the price. ' +
            'Respond with a JSON object with exactly these keys: ' +
            "verdict (one of 'low', 'fair', 'high'), " +
            'typicalLow (number, low end of a broad estimated price range in USD), ' +
            'typicalHigh (number, high end of a broad estimated price range in USD), ' +
            'explanation (2-3 sentences that clearly state this is an estimate and explain major price drivers), ' +
            'tips (array of 1-3 short, practical tips to verify the quote).',
        },
        {
          role: 'user',
          content:
            `Give a rough price check for $${cost} for "${serviceLabel}" on ${vehicleLine(vehicle)}.` +
            (shopName ? ` Quoted by: ${shopName}.` : ''),
        },
      ];
    }
  }
}

type EntitlementCacheEntry = { active: boolean; checkedAt: number };
const entitlementCache = new Map<string, EntitlementCacheEntry>();

async function hasActiveProEntitlement(userId: string): Promise<boolean> {
  const cached = entitlementCache.get(userId);
  if (cached && Date.now() - cached.checkedAt < 60_000) return cached.active;

  const secret = requiredEnv('REVENUECAT_SECRET_API_KEY');
  const response = await fetchWithTimeout(
    `https://api.revenuecat.com/v1/subscribers/${encodeURIComponent(userId)}`,
    {
      headers: {
        Authorization: `Bearer ${secret}`,
        Accept: 'application/json',
      },
    },
    REVENUECAT_TIMEOUT_MS,
  );

  if (response.status === 404) {
    entitlementCache.set(userId, { active: false, checkedAt: Date.now() });
    return false;
  }
  if (!response.ok) throw new Error(`RevenueCat verification failed (${response.status})`);

  const payload = await response.json() as {
    subscriber?: { entitlements?: Record<string, { expires_date?: string | null }> };
  };
  const entitlement = payload.subscriber?.entitlements?.pro;
  const expiresAt = entitlement?.expires_date ? Date.parse(entitlement.expires_date) : null;
  const active = Boolean(entitlement) &&
    (expiresAt === null || (!Number.isNaN(expiresAt) && expiresAt > Date.now()));
  entitlementCache.set(userId, { active, checkedAt: Date.now() });
  return active;
}

async function authenticate(req: Request): Promise<string> {
  const authorization = req.headers.get('Authorization');
  if (!authorization) throw new Error('UNAUTHENTICATED');

  const supabase = createClient(requiredEnv('SUPABASE_URL'), requiredEnv('SUPABASE_ANON_KEY'), {
    global: { headers: { Authorization: authorization } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) throw new Error('UNAUTHENTICATED');
  return data.user.id;
}

async function consumeQuota(userId: string): Promise<boolean> {
  const admin = createClient(requiredEnv('SUPABASE_URL'), requiredEnv('SUPABASE_SERVICE_ROLE_KEY'), {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data, error } = await admin.rpc('consume_ai_quota', {
    p_user_id: userId,
    p_daily_limit: DAILY_LIMIT,
  });
  if (error) throw new Error(`AI quota check failed: ${error.message}`);
  return data === true;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return json({ error: 'POST only' }, 405);

  const contentLength = Number(req.headers.get('content-length') ?? '0');
  if (Number.isFinite(contentLength) && contentLength > MAX_REQUEST_BYTES) {
    return json({ error: 'Request is too large' }, 413);
  }

  let userId: string;
  try {
    userId = await authenticate(req);
  } catch (e) {
    if (e instanceof Error && e.message === 'UNAUTHENTICATED') return json({ error: 'Authentication required' }, 401);
    console.error(e);
    return json({ error: 'Authentication service unavailable' }, 503);
  }

  try {
    if (!(await hasActiveProEntitlement(userId))) {
      return json({ error: 'Glovebox Pro is required for AI features' }, 403);
    }
  } catch (e) {
    console.error(e);
    return json({ error: 'Could not verify Glovebox Pro right now' }, 503);
  }

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

  try {
    if (!(await consumeQuota(userId))) {
      return json({ error: `Daily AI limit reached (${DAILY_LIMIT} requests)` }, 429);
    }
  } catch (e) {
    console.error(e);
    return json({ error: 'AI usage limit service is unavailable' }, 503);
  }

  let apiKey: string;
  try {
    apiKey = requiredEnv('OPENAI_API_KEY');
  } catch (e) {
    console.error(e);
    return json({ error: 'AI is not configured on the server' }, 501);
  }

  let upstream: Response;
  try {
    upstream = await fetchWithTimeout(
      'https://api.openai.com/v1/chat/completions',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
        body: JSON.stringify({
          model: MODEL,
          messages,
          response_format: { type: 'json_object' },
          max_tokens: 700,
        }),
      },
      OPENAI_TIMEOUT_MS,
    );
  } catch (e) {
    console.error(e);
    return json({ error: 'The AI service timed out. Try again.' }, 504);
  }

  if (!upstream.ok) {
    const detail = await upstream.text();
    console.error(`OpenAI error ${upstream.status}: ${detail.slice(0, 500)}`);
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
