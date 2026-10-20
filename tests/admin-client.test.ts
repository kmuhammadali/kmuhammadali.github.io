import { test, mock } from "node:test";
import assert from "node:assert/strict";
import { adminRequest, cmsApi } from "../src/admin/api.ts";

test("admin requests use HttpOnly-cookie credentials and CSRF marker, never send secrets", async () => {
  const fetch = mock.method(
    globalThis,
    "fetch",
    async (url: unknown, options?: RequestInit) => {
      assert.ok(String(url).endsWith("/api/admin/skills/id-1"));
      assert.equal(options?.credentials, "include");
      assert.equal(options?.redirect, "error");
      const headers = new Headers(options?.headers);
      assert.equal(headers.get("X-CMS-Request"), "1");
      assert.equal(headers.get("If-Match"), '"version-1"');
      assert.equal(headers.get("Authorization"), null);
      assert.deepEqual(JSON.parse(String(options?.body)), {
        id: "id-1",
        title: "Updated title",
      });
      return Response.json({ id: "id-1" });
    },
  );
  try {
    await cmsApi.save(
      "skills",
      {
        id: "id-1",
        title: "Updated title",
        created_at: "before",
        updated_at: "version-1",
      },
      false,
    );
  } finally {
    fetch.mock.restore();
  }
});
test("authentication, network and conflicting edits surface actionable errors", async () => {
  for (const [response, pattern] of [
    [Response.json({ error: "Changed" }, { status: 409 }), /Changed/],
    [Response.json({}, { status: 401 }), /Sign in again/],
    [
      new Response("<html>Login</html>", {
        headers: { "Content-Type": "text/html" },
      }),
      /sign-in/,
    ],
  ] as [Response, RegExp][]) {
    const fetch = mock.method(globalThis, "fetch", async () => response);
    try {
      await assert.rejects(adminRequest("skills"), pattern);
    } finally {
      fetch.mock.restore();
    }
  }
  const fetch = mock.method(globalThis, "fetch", async () => {
    throw new Error("offline");
  });
  try {
    await assert.rejects(adminRequest("skills"), /Cannot reach Admin API/);
  } finally {
    fetch.mock.restore();
  }
});
