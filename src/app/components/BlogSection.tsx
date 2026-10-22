import { TextScramble } from './TextScramble';
import { useEffect, useState, type MouseEvent } from 'react';
import { getPublishedPosts, type PostSummary } from '../../config/postsApi';
import { blogPath } from '../blogRouting';
import { blogPage } from '../blogPagination';
import { publicationDate } from '../publicationDate';
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
      if (!controller.signal.aborted) { setPosts(data); setPage(p => blogPage(data, p).page); }
    }).catch(() => {
      if (!controller.signal.aborted) setError('Posts are unavailable. Please try again.');
    }).finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [attempt]);
  const visible = blogPage(posts, page);
  const open = (event: MouseEvent<HTMLAnchorElement>, slug: string) => {
    if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    event.preventDefault(); onOpenPost(slug);
  };
  const heading = <h2 id="blog-title" className="font-mono text-primary mb-4"><TextScramble text="BLOG" /></h2>;
  return (
    <section aria-labelledby="blog-title" className="mb-8 text-left relative z-10">
      {loading || error || !posts.length ? (
        <div className="cyber-border bg-black-light/50 rounded-lg p-6">
          {heading}
          {loading ? <p role="status" className="font-mono text-muted-foreground text-sm">Loading posts…</p> : error ? (
            <div role="alert" className="font-mono text-muted-foreground text-sm">
              <p>{error}</p><Button variant="outline" className="mt-3 text-primary border-primary" onClick={() => setAttempt(a => a + 1)}>Retry</Button>
            </div>
          ) : <p className="font-mono text-muted-foreground text-sm">No published posts yet.</p>}
        </div>
      ) : <>
        <div className="space-y-6">
          {visible.posts.map((post, index) => {
            const date = publicationDate(post.published_at);
            return (
            <a key={post.id} href={blogPath(post.slug)} onClick={event => open(event, post.slug)} aria-label={`Read ${post.title}`}
              className="cyber-border bg-black-light/50 rounded-lg p-6 block focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary">
              {index === 0 && heading}
              <article className="grid grid-cols-1 md:grid-cols-2 gap-6 items-center min-w-0">
                <div className="min-w-0">
                  <h3 className="font-mono text-primary text-xl mb-3 break-words">
                    <span className="hover:underline"><TextScramble text={post.title} /></span>
                  </h3>
                  {date.dateTime ? <time dateTime={date.dateTime} className="block font-mono text-muted-foreground text-xs mb-3">{date.label}</time>
                    : <span className="block font-mono text-muted-foreground text-xs mb-3">{date.label}</span>}
                  <p className="font-mono text-muted-foreground text-sm whitespace-pre-wrap break-words">{post.excerpt}</p>
                </div>
                <div className="min-w-0">
                  <PostCover key={post.cover_image_url} url={post.cover_image_url} title={post.title} />
                </div>
              </article>
            </a>
          );})}
        </div>
        {visible.pageCount > 1 && (
          <nav aria-label="Blog pagination" className="flex flex-wrap justify-center gap-2 mt-6">
            {Array.from({ length: visible.pageCount }, (_, index) => <Button key={index} size="sm" variant="outline" aria-label={`Page ${index + 1}`} aria-current={index === visible.page ? 'page' : undefined}
              className={index === visible.page ? 'bg-primary text-black border-primary hover:bg-primary/90' : 'text-primary border-primary hover:bg-primary/10'}
              onClick={() => setPage(index)}>{index + 1}</Button>)}
          </nav>
        )}
      </>}
    </section>
  );
}
