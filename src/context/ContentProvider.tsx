import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { siteContent } from "../config/siteContent";
import { loadContentResult, type SiteContent } from "../config/contentApi";
interface ContentContextValue {
  content: SiteContent;
  isLoading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
}
const ContentContext = createContext<ContentContextValue>({
  content: siteContent,
  isLoading: false,
  error: null,
  refresh: async () => {},
});
export function ContentProvider({ children }: { children: ReactNode }) {
  const [content, setContent] = useState<SiteContent>(siteContent);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const sequence = useRef(0);
  const refresh = useCallback(async () => {
    const ticket = ++sequence.current;
    setIsLoading(true);
    try {
      const result = await loadContentResult();
      if (ticket === sequence.current) {
        setContent(result.content);
        setError(result.error);
      }
    } finally {
      if (ticket === sequence.current) setIsLoading(false);
    }
  }, []);
  useEffect(() => {
    void refresh();
    const reload = () => {
      void refresh();
    };
    window.addEventListener("focus", reload);
    return () => {
      ++sequence.current;
      window.removeEventListener("focus", reload);
    };
  }, [refresh]);
  return (
    <ContentContext.Provider value={{ content, isLoading, error, refresh }}>
      {children}
    </ContentContext.Provider>
  );
}
export function useSiteContent() {
  return useContext(ContentContext);
}
