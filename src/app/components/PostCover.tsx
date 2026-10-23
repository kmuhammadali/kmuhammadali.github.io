import { useState } from 'react';
import { Image as ImageIcon } from 'lucide-react';
export function PostCover({ url, title, compact = false }: { url: string | null; title: string; compact?: boolean }) {
  const [failed, setFailed] = useState(false);
  return url && !failed ? (
    <img data-blog-cover={compact ? '' : undefined} src={url} alt={title} loading="lazy" decoding="async" referrerPolicy="no-referrer"
      onError={() => setFailed(true)} className="w-full h-48 md:h-64 object-cover rounded border border-primary/20" />
  ) : (
    <div data-blog-cover={compact ? '' : undefined} className="w-full h-48 md:h-64 rounded border border-primary/20 bg-black-light/50 flex flex-col items-center justify-center gap-3 text-muted-foreground font-mono text-sm">
      <ImageIcon className="w-8 h-8" aria-hidden="true" />
      <span>No cover image</span>
    </div>
  );
}
