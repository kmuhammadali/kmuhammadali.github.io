import { test } from 'node:test';
import assert from 'node:assert/strict';
import { getMatrixGrid } from '../src/app/components/matrixGrid.ts';
import { siteContent } from '../src/config/siteContent.ts';

test('terminal navigation keeps the four requested destinations and filename labels', () => {
  assert.deepEqual(siteContent.navigation.map(({ id, command }) => [id, `./${command}`]), [
    ['home', './home.exe'], ['about', './about.sys'], ['skills', './skills.mov'], ['contact', './contact.sh'],
  ]);
});

test('Matrix covers mobile, desktop, wide, tall and fractional bounds at the original glyph size', () => {
  for (const [width, height] of [[320, 1200], [390, 1040], [768, 1024], [1280, 900], [1706, 1440], [2560, 1440], [375.5, 981.25]]) {
    const cellWidth = 10.5;
    const cellHeight = 10.5;
    const { columns, rows } = getMatrixGrid(width, height, cellWidth, cellHeight);
    assert.ok(columns * cellWidth >= width);
    assert.ok(rows * cellHeight >= height);
    assert.ok((columns - 1) * cellWidth < width);
    assert.ok((rows - 1) * cellHeight < height);
  }
});
