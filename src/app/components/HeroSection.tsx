import { useSiteContent } from '../../context/ContentProvider';
import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { getMatrixGrid } from './matrixGrid';
import { useTerminalPlayback } from './useTerminalPlayback';
import { BlogSection } from './BlogSection';
import { Button } from './ui/button';
import { ChevronDown, Code, Terminal, Mail } from 'lucide-react';

interface HeroSectionProps {
  onSectionChange: (section: string) => void;
  onOpenPost: (slug: string) => void;
}

export function HeroSection({ onSectionChange, onOpenPost }: HeroSectionProps) {
  const { content, isLoading } = useSiteContent();
  const home = content.home;
  
  const matrixRef = useRef<HTMLDivElement>(null);
  const [matrixGrid, setMatrixGrid] = useState({ rows: 50, columns: 100 });

  useLayoutEffect(() => {
    const matrix = matrixRef.current;
    if (!matrix) return;
    const measure = () => {
      const row = matrix.firstElementChild;
      const cell = row?.firstElementChild;
      if (!row || !cell) return;
      const bounds = matrix.getBoundingClientRect();
      const cellWidth = cell.getBoundingClientRect().width;
      const cellHeight = row.getBoundingClientRect().height;
      if (!bounds.width || !bounds.height || !cellWidth || !cellHeight) return;
      const next = getMatrixGrid(bounds.width, bounds.height, cellWidth, cellHeight);
      setMatrixGrid(previous => previous.rows === next.rows && previous.columns === next.columns ? previous : next);
    };
    measure();
    if (typeof ResizeObserver !== 'undefined') {
      const observer = new ResizeObserver(measure);
      observer.observe(matrix);
      return () => observer.disconnect();
    }
    window.addEventListener('resize', measure);
    return () => window.removeEventListener('resize', measure);
  }, []);

  const [showCursor, setShowCursor] = useState(true);
  
  
const terminalLines = [
  '$ whoami',
  home.role,
  '$ ls -la portfolio/',
  ...home.directories,
  '$ cat mission.txt',
  ...home.mission,
  `$ echo "${home.typingText}"`,
];

const frame = useTerminalPlayback(terminalLines, !isLoading);

  useEffect(() => {
    const cursorTimer = setInterval(() => {
      setShowCursor(prev => !prev);
    }, 500);

    return () => clearInterval(cursorTimer);
  }, []);

  return (
    <section className="min-h-screen flex items-center justify-center relative matrix-bg">
      <div className="container mx-auto px-4 text-center">
        <div className="max-w-4xl mx-auto">
          
          {/* Terminal Window */}
          <div className="cyber-border bg-black-light/50 rounded-lg p-8 mb-8">
            <div className="flex items-center space-x-2 mb-6 pb-4 border-b border-primary/20">
              <div className="w-3 h-3 rounded-full bg-red-500"></div>
              <div className="w-3 h-3 rounded-full bg-yellow-500"></div>
              <div className="w-3 h-3 rounded-full bg-primary"></div>
              <span className="ml-4 font-mono text-sm text-muted-foreground">
                {home.terminal}
              </span>
            </div>

            <div className="text-left space-y-2 font-mono">
              {frame.map(({ text, isCommand, isActive }, index) => {
                return (
                  <div
                    key={index}
                    className={isCommand ? 'text-primary' : 'text-green-dark'}
                  >
                    {text}
                    {isActive && showCursor && (
                      <span className="text-primary">_</span>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          <BlogSection onOpenPost={onOpenPost} />

          {/* Action Buttons */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-12">
            <Button
              onClick={() => onSectionChange(home.cards[0].section)}
              className="cyber-border bg-black-light hover:bg-primary/10 text-primary border-primary p-6 h-auto flex flex-col items-center space-y-2 transition-all duration-300 hover:shadow-lg hover:shadow-primary/20"
              variant="outline"
            >
              <Code className="w-8 h-8" />
              <span>{home.cards[0].title}</span>
              <span className="text-xs text-muted-foreground">{home.cards[0].description}</span>
            </Button>
            
            <Button
              onClick={() => onSectionChange(home.cards[1].section)}
              className="cyber-border bg-black-light hover:bg-primary/10 text-primary border-primary p-6 h-auto flex flex-col items-center space-y-2 transition-all duration-300 hover:shadow-lg hover:shadow-primary/20"
              variant="outline"
            >
              <Terminal className="w-8 h-8" />
              <span>{home.cards[1].title}</span>
              <span className="text-xs text-muted-foreground">{home.cards[1].description}</span>
            </Button>
            
            <Button
              onClick={() => onSectionChange(home.cards[2].section)}
              className="cyber-border bg-black-light hover:bg-primary/10 text-primary border-primary p-6 h-auto flex flex-col items-center space-y-2 transition-all duration-300 hover:shadow-lg hover:shadow-primary/20"
              variant="outline"
            >
              <Mail className="w-8 h-8" />
              <span>{home.cards[2].title}</span>
              <span className="text-xs text-muted-foreground">{home.cards[2].description}</span>
            </Button>
          </div>

          {/* Scroll Indicator */}
          <div className="flex flex-col items-center space-y-2 text-primary animate-bounce">
            <span className="font-mono text-sm">{home.scroll}</span>
            <ChevronDown className="w-5 h-5" />
          </div>
        </div>
      </div>
      
      {/* Matrix-style background effect */}
      <div data-matrix-background aria-hidden="true" className="absolute inset-0 pointer-events-none opacity-5">
        <div ref={matrixRef} className="text-primary font-mono text-xs leading-none overflow-hidden h-full">
          {Array.from({ length: matrixGrid.rows }, (_, i) => (
            <div key={i} className="whitespace-nowrap">
              {Array.from({ length: matrixGrid.columns }, (_, j) => (
                <span key={j} className="inline-block w-3">
                  {Math.random() > 0.5 ? '1' : '0'}
                </span>
              ))}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
