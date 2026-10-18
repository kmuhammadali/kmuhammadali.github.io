
import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from 'react';

import { siteContent } from '../config/siteContent';
import { loadSiteContent } from '../config/contentApi';

type SiteContent = typeof siteContent;

interface ContentContextValue {
  content: SiteContent;
  isLoading: boolean;
}

const ContentContext = createContext<ContentContextValue>({
  content: siteContent,
  isLoading: false,
});

export function ContentProvider({
  children,
}: {
  children: ReactNode;
}) {
  const [content, setContent] = useState<SiteContent>(siteContent);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let active = true;

    loadSiteContent()
      .then((data) => {
        if (active) {
          setContent(data);
        }
      })
      .finally(() => {
        if (active) {
          setIsLoading(false);
        }
      });

    return () => {
      active = false;
    };
  }, []);

  return (
    <ContentContext.Provider value={{ content, isLoading }}>
      {children}
    </ContentContext.Provider>
  );
}

export function useSiteContent() {
  return useContext(ContentContext);
}
