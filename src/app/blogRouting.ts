import { validPostSlug } from '../config/postsApi.ts';
export function blogPath(slug: string) { return `/blog/${encodeURIComponent(slug)}`; }
export function blogSlug(url: URL): string | null {
  const path = /^\/blog\/([a-z0-9]+(?:-[a-z0-9]+)*)\/?$/.exec(url.pathname);
  if (path) return path[1];
  const redirected = url.pathname === '/' ? url.searchParams.get('blog') : null;
  return redirected && validPostSlug(redirected) ? redirected : null;
}
