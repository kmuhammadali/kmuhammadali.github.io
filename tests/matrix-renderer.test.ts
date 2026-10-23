import { test } from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';
import { installMatrix, MATRIX_FRAME_MS } from '../src/app/components/matrixRenderer.ts';
import { measureGlyphs } from '../src/app/components/useScrambleLayout.ts';

test('Matrix caps paints, keeps one scheduled frame, covers resized bounds, pauses and cleans up', () => {
  const dom = new JSDOM('<canvas></canvas>', { pretendToBeVisual: true });
  const win = dom.window, doc = win.document, canvas = doc.querySelector('canvas')!;
  let hidden = false, reduced = false, paints = 0, tiles = 0, width = 120, id = 0;
  const frames = new Map<number, FrameRequestCallback>(), timers = new Map<number, () => void>(), listeners = new Set<() => void>();
  const context = { setTransform() {}, clearRect() { paints++; }, drawImage() { tiles++; }, fillText() {} };
  Object.defineProperty(win.HTMLCanvasElement.prototype, 'getContext', { value: () => context });
  Object.defineProperty(doc, 'hidden', { get: () => hidden });
  Object.defineProperty(win, 'devicePixelRatio', { value: 3 });
  Object.defineProperty(canvas, 'getBoundingClientRect', { value: () => ({ width, height: 120 }) });
  canvas.style.fontSize = '12px';
  Object.defineProperty(win, 'matchMedia', { value: () => ({ get matches() { return reduced; },
    addEventListener: (_: string, fn: () => void) => listeners.add(fn), removeEventListener: (_: string, fn: () => void) => listeners.delete(fn) }) });
  win.requestAnimationFrame = fn => { frames.set(++id, fn); return id; };
  win.cancelAnimationFrame = id => { frames.delete(id); };
  win.setTimeout = ((fn: () => void, delay: number) => { assert.equal(delay, MATRIX_FRAME_MS); timers.set(++id, fn); return id; }) as typeof win.setTimeout;
  win.clearTimeout = id => { if (id !== undefined) timers.delete(id); };
  const paint = () => { const [key, fn] = [...frames][0]; frames.delete(key); fn(0); };
  const cleanup = installMatrix(canvas);
  paint(); assert.equal(paints, 1); assert.equal(tiles, 100);
  assert.equal(canvas.width, 180, 'pixel ratio is capped at 1.5');
  assert.equal(frames.size, 0, 'no idle 60 FPS loop'); assert.equal(timers.size, 1);
  const [timerId, tick] = [...timers][0]; timers.delete(timerId); tick(); paint();
  assert.equal(paints, 2); assert.equal(timers.size, 1);
  hidden = true; doc.dispatchEvent(new win.Event('visibilitychange'));
  assert.equal(timers.size, 0); assert.equal(frames.size, 0);
  hidden = false; doc.dispatchEvent(new win.Event('visibilitychange')); paint();
  reduced = true; listeners.forEach(fn => fn()); paint();
  assert.equal(timers.size, 0, 'reduced motion draws only a static field');
  width = 240; win.dispatchEvent(new win.Event('resize')); paint();
  assert.equal(canvas.width, 360);
  reduced = false; listeners.forEach(fn => fn()); paint();
  cleanup(); assert.equal(timers.size, 0); assert.equal(frames.size, 0); assert.equal(listeners.size, 0);
  win.dispatchEvent(new win.Event('resize')); assert.equal(frames.size, 0);
  dom.window.close();
});

test('scrambled glyph boxes preserve original line positions and Unicode code-unit boundaries', () => {
  const dom = new JSDOM('<span id="origin"><span id="measure">A🌐 B</span></span>');
  const doc = dom.window.document, offsets: number[][] = [];
  let start = 0, end = 0;
  Object.defineProperty(doc, 'createRange', { value: () => ({
    setStart(_: Node, offset: number) { start = offset; }, setEnd(_: Node, offset: number) { end = offset; },
    getBoundingClientRect() { offsets.push([start, end]); return { left: start < 4 ? 20 + start * 8 : 20, top: start < 4 ? 10 : 30, width: 8, height: 16 }; },
  }) });
  const origin = doc.getElementById('origin')!, measure = doc.getElementById('measure')!;
  Object.defineProperty(origin, 'getBoundingClientRect', { value: () => ({ left: 20, top: 10 }) });
  const boxes = measureGlyphs(measure, origin, 'A🌐 B');
  assert.deepEqual(offsets, [[0, 1], [1, 3], [3, 4], [4, 5]]);
  assert.deepEqual(boxes.map(box => [box.left, box.top]), [[0, 0], [8, 0], [24, 0], [0, 20]]);
  dom.window.close();
});
