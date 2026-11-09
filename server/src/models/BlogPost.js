import mongoose from "mongoose";

const replySchema = new mongoose.Schema({
  author: { type: String, required: true }, userId: { type: String, required: true },
  avatarURL: String, text: { type: String, required: true, maxlength: 1000 }, date: { type: String, required: true },
}, { timestamps: true });

const commentSchema = new mongoose.Schema({
  author: { type: String, required: true }, userId: { type: String, required: true },
  avatarURL: String, text: { type: String, required: true, maxlength: 1000 }, date: { type: String, required: true },
  replies: { type: [replySchema], default: [] },
}, { timestamps: true });

const blogPostSchema = new mongoose.Schema({
  _id: { type: String },
  title: { type: String, required: true, trim: true, maxlength: 120 },
  excerpt: { type: String, maxlength: 300, default: "" }, body: { type: String, required: true },
  author: { type: String, required: true }, ownerId: { type: String, required: true, index: true },
  date: { type: String, required: true }, readTime: { type: String, required: true },
  tags: { type: [String], default: [] }, image: { type: String, default: "/blog-covers/writing.svg" },
  coverScale: { type: Number, default: 115 }, coverPosition: { x: { type: Number, default: 50 }, y: { type: Number, default: 50 } },
  accent: { type: String, default: "#d9c8b5" }, likes: { type: Number, default: 0 }, likedBy: { type: [String], default: [] },
  comments: { type: [commentSchema], default: [] }, updatedAtLabel: String, isDemoSeed: { type: Boolean, default: false }, isDeleted: { type: Boolean, default: false },
}, { timestamps: true, versionKey: false });

const BlogPost = mongoose.models.BlogPost || mongoose.model("BlogPost", blogPostSchema, "blogposts");
export default BlogPost;
