"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import type { ReactNode } from "react";
import { useRouter } from "next/navigation";
import { CURRENT_USER_STORAGE_KEY, DEMO_PASSWORD_STORAGE_KEY, DEMO_USER_ID, readCurrentUser, type CurrentUser } from "./data";
import { UserAvatar } from "./UserAvatar";
import { AuthTransition, clearAuthCache, useRequireAuth } from "./useRequireAuth";
import { getReadingHistory } from "./api";

function Icon({ name }: { name: "menu" | "plus" | "clock" | "close" | "search" | "home" | "book" }) {
  const common = { width: 20, height: 20, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 1.8, strokeLinecap: "round" as const, strokeLinejoin: "round" as const, "aria-hidden": true as const };
  const paths = {
    menu: <><path d="M4 6h16M4 12h16M4 18h16" /></>, plus: <><path d="M12 5v14M5 12h14" /></>,
    clock: <><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></>,
    close: <><path d="m6 6 12 12M18 6 6 18" /></>, search: <><circle cx="10.8" cy="10.8" r="6.8" /><path d="m16 16 4 4" /></>,
    home: <><path d="m3 10 9-7 9 7v10a1 1 0 0 1-1 1h-5v-7H9v7H4a1 1 0 0 1-1-1V10Z" /></>,
    book: <><path d="M4 5.5A2.5 2.5 0 0 1 6.5 3H20v17H6.5A2.5 2.5 0 0 1 4 17.5v-12Z" /><path d="M4 17.5A2.5 2.5 0 0 1 6.5 15H20" /></>,
  };
  return <svg {...common}>{paths[name]}</svg>;
}

export function BlogShell({ children, onSearch, searchValue = "" }: { children: ReactNode; onSearch?: (value: string) => void; searchValue?: string }) {
  const router = useRouter();
  const authState = useRequireAuth();
  const [expanded, setExpanded] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [localSearch, setLocalSearch] = useState("");
  const [historyOpen, setHistoryOpen] = useState(false);
  const [history, setHistory] = useState<{ id: string; title: string; at: string }[]>([]);
  const [currentUser, setCurrentUser] = useState<CurrentUser | null>(null);
  const [accountOpen, setAccountOpen] = useState(false);
  const accountRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setCurrentUser(readCurrentUser());
      const query = new URLSearchParams(window.location.search).get("q") ?? "";
      if (query) { setLocalSearch(query); setSearchOpen(true); }
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);

  useEffect(() => {
    function closeOnOutsideClick(event: PointerEvent) {
      if (!accountRef.current?.contains(event.target as Node)) setAccountOpen(false);
    }
    function closeOnEscape(event: KeyboardEvent) {
      if (event.key === "Escape") setAccountOpen(false);
    }
    document.addEventListener("pointerdown", closeOnOutsideClick);
    document.addEventListener("keydown", closeOnEscape);
    return () => { document.removeEventListener("pointerdown", closeOnOutsideClick); document.removeEventListener("keydown", closeOnEscape); };
  }, []);

  async function logout() {
    if (currentUser) {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:5000";
      try { await fetch(`${apiUrl}/api/auth/logout`, { method: "POST", credentials: "include" }); } catch { /* Clear the local session even if offline. */ }
    }
    window.localStorage.removeItem(CURRENT_USER_STORAGE_KEY);
    clearAuthCache();
    setAccountOpen(false);
    router.replace("/login");
  }

  async function deleteAccount() {
    if (!currentUser || !window.confirm("Delete your account permanently? Your account and its blogs, comments, likes, and reading history will be removed.")) return;
    const ownerId = currentUser.id;
    const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:5000";
    try {
      const response = await fetch(`${apiUrl}/api/auth/me`, { method: "DELETE", credentials: "include" });
      if (!response.ok) { window.alert("Your account could not be deleted. Please try again."); return; }
    } catch { window.alert("Your account could not be deleted while offline."); return; }
    window.localStorage.removeItem(CURRENT_USER_STORAGE_KEY);
    clearAuthCache();
    if (ownerId === DEMO_USER_ID) window.localStorage.removeItem(DEMO_PASSWORD_STORAGE_KEY);
    setCurrentUser(null); setAccountOpen(false); router.replace("/login");
  }

  function search(value: string) {
    if (onSearch) onSearch(value);
    else {
      setLocalSearch(value);
      router.replace(value ? `/blogs?q=${encodeURIComponent(value)}` : "/blogs");
    }
  }

  async function toggleHistory() {
    if (!historyOpen) {
      try { setHistory(await getReadingHistory()); } catch { setHistory([]); }
    }
    setHistoryOpen(!historyOpen);
  }

  if (authState !== "authorized") return <AuthTransition redirecting={authState === "redirecting"} />;

  return (
    <div className="min-h-screen bg-[#f7f6f2] text-[#24241f]">
      <aside className={`blog-sidebar ${expanded ? "blog-sidebar-expanded" : ""}`}>
        <div className="flex h-[76px] items-center gap-3 border-b border-black/5 px-5">
          <button className="icon-button" aria-label={expanded ? "Collapse menu" : "Expand menu"} onClick={() => setExpanded(!expanded)}><Icon name="menu" /></button>
          {expanded && <Link href="/blogs" className="font-serif text-2xl font-semibold tracking-tight">Blog<span className="text-[#d88762]">.</span></Link>}
        </div>
        <nav className="flex flex-col gap-2 px-3 py-5">
          <Link title="Explore" href="/blogs" className="side-link"><Icon name="home" />{expanded && <span>Explore</span>}</Link>
          <Link title="Your Blogs" href="/blogs/yours" className="side-link"><Icon name="book" />{expanded && <span>Your Blogs</span>}</Link>
          <Link title="Write a blog" href="/blogs/create" className="side-link"><Icon name="plus" />{expanded && <span>Write a blog</span>}</Link>
          <button title="Search blogs" className="side-link" onClick={() => { setSearchOpen(!searchOpen); setHistoryOpen(false); }}><Icon name="search" />{expanded && <span>Search blogs</span>}</button>
          <button title="Reading history" className="side-link" onClick={toggleHistory}><Icon name="clock" />{expanded && <span>Reading history</span>}</button>
        </nav>
        <div className="mt-auto border-t border-black/5 p-3" ref={accountRef}>
          <div className="flex min-h-12 items-center gap-3 px-1">
            <button type="button" title="Account options" aria-label="Open account options" aria-haspopup="menu" aria-expanded={accountOpen} onClick={() => setAccountOpen(!accountOpen)} className="shrink-0 rounded-full focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#a9664c]">
              <UserAvatar name={currentUser?.name ?? "Reader"} avatarURL={currentUser?.avatarURL} className="h-10 w-10" />
            </button>
            {expanded && <button type="button" title="View account options" aria-expanded={accountOpen} onClick={() => setAccountOpen(!accountOpen)} className="min-w-0 flex-1 truncate rounded-lg py-2 text-left text-sm hover:bg-[#efeee8]">{currentUser?.name ?? "Account"}</button>}
          </div>
          {accountOpen && <div className={`account-popover ${expanded ? "account-popover-expanded" : ""}`} role="menu">
            <Link role="menuitem" href="/account" onClick={() => setAccountOpen(false)} className="account-menu-item">View account</Link>
            <div className="my-1 border-t border-black/5" />
            <button role="menuitem" onClick={() => void logout()} className="account-menu-item w-full text-left">Log out</button>
            <button role="menuitem" onClick={() => void deleteAccount()} className="account-menu-item w-full text-left text-red-700">Delete account</button>
          </div>}
        </div>
      </aside>
      <div className={`blog-main ${expanded ? "blog-main-expanded" : ""}`}>
        <header className="sticky top-0 z-20 border-b border-black/5 bg-[#f7f6f2]/90 backdrop-blur-xl">
          <div className="mx-auto flex h-[76px] max-w-7xl items-center justify-between gap-4 px-5 sm:px-8">
            <div className="flex items-center gap-4"><Link href="/blogs" className="font-serif text-2xl font-semibold tracking-tight">Blog<span className="text-[#d88762]">.</span></Link><div className="hidden items-center gap-2 lg:flex"><span className="rounded-full bg-[#e8eee6] px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-[#526757]">Reader&apos;s club</span><span className="text-sm text-zinc-500">Good stories, shared slowly</span></div></div>
            <div />
          </div>
          {searchOpen && <div className="mx-auto max-w-7xl px-5 pb-4 sm:px-8"><label className="relative block"><span className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-400"><Icon name="search" /></span><input autoFocus value={onSearch ? searchValue : localSearch} onChange={(event) => search(event.target.value)} placeholder="Search titles, stories, or #hashtags…" className="w-full rounded-2xl border border-black/10 bg-white py-3 pl-12 pr-4 text-sm outline-none transition focus:border-[#c88f72] focus:ring-4 focus:ring-[#c88f72]/10" /></label><p className="mt-2 text-xs text-zinc-500">Matches story titles and hashtags as you type.</p></div>}
        </header>
        {historyOpen && <div className="fixed right-5 top-[84px] z-30 w-[min(360px,calc(100vw-2rem))] rounded-2xl border border-black/5 bg-white p-5 shadow-xl"><div className="mb-3 flex items-center justify-between"><h2 className="font-serif text-xl">Recently read</h2><button className="text-zinc-400 hover:text-zinc-800" onClick={() => setHistoryOpen(false)} aria-label="Close history"><Icon name="close" /></button></div>{history.length ? <ul className="space-y-2">{history.map((item) => <li key={item.id}><Link onClick={() => setHistoryOpen(false)} className="block rounded-xl px-3 py-2 hover:bg-[#f7f6f2]" href={`/blogs/${item.id}`}><span className="block text-sm font-medium">{item.title}</span><span className="text-xs text-zinc-400">{new Date(item.at).toLocaleString()}</span></Link></li>)}</ul> : <p className="text-sm text-zinc-500">Your reading history will appear here.</p>}</div>}
        <main className="mx-auto max-w-7xl px-5 pb-20 pt-9 sm:px-8 sm:pt-12">{children}</main>
      </div>
    </div>
  );
}
