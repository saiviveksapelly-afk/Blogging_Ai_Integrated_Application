"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { BlogShell } from "./BlogShell";
import { demoPosts, readCurrentUser, readPosts, type BlogPost, type CurrentUser } from "./data";

function HighlightedText({ text, term }: { text: string; term: string }) {
  if (!term) return <>{text}</>;
  const escaped = term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return <>{text.split(new RegExp(`(${escaped})`, "ig")).map((part, index) => part.toLowerCase() === term.toLowerCase()
    ? <mark key={index} className="rounded bg-[#f3d5a7] px-0.5 text-inherit">{part}</mark>
    : part)}</>;
}

export default function ExplorePage() {
  const router = useRouter();
  const [posts, setPosts] = useState<BlogPost[]>(demoPosts);
  const [query, setQuery] = useState("");
  const [activeTag, setActiveTag] = useState("");
  const [currentUser, setCurrentUser] = useState<CurrentUser | null>(null);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setPosts(readPosts());
      setCurrentUser(readCurrentUser());
      const tag = new URLSearchParams(window.location.search).get("tag");
      if (tag) setActiveTag(tag);
      const initialQuery = new URLSearchParams(window.location.search).get("q");
      if (initialQuery) setQuery(initialQuery);
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);

  const trimmedQuery = query.trim().replace(/^#/, "").toLowerCase();
  const searchResults = trimmedQuery ? posts.filter((post) =>
    post.title.toLowerCase().includes(trimmedQuery) ||
    post.excerpt.toLowerCase().includes(trimmedQuery) ||
    post.body.toLowerCase().includes(trimmedQuery) ||
    post.tags.some((tag) => tag.toLowerCase().includes(trimmedQuery))
  ) : posts;
  const visiblePosts = activeTag ? searchResults.filter((post) => post.tags.includes(activeTag)) : searchResults;
  function clearFilters() {
    setQuery(""); setActiveTag(""); router.replace("/blogs");
  }

  return (
    <BlogShell onSearch={setQuery} searchValue={query}>
      <section className="mb-10 grid gap-8 overflow-hidden rounded-[2rem] bg-[#e9e8df] p-7 sm:p-10 lg:grid-cols-[1fr_0.8fr] lg:items-center">
        <div className="relative z-10">
          <p className="mb-4 text-xs font-semibold uppercase tracking-[0.2em] text-[#9b674e]">A home for your next favorite idea</p>
          <h1 className="max-w-xl font-serif text-4xl leading-[1.08] tracking-tight sm:text-6xl">Stories that make you <em className="font-normal text-[#b7765c]">stay</em> a little longer.</h1>
          <p className="mt-5 max-w-lg text-sm leading-7 text-zinc-600 sm:text-base">Thoughtful notes on everyday life, creative work, and the places in between. Find a quiet corner and read awhile.</p>
          <Link href="/blogs/create" className="mt-7 inline-flex items-center gap-2 rounded-full bg-[#272a25] px-5 py-3 text-sm font-medium text-white transition hover:bg-[#41453e]">Write your first story <span aria-hidden>↗</span></Link>
        </div>
        <div className="hero-art relative hidden min-h-[250px] items-center justify-center lg:flex"><div className="hero-sun" /><div className="hero-book"><span /><span /><span /></div><div className="hero-leaf leaf-one" /><div className="hero-leaf leaf-two" /><div className="hero-leaf leaf-three" /><p className="absolute bottom-2 right-4 font-serif text-sm italic text-[#6e7669]">make room for wonder</p></div>
      </section>

      <section>
        <div className="mb-6 flex flex-wrap items-end justify-between gap-4"><div><p className="mb-2 text-xs font-semibold uppercase tracking-[0.18em] text-[#a26d53]">The good reads</p><h2 className="font-serif text-3xl tracking-tight sm:text-4xl">Explore the blogs</h2></div><p className="text-sm text-zinc-500">{visiblePosts.length} {visiblePosts.length === 1 ? "story" : "stories"} to wander through</p></div>
        {visiblePosts.length ? <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">{visiblePosts.map((post, index) => <article key={post.id} className={`story-card group ${!trimmedQuery && index === 0 ? "sm:col-span-2 xl:col-span-2" : ""}`}><Link href={`/blogs/${post.id}`} className="block h-full"><div className={`story-image ${!trimmedQuery && index === 0 ? "story-image-featured" : ""}`} style={{ backgroundColor: post.accent, backgroundImage: `url("${post.image}")`, backgroundSize: `${post.coverScale ?? 115}% auto`, backgroundPosition: `${post.coverPosition?.x ?? 50}% ${post.coverPosition?.y ?? 50}%` }}><span className="image-caption">FIELD NOTES&nbsp; · &nbsp;{String(index + 1).padStart(2, "0")}</span><span className="image-arrow" aria-hidden>↗</span></div><div className="px-1 pb-2 pt-5"><div className="mb-3 flex items-center gap-2 text-[11px] uppercase tracking-[0.12em] text-zinc-400"><span>{post.date}</span><span>·</span><span>{post.readTime}</span></div><h3 className={`max-w-2xl font-serif leading-tight tracking-tight transition group-hover:text-[#a9664c] ${!trimmedQuery && index === 0 ? "text-3xl sm:text-4xl" : "text-2xl"}`}><HighlightedText text={post.title} term={trimmedQuery} /></h3><p className="mt-3 max-w-2xl text-sm leading-6 text-zinc-600"><HighlightedText text={post.excerpt} term={trimmedQuery} /></p><div className="mt-5 flex flex-wrap items-center justify-between gap-3"><div className="flex flex-wrap gap-2">{post.tags.slice(0, 3).map((tag) => <span key={tag} className="rounded-full bg-[#eeede7] px-3 py-1.5 text-[11px] text-zinc-600">#<HighlightedText text={tag} term={trimmedQuery} /></span>)}</div><span className="text-xs text-zinc-500">by <span className="font-medium text-zinc-700">{currentUser && currentUser.id === post.ownerId ? currentUser.name : post.author}</span></span></div></div></Link></article>)}</div> : <div className="rounded-3xl border border-dashed border-black/15 bg-white/50 px-6 py-16 text-center"><p className="font-serif text-2xl">No stories found just yet.</p><p className="mt-2 text-sm text-zinc-500">Try a different title or hashtag.</p><button className="mt-4 text-sm font-medium text-[#a9664c] underline underline-offset-4" onClick={clearFilters}>Clear search</button></div>}
      </section>
    </BlogShell>
  );
}
