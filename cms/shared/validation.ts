import { siteContent } from "../../src/config/siteContent.ts";
import { pages, type Page, type RecordData, type Resource } from "./types.ts";

export class ApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}
export function object(value: unknown): RecordData {
  if (!value || typeof value !== "object" || Array.isArray(value))
    throw new ApiError(400, "Expected a JSON object");
  return value as RecordData;
}
export function id(value: unknown): string {
  if (
    typeof value !== "string" ||
    !/^[a-zA-Z0-9][a-zA-Z0-9_-]{0,99}$/.test(value)
  )
    throw new ApiError(400, "Invalid record ID");
  return value;
}
export function text(
  value: unknown,
  field: string,
  max = 5000,
  required = false,
): string {
  if (
    typeof value !== "string" ||
    value.length > max ||
    (required && !value.trim()) ||
    /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/.test(value)
  )
    throw new ApiError(400, `Invalid ${field}`);
  return value;
}
export function url(value: unknown, field: string, allowMail = false): string {
  const result = text(value ?? "", field, 2048);
  if (!result) return "";
  if (allowMail && /^mailto:[^\s@]+@[^\s@]+\.[^\s@]+$/.test(result))
    return result;
  let parsed: URL;
  try {
    parsed = new URL(result);
  } catch {
    throw new ApiError(400, `Invalid ${field} URL`);
  }
  if (parsed.protocol !== "https:" || parsed.username || parsed.password)
    throw new ApiError(400, `${field} must use HTTPS`);
  return result;
}
function integer(value: unknown, field: string, max = 1000000): number {
  if (!Number.isSafeInteger(value) || Number(value) < 0 || Number(value) > max)
    throw new ApiError(400, `Invalid ${field}`);
  return Number(value);
}
function published(value: unknown): number {
  if (![0, 1, true, false].includes(value as number))
    throw new ApiError(400, "Invalid publication flag");
  return value ? 1 : 0;
}
function keys(data: RecordData, allowed: string[]) {
  for (const key of Object.keys(data))
    if (!allowed.includes(key))
      throw new ApiError(400, `Unknown field: ${key}`);
}
function shape(template: unknown, value: unknown, path: string): unknown {
  if (typeof template === "string") {
    const result = text(value, path, 10000);
    if (["image", "image_url", "href"].includes(path.split(".").at(-1)!))
      return url(result, path, path.endsWith(".href"));
    return result;
  }
  if (Array.isArray(template)) {
    if (!Array.isArray(value) || value.length > 100)
      throw new ApiError(400, `Invalid ${path} array`);
    return value.map((item, i) =>
      shape(template[0] ?? "", item, `${path}.${i}`),
    );
  }
  const input = object(value);
  const base = object(template);
  keys(input, Object.keys(base));
  return Object.fromEntries(
    Object.entries(base).map(([key, defaultValue]) => [
      key,
      shape(
        defaultValue,
        Object.hasOwn(input, key) ? input[key] : defaultValue,
        `${path}.${key}`,
      ),
    ]),
  );
}
export function pageTemplate(page: Page) {
  if (page === "skills") {
    const { items: _items, ...rest } = siteContent.skills;
    return rest;
  }
  return siteContent[page];
}
export function validatePage(page: string, content: unknown): unknown {
  if (!pages.includes(page as Page)) throw new ApiError(400, "Unknown page");
  const result = shape(pageTemplate(page as Page), content, page) as RecordData;
  if (page === "home") {
    const cards = result.cards as RecordData[];
    if (
      cards.length !== 3 ||
      new Set(cards.map((card) => card.section)).size !== 3 ||
      cards.some(
        (card) =>
          !["about", "skills", "contact"].includes(String(card.section)),
      )
    )
      throw new ApiError(400, "Home must retain its three section cards");
    if (
      (result.directories as string[]).length !== 3 ||
      (result.mission as string[]).length !== 2
    )
      throw new ApiError(400, "Keep the existing terminal line structure");
  }
  if (page === "about") {
    if (result.type !== "design")
      throw new ApiError(400, "Keep the About section type");
    const items = result.items as RecordData[];
    if (new Set(items.map((item) => item.id)).size !== items.length)
      throw new ApiError(400, "About item IDs must be unique");
    for (const item of items) {
      id(item.id);
      if (item.type !== "design")
        throw new ApiError(400, "Invalid About item type");
    }
  }
  if (page === "skills" && result.type !== "video")
    throw new ApiError(400, "Keep the Skills section type");
  if (
    page === "contact" &&
    ((result.links as unknown[]).length !== 4 ||
      !(result.initialOutput as unknown[]).length)
  )
    throw new ApiError(
      400,
      "Keep the four contact slots and initial terminal output",
    );
  return result;
}
export const settingKeys = ["name", "navigation", "footer"] as const;
export function validateSetting(key: string, value: unknown): unknown {
  if (!settingKeys.includes(key as (typeof settingKeys)[number]))
    throw new ApiError(400, "Unsupported public setting");
  const result = shape(
    siteContent[key as (typeof settingKeys)[number]],
    value,
    key,
  );
  if (key === "name") text(result, "name", 200, true);
  if (key === "navigation") {
    const navigation = result as RecordData[];
    if (
      navigation.length !== 4 ||
      new Set(navigation.map((item) => item.id)).size !== 4 ||
      navigation.some((item) => !pages.includes(item.id as Page))
    )
      throw new ApiError(400, "Keep the four existing navigation destinations");
  }
  return result;
}
export const tables: Record<Resource, string> = {
  content: "page_content",
  settings: "site_settings",
  skills: "skills",
  projects: "projects",
  posts: "posts",
  media: "media",
};
const fields: Record<Resource, string[]> = {
  content: ["id", "section", "content", "is_published", "sort_order"],
  settings: ["key", "value"],
  skills: [
    "id",
    "title",
    "description",
    "image_url",
    "tags",
    "sort_order",
    "is_published",
  ],
  projects: [
    "id",
    "title",
    "slug",
    "description",
    "image_url",
    "github_url",
    "live_url",
    "tags",
    "sort_order",
    "is_published",
  ],
  posts: [
    "id",
    "title",
    "slug",
    "excerpt",
    "content",
    "cover_image_url",
    "status",
    "published_at",
    "sort_order",
  ],
  media: [
    "id",
    "file_name",
    "object_key",
    "mime_type",
    "file_size",
    "public_url",
    "alt_text",
    "sort_order",
    "is_published",
  ],
};
function mergeDocument(previous: unknown, patch: unknown): unknown {
  if (
    previous &&
    patch &&
    typeof previous === "object" &&
    typeof patch === "object" &&
    !Array.isArray(previous) &&
    !Array.isArray(patch)
  ) {
    const before = previous as RecordData;
    const next = patch as RecordData;
    return Object.fromEntries(
      [...new Set([...Object.keys(before), ...Object.keys(next)])].map(
        (key) => [
          key,
          Object.hasOwn(next, key)
            ? mergeDocument(before[key], next[key])
            : before[key],
        ],
      ),
    );
  }
  return patch;
}

export function validateRecord(
  resource: Resource,
  input: unknown,
  previous?: RecordData,
): RecordData {
  const patch = object(input);
  keys(patch, fields[resource]);
  const data = { ...previous, ...patch };
  if (previous) {
    const documentField =
      resource === "content"
        ? "content"
        : resource === "settings"
          ? "value"
          : null;
    if (documentField && Object.hasOwn(patch, documentField))
      data[documentField] = mergeDocument(
        previous[documentField],
        patch[documentField],
      );
  }
  const result: RecordData = {};
  if (resource === "settings") {
    result.key = id(data.key);
    result.value = validateSetting(String(result.key), data.value);
    return result;
  }
  result.id = id(data.id);
  if (resource === "content") {
    result.section = String(data.section ?? data.id);
    if (result.section !== result.id)
      throw new ApiError(400, "Page ID and section must match");
    result.content = validatePage(String(result.id), data.content);
  } else if (resource === "media") {
    result.file_name = text(data.file_name, "file_name", 255, true);
    result.object_key = text(data.object_key, "object_key", 1024, true);
    result.mime_type = text(data.mime_type, "mime_type", 120, true);
    if (!/^[\w.+-]+\/[\w.+-]+$/.test(String(result.mime_type)))
      throw new ApiError(400, "Invalid MIME type");
    result.file_size = integer(
      data.file_size ?? 0,
      "file_size",
      Number.MAX_SAFE_INTEGER,
    );
    result.public_url = url(data.public_url, "public_url");
    result.alt_text = text(data.alt_text ?? "", "alt_text", 1000);
  } else {
    result.title = text(data.title, "title", 200, true);
    if (resource === "skills" || resource === "projects") {
      result.description = text(data.description ?? "", "description", 10000);
      result.image_url = url(data.image_url, "image_url");
      if (
        !Array.isArray(data.tags ?? []) ||
        ((data.tags ?? []) as unknown[]).length > 30
      )
        throw new ApiError(400, "Invalid tags");
      result.tags = ((data.tags as unknown[]) ?? []).map((tag) =>
        text(tag, "tag", 80, true),
      );
    }
    if (resource === "projects" || resource === "posts") {
      result.slug = text(data.slug, "slug", 200, true);
      if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(String(result.slug)))
        throw new ApiError(400, "Slug must use lowercase words and hyphens");
    }
    if (resource === "projects") {
      result.github_url = url(data.github_url, "github_url");
      result.live_url = url(data.live_url, "live_url");
    }
    if (resource === "posts") {
      result.excerpt = text(data.excerpt ?? "", "excerpt", 2000);
      result.content = text(data.content ?? "", "post content", 100000);
      result.cover_image_url = url(data.cover_image_url, "cover_image_url");
      if (!["draft", "published"].includes(String(data.status ?? "draft")))
        throw new ApiError(400, "Invalid post status");
      result.status = data.status ?? "draft";
      const date = data.published_at;
      if (
        date != null &&
        (typeof date !== "string" || !Number.isFinite(Date.parse(date)))
      )
        throw new ApiError(400, "Invalid publication date");
      result.published_at =
        result.status === "published" ? date || new Date().toISOString() : null;
    }
  }
  result.sort_order = integer(data.sort_order ?? 0, "sort_order");
  if (resource !== "posts")
    result.is_published = published(data.is_published ?? 0);
  if (resource === "media" && result.is_published && !result.public_url)
    throw new ApiError(400, "Published media requires a public URL");
  return result;
}
export function decodeRow(row: RecordData): RecordData {
  const result = { ...row };
  for (const key of ["content", "value", "tags"]) {
    if (
      typeof result[key] === "string" &&
      (key !== "content" || "section" in row)
    )
      result[key] = JSON.parse(result[key] as string);
  }
  return result;
}
export function encodeValue(
  key: string,
  value: unknown,
  resource: Resource,
): unknown {
  return key === "value" ||
    key === "tags" ||
    (key === "content" && resource === "content")
    ? JSON.stringify(value)
    : value;
}
