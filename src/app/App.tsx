
import { useEffect, useState, type CSSProperties } from 'react';
import {
  ContentProvider,
  useSiteContent,
} from '../context/ContentProvider';

import { Header } from './components/Header';
import { HeroSection } from './components/HeroSection';
import { PortfolioGrid } from './components/PortfolioGrid';
import { ContactSection } from './components/ContactSection';
import { BlogArticle } from './components/BlogArticle';
import { blogPath, blogSlug } from './blogRouting';

import '../styles/layout.css';

function AppContent() {
  const { content } = useSiteContent();

  const [articleSlug, setArticleSlug] = useState(() => blogSlug(new URL(window.location.href)));
  useEffect(() => {
    // Keep the tab icon rooted at its loaded asset URL when pushState changes paths.
    const icon = document.querySelector<HTMLLinkElement>('link[rel="icon"]');
    if (icon) icon.setAttribute('href', icon.href);
    const slug = blogSlug(new URL(window.location.href));
    if (slug && window.location.search.includes('blog=')) window.history.replaceState(null, '', blogPath(slug) + window.location.hash);
    const back = () => { setArticleSlug(blogSlug(new URL(window.location.href))); window.scrollTo(0, 0); };
    window.addEventListener('popstate', back);
    return () => window.removeEventListener('popstate', back);
  }, []);
  function openPost(slug: string) {
    window.history.pushState(null, '', blogPath(slug));
    setArticleSlug(slug); window.scrollTo(0, 0);
  }

  const [activeSection, setActiveSection] = useState('home');
  const [headerHeight, setHeaderHeight] = useState(57);

  const changeSection = (section: string) => {
    if (articleSlug) window.history.pushState(null, '', '/');
    setArticleSlug(null);
    setActiveSection(section);
    window.scrollTo(0, 0);
  };

  const renderSection = () => {
    if (articleSlug) return <BlogArticle slug={articleSlug} onHome={() => changeSection('home')} />;
    switch (activeSection) {
      case 'home':
        return (
          <HeroSection onSectionChange={changeSection} onOpenPost={openPost} />
        );

      case 'about':
        return <PortfolioGrid {...content.about} />;

      case 'skills':
        return <PortfolioGrid {...content.skills} />;

      case 'contact':
        return <ContactSection />;

      default:
        return (
          <HeroSection onSectionChange={changeSection} onOpenPost={openPost} />
        );
    }
  };

  return (
    <div
      className="min-h-screen bg-background text-foreground"
      style={
        {
          '--site-header-height': `${headerHeight}px`,
        } as CSSProperties
      }
    >
      <Header
        activeSection={activeSection}
        onSectionChange={changeSection}
        onHeightChange={setHeaderHeight}
      />

      <main
        data-section={activeSection}
        className={activeSection === 'home' && !articleSlug ? '' : 'pt-20'}
      >
        {renderSection()}
      </main>

      {/* Footer */}
      <footer className="border-t border-primary/20 py-8 px-4">
        <div className="container mx-auto text-center">
          <p className="font-mono text-muted-foreground text-sm">
            {content.footer.copyright}
          </p>

          <p className="font-mono text-xs text-muted-foreground mt-2">
            System.Status:{' '}
            <span className="text-primary">
              {content.footer.status}
            </span>
            {' | '}
            Last.Update:{' '}
            <span className="text-primary">
              {content.footer.lastUpdate}
            </span>
            {' | '}
            Build.Version:{' '}
            <span className="text-primary">
              {content.footer.version}
            </span>
          </p>
        </div>
      </footer>
    </div>
  );
}

export default function App() {
  return (
    <ContentProvider>
      <AppContent />
    </ContentProvider>
  );
}
