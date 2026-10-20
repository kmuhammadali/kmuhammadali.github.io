import { test } from 'node:test';
import assert from 'node:assert/strict';
import { build } from '../worker/node_modules/esbuild/lib/main.js';
import { Miniflare, Response, convertV4MiniflareOptions } from '../worker/node_modules/miniflare/dist/src/index.js';
import { signer, issuer, audience, origin } from './cms-support.ts';

// Run the actual Worker bundle in workerd: Node fetch mocks cannot detect
// unsupported Workers Request options such as redirect: "error".
test('workerd verifies JWTs and refuses JWKS/dashboard redirects without leaking credentials', async () => {
  const keys = await signer();
  const jwt = await keys.token();
  const bundle = await build({
    entryPoints: [new URL('../cms/admin/index.ts', import.meta.url).pathname],
    bundle: true, format: 'esm', platform: 'browser', write: false,
  });
  let mode = 'valid';
  let calls = 0;
  const mf = new Miniflare(convertV4MiniflareOptions({
    modules: true,
    compatibilityDate: '2026-10-18',
    script: bundle.outputFiles[0].text,
    bindings: {
      ACCESS_TEAM_DOMAIN: issuer, ACCESS_AUD: audience,
      ALLOWED_ORIGINS: origin, DASHBOARD_ORIGIN: origin,
    },
    outboundService: async (request) => {
      calls++;
      assert.equal(request.headers.get('Cookie'), null);
      assert.equal(request.headers.get('Cf-Access-Jwt-Assertion'), null);
      if (request.url === `${issuer}/cdn-cgi/access/certs`) {
        if (mode === 'jwks-redirect')
          return new Response(null, { status: 302, headers: { Location: 'https://untrusted.example/keys' } });
        if (mode === 'jwks-down') return new Response(null, { status: 503 });
        return Response.json({ keys: [keys.jwk] });
      }
      assert.equal(request.url, `${origin}/admin/index.html`);
      if (mode === 'dashboard-redirect')
        return new Response(null, { status: 302, headers: { Location: 'https://untrusted.example/admin' } });
      return new Response('<!doctype html><title>CMS</title>', { headers: { 'Content-Type': 'text/html' } });
    },
  }));
  const request = (path, token = jwt) => mf.dispatchFetch(`https://cms.example${path}`, {
    headers: { 'Cf-Access-Jwt-Assertion': token, Cookie: 'CF_Authorization=private-test-cookie' },
  });
  try {
    assert.equal((await request('/api/admin/session', '')).status, 401);
    assert.equal(calls, 0);
    assert.equal((await request('/api/admin/session')).status, 200);
    assert.equal((await request('/api/admin/session', jwt.slice(0, -8) + 'aaaaaaaa')).status, 401);
    assert.equal((await request('/admin/')).status, 200);
    for (const failure of ['jwks-redirect', 'jwks-down', 'dashboard-redirect']) {
      mode = failure;
      const response = await request(failure === 'dashboard-redirect' ? '/admin/' : '/api/admin/session');
      assert.equal(response.status, 503, failure);
      assert.equal(response.headers.get('Location'), null);
    }
  } finally {
    await mf.dispose();
  }
});
