import type { Resource, RecordData } from "../../cms/shared/types";
export const ADMIN_API_URL = (
  (import.meta.env ?? {}).VITE_ADMIN_API_URL ||
  "https://portfolio-cms-api.kmuhammadali.workers.dev"
).replace(/\/$/, "");
export class AdminError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}
export async function adminRequest<T>(
  path: string,
  method = "GET",
  body?: unknown,
  version?: string,
): Promise<T> {
  let response: Response;
  try {
    response = await fetch(`${ADMIN_API_URL}/api/admin/${path}`, {
      method,
      credentials: "include",
      redirect: "error",
      cache: "no-store",
      signal: AbortSignal.timeout(15000),
      headers: {
        "X-CMS-Request": "1",
        ...(body === undefined ? {} : { "Content-Type": "application/json" }),
        ...(version ? { "If-Match": `"${version}"` } : {}),
      },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    });
  } catch {
    throw new AdminError(
      0,
      "Cannot reach Admin API. Sign in with Cloudflare Access, or check your connection and CORS settings.",
    );
  }
  if (response.status === 401 || response.status === 403)
    throw new AdminError(
      response.status,
      "Your session expired or Access denied this request. Sign in again.",
    );
  const type = response.headers.get("Content-Type") ?? "";
  if (!type.includes("application/json"))
    throw new AdminError(401, "Cloudflare Access sign-in is required.");
  const result = (await response.json()) as T & { error?: string };
  if (!response.ok)
    throw new AdminError(
      response.status,
      result.error || `Request failed (${response.status})`,
    );
  return result;
}
export interface Listing {
  items: RecordData[];
  total: number;
  limit: number;
  offset: number;
}
export const cmsApi = {
  session: () => adminRequest<{ authenticated: boolean }>("session"),
  list: (resource: Resource, offset = 0) =>
    adminRequest<Listing>(`${resource}?limit=50&offset=${offset}`),
  get: (resource: Resource, id: string) =>
    adminRequest<RecordData>(`${resource}/${encodeURIComponent(id)}`),
  save: (resource: Resource, data: RecordData, isNew: boolean) => {
    const key = String(data[resource === "settings" ? "key" : "id"]);
    const { created_at: _created, updated_at: version, ...body } = data;
    return adminRequest<RecordData>(
      resource + (isNew ? "" : `/${encodeURIComponent(key)}`),
      isNew ? "POST" : "PATCH",
      body,
      version as string | undefined,
    );
  },
  remove: (resource: Resource, data: RecordData) =>
    adminRequest<{ ok: boolean }>(
      `${resource}/${encodeURIComponent(String(data[resource === "settings" ? "key" : "id"]))}`,
      "DELETE",
      undefined,
      data.updated_at as string | undefined,
    ),
};
