import { useEffect, useState, type MouseEvent } from 'react';
import { ArrowLeft, Copy, Share2 } from 'lucide-react';
import { getPublishedPost, PostNotFound, type Post } from '../../config/postsApi';
import { useSiteContent } from '../../context/ContentProvider';
import { blogPath } from '../blogRouting';
import { Button } from './ui/button';
import { PostCover } from './PostCover';
import { postContentHtml } from '../../content/postContent';
import '../../content/postContent.css';
export function BlogArticle({ slug, onHome }: { slug: string; onHome: () => void }) {
  const { content } = useSiteContent();
  const [post, setPost] = useState<Post | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [missing, setMissing] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const [notice, setNotice] = useState('');
  useEffect(() => {
    const controller = new AbortController();
    setPost(null); setLoading(true); setError(''); setNotice(''); setMissing(false);
    getPublishedPost(slug, controller.signal).then(data => { if (!controller.signal.aborted) setPost(data); })
      .catch(e => { if (!controller.signal.aborted) { setMissing(e instanceof PostNotFound); setError(e instanceof PostNotFound ? 'Article not found or no longer published.' : 'Article is unavailable. Please try again.'); } })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [slug, attempt]);
  useEffect(() => {
    if (post) document.title = `${post.title} | ${content.name}`;
    return () => { document.title = content.name; };
  }, [post, content.name]);
  const url = new URL(blogPath(slug), window.location.origin).href;
  async function copy() {
    try { await navigator.clipboard.writeText(url); setNotice('Link copied.'); }
    catch { setNotice(`Copy this link: ${url}`); }
  }
  async function share() {
    try { await navigator.share({ title: post?.title, url }); }
    catch (e) { if (!(e instanceof Error && e.name === 'AbortError')) setNotice('Sharing is unavailable. Use Copy link instead.'); }
  }
  function home(event: MouseEvent<HTMLAnchorElement>) {
    if (event.button || event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) return;
    event.preventDefault(); onHome();
  }
  return (
    <section className="py-12 px-4">
      <div className="container mx-auto max-w-4xl">
        <a href="/" onClick={home} className="font-mono text-primary inline-flex items-center gap-2 mb-6 hover:underline"><ArrowLeft className="w-4 h-4" />Back to Home</a>
        <article className="cyber-border bg-black-light/50 rounded-lg p-6 md:p-8">
          {loading ? <p role="status" className="font-mono text-muted-foreground">Loading article…</p> : error ? (
            <div role="alert" className="font-mono text-muted-foreground"><h1 className="text-primary mb-3">{error}</h1>{!missing && <Button variant="outline" className="text-primary border-primary" onClick={() => setAttempt(a => a + 1)}>Retry</Button>}</div>
          ) : post && <>
            <h1 className="font-mono text-primary text-2xl md:text-3xl break-words mb-4">{post.title}</h1>
            {post.published_at && <time dateTime={post.published_at} className="font-mono text-muted-foreground text-sm block mb-6">{new Intl.DateTimeFormat('en', { dateStyle: 'long', timeZone: 'UTC' }).format(new Date(post.published_at))}</time>}
            <PostCover key={post.cover_image_url} url={post.cover_image_url} title={post.title} />
            <div className="mt-6 post-content" dangerouslySetInnerHTML={{ __html: postContentHtml(post.content) }} />
            <div className="flex flex-wrap gap-3 mt-8">
              <Button variant="outline" className="text-primary border-primary hover:bg-primary/10" onClick={copy}><Copy className="w-4 h-4 mr-2" />Copy link</Button>
              {typeof navigator.share === 'function' && <Button variant="outline" className="text-primary border-primary hover:bg-primary/10" onClick={share}><Share2 className="w-4 h-4 mr-2" />Share</Button>}
            </div>
            <p role="status" className="font-mono text-muted-foreground text-sm mt-3 break-words">{notice}</p>
          </>}
        </article>
      </div>
    </section>
  );
}
