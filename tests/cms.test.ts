import { test, mock } from "node:test";
import assert from "node:assert/strict";
import admin, { type Env } from "../cms/admin/index.ts";
import publicApi from "../cms/public/index.ts";
import { verifyAccessJwt } from "../cms/admin/auth.ts";
import { siteContent } from "../src/config/siteContent.ts";
import { LocalD1, signer, origin, issuer, audience } from "./cms-support.ts";
import type { RecordData } from "../cms/shared/types.ts";

test("Access JWT signature, issuer, audience, timestamps and algorithm are enforced", async () => {
  const keys = await signer();
  const fetch = mock.method(globalThis, "fetch", async () =>
    Response.json({ keys: [keys.jwk] }),
  );
  const config = { ACCESS_TEAM_DOMAIN: issuer, ACCESS_AUD: audience };
  const request = (jwt: string) =>
    new Request("https://cms.example/api/admin/session", {
      headers: { "Cf-Access-Jwt-Assertion": jwt },
    });
  try {
    assert.ok(await verifyAccessJwt(request(await keys.token()), config));
    for (const [claims, header] of [
      [{ iss: "https://evil.example" }, {}],
      [{ aud: ["wrong"] }, {}],
      [{ exp: 1 }, {}],
      [{ iat: Date.now() }, {}],
      [{ nbf: Date.now() }, {}],
      [{}, { alg: "none" }],
      [{}, { kid: "unknown" }],
    ] as [RecordData, RecordData][])
      assert.equal(
        await verifyAccessJwt(
          request(await keys.token(claims, header)),
          config,
        ),
        null,
      );
    const jwt = await keys.token();
    assert.equal(
      await verifyAccessJwt(request(jwt.slice(0, -8) + "aaaaaaaa"), config),
      null,
    );
    assert.equal(await verifyAccessJwt(request("not-a-jwt"), config), null);
    assert.equal(
      await verifyAccessJwt(new Request("https://cms.example"), config),
      null,
    );
    await assert.rejects(
      verifyAccessJwt(request(jwt), {
        ...config,
        ACCESS_TEAM_DOMAIN: "https://evil.example",
      }),
    );
    fetch.mock.restore();
    const down = mock.method(
      globalThis,
      "fetch",
      async () => new Response(null, { status: 500 }),
    );
    try {
      await assert.rejects(verifyAccessJwt(request(jwt), config));
    } finally {
      down.mock.restore();
    }
  } finally {
    fetch.mock.restore();
  }
});

test("additive migration preserves existing records and defaults publication safely", async () => {
  const db = new LocalD1(false);
  try {
    db.sqlite.exec(
      "INSERT INTO page_content(id,section,content) VALUES('home','home','{\"role\":\"Existing text\"}'); INSERT INTO skills(id,title) VALUES('existing','Existing skill'); INSERT INTO media(id,file_name,object_key,mime_type) VALUES('image','old.png','old.png','image/png');",
    );
    db.migrate();
    assert.equal(
      (
        await db
          .prepare("SELECT content FROM page_content WHERE id='home'")
          .first<{ content: string }>()
      )?.content,
      '{"role":"Existing text"}',
    );
    assert.equal(
      (
        await db
          .prepare("SELECT is_published FROM page_content WHERE id='home'")
          .first<{ is_published: number }>()
      )?.is_published,
      1,
    );
    assert.equal(
      (
        await db
          .prepare("SELECT is_published FROM media WHERE id='image'")
          .first<{ is_published: number }>()
      )?.is_published,
      0,
    );
    assert.equal(
      (
        await db
          .prepare("SELECT title FROM skills WHERE id='existing'")
          .first<{ title: string }>()
      )?.title,
      "Existing skill",
    );
  } finally {
    db.close();
  }
});

test("authenticated CRUD for every resource, publish filtering, ordering and conflicts use real SQLite", async () => {
  const DB = new LocalD1(),
    keys = await signer(),
    jwt = await keys.token();
  const env: Env = {
    DB,
    ACCESS_TEAM_DOMAIN: issuer,
    ACCESS_AUD: audience,
    ALLOWED_ORIGINS: origin,
  };
  const fetch = mock.method(globalThis, "fetch", async (url: unknown) => {
    assert.equal(url, `${issuer}/cdn-cgi/access/certs`);
    return Response.json({ keys: [keys.jwk] });
  });
  const request = (
    path: string,
    method = "GET",
    body?: unknown,
    extra: Record<string, string> = {},
  ) =>
    new Request(`https://cms.example/api/admin/${path}`, {
      method,
      headers: {
        Origin: origin,
        "Cf-Access-Jwt-Assertion": jwt,
        "Content-Type": "application/json",
        "X-CMS-Request": "1",
        ...extra,
      },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    });
  const call = async (
    path: string,
    method = "GET",
    body?: unknown,
    expected = 200,
  ) => {
    const response = await admin.fetch(request(path, method, body), env);
    const result = (await response.json()) as RecordData;
    assert.equal(response.status, expected, JSON.stringify(result));
    return result;
  };
  const pub = async (path: string) => {
    const result = await publicApi.fetch(
      new Request(`https://public.example/api/${path}`),
      env,
    );
    assert.equal(result.status, 200);
    return result.json() as Promise<unknown>;
  };
  try {
    assert.equal(
      (
        await admin.fetch(
          request(
            "skills",
            "POST",
            { title: "bad" },
            { "Cf-Access-Jwt-Assertion": "" },
          ),
          env,
        )
      ).status,
      401,
    );
    assert.equal(
      (
        await DB.prepare("SELECT COUNT(*) AS n FROM skills").first<{
          n: number;
        }>()
      )?.n,
      0,
    );
    await call("session");
    for (const resource of ["skills", "projects", "posts", "media"] as const) {
      const body: RecordData =
        resource === "media"
          ? {
              id: "item",
              file_name: "image.png",
              object_key: "image.png",
              mime_type: "image/png",
              public_url: "https://images.example/test.png",
              file_size: 10,
              alt_text: "Test image",
              is_published: 0,
            }
          : {
              id: "item",
              title: `Test ${resource}`,
              ...(resource === "skills"
                ? { tags: ["TypeScript"] }
                : { slug: "test-item" }),
            };
      const created = await call(resource, "POST", body, 201);
      assert.equal(created.id, "item");
      const listed = await call(resource);
      assert.equal((listed.items as unknown[]).length, 1);
      assert.equal(((await pub(resource)) as unknown[]).length, 0);
      const patch =
        resource === "posts" ? { status: "published" } : { is_published: 1 };
      const published = await call(`${resource}/item`, "PATCH", patch);
      assert.equal(((await pub(resource)) as unknown[]).length, 1);
      if (resource === "posts") {
        const detail = await publicApi.fetch(
          new Request("https://public.example/api/posts/test-item"),
          env,
        );
        assert.equal(detail.status, 200);
        assert.equal(((await detail.json()) as RecordData).content, "");
      }
      const conflict = await admin.fetch(
        request(`${resource}/item`, "PATCH", patch, { "If-Match": '"stale"' }),
        env,
      );
      assert.equal(conflict.status, 409);
      const valid = await admin.fetch(
        request(
          `${resource}/item`,
          "PATCH",
          { sort_order: 7 },
          { "If-Match": `"${published.updated_at}"` },
        ),
        env,
      );
      assert.equal(valid.status, 200);
      await call(
        `${resource}/item`,
        "PATCH",
        resource === "posts" ? { status: "draft" } : { is_published: 0 },
      );
      assert.equal(((await pub(resource)) as unknown[]).length, 0);
      await call(`${resource}/item`, "DELETE");
      await call(`${resource}/item`, "GET", undefined, 404);
    }
    for (const page of ["home", "about", "contact"] as const) {
      await call(
        "content",
        "POST",
        {
          id: page,
          section: page,
          content: siteContent[page],
          is_published: 1,
        },
        201,
      );
      assert.ok(((await pub("content")) as RecordData)[page]);
      await call(`content/${page}`, "PATCH", { is_published: 0 });
      assert.equal(((await pub("content")) as RecordData)[page], undefined);
      await call(`content/${page}`, "DELETE");
    }
    for (const key of ["name", "navigation", "footer"] as const) {
      await call("settings", "POST", { key, value: siteContent[key] }, 201);
      assert.deepEqual(
        ((await pub("settings")) as RecordData)[key],
        siteContent[key],
      );
      await call(`settings/${key}`, "GET");
      await call(`settings/${key}`, "DELETE");
    }
    await call(
      "skills",
      "POST",
      { id: "later", title: "Later", sort_order: 5, is_published: 1 },
      201,
    );
    await call(
      "skills",
      "POST",
      { id: "first", title: "First", sort_order: 0, is_published: 1 },
      201,
    );
    assert.equal(((await pub("skills")) as RecordData[])[0].id, "first");
    assert.equal(
      ((await call("skills?limit=1&offset=1")).items as RecordData[])[0].id,
      "later",
    );
    await call("skills", "POST", { id: "first", title: "Duplicate" }, 409);
    await call("skills/first", "PATCH", { id: "other" }, 400);
    await call("skills/first", "PATCH", {
      title: "Robert'); DROP TABLE skills;--",
    });
    assert.equal(((await call("skills")).items as unknown[]).length, 2);
    for (const bad of [
      { tags: "bad" },
      { title: "" },
      { image_url: "javascript:alert(1)" },
      { sort_order: -1 },
      { is_published: 2 },
      { extra: "field" },
      JSON.parse('{"__proto__":{}}'),
    ])
      await call("skills/first", "PATCH", bad, 400);
    await call(
      "settings",
      "POST",
      { key: "TELEGRAM_BOT_TOKEN", value: "not-public" },
      400,
    );
    await call(
      "content",
      "POST",
      { id: "home", content: { ...siteContent.home, cards: [] } },
      400,
    );
    await call(
      "content",
      "POST",
      { id: "home", content: { ...siteContent.home, role: null } },
      400,
    );
    assert.equal(
      (
        await publicApi.fetch(
          new Request("https://public.example/api/skills", { method: "POST" }),
          env,
        )
      ).status,
      405,
    );
  } finally {
    fetch.mock.restore();
    DB.close();
  }
});

test("CORS, CSRF, request limits and unsupported methods fail without database writes", async () => {
  const keys = await signer(),
    jwt = await keys.token(),
    DB = new LocalD1();
  const env: Env = {
    DB,
    ACCESS_TEAM_DOMAIN: issuer,
    ACCESS_AUD: audience,
    ALLOWED_ORIGINS: origin,
  };
  const fetch = mock.method(globalThis, "fetch", async () =>
    Response.json({ keys: [keys.jwk] }),
  );
  const headers = {
    "Cf-Access-Jwt-Assertion": jwt,
    Origin: origin,
    "Content-Type": "application/json",
    "X-CMS-Request": "1",
  };
  const req = (
    method: string,
    body?: string,
    extra: Record<string, string> = {},
  ) =>
    new Request("https://cms.example/api/admin/skills", {
      method,
      headers: { ...headers, ...extra },
      body,
    });
  try {
    const preflight = await admin.fetch(
      req("OPTIONS", undefined, {
        "Access-Control-Request-Method": "POST",
        "Access-Control-Request-Headers": "content-type,x-cms-request",
      }),
      env,
    );
    assert.equal(preflight.status, 204);
    assert.equal(
      preflight.headers.get("Access-Control-Allow-Credentials"),
      "true",
    );
    const denied = await admin.fetch(
      req("OPTIONS", undefined, {
        Origin: "https://evil.example",
        "Access-Control-Request-Method": "POST",
      }),
      env,
    );
    assert.equal(denied.status, 403);
    assert.equal(denied.headers.get("Access-Control-Allow-Origin"), null);
    assert.equal(
      (
        await admin.fetch(
          req("POST", "{}", { Origin: "https://evil.example" }),
          env,
        )
      ).status,
      403,
    );
    assert.equal(
      (await admin.fetch(req("POST", "{}", { "X-CMS-Request": "" }), env))
        .status,
      403,
    );
    assert.equal(
      (
        await admin.fetch(
          req("POST", "{}", { "Content-Type": "text/plain" }),
          env,
        )
      ).status,
      415,
    );
    assert.equal((await admin.fetch(req("POST", "{"), env)).status, 400);
    assert.equal(
      (await admin.fetch(req("POST", " ".repeat(262145)), env)).status,
      413,
    );
    assert.equal((await admin.fetch(req("HEAD"), env)).status, 405);
    const badConfig = await admin.fetch(req("POST", "{}"), {
      ...env,
      ACCESS_AUD: "",
    });
    assert.equal(badConfig.status, 503);
    assert.equal(
      (
        await DB.prepare("SELECT COUNT(*) AS n FROM skills").first<{
          n: number;
        }>()
      )?.n,
      0,
    );
  } finally {
    fetch.mock.restore();
    DB.close();
  }
});

test("same-origin dashboard proxy verifies Access and never forwards credentials to static hosting", async () => {
  const keys = await signer(),
    jwt = await keys.token(),
    DB = new LocalD1();
  const env: Env = {
    DB,
    ACCESS_TEAM_DOMAIN: issuer,
    ACCESS_AUD: audience,
    ALLOWED_ORIGINS: origin,
    DASHBOARD_ORIGIN: origin,
  };
  let staticCalls = 0;
  const fetch = mock.method(
    globalThis,
    "fetch",
    async (url: unknown, options?: RequestInit) => {
      if (String(url).endsWith("/cdn-cgi/access/certs"))
        return Response.json({ keys: [keys.jwk] });
      assert.equal(url, `${origin}/admin/index.html`);
      assert.equal(options?.headers, undefined);
      assert.equal(options?.redirect, "manual");
      staticCalls++;
      return new Response("<!doctype html><title>CMS</title>", {
        headers: { "Content-Type": "text/html" },
      });
    },
  );
  try {
    const request = (token: string) =>
      new Request("https://cms.example/admin/", {
        headers: {
          "Cf-Access-Jwt-Assertion": token,
          Cookie: "CF_Authorization=private",
        },
      });
    assert.equal((await admin.fetch(request(""), env)).status, 401);
    assert.equal(staticCalls, 0);
    const response = await admin.fetch(request(jwt), env);
    assert.equal(response.status, 200);
    assert.equal(response.headers.get("Cache-Control"), "no-store");
    assert.equal(staticCalls, 1);
    assert.equal(
      (
        await admin.fetch(request(jwt), {
          ...env,
          DASHBOARD_ORIGIN: "http://unsafe.example",
        })
      ).status,
      503,
    );
  } finally {
    fetch.mock.restore();
    DB.close();
  }
});

test("partial document updates preserve existing nested values", async () => {
  const { validateRecord } = await import("../cms/shared/validation.ts");
  const home = {
    id: "home",
    section: "home",
    is_published: 1,
    content: {
      ...siteContent.home,
      mission: ["Existing custom mission", "Keep this line"],
    },
  };
  const changed = validateRecord(
    "content",
    { content: { role: "New role" } },
    home,
  );
  assert.deepEqual((changed.content as RecordData).mission, [
    "Existing custom mission",
    "Keep this line",
  ]);
  assert.equal((changed.content as RecordData).role, "New role");
  const settings = validateRecord(
    "settings",
    { value: { copyright: "Changed" } },
    {
      key: "footer",
      value: { ...siteContent.footer, version: "custom-existing" },
    },
  );
  assert.equal((settings.value as RecordData).version, "custom-existing");
  assert.equal((settings.value as RecordData).copyright, "Changed");
  assert.throws(() =>
    validateRecord(
      "content",
      { content: JSON.parse('{"__proto__":{"polluted":true}}') },
      home,
    ),
  );
  assert.equal(({} as RecordData).polluted, undefined);
});
