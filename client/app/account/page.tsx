"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import type { FormEvent } from "react";
import { DEMO_PASSWORD_STORAGE_KEY, DEMO_USER_ID, readCurrentUser, saveCurrentUser, type BlogPost, type CurrentUser } from "../blogs/data";
import { UserAvatar } from "../blogs/UserAvatar";
import { AuthTransition, useRequireAuth } from "../blogs/useRequireAuth";
import { getMyPosts, getPosts } from "../blogs/api";

type ProfileResponse = { message?: string; user?: { id: string; username: string; email?: string; avatarURL?: string } };
type AccountActivity = { postId: string; postTitle: string; text: string; date: string; kind: "comment" | "reply" };

function customAvatar(url?: string) {
  return url?.startsWith("data:image/jpeg;base64,") ? url : undefined;
}

function resizeAvatar(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("Could not read that image."));
    reader.onload = () => {
      const image = new Image();
      image.onerror = () => reject(new Error("That file is not a supported image."));
      image.onload = () => {
        const canvas = document.createElement("canvas");
        canvas.width = 256; canvas.height = 256;
        const side = Math.min(image.width, image.height);
        const x = (image.width - side) / 2; const y = (image.height - side) / 2;
        canvas.getContext("2d")?.drawImage(image, x, y, side, side, 0, 0, 256, 256);
        resolve(canvas.toDataURL("image/jpeg", 0.76));
      };
      image.src = String(reader.result);
    };
    reader.readAsDataURL(file);
  });
}

export default function AccountPage() {
  const authState = useRequireAuth();
  const [user, setUser] = useState<CurrentUser | null>(null);
  const [identityLoaded, setIdentityLoaded] = useState(false);
  const [name, setName] = useState("");
  const [avatarURL, setAvatarURL] = useState("");
  const [email, setEmail] = useState("");
  const [authoredBlogs, setAuthoredBlogs] = useState<BlogPost[]>([]);
  const [authoredComments, setAuthoredComments] = useState<AccountActivity[]>([]);
  const [profileMessage, setProfileMessage] = useState("");
  const [passwordMessage, setPasswordMessage] = useState("");
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [savingProfile, setSavingProfile] = useState(false);
  const [savingPassword, setSavingPassword] = useState(false);
  const [showPasswordPanel, setShowPasswordPanel] = useState(false);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      const savedUser = readCurrentUser();
      const accountEmail = savedUser?.email ?? (savedUser?.id === DEMO_USER_ID ? "demo@example.com" : "");
      setUser(savedUser ? { ...savedUser, email: accountEmail, avatarURL: customAvatar(savedUser.avatarURL) } : null); setName(savedUser?.name ?? ""); setEmail(accountEmail); setAvatarURL(customAvatar(savedUser?.avatarURL) ?? ""); setIdentityLoaded(true);
      if (savedUser) {
        void Promise.all([getMyPosts(), getPosts()]).then(([posts, allPosts]) => {
          setAuthoredBlogs(posts);
          setAuthoredComments(allPosts.flatMap((post) => post.comments.flatMap((comment) => [
            ...(comment.userId === savedUser.id ? [{ postId: post.id, postTitle: post.title, text: comment.text, date: comment.date, kind: "comment" as const }] : []),
            ...(comment.replies ?? []).filter((reply) => reply.userId === savedUser.id).map((reply) => ({ postId: post.id, postTitle: post.title, text: reply.text, date: reply.date, kind: "reply" as const })),
          ])));
        }).catch(() => { setAuthoredBlogs([]); setAuthoredComments([]); });
      }
      if (savedUser && savedUser.id !== DEMO_USER_ID) {
        const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:5000";
        void fetch(`${apiUrl}/api/auth/me`, { credentials: "include" })
          .then((response) => response.ok ? response.json() as Promise<ProfileResponse> : null)
          .then((data) => {
            if (!data?.user) return;
            const refreshedUser = { id: data.user.id, name: data.user.username, email: data.user.email ?? "", avatarURL: customAvatar(data.user.avatarURL) };
            setUser(refreshedUser); setName(refreshedUser.name); setEmail(refreshedUser.email ?? ""); setAvatarURL(refreshedUser.avatarURL ?? ""); saveCurrentUser(refreshedUser);
          })
          .catch(() => setProfileMessage("Could not refresh your account from the server."));
      }
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);

  async function saveProfile(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); if (!user) return;
    setSavingProfile(true); setProfileMessage("");
    try {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:5000";
      const response = await fetch(`${apiUrl}/api/auth/me/profile`, {
        method: "PATCH", headers: { "Content-Type": "application/json" }, credentials: "include",
        body: JSON.stringify({ username: name.trim(), avatarURL: avatarURL || null }),
      });
      const data = await response.json() as ProfileResponse;
      if (!response.ok || !data.user) throw new Error(data.message ?? "Could not update your profile.");
      const updatedUser: CurrentUser = { id: data.user.id, name: data.user.username, email: data.user.email ?? email, avatarURL: customAvatar(data.user.avatarURL) };
      setUser(updatedUser); setName(updatedUser.name); setAvatarURL(updatedUser.avatarURL ?? ""); saveCurrentUser(updatedUser);
      setProfileMessage("Your profile was updated.");
    } catch (error) {
      setProfileMessage(error instanceof Error ? error.message : "Could not update your profile.");
    } finally { setSavingProfile(false); }
  }

  async function changePassword(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); if (!user) return;
    if (newPassword.length < 8) { setPasswordMessage("Use at least 8 characters for your new password."); return; }
    if (newPassword !== confirmPassword) { setPasswordMessage("The new passwords do not match."); return; }
    setSavingPassword(true); setPasswordMessage("");
    try {
      if (user.id === DEMO_USER_ID) {
        const savedPassword = window.localStorage.getItem(DEMO_PASSWORD_STORAGE_KEY) ?? "demopassword";
        if (currentPassword !== savedPassword) throw new Error("Current password is incorrect.");
        window.localStorage.setItem(DEMO_PASSWORD_STORAGE_KEY, newPassword);
      } else {
        const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:5000";
        const response = await fetch(`${apiUrl}/api/auth/me/password`, {
          method: "PATCH", headers: { "Content-Type": "application/json" }, credentials: "include",
          body: JSON.stringify({ currentPassword, newPassword }),
        });
        const data = await response.json() as { message?: string };
        if (!response.ok) throw new Error(data.message ?? "Could not update your password.");
      }
      setCurrentPassword(""); setNewPassword(""); setConfirmPassword(""); setPasswordMessage("Your password was updated.");
    } catch (error) {
      setPasswordMessage(error instanceof Error ? error.message : "Could not update your password.");
    } finally { setSavingPassword(false); }
  }

  if (authState !== "authorized") return <AuthTransition redirecting={authState === "redirecting"} />;
  if (!identityLoaded) return <main className="grid min-h-screen place-items-center bg-[#f7f6f2] text-sm text-zinc-500">Loading account…</main>;
  if (!user) return <main className="grid min-h-screen place-items-center bg-[#f7f6f2] px-5"><section className="max-w-md rounded-3xl bg-white p-8 text-center"><h1 className="font-serif text-3xl">Log in to your account</h1><p className="mt-3 text-sm text-zinc-500">Your account settings are private to you.</p><Link href="/login" className="mt-6 inline-flex rounded-full bg-[#30342e] px-5 py-3 text-sm text-white">Go to login</Link></section></main>;

  return <main className="min-h-screen bg-[#f7f6f2] px-5 py-10 text-[#24241f] sm:px-8"><div className="mx-auto max-w-3xl"><Link href="/blogs" className="text-sm text-zinc-500 hover:text-zinc-900">← Back to Blog</Link><div className="mb-8 mt-8 flex items-center gap-4"><UserAvatar name={user.name} avatarURL={avatarURL} className="h-16 w-16" /><div><p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#a26d53]">Your account</p><h1 className="mt-1 font-serif text-4xl">{user.name}</h1><p className="mt-1 text-sm text-zinc-500">{email || "Email unavailable"}</p></div></div>
    <section className="mb-6 rounded-3xl bg-white p-6 shadow-sm sm:p-8"><div className="flex items-end justify-between gap-3"><div><p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#a26d53]">Your writing</p><h2 className="mt-1 font-serif text-2xl">Published blogs <span className="text-zinc-400">({authoredBlogs.length})</span></h2></div><Link href="/blogs/yours" className="text-sm text-zinc-500 underline underline-offset-4">View all</Link></div>{authoredBlogs.length ? <ul className="mt-4 divide-y divide-black/5">{authoredBlogs.map((post) => <li key={post.id} className="py-3 first:pt-0 last:pb-0"><Link href={`/blogs/${post.id}`} className="font-medium hover:text-[#a9664c]">{post.title}</Link><p className="mt-1 text-xs text-zinc-400">{post.date} · {post.readTime}</p></li>)}</ul> : <p className="mt-4 text-sm text-zinc-500">You haven&apos;t published a blog yet.</p>}</section>
    <section className="mb-6 rounded-3xl bg-white p-6 shadow-sm sm:p-8"><p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#a26d53]">Your activity</p><h2 className="mt-1 font-serif text-2xl">Comments <span className="text-zinc-400">({authoredComments.length})</span></h2>{authoredComments.length ? <ul className="mt-4 space-y-3">{authoredComments.map((comment, index) => <li key={`${comment.postId}-${comment.kind}-${index}`} className="rounded-2xl bg-[#f7f6f2] p-4"><p className="text-xs text-zinc-500">{comment.kind === "reply" ? "Reply on" : "Comment on"} <Link href={`/blogs/${comment.postId}`} className="font-medium text-zinc-700 underline underline-offset-2">{comment.postTitle}</Link></p><p className="mt-2 text-sm leading-6 text-zinc-700">{comment.text}</p><p className="mt-2 text-xs text-zinc-400">{comment.date}</p></li>)}</ul> : <p className="mt-4 text-sm text-zinc-500">You haven&apos;t commented on any blogs yet.</p>}</section>
    <form id="manage" onSubmit={saveProfile} className="scroll-mt-8 rounded-3xl bg-white p-6 shadow-sm sm:p-8"><h2 className="font-serif text-2xl">Profile</h2><p className="mt-2 text-sm text-zinc-500">Your name and avatar appear beside your stories and comments.</p><label className="mt-6 block text-sm font-medium">Name<input required minLength={3} maxLength={20} pattern="[A-Za-z0-9_]+" value={name} onChange={(event) => setName(event.target.value)} className="mt-2 w-full rounded-xl border border-black/10 px-4 py-3 outline-none focus:border-[#bf8263]" /></label><div className="mt-6 flex flex-wrap items-center gap-5"><UserAvatar name={name || user.name} avatarURL={avatarURL} className="h-20 w-20" /><div className="flex flex-wrap gap-3"><label className="cursor-pointer rounded-full border border-black/10 px-4 py-2.5 text-sm hover:bg-[#f7f6f2]">Upload avatar<input className="sr-only" type="file" accept="image/png,image/jpeg,image/webp" onChange={(event) => { const file = event.target.files?.[0]; if (file) void resizeAvatar(file).then(setAvatarURL).catch(() => setProfileMessage("Could not load that avatar image.")); }} /></label>{avatarURL && <button type="button" onClick={() => setAvatarURL("")} className="rounded-full px-4 py-2.5 text-sm text-zinc-500 hover:bg-[#f7f6f2]">Use default avatar</button>}</div></div><p className="mt-3 text-xs text-zinc-400">Images are cropped square and resized before saving. A default avatar is used when you have not uploaded one.</p><div className="mt-6 flex flex-wrap items-center justify-between gap-3"><p role="status" className="text-sm text-[#a9664c]">{profileMessage}</p><button disabled={savingProfile} className="rounded-full bg-[#30342e] px-5 py-2.5 text-sm font-medium text-white disabled:opacity-50">{savingProfile ? "Saving…" : "Save profile"}</button></div></form>
    <button type="button" aria-expanded={showPasswordPanel} onClick={() => setShowPasswordPanel(!showPasswordPanel)} className="mt-6 rounded-full bg-zinc-900 px-5 py-3 text-sm font-medium text-white hover:bg-zinc-800">{showPasswordPanel ? "Hide password settings" : "Change password"}</button>
    {showPasswordPanel && <form onSubmit={changePassword} className="mt-4 rounded-3xl bg-white p-6 shadow-sm sm:p-8"><h2 className="font-serif text-2xl">Change password</h2><p className="mt-2 text-sm text-zinc-500">Choose a password you have not used on another site.</p><div className="mt-6 grid gap-4 sm:grid-cols-2"><label className="text-sm font-medium sm:col-span-2">Current password<input required type="password" autoComplete="current-password" value={currentPassword} onChange={(event) => setCurrentPassword(event.target.value)} className="mt-2 w-full rounded-xl border border-black/10 px-4 py-3 outline-none focus:border-[#bf8263]" /></label><label className="text-sm font-medium">New password<input required minLength={8} type="password" autoComplete="new-password" value={newPassword} onChange={(event) => setNewPassword(event.target.value)} className="mt-2 w-full rounded-xl border border-black/10 px-4 py-3 outline-none focus:border-[#bf8263]" /></label><label className="text-sm font-medium">Confirm new password<input required minLength={8} type="password" autoComplete="new-password" value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} className="mt-2 w-full rounded-xl border border-black/10 px-4 py-3 outline-none focus:border-[#bf8263]" /></label></div><div className="mt-6 flex flex-wrap items-center justify-between gap-3"><p role="status" className="text-sm text-[#a9664c]">{passwordMessage}</p><button disabled={savingPassword} className="rounded-full border border-black/10 px-5 py-2.5 text-sm font-medium hover:bg-[#f7f6f2] disabled:opacity-50">{savingPassword ? "Updating…" : "Update password"}</button></div></form>}
    <p className="mt-5 text-center text-xs text-zinc-400">{user.id === DEMO_USER_ID ? "Demo profile and password changes stay in this browser." : "Profile and password changes are saved to your account."}</p></div></main>;
}
