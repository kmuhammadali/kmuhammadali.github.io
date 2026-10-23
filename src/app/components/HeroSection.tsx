import { useSiteContent } from '../../context/ContentProvider';
import { useEffect, useRef } from 'react';
import { useTerminalPlayback } from './useTerminalPlayback';
import { BlogSection } from './BlogSection';
import { TextScramble } from './TextScramble';
import { Button } from './ui/button';
import { Code, Terminal, Mail } from 'lucide-react';
import { siteContent } from '../../config/siteContent';

interface HeroSectionProps {
  onSectionChange: (section: string) => void;
  onOpenPost: (slug: string) => void;
}

export function HeroSection({ onSectionChange, onOpenPost }: HeroSectionProps) {
  const { content, isLoading } = useSiteContent();
  const home = content.home;
  
  const terminalLines = [
    '$ whoami',
    home.role,
    '$ ls -la portfolio/',
    ...home.directories,
    '$ cat mission.txt',
    ...home.mission,
    `$ echo "${home.typingText}"`,
  ];

  const terminalRef = useRef<HTMLDivElement>(null);
  const frame = useTerminalPlayback(terminalLines, !isLoading, terminalRef);

  const cardsRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const cards = cardsRef.current;
    if (!cards || typeof IntersectionObserver === 'undefined') return;
    const visible = new Set<Element>();
    const update = () => {
      for (const card of cards.children) card.toggleAttribute('data-visible', !document.hidden && visible.has(card));
    };
    const observer = new IntersectionObserver(entries => {
      for (const entry of entries) {
        if (entry.isIntersecting) visible.add(entry.target); else visible.delete(entry.target);
      }
      update();
    }, { threshold: 0.1 });
    for (const card of cards.children) observer.observe(card);
    document.addEventListener('visibilitychange', update);
    return () => { observer.disconnect(); document.removeEventListener('visibilitychange', update); };
  }, []);
  return (
    <section className="min-h-screen flex items-center justify-center relative matrix-bg">
      <div className="container mx-auto px-4 text-center">
        <div className="max-w-4xl mx-auto">
          
          {/* Terminal Window */}
          <div ref={terminalRef} className="cyber-border bg-black-light/50 rounded-lg p-8 mb-8">
            <div className="flex items-center space-x-2 mb-6 pb-4 border-b border-primary/20">
              <div className="w-3 h-3 rounded-full bg-red-500"></div>
              <div className="w-3 h-3 rounded-full bg-yellow-500"></div>
              <div className="w-3 h-3 rounded-full bg-primary"></div>
              <span className="ml-4 font-mono text-sm text-muted-foreground">
                <TextScramble text={home.terminal} />
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
                    {isActive && (
                      <span data-terminal-caret className="text-primary">_</span>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          <BlogSection onOpenPost={onOpenPost} />

          {/* Action Buttons */}
          <div ref={cardsRef} data-navigation-cards className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-12">
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

          {/* End of page */}
          <div data-end-region className="flex flex-col items-center space-y-2 text-primary">
            <TextScramble text={siteContent.home.scroll} loop className="font-mono text-sm whitespace-pre" />
          </div>
        </div>
      </div>
      

    </section>
  );
}
