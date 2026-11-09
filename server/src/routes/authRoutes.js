import { randomBytes } from "node:crypto";
import { Router } from "express";
import { rateLimit } from "express-rate-limit";
import bcrypt from "bcryptjs";
import { z } from "zod";
import BlogUser from "../models/User.js";
import { requireAuth } from "../middleware/requireAuth.js";
import BlogPost from "../models/BlogPost.js";
import BlogHistory from "../models/BlogHistory.js";

const router = Router();

const passwordSchema = z
  .string()
  .min(8, "Password must be at least 8 characters.")
  .refine(
    (password) => Buffer.byteLength(password, "utf8") <= 72,
    "Password is too long.",
  );

const registerSchema = z
  .object({
    username: z
      .string()
      .trim()
      .toLowerCase()
      .min(3)
      .max(20)
      .regex(/^[a-z0-9_]+$/, "Use letters, numbers, and underscores only."),
    email: z.email().trim().toLowerCase(),
    password: passwordSchema,
    confirmPassword: z.string(),
  })
  .refine((data) => data.password === data.confirmPassword, {
    path: ["confirmPassword"],
    message: "Passwords do not match.",
  });

const loginSchema = z.object({
  email: z.email().trim().toLowerCase(),
  password: passwordSchema,
});

const profileSchema = z
  .object({
    username: z.string().trim().toLowerCase().min(3).max(20).regex(/^[a-z0-9_]+$/, "Use letters, numbers, and underscores only.").optional(),
    avatarURL: z.string().max(100_000).regex(/^data:image\/jpeg;base64,[A-Za-z0-9+/]+={0,2}$/).nullable().optional(),
  })
  .refine((data) => data.username !== undefined || data.avatarURL !== undefined, {
    message: "Add a name or avatar change.",
  });

const changePasswordSchema = z.object({
  currentPassword: z.string(),
  newPassword: passwordSchema,
});

const registerLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: "Too many registration attempts. Try again later." },
});

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: "Too many login attempts. Try again later." },
});

// Compare passwords even when the email doesn't exist, reducing timing clues.
const dummyPasswordHash = await bcrypt.hash(
  randomBytes(32).toString("hex"),
  12,
);

function validationResponse(result) {
  return {
    message: "Please check the submitted details.",
    errors: result.error.issues.map((issue) => ({
      field: issue.path[0],
      message: issue.message,
    })),
  };
}

function duplicateKeyResponse(error) {
  const keys = error.keyPattern ?? error.keyValue ?? {};
  const field = Object.keys(keys)[0];

  if (field === "username") {
    return { field, message: "That username is already taken." };
  }

  if (field === "email") {
    return { field, message: "That email is already registered." };
  }

  return {
    field: null,
    message: "That username or email is already registered.",
  };
}

function regenerateSession(req) {
  return new Promise((resolve, reject) => {
    req.session.regenerate((error) => {
      if (error) reject(error);
      else resolve();
    });
  });
}

function saveSession(req) {
  return new Promise((resolve, reject) => {
    req.session.save((error) => {
      if (error) reject(error);
      else resolve();
    });
  });
}

router.post("/register", registerLimiter, async (req, res, next) => {
  const result = registerSchema.safeParse(req.body);

  if (!result.success) {
    return res.status(400).json(validationResponse(result));
  }

  const { username, email, password } = result.data;

  try {
    const existingUsername = await BlogUser.exists({ username });

    if (existingUsername) {
      return res.status(409).json({
        field: "username",
        message: "That username is already taken.",
      });
    }

    const existingEmail = await BlogUser.exists({ email });

    if (existingEmail) {
      return res.status(409).json({
        field: "email",
        message: "That email is already registered.",
      });
    }

    const passwordHash = await bcrypt.hash(password, 12);
    const user = await BlogUser.create({ username, email, passwordHash });

    return res.status(201).json({
      message: "Registration successful.",
      user: {
        id: user._id,
        username: user.username,
        email: user.email,
        avatarURL: user.avatarURL,
      },
    });
  } catch (error) {
    if (error.code === 11000) {
      return res.status(409).json(duplicateKeyResponse(error));
    }

    return next(error);
  }
});

router.post("/login", loginLimiter, async (req, res, next) => {
  const result = loginSchema.safeParse(req.body);

  if (!result.success) {
    return res.status(400).json(validationResponse(result));
  }

  const { email, password } = result.data;

  try {
    const user = await BlogUser.findOne({ email }).select("+passwordHash");
    const hashToCheck = user?.passwordHash ?? dummyPasswordHash;
    const passwordMatches = await bcrypt.compare(password, hashToCheck);

    if (!user || !passwordMatches) {
      return res.status(401).json({
        message: "Invalid email or password.",
      });
    }

    // Regenerate the session ID after login to reduce session-fixation risk.
    await regenerateSession(req);
    req.session.userId = user._id.toString();
    await saveSession(req);

    return res.status(200).json({
      message: "Login successful.",
      user: {
        id: user._id,
        username: user.username,
        email: user.email,
        avatarURL: user.avatarURL,
      },
    });
  } catch (error) {
    return next(error);
  }
});

// The demo identity is fixed in code, while its session and all demo content
// actions use the same Mongo-backed session/API path as registered accounts.
router.post("/demo", async (req, res, next) => {
  const email = String(req.body?.email ?? "").trim().toLowerCase();
  const password = String(req.body?.password ?? "");
  if (email !== "demo@example.com" || !password) {
    return res.status(401).json({ message: "Invalid demo credentials." });
  }
  try {
    await regenerateSession(req);
    req.session.userId = "demo-account";
    req.session.username = "Demo reader";
    req.session.avatarURL = undefined;
    await saveSession(req);
    return res.status(200).json({ user: { id: "demo-account", username: "Demo reader", email: "demo@example.com" } });
  } catch (error) { return next(error); }
});

router.get("/me", requireAuth, async (req, res, next) => {
  try {
    if (req.session.userId === "demo-account") {
      return res.status(200).json({ user: { id: "demo-account", username: req.session.username ?? "Demo reader", email: "demo@example.com", avatarURL: req.session.avatarURL } });
    }
    const user = await BlogUser.findById(req.session.userId);

    if (!user) {
      return res.status(401).json({ message: "Not logged in." });
    }

    return res.status(200).json({
      user: {
        id: user._id,
        username: user.username,
        email: user.email,
        avatarURL: user.avatarURL,
      },
    });
  } catch (error) {
    return next(error);
  }
});

router.patch("/me/profile", requireAuth, async (req, res, next) => {
  const result = profileSchema.safeParse(req.body);
  if (!result.success) return res.status(400).json(validationResponse(result));

  try {
    const updates = {};
    if (result.data.username !== undefined) updates.username = result.data.username;
    if (result.data.avatarURL !== undefined) {
      updates.avatarURL = result.data.avatarURL ?? "/avatars/default.svg";
    }

    if (req.session.userId === "demo-account") {
      if (updates.username !== undefined) req.session.username = updates.username;
      if (updates.avatarURL !== undefined) req.session.avatarURL = updates.avatarURL;
      await saveSession(req);
      return res.status(200).json({ message: "Profile updated.", user: { id: "demo-account", username: req.session.username ?? "Demo reader", email: "demo@example.com", avatarURL: req.session.avatarURL } });
    }

    const user = await BlogUser.findByIdAndUpdate(
      req.session.userId,
      { $set: updates },
      { new: true, runValidators: true },
    );
    if (!user) return res.status(404).json({ message: "Account not found." });

    return res.status(200).json({
      message: "Profile updated.",
      user: { id: user._id, username: user.username, email: user.email, avatarURL: user.avatarURL },
    });
  } catch (error) {
    if (error.code === 11000) {
      return res.status(409).json({ field: "username", message: "That username is already taken." });
    }
    return next(error);
  }
});

router.patch("/me/password", requireAuth, async (req, res, next) => {
  const result = changePasswordSchema.safeParse(req.body);
  if (!result.success) return res.status(400).json(validationResponse(result));

  try {
    const user = await BlogUser.findById(req.session.userId).select("+passwordHash");
    if (!user) return res.status(404).json({ message: "Account not found." });

    const matches = await bcrypt.compare(result.data.currentPassword, user.passwordHash);
    if (!matches) return res.status(400).json({ message: "Current password is incorrect." });

    user.passwordHash = await bcrypt.hash(result.data.newPassword, 12);
    await user.save();
    return res.status(200).json({ message: "Password updated." });
  } catch (error) {
    return next(error);
  }
});

router.delete("/me", requireAuth, async (req, res, next) => {
  try {
    const userId = req.session.userId;
    await BlogPost.deleteMany({ ownerId: userId, isDemoSeed: { $ne: true } });
    const likedPosts = await BlogPost.find({ likedBy: userId });
    for (const post of likedPosts) { post.likedBy.pull(userId); post.likes = Math.max(0, post.likes - 1); await post.save(); }
    await BlogPost.updateMany({ "comments.userId": userId }, { $pull: { comments: { userId } } });
    const postsWithReplies = await BlogPost.find({ "comments.replies.userId": userId });
    for (const post of postsWithReplies) {
      for (const comment of post.comments) comment.replies = comment.replies.filter((reply) => reply.userId !== userId);
      await post.save();
    }
    await BlogHistory.deleteMany({ userId });
    if (userId !== "demo-account") await BlogUser.findByIdAndDelete(userId);
    req.session.destroy((error) => {
      if (error) return next(error);
      res.clearCookie("blog.sid", {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: process.env.NODE_ENV === "production" ? "none" : "lax",
        path: "/",
      });
      return res.status(204).end();
    });
  } catch (error) {
    return next(error);
  }
});

router.post("/logout", (req, res, next) => {
  req.session.destroy((error) => {
    if (error) return next(error);

    res.clearCookie("blog.sid", {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: process.env.NODE_ENV === "production" ? "none" : "lax",
      path: "/",
    });

    return res.status(204).end();
  });
});

export default router;
