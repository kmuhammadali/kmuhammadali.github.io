import type { BaseEnv, RecordData } from "../shared/types.ts";
import { pages } from "../shared/types.ts";
import { json } from "../shared/http.ts";
export default {
  async fetch(request: Request, env: BaseEnv): Promise<Response> {
    // Revalidate on every load: publication changes do not leave stale drafts in CDN/browser caches.
    const respond = (data: unknown, status = 200) =>
      json(data, status, { "Access-Control-Allow-Origin": "*" });
    if (request.method !== "GET")
      return respond({ error: "Method not allowed" }, 405);
    const path = new URL(request.url).pathname.replace(/\/+$/, "");
    try {
      if (path === "/health") {
        await env.DB.prepare("SELECT 1").first();
        return respond({
          status: "ok",
          service: "portfolio-public-api",
          database: "connected",
        });
      }
      if (path === "/api/content") {
        const { results } = await env.DB.prepare(
          "SELECT id,content FROM page_content WHERE is_published = 1 ORDER BY sort_order ASC,id ASC",
        ).all<{ id: string; content: string }>();
        return respond(
          Object.fromEntries(
            results
              .filter((row) => pages.includes(row.id as (typeof pages)[number]))
              .map((row) => [row.id, JSON.parse(row.content)]),
          ),
        );
      }
      if (path.startsWith("/api/content/")) {
        const page = path.slice("/api/content/".length);
        if (!pages.includes(page as (typeof pages)[number]))
          return respond({ error: "Not found" }, 404);
        const row = await env.DB.prepare(
          "SELECT content FROM page_content WHERE id = ? AND is_published = 1",
        )
          .bind(page)
          .first<{ content: string }>();
        return row
          ? respond(JSON.parse(row.content))
          : respond({ error: "Not found" }, 404);
      }
      if (path === "/api/settings") {
        const { results } = await env.DB.prepare(
          "SELECT key,value FROM site_settings WHERE key IN ('name','navigation','footer')",
        ).all<{ key: string; value: string }>();
        return respond(
          Object.fromEntries(
            results.map((row) => [row.key, JSON.parse(row.value)]),
          ),
        );
      }
      const lists: Record<string, string> = {
        "/api/skills":
          "SELECT id,title,description,image_url,tags FROM skills WHERE is_published = 1 ORDER BY sort_order ASC,created_at DESC,id ASC",
        "/api/projects":
          "SELECT id,title,slug,description,image_url,github_url,live_url,tags FROM projects WHERE is_published = 1 ORDER BY sort_order ASC,created_at DESC,id ASC",
        "/api/posts":
          "SELECT id,title,slug,excerpt,cover_image_url,published_at FROM posts WHERE status = 'published' ORDER BY sort_order ASC,published_at DESC,id ASC",
        "/api/media":
          "SELECT id,file_name,mime_type,file_size,public_url,alt_text FROM media WHERE is_published = 1 ORDER BY sort_order ASC,created_at DESC,id ASC",
      };
      if (lists[path]) {
        const { results } = await env.DB.prepare(lists[path]).all<RecordData>();
        return respond(
          results.map((row) => ({
            ...row,
            ...("tags" in row
              ? { tags: JSON.parse(String(row.tags || "[]")) }
              : {}),
          })),
        );
      }
      const post = /^\/api\/posts\/([a-z0-9]+(?:-[a-z0-9]+)*)$/.exec(path);
      if (post) {
        const row = await env.DB.prepare(
          "SELECT id,title,slug,excerpt,content,cover_image_url,published_at FROM posts WHERE slug = ? AND status = 'published'",
        )
          .bind(post[1])
          .first();
        return row ? respond(row) : respond({ error: "Not found" }, 404);
      }
      return respond({ error: "Not found" }, 404);
    } catch {
      return respond({ error: "Service unavailable" }, 503);
    }
  },
};
