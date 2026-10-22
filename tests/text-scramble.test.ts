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
