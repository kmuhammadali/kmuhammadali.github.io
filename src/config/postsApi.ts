import { PUBLIC_API_URL } from './contentApi.ts';
export interface PostSummary {
  id: string; title: string; slug: string; excerpt: string;
  cover_image_url: string | null; published_at: string | null;
}
export interface Post extends PostSummary { content: string }
export class PostNotFound extends Error {}
const slugPattern = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
export const validPostSlug = (slug: string) => slugPattern.test(slug);
function summary(value: unknown): PostSummary | null {
  if (!value || typeof value !== 'object') return null;
  const v = value as Record<string, unknown>;
  if (v.status !== undefined && v.status !== 'published') return null;
  if (typeof v.id !== 'string' || typeof v.title !== 'string' || !v.title.trim() || v.title.length > 200 ||
      typeof v.slug !== 'string' || !validPostSlug(v.slug) || typeof v.excerpt !== 'string') return null;
  let image: string | null = null;
  if (typeof v.cover_image_url === 'string' && v.cover_image_url) {
    try { const u = new URL(v.cover_image_url); if (u.protocol === 'https:' && !u.username && !u.password) image = u.href; } catch { /* Missing/invalid covers use the placeholder. */ }
  }
  const date = typeof v.published_at === 'string' && Number.isFinite(Date.parse(v.published_at)) ? v.published_at : null;
  return { id: v.id, title: v.title, slug: v.slug, excerpt: v.excerpt, cover_image_url: image, published_at: date };
}
async function get(path: string, signal?: AbortSignal) {
  const response = await fetch(`${PUBLIC_API_URL.replace(/\/$/, '')}${path}`, {
    cache: 'no-store', signal: signal ? AbortSignal.any([signal, AbortSignal.timeout(8000)]) : AbortSignal.timeout(8000),
  });
  if (response.status === 404) throw new PostNotFound('Article not found');
  if (!response.ok) throw new Error('Posts are unavailable. Please try again.');
  return response.json() as Promise<unknown>;
}
export async function getPublishedPosts(signal?: AbortSignal): Promise<PostSummary[]> {
  const data = await get('/api/posts', signal);
  if (!Array.isArray(data)) throw new Error('Posts are unavailable. Please try again.');
  return data.map(summary).filter((p): p is PostSummary => p !== null)
    .sort((a, b) => (Date.parse(b.published_at ?? '') || 0) - (Date.parse(a.published_at ?? '') || 0) || a.id.localeCompare(b.id));
}
export async function getPublishedPost(slug: string, signal?: AbortSignal): Promise<Post> {
  if (!validPostSlug(slug)) throw new PostNotFound('Article not found');
  const value = await get(`/api/posts/${slug}`, signal);
  const post = summary(value);
  if (!post || typeof (value as Record<string, unknown>).content !== 'string') throw new PostNotFound('Article not found');
  return { ...post, content: (value as { content: string }).content };
}
