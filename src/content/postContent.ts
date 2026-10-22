import DOMPurify from 'dompurify';
import { marked } from 'marked';

// Keep the API's string field and distinguish new rich text from legacy Markdown.
export const RICH_TEXT_PREFIX = '<!-- portfolio-rich-text:v1 -->\n';
export function safeContentUrl(value: string, image = false): boolean {
  try {
    const url = new URL(value);
    return !url.username && !url.password &&
      (image ? url.protocol === 'https:' : ['https:', 'http:', 'mailto:'].includes(url.protocol));
  } catch { return false; }
}

/** The same allowlist is applied before editing, saving, pasting and public rendering. */
export function sanitizePostHtml(html: string): string {
  const fragment = DOMPurify.sanitize(html, {
    ALLOWED_TAGS: ['p', 'br', 'strong', 'b', 'em', 'i', 'u', 's', 'del', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
      'ul', 'ol', 'li', 'a', 'blockquote', 'img', 'pre', 'code', 'hr'],
    ALLOWED_ATTR: ['href', 'src', 'alt', 'title', 'start'],
    ALLOW_DATA_ATTR: false,
    ALLOW_ARIA_ATTR: false,
    RETURN_DOM_FRAGMENT: true,
  });
  for (const link of fragment.querySelectorAll('a')) {
    if (!safeContentUrl(link.getAttribute('href') ?? '')) link.removeAttribute('href');
    link.setAttribute('rel', 'noopener noreferrer');
  }
  for (const image of fragment.querySelectorAll('img')) {
    if (!safeContentUrl(image.getAttribute('src') ?? '', true)) { image.remove(); continue; }
    image.setAttribute('loading', 'lazy');
    image.setAttribute('referrerpolicy', 'no-referrer');
    if (!image.hasAttribute('alt')) image.setAttribute('alt', '');
  }
  const container = document.createElement('div');
  container.append(fragment);
  return container.innerHTML;
}
export function postContentHtml(content: string): string {
  return sanitizePostHtml(content.startsWith(RICH_TEXT_PREFIX)
    ? content.slice(RICH_TEXT_PREFIX.length)
    : marked.parse(content, { async: false, gfm: true }));
}
export function saveRichText(html: string): string {
  return RICH_TEXT_PREFIX + sanitizePostHtml(html);
}
