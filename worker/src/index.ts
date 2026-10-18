export interface Env {
  TELEGRAM_BOT_TOKEN: string;
  TELEGRAM_CHAT_ID: string;
  ALLOWED_ORIGINS: string;
  CONTACT_RATE_LIMITER: { limit(options: { key: string }): Promise<{ success: boolean }> };
  GLOBAL_RATE_LIMITER: { limit(options: { key: string }): Promise<{ success: boolean }> };
}

const MAX_BODY_BYTES = 16384;

async function readBody(request: Request): Promise<unknown> {
  if (Number(request.headers.get('Content-Length')) > MAX_BODY_BYTES) throw new Error('size');
  const reader = request.body?.getReader();
  if (!reader) throw new Error('body');
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > MAX_BODY_BYTES) {
        await reader.cancel();
        throw new Error('size');
      }
      chunks.push(value);
    }
  } finally { reader.releaseLock(); }
  const bytes = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.length; }
  return JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes));
}

function validate(input: unknown): { name: string; email: string; message: string } | null {
  if (!input || typeof input !== 'object' || Array.isArray(input)) return null;
  const data = input as Record<string, unknown>;
  if (Object.keys(data).some(key => !['name', 'email', 'message', 'website', 'startedAt'].includes(key))) return null;
  if (typeof data.name !== 'string' || typeof data.email !== 'string' || typeof data.message !== 'string') return null;
  if (data.website !== '' || typeof data.startedAt !== 'number' || !Number.isFinite(data.startedAt)) return null;
  const elapsed = Date.now() - data.startedAt;
  if (elapsed < 3000 || elapsed > 86400000) return null;
  const name = data.name.trim();
  const email = data.email.trim();
  const message = data.message.trim();
  // Names/email are single lines. Messages allow newlines and tabs, but no control codes.
  if (!name || name.length > 100 || /[\x00-\x1f\x7f]/.test(name)) return null;
  if (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || /[\x00-\x1f\x7f]/.test(email)) return null;
  if (!message || message.length > 3000 || /[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]/.test(message)) return null;
  return { name, email, message };
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const origin = request.headers.get('Origin') ?? '';
    const allowedOrigins = (env.ALLOWED_ORIGINS ?? '').split(',').map(value => value.trim()).filter(Boolean);
    const headers = new Headers({ 'Content-Type': 'application/json', 'Cache-Control': 'no-store', 'Vary': 'Origin', 'X-Content-Type-Options': 'nosniff' });
    const respond = (status: number, error?: string) => new Response(JSON.stringify(error ? { ok: false, error } : { ok: true }), { status, headers });
    // Reject absent or disallowed origins; never reflect an unchecked Origin.
    if (!origin || origin === 'null' || !allowedOrigins.includes(origin)) return respond(403, 'Forbidden');
    headers.set('Access-Control-Allow-Origin', origin);
    if (new URL(request.url).pathname !== '/contact') return respond(404, 'Not found');
    if (request.method === 'OPTIONS') {
      if (request.headers.get('Access-Control-Request-Method') !== 'POST') return respond(405, 'Method not allowed');
      const requestedHeaders = (request.headers.get('Access-Control-Request-Headers') ?? '').toLowerCase().split(',').map(h => h.trim()).filter(Boolean);
      if (requestedHeaders.some(h => h !== 'content-type')) return respond(403, 'Forbidden');
      headers.set('Access-Control-Allow-Methods', 'POST');
      headers.set('Access-Control-Allow-Headers', 'Content-Type');
      headers.set('Access-Control-Max-Age', '600');
      return new Response(null, { status: 204, headers });
    }
    if (request.method !== 'POST') { headers.set('Allow', 'POST, OPTIONS'); return respond(405, 'Method not allowed'); }
    if (request.headers.get('Content-Type')?.split(';')[0].trim().toLowerCase() !== 'application/json') return respond(415, 'JSON required');
    if (!env.TELEGRAM_BOT_TOKEN || !env.TELEGRAM_CHAT_ID || !env.CONTACT_RATE_LIMITER || !env.GLOBAL_RATE_LIMITER) return respond(503, 'Service unavailable');
    const ip = request.headers.get('CF-Connecting-IP');
    if (!ip) return respond(403, 'Forbidden');
    try {
      // Cloudflare supplies CF-Connecting-IP. Do not trust client X-Forwarded-For.
      const perIp = await env.CONTACT_RATE_LIMITER.limit({ key: ip });
      if (!perIp.success) { headers.set('Retry-After', '60'); return respond(429, 'Too many requests'); }
      const global = await env.GLOBAL_RATE_LIMITER.limit({ key: 'contact' });
      if (!global.success) { headers.set('Retry-After', '60'); return respond(429, 'Too many requests'); }
    } catch { return respond(503, 'Service unavailable'); }
    let input: unknown;
    try { input = await readBody(request); }
    catch (error) { return respond(error instanceof Error && error.message === 'size' ? 413 : 400, 'Invalid request'); }
    const data = validate(input);
    if (!data) return respond(400, 'Invalid input');
    try {
      // Plain text: no parse_mode, so HTML/Markdown in user input is never interpreted.
      const response = await fetch(`https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: env.TELEGRAM_CHAT_ID,
          text: `Website contact\n\nName: ${data.name}\nEmail: ${data.email}\n\nMessage:\n${data.message}`,
          link_preview_options: { is_disabled: true },
        }),
        signal: AbortSignal.timeout(10000),
      });
      if (!response.ok) return respond(502, 'Delivery not confirmed');
      const result = await response.json() as { ok?: boolean; result?: { message_id?: number } };
      if (result.ok !== true || !Number.isInteger(result.result?.message_id)) return respond(502, 'Delivery not confirmed');
      return respond(200);
    } catch { return respond(502, 'Delivery not confirmed'); }
  },
};
