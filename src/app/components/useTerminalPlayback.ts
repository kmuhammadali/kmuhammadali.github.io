import { useEffect, useState } from 'react';
import { terminalFrame, terminalLength } from './terminalPlayback';

// Module lifetime is one document load; switching sections never restarts playback.
let startedAt: number | undefined;
let completed = false;
export function useTerminalPlayback(lines: string[], ready: boolean) {
  const [now, setNow] = useState(Date.now);
  const length = terminalLength(lines);
  useEffect(() => {
    if (!ready || completed) return;
    startedAt ??= Date.now();
    const tick = () => {
      const time = Date.now();
      if (Math.floor((time - startedAt!) / 45) >= length) completed = true;
      setNow(time);
      return completed;
    };
    if (tick()) return;
    const timer = setInterval(() => { if (tick()) clearInterval(timer); }, 45);
    return () => clearInterval(timer);
  }, [ready, length]);
  return terminalFrame(lines, completed ? Infinity : startedAt === undefined ? 0 : Math.floor((now - startedAt) / 45));
}
