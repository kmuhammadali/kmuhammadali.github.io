import { test } from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';

const dom = new JSDOM('<!doctype html><html><body></body></html>', { url: 'https://portfolio.test' });
Object.assign(globalThis, { window: dom.window, document: dom.window.document, Node: dom.window.Node,
  HTMLElement: dom.window.HTMLElement, Element: dom.window.Element, MutationObserver: dom.window.MutationObserver,
  getComputedStyle: dom.window.getComputedStyle });
Object.defineProperty(globalThis, 'navigator', { configurable: true, value: dom.window.navigator });
const { postContentHtml, sanitizePostHtml, saveRichText, safeContentUrl, RICH_TEXT_PREFIX } = await import('../src/content/postContent.ts');
const { Editor } = await import('@tiptap/core');
const { default: StarterKit } = await import('@tiptap/starter-kit');
const { default: Image } = await import('@tiptap/extension-image');
const parse = (html: string) => new JSDOM(html).window.document.body;

test('legacy Markdown renders semantic headings, paragraphs, nested lists, links and formatting', () => {
  const markdown = '# Main\n\n## Section\n\n### Detail\n\nParagraph **bold**, *italic*, ~~removed~~ and [link](https://example.com).\n\n- One\n  - Nested\n- Two\n\n1. First\n2. Second\n\n> Quoted\n\n```js\nconst safe = "<script>";\n```';
  const body = parse(postContentHtml(markdown));
  assert.equal(body.querySelector('h1')?.textContent, 'Main');
  assert.equal(body.querySelector('h2')?.textContent, 'Section');
  assert.equal(body.querySelector('h3')?.textContent, 'Detail');
  assert.equal(body.querySelector('strong')?.textContent, 'bold');
  assert.equal(body.querySelector('em')?.textContent, 'italic');
  assert.equal(body.querySelector('del')?.textContent, 'removed');
  assert.equal(body.querySelectorAll('ul li').length, 3);
  assert.equal(body.querySelectorAll('ol li').length, 2);
  assert.equal(body.querySelector('a')?.getAttribute('href'), 'https://example.com');
  assert.equal(body.querySelector('blockquote')?.textContent?.trim(), 'Quoted');
  assert.match(body.querySelector('pre code')?.textContent ?? '', /<script>/);
  assert.equal(body.querySelector('script'), null);
});

test('both formats remove executable markup, clobbering, CSS, embeds and unsafe URLs', () => {
  const payload = '<script>alert(1)</script><svg onload="alert(1)"></svg><iframe src="https://evil.test"></iframe>' +
    '<p id="location" style="position:fixed" onclick="alert(1)">Safe text</p>' +
    '<a href="jav&#97;script:alert(1)">bad</a><a href="data:text/html,bad">data</a>' +
    '<img src="https://example.com/good.png" onerror="alert(1)"><img src="http://example.com/bad.png">' +
    '<img src="data:image/svg+xml,bad"><img src="//example.com/bad.png"><form><input name="cookie"></form>';
  for (const content of [payload, RICH_TEXT_PREFIX + payload]) {
    const body = parse(postContentHtml(content));
    assert.equal(body.querySelector('script,svg,iframe,form,input,[onclick],[onerror],[id],[style]'), null);
    assert.ok([...body.querySelectorAll('a')].every(a => !a.hasAttribute('href')));
    assert.equal(body.querySelectorAll('img').length, 1);
    assert.equal(body.querySelector('img')?.getAttribute('referrerpolicy'), 'no-referrer');
    assert.match(body.textContent ?? '', /Safe text/);
  }
  assert.equal(safeContentUrl('https://user:password@example.com'), false);
  assert.equal(safeContentUrl('mailto:hello@example.com'), true);
  assert.equal(safeContentUrl('javascript:alert(1)'), false);
});

test('rich text is versioned, sanitized and stable across save/load cycles including underline and images', () => {
  const saved = saveRichText('<h1>Heading</h1><p><u>underlined</u> <s>struck</s></p><ol start="3"><li>Item</li></ol>' +
    '<img src="https://example.com/image.png" alt="A description"><a href="https://example.com">Link</a>');
  assert.ok(saved.startsWith(RICH_TEXT_PREFIX));
  assert.equal(saveRichText(postContentHtml(saved)), saved);
  const body = parse(postContentHtml(saved));
  assert.equal(body.querySelector('u')?.textContent, 'underlined');
  assert.equal(body.querySelector('ol')?.getAttribute('start'), '3');
  assert.equal(body.querySelector('img')?.getAttribute('alt'), 'A description');
  assert.equal(sanitizePostHtml('<p>hello</p>'), '<p>hello</p>');
});

test('TipTap preserves legacy body on open/read-only changes, supports formatting, undo/redo and rich text reopen', () => {
  const legacy = '## Original\n\nKeep **bold** and *italic*.\n\n- One\n- Two\n\n> Quote';
  let stored = legacy;
  const create = (value: string) => new Editor({
    extensions: [StarterKit, Image], content: postContentHtml(value),
    onUpdate: ({ editor }) => { stored = saveRichText(editor.getHTML()); },
  });
  const editor = create(legacy);
  try {
    editor.setEditable(false, false); editor.setEditable(true, false);
    assert.equal(stored, legacy, 'opening and saving metadata must not rewrite legacy Markdown');
    editor.commands.setTextSelection({ from: 1, to: 9 });
    editor.commands.toggleUnderline();
    assert.match(stored, /<u>Original<\/u>/);
    assert.match(stored, /<strong>bold<\/strong>/);
    editor.commands.undo();
    assert.doesNotMatch(stored, /<u>/);
    editor.commands.redo();
    assert.match(stored, /<u>/);
    editor.commands.insertContent('<p><s>Removed</s></p>');
    const reopened = create(stored);
    try {
      const body = parse(reopened.getHTML());
      assert.equal(body.querySelectorAll('ul li').length, 2);
      assert.equal(body.querySelector('blockquote')?.textContent, 'Quote');
      assert.equal(body.querySelector('s')?.textContent, 'Removed');
    } finally { reopened.destroy(); }
  } finally { editor.destroy(); }
});
