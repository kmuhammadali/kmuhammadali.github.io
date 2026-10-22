export const POSTS_PER_PAGE = 3;
export function blogPage<T>(posts: readonly T[], requestedPage: number) {
  const pageCount = Math.ceil(posts.length / POSTS_PER_PAGE);
  const page = Math.max(0, Math.min(requestedPage, pageCount - 1));
  return { page, pageCount, posts: posts.slice(page * POSTS_PER_PAGE, (page + 1) * POSTS_PER_PAGE) };
}
