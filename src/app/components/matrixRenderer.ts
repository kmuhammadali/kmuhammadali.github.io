export const MATRIX_FRAME_MS = 500; // Original binary cadence; at most two paints per second.
export function installMatrix(canvas: HTMLCanvasElement) {
  const doc = canvas.ownerDocument, win = doc.defaultView!;
  const context = canvas.getContext('2d');
  if (!context) return () => {};
  const reduced = win.matchMedia('(prefers-reduced-motion: reduce)');
  const atlas = doc.createElement('canvas'), ink = atlas.getContext('2d');
  if (!ink) return () => {};
  let timer = 0, frame = 0, disposed = false, width = 0, height = 0, cell = 12, ratio = 1;
  const size = () => {
    const bounds = canvas.getBoundingClientRect(), style = win.getComputedStyle(canvas);
    const nextRatio = Math.min(win.devicePixelRatio || 1, 1.5);
    if (width === bounds.width && height === bounds.height && ratio === nextRatio) return;
    width = bounds.width; height = bounds.height; ratio = nextRatio;
    cell = parseFloat(style.fontSize) || 12;
    canvas.width = Math.ceil(width * ratio); canvas.height = Math.ceil(height * ratio);
    context.setTransform(ratio, 0, 0, ratio, 0, 0);
    atlas.width = Math.ceil(cell * ratio) * 2; atlas.height = Math.ceil(cell * ratio);
    ink.setTransform(ratio, 0, 0, ratio, 0, 0);
    ink.font = `${cell}px ${style.fontFamily}`; ink.fillStyle = style.color; ink.textBaseline = 'top';
    ink.fillText('0', 0, 0); ink.fillText('1', atlas.width / ratio / 2, 0);
  };
  const stop = () => { win.clearTimeout(timer); win.cancelAnimationFrame(frame); timer = frame = 0; };
  const paint = () => {
    frame = 0;
    if (disposed || doc.hidden) return;
    size();
    context.clearRect(0, 0, width, height);
    const tileWidth = atlas.width / 2;
    for (let y = 0; y < height; y += cell) {
      for (let x = 0; x < width; x += cell) {
        context.drawImage(atlas, Math.random() < .5 ? 0 : tileWidth, 0, tileWidth, atlas.height, x, y, cell, cell);
      }
    }
    if (!reduced.matches) timer = win.setTimeout(() => { timer = 0; frame = win.requestAnimationFrame(paint); }, MATRIX_FRAME_MS);
  };
  const resume = () => { stop(); if (!doc.hidden) frame = win.requestAnimationFrame(paint); };
  const resize = () => { if (!frame) { win.clearTimeout(timer); timer = 0; frame = win.requestAnimationFrame(paint); } };
  resume();
  doc.addEventListener('visibilitychange', resume); reduced.addEventListener('change', resume);
  win.addEventListener('resize', resize, { passive: true });
  return () => {
    disposed = true; stop(); doc.removeEventListener('visibilitychange', resume);
    reduced.removeEventListener('change', resume); win.removeEventListener('resize', resize);
  };
}
