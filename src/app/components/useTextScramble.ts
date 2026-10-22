import { useEffect, useRef, useState } from 'react';
import { endMarkerFrame, revealScrambleFrame, SCRAMBLE_ONCE_MS } from './scrambleFrames.ts';

export function useTextScramble(text: string, loop = true, enabled = true) {
  const [display, setDisplay] = useState(text);
  const completed = useRef(false);
  const previousText = useRef(text);
  useEffect(() => {
    if (previousText.current !== text) { previousText.current = text; completed.current = false; }
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
    let timer: ReturnType<typeof setInterval> | undefined;
    const stop = () => { clearInterval(timer); timer = undefined; setDisplay(text); };
    const restart = () => {
      stop();
      if (!enabled || document.hidden || (!loop && completed.current)) return;
      if (reducedMotion.matches) { if (!loop) completed.current = true; return; }
      const startedAt = performance.now();
      const tick = () => {
        const elapsed = performance.now() - startedAt;
        if (!loop && elapsed >= SCRAMBLE_ONCE_MS) { completed.current = true; stop(); return; }
        setDisplay(loop ? endMarkerFrame(text, elapsed) : revealScrambleFrame(text, elapsed / SCRAMBLE_ONCE_MS));
      };
      tick();
      timer = setInterval(tick, 70);
    };
    restart();
    reducedMotion.addEventListener('change', restart);
    document.addEventListener('visibilitychange', restart);
    return () => {
      clearInterval(timer);
      reducedMotion.removeEventListener('change', restart);
      document.removeEventListener('visibilitychange', restart);
    };
  }, [text, loop, enabled]);
  return display;
}
