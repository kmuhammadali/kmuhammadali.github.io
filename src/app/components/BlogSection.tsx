import { useEffect, useState, type MouseEvent } from 'react';
import { getPublishedPosts, type PostSummary } from '../../config/postsApi';
import { blogPath } from '../blogRouting';
import { Button } from './ui/button';
import { PostCover } from './PostCover';
export function BlogSection({ onOpenPost }: { onOpenPost: (slug: string) => void }) {
  const [posts, setPosts] = useState<PostSummary[]>([]);
  const [page, setPage] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    setLoading(true); setError('');
    getPublishedPosts(controller.signal).then(data => {
      if (!controller.signal.aborted) { setPosts(data); setPage(p => Math.min(p, Math.max(0, data.length - 1))); }
    }).catch(() => {
      if (!controller.signal.aborted) setError('Posts are unavailable. Please try again.');
    }).finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [attempt]);
  const post = posts[page];
  const open = (event: MouseEvent<HTMLAnchorElement>) => {
    if (!post || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    event.preventDefault(); onOpenPost(post.slug);
  };
  return (
    <section aria-labelledby="blog-title" className="mb-8 text-left relative z-10">
      <div className="cyber-border bg-black-light/50 rounded-lg p-6">
        <h2 id="blog-title" className="font-mono text-primary mb-4">BLOG</h2>
        {loading ? <p role="status" className="font-mono text-muted-foreground text-sm">Loading posts…</p> : error ? (
          <div role="alert" className="font-mono text-muted-foreground text-sm">
            <p>{error}</p><Button variant="outline" className="mt-3 text-primary border-primary" onClick={() => setAttempt(a => a + 1)}>Retry</Button>
          </div>
        ) : !post ? <p className="font-mono text-muted-foreground text-sm">No published posts yet.</p> : (
          <article key={post.id} className="grid grid-cols-1 md:grid-cols-2 gap-6 items-center min-w-0">
            <div className="min-w-0">
              <h3 className="font-mono text-primary text-xl mb-3 break-words">
                <a href={blogPath(post.slug)} onClick={open} className="hover:underline focus-visible:outline focus-visible:outline-primary">{post.title}</a>
              </h3>
              <p className="font-mono text-muted-foreground text-sm whitespace-pre-wrap break-words">{post.excerpt}</p>
            </div>
            <a href={blogPath(post.slug)} onClick={open} aria-label={`Read ${post.title}`} className="block focus-visible:outline focus-visible:outline-primary">
              <PostCover key={post.cover_image_url} url={post.cover_image_url} title={post.title} />
            </a>
          </article>
        )}
        {!loading && !error && posts.length > 1 && (
          <nav aria-label="Blog pagination" className="flex flex-wrap justify-center gap-2 mt-6">
            {posts.map((p, index) => <Button key={p.id} size="sm" variant="outline" aria-label={`Page ${index + 1}`} aria-current={index === page ? 'page' : undefined}
              className={index === page ? 'bg-primary text-black border-primary hover:bg-primary/90' : 'text-primary border-primary hover:bg-primary/10'}
              onClick={() => setPage(index)}>{index + 1}</Button>)}
          </nav>
        )}
      </div>
    </section>
  );
}
