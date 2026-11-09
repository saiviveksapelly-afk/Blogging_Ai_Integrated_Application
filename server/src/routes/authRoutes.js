import { randomBytes } from "node:crypto";
import { Router } from "express";
import { rateLimit } from "express-rate-limit";
import bcrypt from "bcryptjs";
import { z } from "zod";
import BlogUser from "../models/User.js";
import { requireAuth } from "../middleware/requireAuth.js";

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

router.get("/me", requireAuth, async (req, res, next) => {
  try {
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
    await BlogUser.findByIdAndDelete(req.session.userId);
    req.session.destroy((error) => {
      if (error) return next(error);
      res.clearCookie("blog.sid", {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
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
      sameSite: "lax",
      path: "/",
    });

    return res.status(204).end();
  });
});

export default router;
