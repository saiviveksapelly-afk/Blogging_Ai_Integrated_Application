# AI-Integrated Blogging Platform

A full-stack blogging app where writers can publish stories, interact with each other, and get AI proofreading suggestions while they write. Built with **Next.js 16 + TypeScript** on the front end and **Express 5 + MongoDB** on the back end, with a security-first API.

## Features

- **Accounts:** register, log in, log out, update username and avatar, change password, delete account (with cleanup of the user's posts, likes, comments and history)
- **Blogging:** rich-text editor (bold, italic, headings, inline images with resizing), cover images, tags, create / edit / delete your own posts
- **Engagement:** likes, comments, and nested replies, each editable and deletable only by their author
- **Reading history:** recently visited posts per user
- **AI writing review:** one click sends a draft to an LLM that returns spelling, grammar and clarity suggestions you can apply individually
- **Demo account:** try the app without registering

## Tech Stack

| Layer | Tools |
| --- | --- |
| Client | Next.js 16, React 19, TypeScript, Tailwind CSS 4 |
| Server | Node.js, Express 5 (ES modules) |
| Database | MongoDB with Mongoose 9 |
| AI | LongCat chat-completions API (called from the server only) |

## Security

Security was a design goal from the start. Here is each package and exactly how it is used.

### Zod: validate every input at the boundary

Every route that accepts data parses it with a Zod schema before touching the database. Invalid input is rejected with a `400` and field-level error messages.

- **Registration:** username is trimmed, lowercased, 3-20 characters and restricted to `a-z`, `0-9` and `_`; email is validated and normalized; passwords must be 8+ characters and at most 72 bytes (bcrypt's limit); a `.refine()` checks that password and confirmation match.
- **Login:** email and password are parsed with the same schemas.
- **Profile updates:** avatar uploads must match a strict `data:image/jpeg;base64,...` pattern and a size cap.
- **Blog posts:** title, excerpt, tags, cover scale and position all have length and range limits. Request bodies are never trusted as-is.
- **Comments and likes:** comment text is trimmed and length-limited; the like toggle must be a real boolean.
- **AI endpoint:** the request is validated going in, and the **LLM's response is validated coming out**. The model's JSON is parsed against a Zod schema (field enum, length limits, max 30 suggestions) before anything reaches the client, so a malformed or malicious model reply cannot break the UI.

### Helmet: secure HTTP headers

`helmet()` is applied globally in `server.js`, setting protective headers such as `X-Content-Type-Options`, `Strict-Transport-Security` and `X-Frame-Options`, which reduce clickjacking, MIME sniffing and similar browser-level attacks. The `X-Powered-By` header is also disabled so the server doesn't advertise Express.

### bcryptjs: password hashing

- Passwords are hashed with **bcrypt at cost factor 12** and never stored in plain text.
- The hash field uses `select: false` in the Mongoose schema, so it is never returned by a query unless explicitly requested.
- Login always runs a `bcrypt.compare`, even when the email doesn't exist (against a dummy hash generated at startup). This keeps response timing similar and reduces user-enumeration via timing.
- Login failures return one generic message ("Invalid email or password.") regardless of which part was wrong.

### express-rate-limit: brute-force and abuse protection

Per-route limiters keep attackers (and runaway scripts) in check:

| Route | Limit |
| --- | --- |
| `POST /api/auth/register` | 5 requests / 15 min |
| `POST /api/auth/login` | 10 requests / 15 min |
| `POST /api/ai/suggestions` | 12 requests / 15 min (also protects the LLM API bill) |

### express-session + connect-mongo: server-side sessions

- Sessions are stored in **MongoDB** (7-day TTL) rather than in signed client-side tokens, so they can be revoked server-side.
- The session cookie is `httpOnly` (not readable by JavaScript), `secure` in production, and `sameSite` is set per environment (`none` for a cross-site production deployment, `lax` in development).
- The session ID is **regenerated on login** to prevent session fixation, and **destroyed on logout** with the cookie cleared.
- The server refuses to start if `SESSION_SECRET` is missing.

### CORS

`cors` is locked to a single allowed origin (`CLIENT_URL`) with `credentials: true`, instead of a wildcard.

### Authorization, not just authentication

A small `requireAuth` middleware protects all write endpoints. On top of that, ownership is enforced per resource:

- Editing or deleting a post requires `post.ownerId === session.userId` (otherwise `403`).
- Editing or deleting a comment or reply requires that you wrote it (otherwise `403`).

### HTML sanitization for blog content

Post bodies are rich HTML, so the server runs them through an allowlist sanitizer before saving. It strips comments and dangerous elements (`script`, `style`, `iframe`, `svg`, `form`, etc.), keeps only a small set of formatting tags, removes all attributes, and only allows images from `https://` or base64 `jpeg/png/webp` sources.

### Safe handling of the AI integration

- The LLM API key lives **only on the server** in an environment variable and is never exposed to the browser.
- The system prompt tells the model to treat the blog text as data and ignore any instructions inside it (prompt-injection mitigation), and the output is schema-validated (see Zod above).
- The call has a 45-second timeout, and upstream errors are mapped to friendly messages without leaking details.

### Other hygiene

- Environment variables are never committed (`.env` is git-ignored, `.env.example` documents the required keys).
- A centralized error handler returns a generic `500` message instead of stack traces.
- Request body size is capped (`express.json({ limit })`).

## Project Structure

```
.
├── client/                 # Next.js app (App Router)
│   └── app/
│       ├── blogs/          # list, detail, editor, comments, API client
│       ├── account/        # profile, avatar, password, delete account
│       ├── login/
│       └── register/
└── server/
    └── src/
        ├── config/         # MongoDB connection
        ├── middleware/     # requireAuth
        ├── models/         # User, BlogPost, BlogHistory, DeletedDemoPost
        ├── routes/         # authRoutes, blogRoutes, aiRoutes
        └── server.js
```

## Getting Started

### Prerequisites

- Node.js 20+
- A MongoDB database (local or MongoDB Atlas)
- A LongCat API key (optional; only needed for AI suggestions)

### 1. Server

```bash
cd server
npm install
cp .env.example .env
```

Fill in `.env`:

```env
MONGODB_URI=mongodb://localhost:27017/blog
SESSION_SECRET=use-a-long-random-string
CLIENT_URL=http://localhost:3000
PORT=5000
LONGCAT_API_KEY=your-key-here
LONGCAT_MODEL=LongCat-2.5
```

```bash
npm run dev
```

The API runs at `http://localhost:5000` (health check: `/api/health`).

### 2. Client

```bash
cd client
npm install
```

Optionally create `client/.env.local` if your API isn't on port 5000:

```env
NEXT_PUBLIC_API_URL=http://localhost:5000
```

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## API Overview

| Method | Endpoint | Auth | Description |
| --- | --- | --- | --- |
| POST | `/api/auth/register` | - | Create an account |
| POST | `/api/auth/login` | - | Log in |
| POST | `/api/auth/logout` | - | Log out |
| GET | `/api/auth/me` | Yes | Current user |
| PATCH | `/api/auth/me/profile` | Yes | Update username / avatar |
| PATCH | `/api/auth/me/password` | Yes | Change password |
| DELETE | `/api/auth/me` | Yes | Delete account |
| GET | `/api/blogs` | - | List posts |
| GET | `/api/blogs/:id` | - | Get a post |
| POST | `/api/blogs` | Yes | Create a post |
| PUT / DELETE | `/api/blogs/:id` | Owner | Edit / delete a post |
| POST | `/api/blogs/:id/like` | Yes | Like or unlike |
| POST | `/api/blogs/:id/comments` | Yes | Add a comment |
| PATCH / DELETE | `/api/blogs/:id/comments/:commentId` | Author | Edit / delete a comment |
| POST | `/api/blogs/:id/comments/:commentId/replies` | Yes | Reply to a comment |
| GET | `/api/blogs/history` | Yes | Reading history |
| POST | `/api/ai/suggestions` | Yes | AI proofreading suggestions |

## Testing

Playwright end-to-end tests are planned (auth flows, blog CRUD, comments, ownership checks, and a mocked AI endpoint).

live : https://blogging-ai-integrated-application.vercel.app/
