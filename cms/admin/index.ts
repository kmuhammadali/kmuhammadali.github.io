import { verifyAccessJwt, AuthUnavailable, type AccessEnv } from "./auth.ts";
import { json, readJSON } from "../shared/http.ts";
import {
  ApiError,
  decodeRow,
  encodeValue,
  id,
  object,
  settingKeys,
  tables,
  validateRecord,
} from "../shared/validation.ts";
import {
  resources,
  type BaseEnv,
  type Resource,
  type RecordData,
} from "../shared/types.ts";
export interface Env extends BaseEnv, AccessEnv {
  ALLOWED_ORIGINS: string;
  DASHBOARD_ORIGIN?: string;
}
const stamp = "strftime('%Y-%m-%dT%H:%M:%fZ','now')";
function keyFor(resource: Resource) {
  return resource === "settings" ? "key" : "id";
}
function writableOrigin(request: Request, env: Env) {
  const origin = request.headers.get("Origin");
  return (
    !!origin &&
    [
      new URL(request.url).origin,
      ...(env.ALLOWED_ORIGINS ?? "")
        .split(",")
        .map((x) => x.trim())
        .filter(Boolean),
    ].includes(origin)
  );
}
function cors(request: Request, env: Env) {
  const headers = new Headers({ Vary: "Origin" });
  if (writableOrigin(request, env)) {
    headers.set("Access-Control-Allow-Origin", request.headers.get("Origin")!);
    headers.set("Access-Control-Allow-Credentials", "true");
    headers.set("Access-Control-Expose-Headers", "ETag");
  }
  return headers;
}
async function getRecord(env: Env, resource: Resource, key: string) {
  const row = await env.DB.prepare(
    `SELECT * FROM ${tables[resource]} WHERE ${keyFor(resource)} = ?`,
  )
    .bind(key)
    .first<RecordData>();
  return row ? decodeRow(row) : null;
}
function assertVersion(request: Request, row: RecordData) {
  const expected = request.headers.get("If-Match");
  if (expected && expected !== `"${row.updated_at}"`)
    throw new ApiError(409, "This record changed. Reload before saving.");
}
export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const headers = cors(request, env);
    const respond = (value: unknown, status = 200) =>
      json(value, status, headers);
    const pathname = new URL(request.url).pathname.replace(/\/+$/, "") || "/";
    if (request.method === "OPTIONS") {
      const requested = (
        request.headers.get("Access-Control-Request-Headers") ?? ""
      )
        .toLowerCase()
        .split(",")
        .map((x) => x.trim())
        .filter(Boolean);
      if (
        !writableOrigin(request, env) ||
        !["GET", "POST", "PUT", "PATCH", "DELETE"].includes(
          request.headers.get("Access-Control-Request-Method") ?? "",
        ) ||
        requested.some(
          (h) => !["content-type", "if-match", "x-cms-request"].includes(h),
        )
      )
        return respond({ error: "Forbidden" }, 403);
      headers.set(
        "Access-Control-Allow-Methods",
        "GET, POST, PUT, PATCH, DELETE",
      );
      headers.set(
        "Access-Control-Allow-Headers",
        "Content-Type, If-Match, X-CMS-Request",
      );
      return new Response(null, { status: 204, headers });
    }
    try {
      if (pathname === "/health" && request.method === "GET") {
        await env.DB.prepare("SELECT 1").first();
        return respond({
          status: "ok",
          service: "portfolio-cms-api",
          database: "connected",
        });
      }
      // Every admin read, write, dashboard and asset request needs a cryptographically verified Access JWT.
      const user = await verifyAccessJwt(request, env);
      if (!user) return respond({ error: "Unauthorized" }, 401);
      if (pathname === "/api/admin/session" && request.method === "GET")
        return respond({ authenticated: true, service: "portfolio-cms-api" });
      if (
        request.method === "GET" &&
        (pathname === "/admin" ||
          pathname === "/admin/index.html" ||
          /^\/assets\/[\w.-]+$/.test(pathname))
      ) {
        // Optional same-origin dashboard avoids third-party Access-cookie restrictions.
        if (!env.DASHBOARD_ORIGIN)
          return respond({ error: "Dashboard origin not configured" }, 503);
        const origin = new URL(env.DASHBOARD_ORIGIN);
        if (
          origin.protocol !== "https:" ||
          origin.pathname !== "/" ||
          origin.username ||
          origin.password ||
          origin.search ||
          origin.hash
        )
          throw new ApiError(503, "Invalid dashboard origin");
        const target = `${origin.origin}${pathname.startsWith("/assets/") ? pathname : "/admin/index.html"}`;
        const upstream = await fetch(target, {
          redirect: "manual",
          signal: AbortSignal.timeout(8000),
        });
        if (upstream.status >= 300 && upstream.status < 400)
          throw new ApiError(503, "Dashboard origin redirected unexpectedly");
        const responseHeaders = new Headers(upstream.headers);
        responseHeaders.set("Cache-Control", "no-store");
        responseHeaders.set("X-Content-Type-Options", "nosniff");
        responseHeaders.set("Referrer-Policy", "no-referrer");
        // No Access headers/cookies are sent to the static host.
        return new Response(upstream.body, {
          status: upstream.status,
          headers: responseHeaders,
        });
      }
      const match =
        /^\/api\/admin\/(content|skills|projects|posts|settings|media)(?:\/([^/]+))?$/.exec(
          pathname,
        );
      if (!match) return respond({ error: "Not found" }, 404);
      const resource = match[1] as Resource;
      let key: string | null = null;
      if (match[2]) {
        try {
          key = id(decodeURIComponent(match[2]));
        } catch {
          throw new ApiError(400, "Invalid record ID");
        }
      }
      if (!resources.includes(resource))
        return respond({ error: "Not found" }, 404);
      if (
        resource === "settings" &&
        key &&
        !settingKeys.includes(key as (typeof settingKeys)[number])
      )
        return respond({ error: "Not found" }, 404);
      if (request.method === "GET") {
        if (key) {
          const record = await getRecord(env, resource, key);
          if (!record) return respond({ error: "Not found" }, 404);
          headers.set("ETag", `"${record.updated_at}"`);
          return respond(record);
        }
        const params = new URL(request.url).searchParams;
        const limit = Number(params.get("limit") ?? 50),
          offset = Number(params.get("offset") ?? 0);
        if (
          !Number.isInteger(limit) ||
          limit < 1 ||
          limit > 200 ||
          !Number.isSafeInteger(offset) ||
          offset < 0
        )
          throw new ApiError(400, "Invalid pagination");
        const condition =
          resource === "settings"
            ? " WHERE key IN ('name','navigation','footer')"
            : "";
        const order =
          resource === "settings"
            ? "key ASC"
            : "sort_order ASC, " +
              (resource === "content" ? "id ASC" : "created_at DESC, id ASC");
        const { results } = await env.DB.prepare(
          `SELECT * FROM ${tables[resource]}${condition} ORDER BY ${order} LIMIT ? OFFSET ?`,
        )
          .bind(limit, offset)
          .all<RecordData>();
        const count = await env.DB.prepare(
          `SELECT COUNT(*) AS total FROM ${tables[resource]}${condition}`,
        ).first<{ total: number }>();
        return respond({
          items: results.map(decodeRow),
          total: count?.total ?? 0,
          limit,
          offset,
        });
      }
      if (!["POST", "PUT", "PATCH", "DELETE"].includes(request.method)) {
        headers.set("Allow", "GET, POST, PUT, PATCH, DELETE, OPTIONS");
        return respond({ error: "Method not allowed" }, 405);
      }
      if (
        !writableOrigin(request, env) ||
        request.headers.get("X-CMS-Request") !== "1"
      )
        return respond({ error: "Forbidden request origin" }, 403);
      if (request.method === "DELETE") {
        if (!key) throw new ApiError(400, "Record ID required");
        const row = await getRecord(env, resource, key);
        if (!row) return respond({ error: "Not found" }, 404);
        assertVersion(request, row);
        const result = await env.DB.prepare(
          `DELETE FROM ${tables[resource]} WHERE ${keyFor(resource)} = ? AND updated_at = ?`,
        )
          .bind(key, row.updated_at)
          .run();
        if (!result.meta.changes)
          throw new ApiError(409, "Record changed before deletion");
        return respond({ ok: true });
      }
      const input = object(await readJSON(request));
      const isCreate = request.method === "POST";
      if (isCreate && key)
        throw new ApiError(405, "POST creates records at the collection URL");
      if (!isCreate && !key) throw new ApiError(400, "Record ID required");
      if (isCreate)
        key = id(
          input[keyFor(resource)] ??
            (resource === "content" ? input.section : crypto.randomUUID()),
        );
      const previous = await getRecord(env, resource, key!);
      if (isCreate && previous)
        throw new ApiError(409, "Record already exists");
      if (!isCreate && !previous) return respond({ error: "Not found" }, 404);
      if (previous) assertVersion(request, previous);
      if (
        input[keyFor(resource)] !== undefined &&
        input[keyFor(resource)] !== key
      )
        throw new ApiError(400, "Record identity cannot change");
      const data = validateRecord(
        resource,
        { ...input, [keyFor(resource)]: key },
        previous ?? undefined,
      );
      const entries = Object.entries(data);
      if (isCreate) {
        const columns = entries.map(([field]) => field);
        const result = await env.DB.prepare(
          `INSERT INTO ${tables[resource]} (${columns.join(",")},updated_at) VALUES (${columns.map(() => "?").join(",")},${stamp})`,
        )
          .bind(
            ...entries.map(([field, value]) =>
              encodeValue(field, value, resource),
            ),
          )
          .run();
        if (!result.success) throw new ApiError(500, "Unable to create record");
      } else {
        const updates = entries.filter(([field]) => field !== keyFor(resource));
        const result = await env.DB.prepare(
          `UPDATE ${tables[resource]} SET ${updates.map(([field]) => `${field} = ?`).join(",")}, updated_at = ${stamp} WHERE ${keyFor(resource)} = ? AND updated_at = ?`,
        )
          .bind(
            ...updates.map(([field, value]) =>
              encodeValue(field, value, resource),
            ),
            key,
            previous!.updated_at,
          )
          .run();
        if (!result.meta.changes)
          throw new ApiError(409, "Record changed before saving");
      }
      const saved = await getRecord(env, resource, key!);
      headers.set("ETag", `"${saved?.updated_at}"`);
      return respond(saved, isCreate ? 201 : 200);
    } catch (error) {
      if (error instanceof ApiError)
        return respond({ error: error.message }, error.status);
      if (error instanceof AuthUnavailable)
        return respond({ error: error.message }, 503);
      if (
        error instanceof Error &&
        /UNIQUE constraint failed/.test(error.message)
      )
        return respond(
          { error: "ID, slug or object key is already in use" },
          409,
        );
      // Do not echo database details, JWTs or request bodies.
      return respond(
        {
          error:
            "Service unavailable. Check database binding and pending migrations.",
        },
        503,
      );
    }
  },
};
