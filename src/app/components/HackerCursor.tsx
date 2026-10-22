import { useEffect, useRef, useState } from 'react';
import { installPortfolioCursor } from './cursorController';
import '../../styles/cinematic.css';
export function HackerCursor() {
  const layer = useRef<HTMLDivElement>(null), point = useRef<HTMLDivElement>(null), halo = useRef<HTMLDivElement>(null);
  const nextId = useRef(0);
  const [ripples, setRipples] = useState<{ id: number; x: number; y: number }[]>([]);
  useEffect(() => {
    const host = layer.current?.closest<HTMLElement>('[data-public-portfolio]');
    if (!host || !layer.current || !point.current || !halo.current) return;
    return installPortfolioCursor({ host, layer: layer.current, point: point.current, halo: halo.current,
      onRipple: (x, y) => { const id = ++nextId.current; setRipples(previous => [...previous.slice(-2), { id, x, y }]); },
    });
  }, []);
  return <div ref={layer} className="hacker-cursor" aria-hidden="true">
    <div ref={point} className="hacker-cursor__point" />
    <div ref={halo} className="hacker-cursor__halo"><span /></div>
    {ripples.map(ripple => <span key={ripple.id} className="hacker-cursor__ripple" style={{ left: ripple.x, top: ripple.y }}
      onAnimationEnd={() => setRipples(previous => previous.filter(item => item.id !== ripple.id))} />)}
  </div>;
}
