import { test, mock } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import { terminalFrame, terminalLength } from '../src/app/components/terminalPlayback.ts';
import { getPublishedPosts, getPublishedPost, PostNotFound } from '../src/config/postsApi.ts';
import { blogSlug, blogPath } from '../src/app/blogRouting.ts';

test('terminal types commands only, reveals complete outputs immediately, and ends with an active final command', () => {
  const lines = ['$ whoami', 'Complete output', '$ ls', 'file-a', 'file-b', '$ echo "I.AM.MUHAMMAD.ALI"', 'Never render this'];
  assert.deepEqual(terminalFrame(lines, 4).map(x => x.text), ['$ wh']);
  assert.deepEqual(terminalFrame(lines, 8).map(x => x.text), ['$ whoami', 'Complete output', '']);
  assert.deepEqual(terminalFrame(lines, 12).map(x => x.text), ['$ whoami', 'Complete output', '$ ls', 'file-a', 'file-b', '']);
  const frame = terminalFrame(lines, Infinity);
  assert.equal(frame.at(-1)?.text, '$ echo "I.AM.MUHAMMAD.ALI"');
  assert.equal(frame.at(-1)?.isActive, true);
  assert.equal(frame.filter(x => x.isActive).length, 1);
  assert.equal(terminalLength(lines), 8 + 4 + lines[5].length);
});

const post = { id: 'old', title: 'Old post', slug: 'old-post', excerpt: 'Excerpt', cover_image_url: null, published_at: '2026-01-01T12:00:00Z' };
test('published posts sort newest first and reject drafts, malformed slugs, and unsafe images', async () => {
  const fetch = mock.method(globalThis, 'fetch', async () => Response.json([
    post,
    { ...post, id: 'new', slug: 'new-post', published_at: '2026-10-20T12:00:00Z', cover_image_url: 'javascript:alert(1)' },
    { ...post, id: 'draft', status: 'draft' },
    { ...post, slug: '../admin' },
  ]));
  try {
    const result = await getPublishedPosts();
    assert.deepEqual(result.map(x => x.id), ['new', 'old']);
    assert.equal(result[0].cover_image_url, null);
  } finally { fetch.mock.restore(); }
});

test('article API keeps full content as text, encodes no arbitrary routes, and handles unpublished/not-found/network errors', async () => {
  const fetch = mock.method(globalThis, 'fetch', async () => Response.json({ ...post, content: '<script>plain text</script>\nFull body' }));
  try {
    assert.equal((await getPublishedPost('old-post')).content, '<script>plain text</script>\nFull body');
    await assert.rejects(getPublishedPost('../admin'), PostNotFound);
    assert.equal(fetch.mock.calls.length, 1);
  } finally { fetch.mock.restore(); }
  for (const status of [404, 503]) {
    const down = mock.method(globalThis, 'fetch', async () => new Response(null, { status }));
    try { await assert.rejects(getPublishedPost('old-post'), status === 404 ? PostNotFound : Error); }
    finally { down.mock.restore(); }
  }
});

test('GitHub Pages direct article fallback uses a fixed same-origin root and restores canonical slugs', () => {
  const html = readFileSync(new URL('../public/404.html', import.meta.url), 'utf8');
  const script = /<script>([\s\S]*?)<\/script>/.exec(html)![1];
  for (const [pathname, expected] of [['/blog/my-post', '/?blog=my-post#part'], ['/blog/my-post/', '/?blog=my-post#part'], ['/admin/', null], ['/blog/https://evil.example', null]]) {
    let target: string | null = null;
    runInNewContext(script, { location: { pathname, hash: '#part', replace: (url: string) => { target = url; } } });
    assert.equal(target, expected);
  }
  assert.equal(blogSlug(new URL('https://site.example/?blog=my-post')), 'my-post');
  assert.equal(blogSlug(new URL('https://site.example/blog/my-post#part')), 'my-post');
  assert.equal(blogSlug(new URL('https://site.example/?blog=../admin')), null);
  assert.equal(blogPath('my-post'), '/blog/my-post');
});
