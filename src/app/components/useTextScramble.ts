import { useEffect, useState } from 'react';
import { endMarkerFrame } from './scrambleFrames.ts';

export function useTextScramble(text: string) {
  const [display, setDisplay] = useState(text);
  useEffect(() => {
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
    let timer: ReturnType<typeof setInterval> | undefined;
    const restart = () => {
      clearInterval(timer);
      setDisplay(text);
      if (reducedMotion.matches || document.hidden) return;
      const startedAt = performance.now();
      timer = setInterval(() => setDisplay(endMarkerFrame(text, performance.now() - startedAt)), 60);
    };
    restart();
    reducedMotion.addEventListener('change', restart);
    document.addEventListener('visibilitychange', restart);
    return () => {
      clearInterval(timer);
      reducedMotion.removeEventListener('change', restart);
      document.removeEventListener('visibilitychange', restart);
    };
  }, [text]);
  return display;
}
