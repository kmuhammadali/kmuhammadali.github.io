import { siteContent } from '../config/siteContent';
import { useState, type CSSProperties } from 'react';
import { Header } from './components/Header';
import { HeroSection } from './components/HeroSection';
import { PortfolioGrid } from './components/PortfolioGrid';
import { ContactSection } from './components/ContactSection';
import '../styles/layout.css';

export default function App() {
  const [activeSection, setActiveSection] = useState('home');
  const [headerHeight, setHeaderHeight] = useState(57);
  const changeSection = (section: string) => {
    setActiveSection(section);
    window.scrollTo(0, 0);
  };

  const renderSection = () => {
    switch (activeSection) {
      case 'home':
        return <HeroSection onSectionChange={changeSection} />;
      case 'about':
        return <PortfolioGrid {...siteContent.about} />;
      case 'skills':
        return <PortfolioGrid {...siteContent.skills} />;
      case 'contact':
        return <ContactSection />;
      default:
        return <HeroSection onSectionChange={changeSection} />;
    }
  };

  return (
    <div className="min-h-screen bg-background text-foreground" style={{ '--site-header-height': `${headerHeight}px` } as CSSProperties}>
      <Header activeSection={activeSection} onSectionChange={changeSection} onHeightChange={setHeaderHeight} />
      
      <main data-section={activeSection} className={activeSection === 'home' ? '' : 'pt-20'}>
        {renderSection()}
      </main>
      
      {/* Footer */}
      <footer className="border-t border-primary/20 py-8 px-4">
        <div className="container mx-auto text-center">
          <p className="font-mono text-muted-foreground text-sm">
            {siteContent.footer.copyright}
          </p>
          <p className="font-mono text-xs text-muted-foreground mt-2">
            System.Status: <span className="text-primary">{siteContent.footer.status}</span> | 
            Last.Update: <span className="text-primary">{siteContent.footer.lastUpdate}</span> |
            Build.Version: <span className="text-primary">{siteContent.footer.version}</span>
          </p>
        </div>
      </footer>
    </div>
  );
}