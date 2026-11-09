"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { Suspense } from "react";
import { useEffect, useRef, useState } from "react";
import { BlogShell } from "../BlogShell";
import { demoPosts, readCurrentUser, type BlogPost, type CurrentUser } from "../data";
import { deletePost as deletePostApi, getPost, recordPostVisit, togglePostLike } from "../api";
import { UserAvatar } from "../UserAvatar";
import { CommentSection } from "../CommentSection";

function BlogDetailContent() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [posts, setPosts] = useState<BlogPost[]>(demoPosts);
  const [liked, setLiked] = useState(false);
  const likedRef = useRef(false);
  const [currentUser, setCurrentUser] = useState<CurrentUser | null>(null);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      const user = readCurrentUser();
      setCurrentUser(user);
      void getPost(id).then((viewed) => {
        setPosts([viewed]);
        likedRef.current = Boolean(viewed.liked);
        setLiked(Boolean(viewed.liked));
        void recordPostVisit(id).catch(() => undefined);
      }).catch(() => setPosts([]));
    }, 0);
    return () => window.clearTimeout(timer);
  }, [id]);

  const post = posts.find((item) => item.id === id);
  if (!post) return <BlogShell><div className="py-24 text-center"><h1 className="font-serif text-3xl">This story has wandered off.</h1><Link className="mt-4 inline-block text-sm text-[#a9664c] underline" href="/blogs">Back to explore</Link></div></BlogShell>;

  const updatePost = (next: BlogPost) => {
    setPosts((current) => current.map((item) => item.id === next.id ? next : item));
  };

  const deletePost = () => {
    if (!currentUser || currentUser.id !== post.ownerId) return;
    if (!window.confirm("Delete this blog? This also removes its comments and replies.")) return;
    void deletePostApi(post.id).then(() => router.replace("/blogs/yours")).catch((error) => window.alert(error instanceof Error ? error.message : "Could not delete this blog."));
  };

  const toggleLike = () => {
    const nextLiked = !likedRef.current;
    likedRef.current = nextLiked;
    setLiked(nextLiked);
    void togglePostLike(id, nextLiked).then((result) => {
      setPosts((current) => current.map((item) => item.id === id ? { ...item, liked: result.liked, likes: result.likes } : item));
      likedRef.current = result.liked;
      setLiked(result.liked);
    }).catch((error) => {
      likedRef.current = liked;
      setLiked(liked);
      window.alert(error instanceof Error ? error.message : "Could not save your appreciation.");
    });
  };

  const isAuthor = Boolean(currentUser && currentUser.id === post.ownerId);
  const authorName = currentUser && currentUser.id === post.ownerId ? currentUser.name : post.author;
  const authorAvatar = currentUser && currentUser.id === post.ownerId ? currentUser.avatarURL : undefined;

  return <BlogShell><article className="mx-auto max-w-4xl">
    <Link href="/blogs" className="mb-8 inline-flex items-center gap-2 text-sm text-zinc-500 hover:text-zinc-900">← <span>All stories</span></Link>
    <div className="mb-7 flex flex-wrap gap-2">{post.tags.map((tag) => <Link key={tag} href={`/blogs?tag=${encodeURIComponent(tag)}`} className="rounded-full bg-[#eeede7] px-3 py-1.5 text-xs text-zinc-600 hover:bg-[#e4e2d9]">#{tag}</Link>)}</div>
    <h1 className="max-w-3xl font-serif text-4xl leading-[1.08] tracking-tight sm:text-6xl">{post.title}</h1>
    <p className="mt-5 max-w-2xl text-lg leading-8 text-zinc-500">{post.excerpt}</p>
    <div className="mt-7 flex flex-wrap items-center justify-between gap-4 border-y border-black/5 py-5"><div className="flex items-center gap-3"><UserAvatar name={authorName} avatarURL={authorAvatar} className="h-11 w-11" /><div><p className="text-sm font-medium">{authorName}</p><p className="mt-1 text-xs text-zinc-400">{post.date} <span className="mx-1">·</span> {post.readTime}{isAuthor && post.updatedAt ? <span> <span className="mx-1">·</span> Updated {post.updatedAt}</span> : null}</p></div></div>{isAuthor && <div className="flex gap-2"><Link href={`/blogs/${post.id}/edit`} className="rounded-full border border-black/10 px-4 py-2 text-xs font-medium hover:bg-white">Edit your blog ↗</Link><button type="button" onClick={deletePost} className="rounded-full border border-red-200 px-4 py-2 text-xs font-medium text-red-700 hover:bg-red-50">Delete</button></div>}</div>
    <div role="img" aria-label={`Cover image for ${post.title}`} className="my-8 aspect-[2.4/1] overflow-hidden rounded-[1.75rem] bg-[#e9e8df]" style={{ backgroundImage: `url("${post.image}")`, backgroundSize: `${post.coverScale ?? 115}% auto`, backgroundPosition: `${post.coverPosition?.x ?? 50}% ${post.coverPosition?.y ?? 50}%` }} />
    <div className="mx-auto max-w-3xl"><div className="blog-article-body" dangerouslySetInnerHTML={{ __html: post.body }} /><div className="mt-10 flex items-center justify-between border-y border-black/5 py-5"><button onClick={toggleLike} className={`inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm transition ${liked ? "bg-[#f6e5df] text-[#a45137]" : "bg-[#f0efe9] text-zinc-600 hover:bg-[#e8e7df]"}`} aria-pressed={liked}><span aria-hidden>{liked ? "♥" : "♡"}</span>{post.likes} appreciations</button><span className="text-xs text-zinc-400">A good story is better shared.</span></div></div>
    <CommentSection key={post.id} post={post} currentUser={currentUser} onChange={updatePost} />
  </article></BlogShell>;
}

export default function BlogDetailPage() {
  return (
    <Suspense fallback={<main className="min-h-screen bg-[#f7f6f2] px-5 py-20 text-center text-sm text-zinc-500">Loading story…</main>}>
      <BlogDetailContent />
    </Suspense>
  );
}
