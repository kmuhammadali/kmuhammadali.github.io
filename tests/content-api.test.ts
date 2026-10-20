import { test, mock } from "node:test";
import assert from "node:assert/strict";
import {
  loadSiteContent,
  loadContentResult,
} from "../src/config/contentApi.ts";
import { siteContent } from "../src/config/siteContent.ts";

test("published content merges safely, including empty skill collections after unpublishing", async () => {
  const fetch = mock.method(
    globalThis,
    "fetch",
    async (url: unknown, options?: RequestInit) => {
      assert.equal(options?.cache, "no-store");
      const path = new URL(String(url)).pathname;
      return Response.json(
        path === "/api/content"
          ? {
              home: { role: "Published role" },
              skills: { description: "Updated intro" },
            }
          : path === "/api/settings"
            ? { name: "CMS name", footer: { copyright: "Updated footer" } }
            : [],
      );
    },
  );
  try {
    const content = await loadSiteContent();
    assert.equal(content.home.role, "Published role");
    assert.deepEqual(content.home.cards, siteContent.home.cards);
    assert.equal(content.skills.description, "Updated intro");
    assert.equal(content.skills.items.length, 0);
    assert.equal(content.footer.copyright, "Updated footer");
    assert.equal(content.name, "CMS name");
    assert.equal(content.contact.submit, siteContent.contact.submit);
  } finally {
    fetch.mock.restore();
  }
});
test("unavailable collections retain fallback without discarding healthy content", async () => {
  const fetch = mock.method(globalThis, "fetch", async (url: unknown) => {
    const path = new URL(String(url)).pathname;
    if (path === "/api/skills") throw new Error("offline");
    return Response.json(
      path === "/api/content" ? { home: { role: "Still loaded" } } : {},
    );
  });
  try {
    const { content, error } = await loadContentResult();
    assert.equal(content.home.role, "Still loaded");
    assert.ok(error);
    assert.deepEqual(content.skills.items, siteContent.skills.items);
  } finally {
    fetch.mock.restore();
  }
});
test("malformed published content and dangerous URLs do not reach public components", async () => {
  const fetch = mock.method(globalThis, "fetch", async (url: unknown) => {
    const path = new URL(String(url)).pathname;
    return Response.json(
      path === "/api/content"
        ? {
            home: { cards: [] },
            contact: { links: [{ href: "javascript:alert(1)" }] },
          }
        : path === "/api/settings"
          ? { navigation: [] }
          : [
              {
                id: "bad",
                title: "Bad URL",
                image_url: "javascript:alert(1)",
                tags: [],
              },
            ],
    );
  });
  try {
    const { content, error } = await loadContentResult();
    assert.ok(error);
    assert.deepEqual(content.home, siteContent.home);
    assert.deepEqual(content.navigation, siteContent.navigation);
    assert.deepEqual(content.contact.links, siteContent.contact.links);
    assert.deepEqual(content.skills.items, siteContent.skills.items);
    assert.deepEqual(
      siteContent.home.cards.map((c) => c.section),
      ["about", "skills", "contact"],
    );
  } finally {
    fetch.mock.restore();
  }
});
