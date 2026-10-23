import { useLayoutEffect, useState, type RefObject } from 'react';

export interface GlyphBox { left: number; top: number; width: number; height: number }
/** Read the original text once, never the changing animation layer. */
export function measureGlyphs(measure: HTMLElement, origin: HTMLElement, text: string): GlyphBox[] {
  const node = measure.firstChild;
  if (!node) return [];
  const bounds = origin.getBoundingClientRect(), range = measure.ownerDocument.createRange();
  let offset = 0;
  return [...text].map(glyph => {
    range.setStart(node, offset); offset += glyph.length; range.setEnd(node, offset);
    const box = range.getBoundingClientRect();
    return { left: box.left - bounds.left, top: box.top - bounds.top, width: box.width, height: box.height };
  });
}
export function useScrambleLayout(element: RefObject<HTMLSpanElement | null>, text: string) {
  const [layout, setLayout] = useState<{ text: string; boxes: GlyphBox[] } | null>(null);
  useLayoutEffect(() => {
    const target = element.current, measure = target?.querySelector<HTMLElement>('.scramble-text__measure');
    if (!target || !measure) return;
    const desktop = window.matchMedia('(min-width: 768px)');
    const update = () => {
      if (!desktop.matches) { setLayout(null); return; }
      const boxes = measureGlyphs(measure, target, text);
      setLayout(previous => previous?.text === text && JSON.stringify(previous.boxes) === JSON.stringify(boxes) ? previous : { text, boxes });
    };
    update();
    const observer = new ResizeObserver(update); observer.observe(measure);
    desktop.addEventListener('change', update);
    document.fonts?.addEventListener('loadingdone', update);
    return () => {
      observer.disconnect(); desktop.removeEventListener('change', update);
      document.fonts?.removeEventListener('loadingdone', update);
    };
  }, [element, text]);
  return layout?.text === text ? layout.boxes : null;
}
