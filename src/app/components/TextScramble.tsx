import { useEffect, useRef, useState } from 'react';
import { useTextScramble } from './useTextScramble';
import { scrambleColor } from './scrambleFrames';
import '../../styles/cinematic.css';

export function TextScramble({ text, loop = false, className = '' }: { text: string; loop?: boolean; className?: string }) {
  const element = useRef<HTMLSpanElement>(null);
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const target = element.current;
    if (!target) return;
    if (typeof IntersectionObserver === 'undefined') { setVisible(true); return; }
    const observer = new IntersectionObserver(entries => {
      if (entries.some(entry => entry.isIntersecting)) {
        setVisible(true);
        if (!loop) observer.disconnect();
      } else if (loop) setVisible(false);
    }, { threshold: 0.1 });
    observer.observe(target);
    return () => observer.disconnect();
  }, [loop]);
  const display = useTextScramble(text, loop, visible);
  const originalGlyphs = [...text], displayGlyphs = [...display];
  return (
    <span ref={element} data-scramble-text data-end-marker={loop ? '' : undefined} className={`scramble-text ${className}`}>
      <span aria-hidden="true" className="scramble-text__measure">{text}</span>
      <span aria-hidden="true" className="scramble-text__visual">
        {displayGlyphs.map((character, index) => <span key={index} style={{ color: scrambleColor(originalGlyphs[index] ?? '', character, index) }}>{character}</span>)}
      </span>
      <span className="sr-only">{text}</span>
    </span>
  );
}
