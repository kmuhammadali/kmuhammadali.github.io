import { siteContent } from '../config/siteContent';
import { useState } from 'react';
import { Header } from './components/Header';
import { HeroSection } from './components/HeroSection';
import { PortfolioGrid } from './components/PortfolioGrid';
import { ContactSection } from './components/ContactSection';

export default function App() {
  const [activeSection, setActiveSection] = useState('home');

  const renderSection = () => {
    switch (activeSection) {
      case 'home':
        return <HeroSection onSectionChange={setActiveSection} />;
      case 'about':
        return <PortfolioGrid {...siteContent.about} />;
      case 'skills':
        return <PortfolioGrid {...siteContent.skills} />;
      case 'contact':
        return <ContactSection />;
      default:
        return <HeroSection onSectionChange={setActiveSection} />;
    }
  };

  return (
    <div className="min-h-screen bg-background text-foreground">
      <Header activeSection={activeSection} onSectionChange={setActiveSection} />
      
      <main className={activeSection === 'home' ? '' : 'pt-20'}>
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