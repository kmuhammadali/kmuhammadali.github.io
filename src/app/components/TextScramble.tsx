import { useEffect, useRef, useState } from 'react';
import { useScrambleLayout } from './useScrambleLayout';
import { useTextScramble } from './useTextScramble';
import { headingAnimations } from './animationQueue';
import { scrambleColor } from './scrambleFrames';
import '../../styles/cinematic.css';

export function TextScramble({ text, loop = false, className = '' }: { text: string; loop?: boolean; className?: string }) {
  const element = useRef<HTMLSpanElement>(null);
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const target = element.current;
    if (!target) return;
    let completed = false, intersecting = false;
    let cancel: (() => void) | undefined;
    const update = () => {
      cancel?.(); cancel = undefined;
      setVisible(false);
      if (!intersecting || document.hidden || completed) return;
      if (loop) { setVisible(true); return; }
      if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) { completed = true; return; }
      cancel = headingAnimations.add(target, () => setVisible(true), () => {
        completed = true; setVisible(false); cancel = undefined;
      });
    };
    // Observe the whole post so short titles don't start while their card is offscreen.
    const observed = target.closest('[data-blog-post]') ?? target;
    const observer = typeof IntersectionObserver === 'undefined' ? undefined : new IntersectionObserver(entries => {
      const next = entries.some(entry => entry.isIntersecting);
      if (next !== intersecting) { intersecting = next; update(); }
    }, { threshold: 0.1 });
    if (observer) observer.observe(observed);
    else { intersecting = true; update(); }
    document.addEventListener('visibilitychange', update);
    return () => { observer?.disconnect(); cancel?.(); document.removeEventListener('visibilitychange', update); };
  }, [loop, text]);
  const boxes = useScrambleLayout(element, text);
  const display = useTextScramble(text, loop, visible);
  const originalGlyphs = [...text], displayGlyphs = [...display];
  return (
    <span ref={element} data-scramble-text data-scrambling={display !== text ? '' : undefined} data-end-marker={loop ? '' : undefined} className={`scramble-text ${className}`}>
      <span aria-hidden="true" className="scramble-text__measure">{text}</span>
      <span aria-hidden="true" className="scramble-text__visual">
        {displayGlyphs.map((character, index) => <span key={index} style={{ ...(boxes?.[index] ? { position: 'absolute', ...boxes[index], lineHeight: `${boxes[index].height}px`, whiteSpace: 'pre', overflow: 'hidden' } : {}), color: scrambleColor(originalGlyphs[index] ?? '', character, index) }}>{character}</span>)}
      </span>
      <span className="sr-only">{text}</span>
    </span>
  );
}
