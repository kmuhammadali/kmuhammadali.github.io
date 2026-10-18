import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { siteContent } from '../src/config/siteContent.ts';
const baseline = JSON.parse(readFileSync(new URL('./design-baseline.json', import.meta.url), 'utf8'));
test('original styles and Home/Contact/Header/gallery visible class lists are unchanged', () => {
  for (const [path, expected] of Object.entries(baseline.css)) {
    assert.equal(createHash('sha256').update(readFileSync(new URL(`../src/${path}`, import.meta.url))).digest('hex'), expected);
  }
  for (const [name, expected] of Object.entries(baseline.classes)) {
    const source = readFileSync(new URL(`../src/app/components/${name}.tsx`, import.meta.url), 'utf8');
    assert.deepEqual([...source.slice(source.indexOf('  return (')).matchAll(/className="([^"]*)"/g)].map(match => match[1]), expected);
  }
});
test('navigation and three original Home cards target all requested sections', () => {
  assert.deepEqual(siteContent.navigation.map(item => item.label), ['Home', 'About', 'Skills', 'Contact']);
  assert.deepEqual(siteContent.home.cards.map(item => item.section), ['about', 'skills', 'contact']);
  assert.equal(siteContent.name, 'Muhammad Ali');
});
