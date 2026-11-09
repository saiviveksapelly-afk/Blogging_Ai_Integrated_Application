export type BlogPost = {
  id: string;
  title: string;
  excerpt: string;
  body: string;
  author: string;
  ownerId?: string;
  date: string;
  readTime: string;
  tags: string[];
  image: string;
  coverScale?: number;
  coverPosition?: { x: number; y: number };
  accent: string;
  likes: number;
  comments: BlogComment[];
  updatedAt?: string;
};

export type BlogComment = {
  author: string;
  userId?: string;
  avatarURL?: string;
  text: string;
  date: string;
  replies?: { author: string; userId?: string; avatarURL?: string; text: string; date: string }[];
};

export const demoPosts: BlogPost[] = [
  {
    id: "quiet-mornings", title: "The quiet art of starting again", excerpt: "A small reminder that beginnings don't need to be loud to be meaningful.",
    body: "<p>Some mornings arrive without a plan. The light finds its way across the floor, the kettle begins to hum, and for a little while the world asks nothing of us.</p><p>I've started to think that beginning again is less like turning a page and more like opening a window. You don't need to erase what came before. You only need to let a little fresh air in.</p><h2>Make room for the small things</h2><p>A walk around the block. A note to someone you miss. Ten minutes spent with an idea before deciding whether it's worth pursuing. These ordinary acts have a way of carrying us forward.</p><p>Maybe that's enough for today: one small thing, done with care.</p>",
    author: "Maya Chen", date: "Nov 8, 2026", readTime: "4 min read", tags: ["mindfulness", "life", "writing"], image: "/blog-covers/morning.svg", accent: "#e9c9a7", likes: 28, comments: [{ author: "Jamie Park", text: "This is exactly the reminder I needed today.", date: "2 hours ago" }],
  },
  {
    id: "slow-travel", title: "A slower way to see a city", excerpt: "On getting lost on purpose, and finding the places guidebooks leave out.",
    body: "<p>The best day of my last trip began with a missed turn. I put the map away and followed a narrow street downhill, past shuttered bakeries and balconies full of plants.</p><p>Travel can become a checklist if we let it. But the moments I remember most are usually the ones I couldn't have planned: a conversation over coffee, a tiny bookshop, the quiet square where locals gather at dusk.</p><h2>Leave a little space</h2><p>Choose one thing you want to see, then leave the rest of the day open. Walk slowly enough to notice what's already there.</p>",
    author: "Demo reader", ownerId: "demo-account", date: "Nov 6, 2026", readTime: "5 min read", tags: ["travel", "slow living", "life"], image: "/blog-covers/travel.svg", accent: "#b7c5b2", likes: 42, comments: [],
  },
  {
    id: "creative-routine", title: "Build a creative routine that bends", excerpt: "Consistency works better when it can make room for real life.",
    body: "<p>For years, I thought a creative practice needed a perfect schedule. The truth is that life rarely gives us a perfect stretch of uninterrupted time.</p><p>What helped was making the practice smaller and more flexible. I keep a notebook in my bag. I set a gentle minimum: one paragraph, one sketch, one question worth following.</p><h2>Return without guilt</h2><p>A routine is a path you can find again. Missing a day doesn't erase the path. The point is to make returning feel easy.</p>",
    author: "Jordan Ellis", date: "Nov 4, 2026", readTime: "3 min read", tags: ["creativity", "habits", "writing"], image: "/blog-covers/writing.svg", accent: "#e0b9ae", likes: 19, comments: [{ author: "Demo reader", userId: "demo-account", text: "The smaller minimum makes all the difference.", date: "Yesterday" }],
  },
  {
    id: "city-gardens", title: "What a city garden teaches us", excerpt: "A little patch of green can change the way a whole neighborhood feels.",
    body: "<p>There is a garden between two apartment buildings that I walk past every morning. In spring, it is mostly potential. By summer, the tomatoes lean over their stakes and the marigolds spill onto the path.</p><p>People who had never spoken before now trade seedlings and weather reports. The garden doesn't solve everything, but it gives people a reason to show up for one another.</p><h2>Care is a shared practice</h2><p>Perhaps that's what growing things in a city really offers: a reminder that good things can take root even in unlikely places.</p>",
    author: "Sam Rivera", date: "Nov 2, 2026", readTime: "4 min read", tags: ["community", "nature", "city life"], image: "/blog-covers/garden.svg", accent: "#b9c9ad", likes: 35, comments: [],
  },
  {
    id: "reading-notes", title: "Reading with a pencil in hand", excerpt: "A few notes on making more of the books we bring into our lives.",
    body: "<p>I used to treat books as things to finish. Now I treat them more like conversations: worth pausing, circling back, and sometimes disagreeing with.</p><p>A pencil in the margin slows me down. It turns reading from a race into a relationship with the page.</p><h2>Keep the thought close</h2><p>When a sentence stays with you, write down why. The answer is often more interesting than the sentence itself.</p>",
    author: "Demo reader", ownerId: "demo-account", date: "Oct 29, 2026", readTime: "3 min read", tags: ["books", "learning", "writing"], image: "/blog-covers/books.svg", accent: "#d5c2a7", likes: 24, comments: [],
  },
  {
    id: "weekend-cooking", title: "The joy of cooking without a recipe", excerpt: "Start with what's in the fridge, and let dinner become its own kind of story.",
    body: "<p>Some of my favorite meals began with no plan at all. A soft onion in a pan, whatever greens need using, a handful of herbs from the windowsill.</p><p>Cooking this way asks you to pay attention. Taste as you go. Add a little acid. Wait before adding more salt. The kitchen becomes a place to practice trusting your senses.</p><h2>Good enough is delicious</h2><p>Not every experiment becomes a keeper. That's part of the fun. A meal can simply be warm, shared, and enough.</p>",
    author: "Priya Nair", date: "Oct 25, 2026", readTime: "4 min read", tags: ["food", "home", "slow living"], image: "/blog-covers/cooking.svg", accent: "#e2c391", likes: 31, comments: [],
  },
];

export const DEMO_USER_ID = "demo-account";
export const CURRENT_USER_STORAGE_KEY = "blog.current.user.v1";
export const DEMO_PASSWORD_STORAGE_KEY = "blog.demo.password.v1";
export const POSTS_STORAGE_KEY = "blog.demo.posts.v1";
export const HISTORY_STORAGE_KEY = "blog.demo.history.v1";

export type CurrentUser = { id: string; name: string; email?: string; avatarURL?: string };

export function readCurrentUser(): CurrentUser | null {
  if (typeof window === "undefined") return null;
  try {
    const user = JSON.parse(window.localStorage.getItem(CURRENT_USER_STORAGE_KEY) ?? "null") as CurrentUser | null;
    return user && typeof user.id === "string" && typeof user.name === "string" ? user : null;
  } catch {
    return null;
  }
}

export function saveCurrentUser(user: CurrentUser) {
  window.localStorage.setItem(CURRENT_USER_STORAGE_KEY, JSON.stringify(user));
}

export function readDemoPassword() {
  return window.localStorage.getItem(DEMO_PASSWORD_STORAGE_KEY) ?? "demopassword";
}

export function readPosts(): BlogPost[] {
  if (typeof window === "undefined") return demoPosts;
  try {
    const saved = window.localStorage.getItem(POSTS_STORAGE_KEY);
    if (!saved) return demoPosts;
    const posts = JSON.parse(saved) as BlogPost[];
    // Posts created by the previous demo version used "You" as their owner label.
    return posts.map((post) => ({
      ...post,
      ...(post.author === "You" && !post.ownerId ? { author: "Demo reader", ownerId: DEMO_USER_ID } : {}),
      comments: (post.comments ?? []).map((comment) => ({
        ...comment,
        ...(comment.author === "You" && !comment.userId ? { author: "Demo reader", userId: DEMO_USER_ID } : {}),
        replies: (comment.replies ?? []).map((reply) => reply.author === "You" && !reply.userId
          ? { ...reply, author: "Demo reader", userId: DEMO_USER_ID }
          : reply),
      })),
    }));
  } catch {
    return demoPosts;
  }
}

export function writePosts(posts: BlogPost[]) {
  window.localStorage.setItem(POSTS_STORAGE_KEY, JSON.stringify(posts));
}

export function deleteOwnedPost(postId: string, ownerId: string) {
  const posts = readPosts();
  const target = posts.find((post) => post.id === postId);
  if (!target || target.ownerId !== ownerId) return null;
  const remaining = posts.filter((post) => post.id !== postId);
  writePosts(remaining);
  try {
    const history = JSON.parse(window.localStorage.getItem(HISTORY_STORAGE_KEY) ?? "[]") as { id: string }[];
    window.localStorage.setItem(HISTORY_STORAGE_KEY, JSON.stringify(history.filter((entry) => entry.id !== postId)));
  } catch {
    window.localStorage.removeItem(HISTORY_STORAGE_KEY);
  }
  return remaining;
}

export function recordVisit(post: BlogPost) {
  try {
    const history = JSON.parse(window.localStorage.getItem(HISTORY_STORAGE_KEY) ?? "[]") as { id: string; title: string; at: string }[];
    const next = [{ id: post.id, title: post.title, at: new Date().toISOString() }, ...history.filter((entry) => entry.id !== post.id)].slice(0, 8);
    window.localStorage.setItem(HISTORY_STORAGE_KEY, JSON.stringify(next));
  } catch {
    window.localStorage.setItem(HISTORY_STORAGE_KEY, JSON.stringify([{ id: post.id, title: post.title, at: new Date().toISOString() }]));
  }
}
