import { useEffect, useState, type RefObject } from 'react';
import { terminalFrame, terminalLength } from './terminalPlayback.ts';

// Module lifetime is one document load; switching sections never restarts playback.
let startedAt: number | undefined;
let completed = false;
export function useTerminalPlayback(lines: string[], ready: boolean, element?: RefObject<HTMLElement | null>) {
  const [now, setNow] = useState(Date.now);
  const length = terminalLength(lines);
  useEffect(() => {
    if (!ready) return;
    startedAt ??= Date.now();
    const tick = () => {
      const time = Date.now();
      if (Math.floor((time - startedAt!) / 45) >= length) completed = true;
      setNow(time);
      return completed;
    };
    let timer: ReturnType<typeof setInterval> | undefined;
    let visible = true;
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)');
    const update = () => {
      clearInterval(timer); timer = undefined;
      element?.current?.toggleAttribute('data-terminal-active', !document.hidden && visible);
      if (document.hidden || !visible) return;
      if (reduced.matches) { completed = true; setNow(Infinity); return; }
      if (completed) return;
      if (!tick()) timer = setInterval(() => { if (tick()) clearInterval(timer); }, 45);
    };
    const observer = element?.current && typeof IntersectionObserver !== 'undefined' ? new IntersectionObserver(entries => {
      visible = entries.some(entry => entry.isIntersecting); update();
    }) : undefined;
    if (observer && element?.current) observer.observe(element.current);
    update();
    document.addEventListener('visibilitychange', update);
    reduced.addEventListener('change', update);
    return () => {
      clearInterval(timer); observer?.disconnect();
      element?.current?.removeAttribute('data-terminal-active');
      document.removeEventListener('visibilitychange', update);
      reduced.removeEventListener('change', update);
    };
  }, [ready, length, element]);
  return terminalFrame(lines, completed ? Infinity : startedAt === undefined ? 0 : Math.floor((now - startedAt) / 45));
}
