"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { BlogShell } from "../BlogShell";
import { deleteOwnedPost, readCurrentUser, readPosts, type BlogPost, type CurrentUser } from "../data";

export default function YourBlogsPage() {
  const [posts, setPosts] = useState<BlogPost[]>([]);
  const [currentUser, setCurrentUser] = useState<CurrentUser | null>(null);
  const [query, setQuery] = useState("");
  useEffect(() => {
    const timer = window.setTimeout(() => {
      const user = readCurrentUser();
      setCurrentUser(user);
      setPosts(user ? readPosts().filter((post) => post.ownerId === user.id) : []);
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);

  const term = query.trim().replace(/^#/, "").toLowerCase();
  const visiblePosts = posts.filter((post) => !term ||
    post.title.toLowerCase().includes(term) ||
    post.excerpt.toLowerCase().includes(term) ||
    post.tags.some((tag) => tag.toLowerCase().includes(term))
  );

  function deleteBlog(postId: string) {
    if (!currentUser || !window.confirm("Delete this blog and all its comments?")) return;
    const nextPosts = deleteOwnedPost(postId, currentUser.id);
    if (nextPosts) setPosts(nextPosts.filter((post) => post.ownerId === currentUser.id));
  }

  return <BlogShell onSearch={setQuery} searchValue={query}><section className="mx-auto max-w-5xl"><div className="flex flex-wrap items-end justify-between gap-4"><div><p className="mb-2 text-xs font-semibold uppercase tracking-[0.18em] text-[#a26d53]">Your writing desk</p><h1 className="font-serif text-4xl tracking-tight sm:text-5xl">Your blogs</h1><p className="mt-3 text-sm text-zinc-500">Stories published by {currentUser?.name ?? "your account"}, saved in this browser.</p></div><Link href="/blogs/create" className="rounded-full bg-[#30342e] px-5 py-3 text-sm font-medium text-white hover:bg-[#484c45]">＋ Write a blog</Link></div>
    <div className="mt-9 space-y-4">{visiblePosts.length ? visiblePosts.map((post) => <article key={post.id} className="flex flex-col gap-5 rounded-3xl bg-white p-4 shadow-sm sm:flex-row sm:items-center sm:p-5"><Link href={`/blogs/${post.id}`} aria-label={`Read ${post.title}`} className="h-40 shrink-0 overflow-hidden rounded-2xl bg-center transition hover:scale-[1.02] sm:w-52" style={{ backgroundImage: `url("${post.image}")`, backgroundSize: `${post.coverScale ?? 115}% auto`, backgroundPosition: `${post.coverPosition?.x ?? 50}% ${post.coverPosition?.y ?? 50}%` }} /><div className="min-w-0 flex-1"><div className="mb-2 flex items-center gap-2 text-[11px] uppercase tracking-[0.12em] text-zinc-400"><span>{post.date}</span><span>·</span><span>{post.readTime}</span></div><Link href={`/blogs/${post.id}`} className="font-serif text-2xl tracking-tight hover:text-[#a9664c]">{post.title}</Link><p className="mt-2 line-clamp-2 text-sm leading-6 text-zinc-500">{post.excerpt}</p><div className="mt-4 flex flex-wrap gap-2">{post.tags.map((tag) => <span key={tag} className="rounded-full bg-[#f0efe9] px-3 py-1 text-[11px] text-zinc-600">#{term && tag.toLowerCase().includes(term) ? <mark className="rounded bg-[#f3d5a7] text-inherit">{tag}</mark> : tag}</span>)}</div></div><div className="flex shrink-0 gap-2"><Link href={`/blogs/${post.id}/edit`} className="rounded-full border border-black/10 px-4 py-2.5 text-center text-sm hover:bg-[#f7f6f2]">Edit</Link><button type="button" onClick={() => deleteBlog(post.id)} className="rounded-full border border-red-200 px-4 py-2.5 text-sm text-red-700 hover:bg-red-50">Delete</button></div></article>) : <div className="rounded-3xl border border-dashed border-black/15 bg-white/50 px-6 py-16 text-center"><p className="font-serif text-2xl">{term ? "No matching blogs." : currentUser ? "Your next story starts here." : "Log in to see your blogs."}</p><p className="mt-2 text-sm text-zinc-500">{term ? "Try another title or hashtag." : currentUser ? "Write something worth sharing." : "Each account has its own writing desk."}</p><Link href={term ? "/blogs/yours" : currentUser ? "/blogs/create" : "/login"} onClick={term ? () => setQuery("") : undefined} className="mt-5 inline-flex rounded-full bg-[#30342e] px-5 py-3 text-sm text-white">{term ? "Clear search" : currentUser ? "Create a blog" : "Go to login"}</Link></div>}</div>
  </section></BlogShell>;
}
