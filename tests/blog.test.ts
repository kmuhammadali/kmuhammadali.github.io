import { test, mock } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import { terminalFrame, terminalLength } from '../src/app/components/terminalPlayback.ts';
import { getPublishedPosts, getPublishedPost, PostNotFound } from '../src/config/postsApi.ts';
import { blogSlug, blogPath } from '../src/app/blogRouting.ts';
import { blogPage } from '../src/app/blogPagination.ts';
import { publicationDate } from '../src/app/publicationDate.ts';
import { endMarkerFrame, SCRAMBLE_CYCLE_MS, SCRAMBLE_HOLD_MS } from '../src/app/components/scrambleFrames.ts';
import { pageTitle } from '../src/config/pageTitle.ts';

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


test('blog pages show three ordered posts and hide pagination for up to three posts', () => {
  const posts = ['newest', 'second', 'third', 'fourth', 'fifth', 'sixth', 'oldest'];
  for (const [page, expected] of [[0, posts.slice(0, 3)], [1, posts.slice(3, 6)], [2, posts.slice(6)]] as const) {
    const result = blogPage(posts, page);
    assert.deepEqual(result.posts, expected);
    assert.equal(result.pageCount, 3);
  }
  assert.deepEqual(blogPage(posts, 99).posts, ['oldest']);
  assert.deepEqual(blogPage(posts, -1).posts, posts.slice(0, 3));
  assert.deepEqual(blogPage([], 2), { page: 0, pageCount: 0, posts: [] });
  for (const count of [1, 2, 3]) {
    const result = blogPage(posts.slice(0, count), 2);
    assert.equal(result.pageCount, 1);
    assert.equal(result.page, 0);
    assert.equal(result.posts.length, count);
  }
  assert.equal(blogPage(posts.slice(0, 4), 0).pageCount, 2);
  assert.deepEqual(posts, ['newest', 'second', 'third', 'fourth', 'fifth', 'sixth', 'oldest']);
});

test('publication dates are readable, timezone-stable and gracefully handle absent/invalid dates', () => {
  assert.deepEqual(publicationDate('2026-10-22T00:30:00Z'), { label: 'October 22, 2026', dateTime: '2026-10-22T00:30:00Z' });
  assert.equal(publicationDate('2026-10-22T23:30:00-05:00').label, 'October 23, 2026');
  for (const value of [null, '', 'not-a-date']) {
    assert.deepEqual(publicationDate(value), { label: 'Publication date unavailable', dateTime: undefined });
  }
});

test('end marker scramble loops, preserves spaces and width, and returns to its original text', () => {
  const label = '// END OF PAGE';
  assert.equal(endMarkerFrame(label, 0), label);
  const randomFrame = endMarkerFrame(label, SCRAMBLE_HOLD_MS, () => 0);
  assert.notEqual(randomFrame, label);
  assert.equal(randomFrame.length, label.length);
  for (let elapsed = SCRAMBLE_HOLD_MS; elapsed < SCRAMBLE_CYCLE_MS; elapsed += 60) {
    const frame = endMarkerFrame(label, elapsed, () => 0);
    assert.equal(frame.length, label.length);
    assert.equal(frame[2], ' ');
    assert.equal(frame[6], ' ');
    assert.equal(frame[9], ' ');
  }
  assert.ok(endMarkerFrame(label, SCRAMBLE_CYCLE_MS - 1, () => 0).startsWith(label.slice(0, -1)));
  assert.equal(endMarkerFrame(label, SCRAMBLE_CYCLE_MS), label);
  assert.notEqual(endMarkerFrame(label, SCRAMBLE_CYCLE_MS + SCRAMBLE_HOLD_MS, () => 0), label);
});

test('browser titles stay independent of CMS branding and restore the fixed main-page title', () => {
  assert.equal(pageTitle(), 'Muhammad Ali');
  assert.equal(pageTitle('Where Economics Meets Technology'), 'Where Economics Meets Technology | Muhammad Ali');
  for (const path of ['context/ContentProvider.tsx', 'main.tsx']) {
    const source = readFileSync(new URL(`../src/${path}`, import.meta.url), 'utf8');
    assert.ok(!source.includes('document.title'), 'CMS refresh and bootstrap must not race route titles');
  }
  const article = readFileSync(new URL('../src/app/components/BlogArticle.tsx', import.meta.url), 'utf8');
  assert.ok(!article.includes('content.name'));
  assert.ok(article.includes('document.title = pageTitle(post?.title)'));
  assert.ok(article.includes('document.title = SITE_TITLE'));
});
