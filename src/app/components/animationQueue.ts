/** One visible heading at a time. Entries are batched and ordered by document position. */
export function createAnimationQueue() {
  type Entry = { element: Element; start: () => void; finish: () => void };
  const waiting = new Set<Entry>();
  let active: Entry | undefined;
  let timer: ReturnType<typeof setTimeout> | undefined;
  const advance = () => {
    timer = undefined;
    if (active || !waiting.size) return;
    active = [...waiting].sort((a, b) =>
      a.element.compareDocumentPosition(b.element) & 4 ? -1 : 1)[0];
    waiting.delete(active);
    active.start();
    timer = setTimeout(() => {
      const done = active;
      active = undefined;
      done?.finish();
      advance();
    }, 1200);
  };
  return {
    add(element: Element, start: () => void, finish: () => void) {
      const entry = { element, start, finish };
      waiting.add(entry);
      if (!active && timer === undefined) timer = setTimeout(advance, 0);
      return () => {
        waiting.delete(entry);
        if (active === entry) {
          clearTimeout(timer); active = undefined; timer = undefined;
        }
        if (!active && !waiting.size) { clearTimeout(timer); timer = undefined; }
        else if (!active && timer === undefined) timer = setTimeout(advance, 0);
      };
    },
  };
}
export const headingAnimations = createAnimationQueue();
