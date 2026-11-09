import { LEGACY_HISTORY_STORAGE_KEY, LEGACY_POSTS_STORAGE_KEY, type BlogPost } from "./data";

const API_URL = (process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:5000").replace(/\/$/, "");

export async function blogApi<T = unknown>(path: string, init: RequestInit = {}): Promise<T> {
  const headers = new Headers(init.headers);
  if (init.body && !headers.has("Content-Type")) headers.set("Content-Type", "application/json");
  const response = await fetch(`${API_URL}/api/blogs${path}`, {
    ...init,
    credentials: "include",
    cache: "no-store",
    headers,
  });
  if (response.status === 204) return undefined as T;
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.message ?? "The request could not be completed.");
  return data as T;
}

export const getPosts = async () => (await blogApi<{ posts: BlogPost[] }>("/")).posts;
export const getMyPosts = async () => (await blogApi<{ posts: BlogPost[] }>("/mine")).posts;
export const getPost = async (id: string) => (await blogApi<{ post: BlogPost }>(`/${encodeURIComponent(id)}`)).post;
export const savePost = async (post: BlogPost, editing: boolean) => (await blogApi<{ post: BlogPost }>(editing ? `/${encodeURIComponent(post.id)}` : "/", { method: editing ? "PUT" : "POST", body: JSON.stringify(post) })).post;
export const deletePost = (id: string) => blogApi(`/${encodeURIComponent(id)}`, { method: "DELETE" });
export const togglePostLike = (id: string, liked: boolean) => blogApi<{ liked: boolean; likes: number }>(`/${encodeURIComponent(id)}/like`, { method: "POST", body: JSON.stringify({ liked }) });
export const addPostComment = (id: string, text: string) => blogApi<{ post: BlogPost }>(`/${encodeURIComponent(id)}/comments`, { method: "POST", body: JSON.stringify({ text }) });
export const editPostComment = (id: string, commentId: string, text: string) => blogApi<{ post: BlogPost }>(`/${encodeURIComponent(id)}/comments/${encodeURIComponent(commentId)}`, { method: "PATCH", body: JSON.stringify({ text }) });
export const removePostComment = (id: string, commentId: string) => blogApi<{ post: BlogPost }>(`/${encodeURIComponent(id)}/comments/${encodeURIComponent(commentId)}`, { method: "DELETE" });
export const addPostReply = (id: string, commentId: string, text: string) => blogApi<{ post: BlogPost }>(`/${encodeURIComponent(id)}/comments/${encodeURIComponent(commentId)}/replies`, { method: "POST", body: JSON.stringify({ text }) });
export const editPostReply = (id: string, commentId: string, replyId: string, text: string) => blogApi<{ post: BlogPost }>(`/${encodeURIComponent(id)}/comments/${encodeURIComponent(commentId)}/replies/${encodeURIComponent(replyId)}`, { method: "PATCH", body: JSON.stringify({ text }) });
export const removePostReply = (id: string, commentId: string, replyId: string) => blogApi<{ post: BlogPost }>(`/${encodeURIComponent(id)}/comments/${encodeURIComponent(commentId)}/replies/${encodeURIComponent(replyId)}`, { method: "DELETE" });
export const getReadingHistory = async () => (await blogApi<{ history: { id: string; title: string; at: string }[] }>("/history")).history;
export const recordPostVisit = (id: string) => blogApi(`/history/${encodeURIComponent(id)}`, { method: "POST" });

export type WritingSuggestion = { field: "title" | "body"; original: string; suggested: string; explanation: string };
export async function requestWritingSuggestions(title: string, body: string) {
  const response = await fetch(`${API_URL}/api/ai/suggestions`, {
    method: "POST", credentials: "include", cache: "no-store",
    headers: { "Content-Type": "application/json" }, body: JSON.stringify({ title, body }),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.message ?? "Could not get writing suggestions.");
  return data.suggestions as WritingSuggestion[];
}
export async function migrateLegacyBrowserData(userId: string) {
  const marker = `blog.mongo.migrated.v1.${userId}`;
  if (window.localStorage.getItem(marker) === "1") return;
  const postsRaw = window.localStorage.getItem(LEGACY_POSTS_STORAGE_KEY);
  const historyRaw = window.localStorage.getItem(LEGACY_HISTORY_STORAGE_KEY);
  const likedRaw = window.localStorage.getItem(`blog.likes.${userId}.v1`);
  if (!postsRaw && !historyRaw && !likedRaw) { window.localStorage.setItem(marker, "1"); return; }

  const posts = postsRaw ? JSON.parse(postsRaw) : [];
  const history = historyRaw ? JSON.parse(historyRaw) : [];
  const likedPostIds = likedRaw ? JSON.parse(likedRaw) : [];
  const batches = Array.isArray(posts) && posts.length ? posts.map((post: unknown) => [post]) : [[]];
  for (let index = 0; index < batches.length; index += 1) {
    await blogApi("/migrate", { method: "POST", body: JSON.stringify({ posts: batches[index], history: index === 0 ? history : [], likedPostIds: index === 0 ? likedPostIds : [] }) });
  }
  if (Array.isArray(posts)) {
    const remaining = posts.filter((post) => post?.ownerId !== userId && !(userId === "demo-account" && post?.author === "You"));
    if (remaining.length) window.localStorage.setItem(LEGACY_POSTS_STORAGE_KEY, JSON.stringify(remaining));
    else window.localStorage.removeItem(LEGACY_POSTS_STORAGE_KEY);
  }
  window.localStorage.removeItem(LEGACY_HISTORY_STORAGE_KEY);
  window.localStorage.removeItem(`blog.likes.${userId}.v1`);
  window.localStorage.setItem(marker, "1");
}
