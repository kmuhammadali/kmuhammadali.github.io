import { test } from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';
import { act, createElement } from 'react';
import { createRoot } from 'react-dom/client';
import { useTextScramble } from '../src/app/components/useTextScramble.ts';

test('scramble respects initial/dynamic reduced motion, stops when hidden and cleans up on unmount', async t => {
  const dom = new JSDOM('<div id="root"></div>', { pretendToBeVisual: true });
  Object.assign(globalThis, { window: dom.window, document: dom.window.document, IS_REACT_ACT_ENVIRONMENT: true });
  const motionListeners = new Set<() => void>();
  let reduced = true, hidden = false, now = 0;
  let tick: (() => void) | null = null;
  Object.defineProperty(dom.window.document, 'hidden', { get: () => hidden });
  Object.defineProperty(dom.window, 'matchMedia', { value: () => ({
    get matches() { return reduced; },
    addEventListener: (_: string, listener: () => void) => motionListeners.add(listener),
    removeEventListener: (_: string, listener: () => void) => motionListeners.delete(listener),
  }) });
  t.mock.method(performance, 'now', () => now);
  t.mock.method(globalThis, 'setInterval', (fn: () => void) => { tick = fn; return 1 as unknown as ReturnType<typeof setInterval>; });
  t.mock.method(globalThis, 'clearInterval', () => { tick = null; });
  function Harness() { return createElement('span', null, useTextScramble('// END OF PAGE')); }
  const node = dom.window.document.getElementById('root')!;
  const root = createRoot(node);
  await act(async () => { root.render(createElement(Harness)); });
  assert.equal(node.textContent, '// END OF PAGE');
  assert.equal(tick, null, 'reduced motion must not schedule animation');
  await act(async () => { reduced = false; motionListeners.forEach(listener => listener()); });
  assert.ok(tick);
  await act(async () => { now = 2500; (tick as (() => void) | null)?.(); });
  assert.notEqual(node.textContent, '// END OF PAGE');
  await act(async () => { hidden = true; dom.window.document.dispatchEvent(new dom.window.Event('visibilitychange')); });
  assert.equal(tick, null);
  assert.equal(node.textContent, '// END OF PAGE');
  await act(async () => { hidden = false; dom.window.document.dispatchEvent(new dom.window.Event('visibilitychange')); });
  assert.ok(tick);
  await act(async () => { reduced = true; motionListeners.forEach(listener => listener()); });
  assert.equal(tick, null);
  assert.equal(node.textContent, '// END OF PAGE');
  await act(async () => { root.unmount(); });
  assert.equal(motionListeners.size, 0);
  assert.equal(tick, null);
  dom.window.close();
});

test('one-time headings stop scheduling frames and do not replay on visibility changes; new text animates once', async t => {
  const dom = new JSDOM('<div id="root"></div>', { pretendToBeVisual: true });
  Object.assign(globalThis, { window: dom.window, document: dom.window.document, IS_REACT_ACT_ENVIRONMENT: true });
  let now = 0, tick: (() => void) | null = null;
  Object.defineProperty(dom.window, 'matchMedia', { value: () => ({ matches: false, addEventListener() {}, removeEventListener() {} }) });
  t.mock.method(performance, 'now', () => now);
  t.mock.method(globalThis, 'setInterval', (fn: () => void) => { tick = fn; return 1 as unknown as ReturnType<typeof setInterval>; });
  t.mock.method(globalThis, 'clearInterval', () => { tick = null; });
  function Heading({ text, enabled }: { text: string; enabled: boolean }) {
    return createElement('span', null, useTextScramble(text, false, enabled));
  }
  const node = dom.window.document.getElementById('root')!, root = createRoot(node);
  await act(async () => root.render(createElement(Heading, { text: 'ABOUT', enabled: false })));
  assert.equal(tick, null, 'offscreen headings do not animate');
  await act(async () => root.render(createElement(Heading, { text: 'ABOUT', enabled: true })));
  assert.notEqual(node.textContent, 'ABOUT');
  await act(async () => { now = 1200; (tick as (() => void) | null)?.(); });
  assert.equal(node.textContent, 'ABOUT');
  assert.equal(tick, null, 'one-shot timer stops after resolving');
  await act(async () => dom.window.document.dispatchEvent(new dom.window.Event('visibilitychange')));
  assert.equal(tick, null, 'completed titles do not restart on refocus');
  await act(async () => root.render(createElement(Heading, { text: 'SKILLS', enabled: true })));
  assert.ok(tick, 'new heading gets its own animation');
  await act(async () => { now = 2400; (tick as (() => void) | null)?.(); });
  assert.equal(node.textContent, 'SKILLS');
  assert.equal(tick, null);
  await act(async () => root.unmount());
  dom.window.close();
});

test('long multiline titles restore exactly; stale ticks cannot overwrite replacement titles', async t => {
  const dom = new JSDOM('<div id="root"></div>', { pretendToBeVisual: true });
  Object.assign(globalThis, { window: dom.window, document: dom.window.document, IS_REACT_ACT_ENVIRONMENT: true });
  Object.defineProperty(dom.window, 'matchMedia', { value: () => ({ matches: false, addEventListener() {}, removeEventListener() {} }) });
  let now = 0, next = 0;
  const timers = new Map<number, () => void>();
  t.mock.method(performance, 'now', () => now);
  t.mock.method(globalThis, 'setInterval', (fn: () => void) => { timers.set(++next, fn); return next as unknown as ReturnType<typeof setInterval>; });
  t.mock.method(globalThis, 'clearInterval', (id: number) => { timers.delete(id); });
  function Heading({ text }: { text: string }) { return createElement('span', null, useTextScramble(text, false, true)); }
  const node = document.getElementById('root')!, root = createRoot(node);
  await act(async () => root.render(createElement(Heading, { text: 'Old post' })));
  const staleTick = [...timers.values()][0];
  const title = 'Where Economics Meets Technology\nA longer second line 🌐';
  await act(async () => root.render(createElement(Heading, { text: title })));
  assert.equal(timers.size, 1, 'only the current title owns a timer');
  const currentTick = [...timers.values()][0];
  await act(async () => { now = 1200; currentTick(); staleTick(); });
  assert.equal(node.textContent, title);
  assert.equal(timers.size, 0);
  await act(async () => staleTick());
  assert.equal(node.textContent, title);
  await act(async () => root.unmount());
  assert.equal(timers.size, 0); dom.window.close();
});
