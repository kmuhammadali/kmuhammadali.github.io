import { test } from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';
import { act, createElement, useRef } from 'react';
import { createRoot } from 'react-dom/client';
import { useTerminalPlayback } from '../src/app/components/useTerminalPlayback.ts';

test('terminal pauses work offscreen/in hidden tabs, resumes, and removes timers and observers on unmount', async t => {
  const dom = new JSDOM('<div id="root"></div>', { pretendToBeVisual: true });
  let notify: (entries: { isIntersecting: boolean }[]) => void = () => {};
  let tick: (() => void) | undefined, disconnected = false, hidden = false, reduced = false;
  const listeners = new Set<() => void>();
  Object.assign(globalThis, { window: dom.window, document: dom.window.document, IS_REACT_ACT_ENVIRONMENT: true,
    IntersectionObserver: class {
      constructor(callback: typeof notify) { notify = callback; }
      observe() {} disconnect() { disconnected = true; }
    },
  });
  Object.defineProperty(dom.window.document, 'hidden', { get: () => hidden });
  Object.defineProperty(dom.window, 'matchMedia', { value: () => ({ get matches() { return reduced; },
    addEventListener: (_: string, listener: () => void) => listeners.add(listener),
    removeEventListener: (_: string, listener: () => void) => listeners.delete(listener),
  }) });
  t.mock.method(globalThis, 'setInterval', (fn: () => void) => { tick = fn; return 1 as unknown as ReturnType<typeof setInterval>; });
  t.mock.method(globalThis, 'clearInterval', () => { tick = undefined; });
  function Terminal() {
    const ref = useRef<HTMLDivElement>(null);
    const frame = useTerminalPlayback(['$ whoami', 'Output', '$ echo "END"'], true, ref);
    return createElement('div', { ref }, frame.map(line => line.text).join('\n'));
  }
  const root = createRoot(dom.window.document.getElementById('root')!);
  await act(async () => root.render(createElement(Terminal)));
  assert.ok(tick);
  await act(async () => notify([{ isIntersecting: false }]));
  assert.equal(tick, undefined);
  await act(async () => notify([{ isIntersecting: true }]));
  assert.ok(tick);
  await act(async () => { hidden = true; document.dispatchEvent(new dom.window.Event('visibilitychange')); });
  assert.equal(tick, undefined);
  await act(async () => { hidden = false; document.dispatchEvent(new dom.window.Event('visibilitychange')); });
  assert.ok(tick);
  await act(async () => { reduced = true; listeners.forEach(listener => listener()); });
  assert.equal(tick, undefined, 'reduced motion finishes typing without a timer');
  assert.match(dom.window.document.getElementById('root')!.textContent!, /END/);
  await act(async () => root.unmount());
  assert.equal(tick, undefined); assert.equal(listeners.size, 0); assert.equal(disconnected, true);
  const nextRoot = createRoot(dom.window.document.getElementById('root')!);
  await act(async () => { reduced = false; nextRoot.render(createElement(Terminal)); });
  assert.ok(document.querySelector('[data-terminal-active]'), 'returning Home preserves the blinking caret after playback completed');
  assert.equal(tick, undefined, 'completed commands never replay');
  await act(async () => nextRoot.unmount());
  dom.window.close();
});
