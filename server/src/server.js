import "dotenv/config";
import cors from "cors";
import express from "express";
import helmet from "helmet";
import session from "express-session";
import MongoStore from "connect-mongo";
import { connectDB } from "./config/db.js";
import authRoutes from "./routes/authRoutes.js";
import blogRoutes from "./routes/blogRoutes.js";
import aiRoutes from "./routes/aiRoutes.js";

const app = express();
app.set("trust proxy", 1);
const port = process.env.PORT || 5000;
const clientUrl = process.env.CLIENT_URL || "http://localhost:3000";
const sessionSecret = process.env.SESSION_SECRET;

if (!sessionSecret) {
  throw new Error("SESSION_SECRET is missing from the environment.");
}

app.disable("x-powered-by");
app.use(helmet());
app.use(
  cors({
    origin: clientUrl,
    credentials: true,
  }),
);
app.use(express.json({ limit: "15mb" }));

app.use(
  session({
    name: "blog.sid",
    secret: sessionSecret,
    store: MongoStore.create({
      mongoUrl: process.env.MONGODB_URI,
      collectionName: "sessions",
      ttl: 7 * 24 * 60 * 60,
    }),
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: process.env.NODE_ENV === "production" ? "none" : "lax",
      maxAge: 7 * 24 * 60 * 60 * 1000,
    },
  }),
);

app.get("/api/health", (_req, res) => {
  res.json({ ok: true, service: "blog-api" });
});

app.use("/api/auth", authRoutes);
app.use("/api/blogs", blogRoutes);
app.use("/api/ai", aiRoutes);

app.use("/api", (_req, res) => {
  res.status(404).json({ message: "API route not found." });
});

app.use((error, _req, res, next) => {
  if (res.headersSent) return next(error);

  console.error("Request failed:", error.message);
  return res.status(500).json({ message: "Unexpected server error." });
});

async function startServer() {
  try {
    await connectDB();

    app.listen(port, () => {
      console.log(`Server is running on port ${port}`);
    });
  } catch (error) {
    console.error("Error starting server:", error.message);
    process.exit(1);
  }
}

startServer();
