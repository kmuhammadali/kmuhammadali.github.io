import { siteContent } from "./siteContent.ts";
import {
  object,
  validatePage,
  validateRecord,
  validateSetting,
} from "../../cms/shared/validation.ts";
export type SiteContent = typeof siteContent;
export const PUBLIC_API_URL =
  (import.meta.env ?? {}).VITE_PUBLIC_API_URL ||
  "https://portfolio-public-api.kmuhammadali.workers.dev";

async function getJSON(path: string): Promise<unknown> {
  const response = await fetch(`${PUBLIC_API_URL.replace(/\/$/, "")}${path}`, {
    method: "GET",
    cache: "no-store",
    signal: AbortSignal.timeout(8000),
  });
  if (!response.ok) throw new Error(`CMS API error: ${response.status}`);
  return response.json();
}
export async function loadContentResult(): Promise<{
  content: SiteContent;
  error: string | null;
}> {
  // A failure in one collection should not discard other successfully published edits.
  const [pages, settings, skills] = await Promise.allSettled([
    getJSON("/api/content"),
    getJSON("/api/settings"),
    getJSON("/api/skills"),
  ]);
  const content = structuredClone(siteContent);
  let unavailable = false;
  if (pages.status === "fulfilled") {
    try {
      const data = object(pages.value);
      for (const page of ["home", "about", "skills", "contact"] as const) {
        if (data[page] !== undefined) {
          try {
            Object.assign(content[page], validatePage(page, data[page]));
          } catch {
            unavailable = true;
          }
        }
      }
    } catch {
      unavailable = true;
    }
  } else unavailable = true;
  if (settings.status === "fulfilled") {
    try {
      const data = object(settings.value);
      if (data.name !== undefined)
        content.name = validateSetting("name", data.name) as string;
      if (data.navigation !== undefined)
        content.navigation = validateSetting(
          "navigation",
          data.navigation,
        ) as SiteContent["navigation"];
      if (data.footer !== undefined)
        content.footer = validateSetting(
          "footer",
          data.footer,
        ) as SiteContent["footer"];
    } catch {
      unavailable = true;
    }
  } else unavailable = true;
  if (skills.status === "fulfilled") {
    try {
      if (!Array.isArray(skills.value)) throw new Error("Invalid skills");
      content.skills.items = skills.value.map((item) => {
        const skill = validateRecord("skills", item);
        return {
          id: String(skill.id),
          title: String(skill.title),
          description: String(skill.description),
          image: String(skill.image_url),
          tags: skill.tags as string[],
          type: "video" as const,
        };
      });
    } catch {
      unavailable = true;
    }
  } else unavailable = true;
  return {
    content,
    error: unavailable
      ? "Some CMS content is unavailable; local fallback content is being used."
      : null,
  };
}
export async function loadSiteContent(): Promise<SiteContent> {
  return (await loadContentResult()).content;
}
