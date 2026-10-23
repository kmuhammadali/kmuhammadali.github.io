import { test } from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';
import { installPortfolioCursor } from '../src/app/components/cursorController.ts';
import { revealScrambleFrame, scrambleColor } from '../src/app/components/scrambleFrames.ts';

test('cursor follows mouse, detects controls and clicks, restores native cursor for touch/reduced motion/keyboard, and cleans up', () => {
  const dom = new JSDOM('<div id="host"><button>Click</button><div id="layer"><i id="point"></i><i id="halo"></i></div></div>', { pretendToBeVisual: true });
  const win = dom.window;
  const nodes = (id: string) => win.document.getElementById(id)!;
  let fine = true, reduced = false, ripples = 0;
  const listeners = new Set<() => void>(), frames = new Map<number, FrameRequestCallback>();
  let nextFrame = 0;
  Object.defineProperty(win, 'matchMedia', { value: (query: string) => ({
    get matches() { return query.includes('reduced-motion') ? reduced : fine; },
    addEventListener: (_: string, listener: () => void) => listeners.add(listener),
    removeEventListener: (_: string, listener: () => void) => listeners.delete(listener),
  }) });
  win.requestAnimationFrame = callback => { frames.set(++nextFrame, callback); return nextFrame; };
  win.cancelAnimationFrame = id => { frames.delete(id); };
  const cleanup = installPortfolioCursor({ host: nodes('host'), layer: nodes('layer'), point: nodes('point'), halo: nodes('halo'), onRipple: () => ripples++ });
  const button = win.document.querySelector('button')!;
  function pointer(type: string, pointerType = 'mouse') {
    const event = new win.MouseEvent(type, { bubbles: true, clientX: 120, clientY: 80 });
    Object.defineProperty(event, 'pointerType', { value: pointerType });
    button.dispatchEvent(event);
    assert.equal(event.defaultPrevented, false, 'native actions must remain intact');
  }
  pointer('pointermove');
  assert.ok(nodes('host').hasAttribute('data-custom-cursor'));
  assert.ok(nodes('layer').hasAttribute('data-interactive'));
  pointer('pointermove'); pointer('pointermove');
  assert.equal(nodes('point').style.transform, '', 'pointer events coalesce DOM writes into a frame');
  const [id, draw] = [...frames][0]; frames.delete(id); draw(16.67);
  assert.match(nodes('point').style.transform, /120px, 80px/);
  pointer('pointermove');
  assert.equal(frames.size, 1, 'only one movement frame is scheduled');
  pointer('pointerdown'); assert.equal(ripples, 1);
  pointer('pointermove', 'touch');
  assert.ok(!nodes('host').hasAttribute('data-custom-cursor'));
  assert.equal(frames.size, 0);
  pointer('pointerdown', 'touch'); assert.equal(ripples, 1);
  fine = false; listeners.forEach(listener => listener()); pointer('pointermove');
  assert.ok(!nodes('host').hasAttribute('data-custom-cursor'));
  fine = true; reduced = true; listeners.forEach(listener => listener()); pointer('pointerdown');
  assert.equal(ripples, 1);
  reduced = false; pointer('pointermove');
  win.document.dispatchEvent(new win.KeyboardEvent('keydown', { key: 'Tab' }));
  assert.ok(!nodes('host').hasAttribute('data-custom-cursor'));
  pointer('pointermove'); cleanup(); pointer('pointermove');
  assert.ok(!nodes('host').hasAttribute('data-custom-cursor'));
  assert.equal(frames.size, 0); assert.equal(listeners.size, 0);
  dom.window.close();
});

test('cinematic glyphs use the requested palette, preserve Unicode/spacing, and settle to the inherited color', () => {
  const colors = new Set(Array.from({ length: 16 }, (_, index) => scrambleColor('A', '!', index)));
  assert.deepEqual(colors, new Set(['#00ff41', '#00e5ff', '#518dff', '#c084fc', '#ffffff']));
  assert.equal(scrambleColor('A', 'A', 0), undefined);
  assert.equal(scrambleColor(' ', ' ', 1), undefined);
  const label = 'Hello 🌐 world';
  for (const progress of [0, 0.25, 0.5, 0.75, 1]) {
    const frame = revealScrambleFrame(label, progress, () => 0);
    assert.equal([...frame].length, [...label].length);
    assert.equal([...frame][5], ' ');
    assert.equal([...frame][7], ' ');
  }
  assert.equal(revealScrambleFrame(label, 1), label);
});
