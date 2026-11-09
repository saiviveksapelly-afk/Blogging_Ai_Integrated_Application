import { randomUUID } from "node:crypto";
import { Router } from "express";
import { z } from "zod";
import BlogPost from "../models/BlogPost.js";
import BlogHistory from "../models/BlogHistory.js";
import DeletedDemoPost from "../models/DeletedDemoPost.js";
import BlogUser from "../models/User.js";
import { requireAuth } from "../middleware/requireAuth.js";
import { ensureDemoPosts } from "../data/demoPosts.js";

const router = Router();
const DEMO_ID = "demo-account";
const commentInput = z.string().trim().min(1).max(1000);
const postInput = z.object({
  title: z.string().trim().min(1).max(120), excerpt: z.string().max(300).default(""), body: z.string().min(1).max(10_000_000),
  readTime: z.string().max(40), tags: z.array(z.string().trim().min(1).max(40)).max(20),
  image: z.string().max(5_000_000), coverScale: z.number().min(100).max(180).optional(),
  coverPosition: z.object({ x: z.number().min(0).max(100), y: z.number().min(0).max(100) }).optional(),
  accent: z.string().max(30).optional(), date: z.string().max(60).optional(),
});

function sanitizeBody(html) {
  const withoutDangerous = String(html)
    .replace(/<!--[\s\S]*?-->/g, "")
    .replace(/<(script|style|iframe|object|embed|svg|math|form|input|video|audio)\b[^>]*>[\s\S]*?<\/\1\s*>/gi, "");
  const allowed = new Set(["p", "br", "h2", "strong", "b", "em", "i", "ul", "ol", "li", "blockquote", "img"]);
  return withoutDangerous.replace(/<\/?([a-z][a-z0-9]*)\b([^>]*)>/gi, (raw, tagName, attrs) => {
    const tag = tagName.toLowerCase();
    if (!allowed.has(tag)) return "";
    if (raw.startsWith("</")) return tag === "br" || tag === "img" ? "" : "</" + tag + ">";
    if (tag !== "img") return "<" + tag + ">";
    const source = attrs.match(/\bsrc\s*=\s*(["'])(.*?)\1/i)?.[2] ?? "";
    if (!source.startsWith("https://") && !/^data:image\/(jpeg|png|webp);base64,/i.test(source)) return "";
    const alt = (attrs.match(/\balt\s*=\s*(["'])(.*?)\1/i)?.[2] ?? "Blog image").replace(/["<>]/g, "");
    const widthMatch = attrs.match(/(?:data-image-width|max-width)\s*:?\s*["']?(\d{1,3})/i);
    const width = Math.min(100, Math.max(25, Number(widthMatch?.[1] ?? 48)));
    const float = /float\s*:\s*right/i.test(attrs) ? "right" : "left";
    const margin = float === "right" ? "1rem 0 1rem 1.25rem" : "1rem 1.25rem 1rem 0";
    return "<img src=\"" + source.replace(/&/g, "&amp;").replace(/"/g, "&quot;") + "\" alt=\"" + alt + "\" draggable=\"false\" class=\"blog-inline-image\" data-image-width=\"" + width + "\" style=\"max-width:" + width + "%;height:auto;border-radius:1rem;margin:" + margin + ";float:" + float + ";clear:none\">";
  });
}

async function actor(req) {
  if (req.session.userId === DEMO_ID) return { id: DEMO_ID, name: req.session.username ?? "Demo reader", avatarURL: req.session.avatarURL };
  const user = await BlogUser.findById(req.session.userId);
  return user ? { id: user.id, name: user.username, avatarURL: user.avatarURL } : null;
}

function postDto(post, userId) {
  const raw = post.toObject ? post.toObject() : post;
  return {
    id: raw._id, title: raw.title, excerpt: raw.excerpt, body: raw.body, author: raw.author, ownerId: raw.ownerId,
    date: raw.date, readTime: raw.readTime, tags: raw.tags, image: raw.image, coverScale: raw.coverScale,
    coverPosition: raw.coverPosition, accent: raw.accent, likes: raw.likes, liked: (raw.likedBy ?? []).includes(userId),
    comments: (raw.comments ?? []).map((comment) => ({ id: comment._id.toString(), author: comment.author, userId: comment.userId,
      avatarURL: comment.avatarURL, text: comment.text, date: comment.date,
      replies: (comment.replies ?? []).map((reply) => ({ id: reply._id.toString(), author: reply.author, userId: reply.userId, avatarURL: reply.avatarURL, text: reply.text, date: reply.date })) })),
    updatedAt: raw.updatedAtLabel,
  };
}

async function findPost(req, res) {
  const post = await BlogPost.findOne({ _id: req.params.id, isDeleted: { $ne: true } });
  if (!post) { res.status(404).json({ message: "Blog not found." }); return null; }
  return post;
}

router.use(async (_req, _res, next) => { try { await ensureDemoPosts(); next(); } catch (error) { next(error); } });

router.get("/", async (req, res, next) => {
  try {
    const userId = req.session?.userId ?? "";
    const posts = await BlogPost.find({ isDeleted: { $ne: true } }).sort({ createdAt: -1 });
    const seeds = posts.filter((post) => post.isDemoSeed).reverse();
    const userPosts = posts.filter((post) => !post.isDemoSeed);
    return res.json({ posts: [...seeds, ...userPosts].map((post) => postDto(post, userId)) });
  } catch (error) { return next(error); }
});

router.get("/mine", requireAuth, async (req, res, next) => {
  try {
    const posts = await BlogPost.find({ ownerId: req.session.userId, isDeleted: { $ne: true } }).sort({ createdAt: -1 });
    return res.json({ posts: posts.map((post) => postDto(post, req.session.userId)) });
  } catch (error) { return next(error); }
});

router.get("/history", requireAuth, async (req, res, next) => {
  try {
    const entries = await BlogHistory.find({ userId: req.session.userId }).sort({ visitedAt: -1 }).limit(20).lean();
    return res.json({ history: entries.map(({ postId, title, visitedAt }) => ({ id: postId, title, at: visitedAt.toISOString() })) });
  } catch (error) { return next(error); }
});

router.post("/migrate", requireAuth, async (req, res, next) => {
  const schema = z.object({
    posts: z.array(z.record(z.string(), z.unknown())).max(150).default([]),
    history: z.array(z.record(z.string(), z.unknown())).max(100).default([]),
    likedPostIds: z.array(z.string().max(160)).max(500).default([]),
  });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ message: "Legacy browser data could not be imported." });
  try {
    const user = await actor(req);
    if (!user) return res.status(401).json({ message: "Please log in again." });
    let imported = 0;
    for (const legacy of parsed.data.posts) {
      const oldOwner = String(legacy.ownerId ?? (user.id === DEMO_ID && legacy.author === "You" ? DEMO_ID : ""));
      const id = typeof legacy.id === "string" ? legacy.id : "";
      const valid = postInput.safeParse(legacy);
      if (!id) continue;
      let post = await BlogPost.findById(id);
      const ownsPost = oldOwner === user.id && valid.success;
      if (!post && !ownsPost) continue;
      const comments = Array.isArray(legacy.comments) ? legacy.comments : [];
      const ownComments = comments.filter((item) => item && item.userId === user.id && String(item.text ?? "").trim()).map((item) => ({
        author: user.name, userId: user.id, avatarURL: user.avatarURL, text: String(item.text).slice(0, 1000), date: String(item.date ?? "Imported"),
        replies: (Array.isArray(item.replies) ? item.replies : []).filter((reply) => reply && reply.userId === user.id && String(reply.text ?? "").trim()).map((reply) => ({ author: user.name, userId: user.id, avatarURL: user.avatarURL, text: String(reply.text).slice(0, 1000), date: String(reply.date ?? "Imported") })),
      }));
      if (!post && ownsPost) {
        const oldLikes = Math.max(0, Number(legacy.likes) || 0);
        const alreadyCounted = parsed.data.likedPostIds.includes(id) ? 1 : 0;
        post = new BlogPost({ _id: id, ...valid.data, body: sanitizeBody(valid.data.body), author: user.name, ownerId: user.id, date: valid.data.date || "Imported", likes: Math.max(0, oldLikes - alreadyCounted), likedBy: [], comments: ownComments, isDemoSeed: false });
        await post.save(); imported += 1;
      } else {
        if (post.isDemoSeed && post.ownerId === user.id && ownsPost) Object.assign(post, valid.data, { body: sanitizeBody(valid.data.body), author: user.name });
        for (const comment of ownComments) if (!post.comments.some((saved) => saved.userId === user.id && saved.text === comment.text)) post.comments.push(comment);
        await post.save();
      }
    }
    for (const postId of parsed.data.likedPostIds) {
      await BlogPost.updateOne({ _id: postId, isDeleted: { $ne: true }, likedBy: { $ne: user.id } }, { $addToSet: { likedBy: user.id }, $inc: { likes: 1 } });
    }
    for (const entry of parsed.data.history) {
      if (typeof entry.id !== "string") continue;
      const post = await BlogPost.findOne({ _id: entry.id, isDeleted: { $ne: true } });
      if (post) await BlogHistory.findOneAndUpdate({ userId: user.id, postId: post.id }, { $set: { title: post.title, visitedAt: new Date(String(entry.at ?? Date.now())) } }, { upsert: true });
    }
    return res.json({ imported });
  } catch (error) { return next(error); }
});

router.post("/history/:postId", requireAuth, async (req, res, next) => {
  try {
    const post = await BlogPost.findOne({ _id: req.params.postId, isDeleted: { $ne: true } });
    if (!post) return res.status(404).json({ message: "Blog not found." });
    await BlogHistory.findOneAndUpdate({ userId: req.session.userId, postId: post.id }, { $set: { title: post.title, visitedAt: new Date() } }, { upsert: true, new: true });
    return res.status(204).end();
  } catch (error) { return next(error); }
});

router.delete("/history", requireAuth, async (req, res, next) => {
  try { await BlogHistory.deleteMany({ userId: req.session.userId }); return res.status(204).end(); }
  catch (error) { return next(error); }
});

router.get("/:id", async (req, res, next) => {
  try { const post = await BlogPost.findOne({ _id: req.params.id, isDeleted: { $ne: true } }); if (!post) return res.status(404).json({ message: "Blog not found." }); return res.json({ post: postDto(post, req.session?.userId ?? "") }); }
  catch (error) { return next(error); }
});

router.post("/", requireAuth, async (req, res, next) => {
  const parsed = postInput.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ message: "Please check the blog details.", errors: parsed.error.issues });
  try {
    const user = await actor(req);
    if (!user) return res.status(401).json({ message: "Please log in again." });
    const now = new Date();
    const post = await BlogPost.create({ _id: "story-" + randomUUID(), ...parsed.data, body: sanitizeBody(parsed.data.body), author: user.name, ownerId: user.id, date: parsed.data.date || now.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }), accent: parsed.data.accent || "#d9c8b5", likes: 0, likedBy: [], comments: [], isDemoSeed: false });
    return res.status(201).json({ post: postDto(post, user.id) });
  } catch (error) { return next(error); }
});

router.put("/:id", requireAuth, async (req, res, next) => {
  const parsed = postInput.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ message: "Please check the blog details.", errors: parsed.error.issues });
  try {
    const post = await findPost(req, res); if (!post) return;
    if (post.ownerId !== req.session.userId) return res.status(403).json({ message: "You can only edit your own blogs." });
    Object.assign(post, parsed.data, { body: sanitizeBody(parsed.data.body), updatedAtLabel: new Date().toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) });
    await post.save();
    return res.json({ post: postDto(post, req.session.userId) });
  } catch (error) { return next(error); }
});

router.delete("/:id", requireAuth, async (req, res, next) => {
  try {
    const post = await findPost(req, res); if (!post) return;
    if (post.ownerId !== req.session.userId) return res.status(403).json({ message: "You can only delete your own blogs." });
    if (post.isDemoSeed) {
      await DeletedDemoPost.updateOne({ _id: post.id }, { $set: { deletedAt: new Date() } }, { upsert: true });
    }
    await post.deleteOne();
    await BlogHistory.deleteMany({ postId: post.id });
    return res.status(204).end();
  } catch (error) { return next(error); }
});

router.post("/:id/like", requireAuth, async (req, res, next) => {
  try {
    const shouldLike = z.boolean().safeParse(req.body?.liked);
    if (!shouldLike.success) return res.status(400).json({ message: "Choose whether to like this blog." });
    const filter = { _id: req.params.id, isDeleted: { $ne: true }, likedBy: shouldLike.data ? { $ne: req.session.userId } : req.session.userId };
    const update = shouldLike.data
      ? { $addToSet: { likedBy: req.session.userId }, $inc: { likes: 1 } }
      : { $pull: { likedBy: req.session.userId }, $inc: { likes: -1 } };
    await BlogPost.updateOne(filter, update);
    const post = await findPost(req, res); if (!post) return;
    return res.json({ liked: post.likedBy.includes(req.session.userId), likes: post.likes });
  } catch (error) { return next(error); }
});

router.post("/:id/comments", requireAuth, async (req, res, next) => {
  const parsed = commentInput.safeParse(req.body.text);
  if (!parsed.success) return res.status(400).json({ message: "Write a comment before posting." });
  try {
    const post = await findPost(req, res); if (!post) return;
    const user = await actor(req); if (!user) return res.status(401).json({ message: "Please log in again." });
    post.comments.push({ author: user.name, userId: user.id, avatarURL: user.avatarURL, text: parsed.data, date: "Just now", replies: [] });
    await post.save(); return res.status(201).json({ post: postDto(post, user.id) });
  } catch (error) { return next(error); }
});

router.patch("/:id/comments/:commentId", requireAuth, async (req, res, next) => {
  const parsed = commentInput.safeParse(req.body.text);
  if (!parsed.success) return res.status(400).json({ message: "Comment cannot be empty." });
  try {
    const post = await findPost(req, res); if (!post) return;
    const comment = post.comments.id(req.params.commentId);
    if (!comment) return res.status(404).json({ message: "Comment not found." });
    if (comment.userId !== req.session.userId) return res.status(403).json({ message: "You can only edit your own comments." });
    comment.text = parsed.data; await post.save(); return res.json({ post: postDto(post, req.session.userId) });
  } catch (error) { return next(error); }
});

router.delete("/:id/comments/:commentId", requireAuth, async (req, res, next) => {
  try {
    const post = await findPost(req, res); if (!post) return;
    const comment = post.comments.id(req.params.commentId);
    if (!comment) return res.status(404).json({ message: "Comment not found." });
    if (comment.userId !== req.session.userId) return res.status(403).json({ message: "You can only delete your own comments." });
    comment.deleteOne(); await post.save(); return res.json({ post: postDto(post, req.session.userId) });
  } catch (error) { return next(error); }
});

router.post("/:id/comments/:commentId/replies", requireAuth, async (req, res, next) => {
  const parsed = commentInput.safeParse(req.body.text);
  if (!parsed.success) return res.status(400).json({ message: "Reply cannot be empty." });
  try {
    const post = await findPost(req, res); if (!post) return;
    const comment = post.comments.id(req.params.commentId); if (!comment) return res.status(404).json({ message: "Comment not found." });
    const user = await actor(req); if (!user) return res.status(401).json({ message: "Please log in again." });
    comment.replies.push({ author: user.name, userId: user.id, avatarURL: user.avatarURL, text: parsed.data, date: "Just now" });
    await post.save(); return res.status(201).json({ post: postDto(post, user.id) });
  } catch (error) { return next(error); }
});

router.patch("/:id/comments/:commentId/replies/:replyId", requireAuth, async (req, res, next) => {
  const parsed = commentInput.safeParse(req.body.text);
  if (!parsed.success) return res.status(400).json({ message: "Reply cannot be empty." });
  try {
    const post = await findPost(req, res); if (!post) return;
    const comment = post.comments.id(req.params.commentId); const reply = comment?.replies.id(req.params.replyId);
    if (!reply) return res.status(404).json({ message: "Reply not found." });
    if (reply.userId !== req.session.userId) return res.status(403).json({ message: "You can only edit your own replies." });
    reply.text = parsed.data; await post.save(); return res.json({ post: postDto(post, req.session.userId) });
  } catch (error) { return next(error); }
});

router.delete("/:id/comments/:commentId/replies/:replyId", requireAuth, async (req, res, next) => {
  try {
    const post = await findPost(req, res); if (!post) return;
    const comment = post.comments.id(req.params.commentId); const reply = comment?.replies.id(req.params.replyId);
    if (!reply) return res.status(404).json({ message: "Reply not found." });
    if (reply.userId !== req.session.userId) return res.status(403).json({ message: "You can only delete your own replies." });
    reply.deleteOne(); await post.save(); return res.json({ post: postDto(post, req.session.userId) });
  } catch (error) { return next(error); }
});

export default router;
