import { siteContent } from '../../config/siteContent';
import { useState } from 'react';
import { Button } from './ui/button';
import { Terminal, Menu, X } from 'lucide-react';

interface HeaderProps {
  activeSection: string;
  onSectionChange: (section: string) => void;
}

export function Header({ activeSection, onSectionChange }: HeaderProps) {
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  const sections = siteContent.navigation;

  return (
    <header className="fixed top-0 left-0 right-0 z-50 bg-black-deep/80 backdrop-blur-sm border-b border-primary/20">
      <div className="container mx-auto px-4 py-4">
        <div className="flex items-center justify-between">
          {/* Logo */}
          <div className="flex items-center space-x-2">
            <Terminal className="w-6 h-6 text-primary" />
            <span className="font-mono text-primary terminal-cursor">{siteContent.name}</span>
          </div>

          {/* Desktop Navigation */}
          <nav className="hidden md:flex space-x-1">
            {sections.map((section) => (
              <Button
                key={section.id}
                variant={activeSection === section.id ? "default" : "ghost"}
                size="sm"
                onClick={() => onSectionChange(section.id)}
                className={`
                  font-mono text-sm transition-all duration-200
                  ${activeSection === section.id 
                    ? 'bg-primary text-black shadow-lg shadow-primary/20' 
                    : 'text-primary hover:bg-primary/10 hover:text-primary'
                  }
                `}
              >
                {section.label}
              </Button>
            ))}
          </nav>

          {/* Mobile Menu Button */}
          <Button
            variant="ghost"
            size="sm"
            className="md:hidden text-primary"
            onClick={() => setIsMenuOpen(!isMenuOpen)}
            aria-label="Toggle navigation"
            aria-expanded={isMenuOpen}
          >
            {isMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </Button>
        </div>

        {/* Mobile Navigation */}
        {isMenuOpen && (
          <nav className="md:hidden mt-4 py-4 border-t border-primary/20">
            <div className="space-y-2">
              {sections.map((section) => (
                <Button
                  key={section.id}
                  variant={activeSection === section.id ? "default" : "ghost"}
                  size="sm"
                  onClick={() => {
                    onSectionChange(section.id);
                    setIsMenuOpen(false);
                  }}
                  className={`
                    w-full justify-start font-mono text-sm
                    ${activeSection === section.id 
                      ? 'bg-primary text-black' 
                      : 'text-primary hover:bg-primary/10'
                    }
                  `}
                >
                  {section.label}
                </Button>
              ))}
            </div>
          </nav>
        )}
      </div>
    </header>
  );
}