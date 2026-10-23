import { test } from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';
import { createAnimationQueue } from '../src/app/components/animationQueue.ts';

test('visible headings animate top to bottom, one at a time, and finish only once', context => {
  context.mock.timers.enable({ apis: ['setTimeout'] });
  const dom = new JSDOM('<h1>Top</h1><h2>Middle</h2><h3>Bottom</h3>');
  const elements = [...dom.window.document.querySelectorAll('h1,h2,h3')];
  const queue = createAnimationQueue(), events: string[] = [];
  const cleanup = [...elements].reverse().map(element => queue.add(element,
    () => events.push(`start ${element.textContent}`), () => events.push(`end ${element.textContent}`)));
  context.mock.timers.tick(0);
  assert.deepEqual(events, ['start Top']);
  context.mock.timers.tick(1200);
  assert.deepEqual(events, ['start Top', 'end Top', 'start Middle']);
  context.mock.timers.tick(1200); context.mock.timers.tick(1200);
  assert.deepEqual(events, ['start Top', 'end Top', 'start Middle', 'end Middle', 'start Bottom', 'end Bottom']);
  context.mock.timers.tick(5000);
  assert.equal(events.length, 6);
  cleanup.forEach(cancel => cancel()); dom.window.close();
});

test('offscreen, pagination and route cleanup cancel pending/active animations without blocking later entries', context => {
  context.mock.timers.enable({ apis: ['setTimeout'] });
  const dom = new JSDOM('<h1>Old</h1><h2>Hidden</h2><h3>New page</h3>');
  const elements = [...dom.window.document.querySelectorAll('h1,h2,h3')];
  const queue = createAnimationQueue(), events: string[] = [];
  const first = queue.add(elements[0], () => events.push('old'), () => events.push('old finished'));
  const hidden = queue.add(elements[1], () => events.push('hidden'), () => {});
  context.mock.timers.tick(0);
  first(); hidden();
  const next = queue.add(elements[2], () => events.push('new'), () => events.push('new finished'));
  context.mock.timers.tick(0); context.mock.timers.tick(1200);
  assert.deepEqual(events, ['old', 'new', 'new finished']);
  next(); dom.window.close();
});
