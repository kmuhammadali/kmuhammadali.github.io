import { test, mock } from 'node:test';
import assert from 'node:assert/strict';
import worker, { type Env } from '../worker/src/index.ts';
import { sendContact } from '../src/lib/contact.ts';

const origin = 'https://portfolio.example';
const payload = () => ({ name: 'Visitor <b>name</b>', email: 'visitor@example.com', message: 'Hello *world*\nA question.', website: '', startedAt: Date.now() - 5000 });
const env = (): Env => ({
  TELEGRAM_BOT_TOKEN: 'test-token', TELEGRAM_CHAT_ID: '123', ALLOWED_ORIGINS: origin,
  CONTACT_RATE_LIMITER: { limit: async () => ({ success: true }) },
  GLOBAL_RATE_LIMITER: { limit: async () => ({ success: true }) },
});
function request(body: unknown = payload(), extra: Record<string, string> = {}) {
  return new Request('https://api.example/contact', { method: 'POST', headers: { Origin: origin, 'Content-Type': 'application/json', 'CF-Connecting-IP': '192.0.2.1', ...extra }, body: JSON.stringify(body) });
}

test('only confirms success for a Telegram message receipt; user text stays plain', async () => {
  const fetchMock = mock.method(globalThis, 'fetch', async (_url: unknown, init: RequestInit) => {
    const sent = JSON.parse(init.body as string);
    assert.equal(sent.chat_id, '123');
    assert.ok(sent.text.includes('Visitor &lt;b&gt;name&lt;/b&gt;'));
    assert.ok(sent.text.includes('Hello *world*'));
    assert.equal(sent.parse_mode, 'HTML');
    assert.equal(sent.link_preview_options.is_disabled, true);
    assert.ok(sent.text.length < 4096);
    return Response.json({ ok: true, result: { message_id: 42 } });
  });
  try {
    const response = await worker.fetch(request(), env());
    assert.equal(response.status, 200);
    assert.equal(response.headers.get('Access-Control-Allow-Origin'), origin);
    assert.deepEqual(await response.json(), { ok: true });
    assert.equal(fetchMock.mock.callCount(), 1);
  } finally { fetchMock.mock.restore(); }
});

test('rejects missing/unapproved origins and restricts preflight method and headers', async () => {
  for (const value of ['', 'null', 'https://evil.example', `${origin}.evil.example`]) {
    const response = await worker.fetch(request(payload(), { Origin: value }), env());
    assert.equal(response.status, 403);
    assert.equal(response.headers.get('Access-Control-Allow-Origin'), null);
  }
  const options = (method: string, header = 'content-type') => new Request('https://api.example/contact', { method: 'OPTIONS', headers: { Origin: origin, 'Access-Control-Request-Method': method, 'Access-Control-Request-Headers': header } });
  assert.equal((await worker.fetch(options('POST'), env())).status, 204);
  assert.equal((await worker.fetch(options('DELETE'), env())).status, 405);
  assert.equal((await worker.fetch(options('POST', 'authorization'), env())).status, 403);
});

test('validates types, lengths, spam trap, timing, control characters, and email', async () => {
  const invalid = [null, [], { name: 42 }, { name: ' ' }, { email: 'invalid' }, { email: 'a@b.com\r\nx' }, { message: '' }, { message: 'x'.repeat(3001) }, { name: 'x'.repeat(101) }, { website: 'spam' }, { startedAt: Date.now() }, { startedAt: Date.now() + 5000 }, { startedAt: Date.now() - 86400001 }, { startedAt: 'yesterday' }, { name: 'new\nline' }, { message: '\x00bad' }, { extra: 'field' }];
  const fetchMock = mock.method(globalThis, 'fetch', async () => { throw new Error('must not deliver'); });
  try {
    for (const patch of invalid) {
      const body = patch && !Array.isArray(patch) ? { ...payload(), ...patch } : patch;
      assert.equal((await worker.fetch(request(body), env())).status, 400, JSON.stringify(patch));
    }
    assert.equal(fetchMock.mock.callCount(), 0);
  } finally { fetchMock.mock.restore(); }
});

test('bounds raw body size and handles malformed JSON', async () => {
  const malformed = request();
  const headers = malformed.headers;
  assert.equal((await worker.fetch(new Request(malformed.url, { method: 'POST', headers, body: '{' }), env())).status, 400);
  assert.equal((await worker.fetch(request({ message: 'x'.repeat(17000) }), env())).status, 413);
  assert.equal((await worker.fetch(request(payload(), { 'Content-Type': 'text/plain' }), env())).status, 415);
  assert.equal((await worker.fetch(new Request(malformed.url, { headers }), env())).status, 405);
  assert.equal((await worker.fetch(new Request('https://api.example/other', { headers }), env())).status, 404);
});

test('rate limits fail closed, return retry hints, and never call Telegram', async () => {
  for (const binding of ['CONTACT_RATE_LIMITER', 'GLOBAL_RATE_LIMITER'] as const) {
    const config = env();
    config[binding].limit = async () => ({ success: false });
    const response = await worker.fetch(request(), config);
    assert.equal(response.status, 429);
    assert.equal(response.headers.get('Retry-After'), '60');
  }
  const config = env();
  config.CONTACT_RATE_LIMITER.limit = async () => { throw new Error('down'); };
  assert.equal((await worker.fetch(request(), config)).status, 503);
  assert.equal((await worker.fetch(request(), { ...env(), TELEGRAM_BOT_TOKEN: '' })).status, 503);
  assert.equal((await worker.fetch(request(payload(), { 'CF-Connecting-IP': '' }), env())).status, 403);
});

test('Telegram errors, missing receipts, malformed responses and timeouts never return success or leak secrets', async () => {
  const outcomes = [() => Response.json({ ok: false, description: 'test-token' }), () => Response.json({ ok: true }), () => Response.json({ ok: true, result: {} }), () => new Response('upstream error', { status: 500 }), () => new Response('not json'), () => { throw new DOMException('timed out', 'TimeoutError'); }];
  for (const outcome of outcomes) {
    const fetchMock = mock.method(globalThis, 'fetch', async () => outcome());
    try {
      const response = await worker.fetch(request(), env());
      assert.equal(response.status, 502);
      assert.ok(!(await response.text()).includes('test-token'));
    } finally { fetchMock.mock.restore(); }
  }
});

test('frontend requires explicit server confirmation and maps failures', async () => {
  await assert.rejects(sendContact(undefined, payload()), /configuration/);
  await assert.rejects(sendContact('http://api.example/contact', payload()), /configuration/);
  const cases: [() => Response, string | null][] = [
    [() => Response.json({ ok: true }), null],
    [() => Response.json({ ok: false }), 'delivery'],
    [() => new Response('bad json'), 'delivery'],
    [() => Response.json({ ok: true }, { status: 500 }), 'delivery'],
    [() => new Response(null, { status: 400 }), 'validation'],
    [() => new Response(null, { status: 429 }), 'rateLimit'],
    [() => { throw new Error('offline'); }, 'delivery'],
  ];
  for (const [outcome, error] of cases) {
    const fetchMock = mock.method(globalThis, 'fetch', async (_url: unknown, init: RequestInit) => {
      assert.equal(init.method, 'POST');
      assert.equal(init.credentials, 'omit');
      assert.ok(init.signal);
      return outcome();
    });
    try {
      if (error) await assert.rejects(sendContact('https://api.example/contact', payload()), new RegExp(error));
      else await sendContact('https://api.example/contact', payload());
    } finally { fetchMock.mock.restore(); }
  }
});
