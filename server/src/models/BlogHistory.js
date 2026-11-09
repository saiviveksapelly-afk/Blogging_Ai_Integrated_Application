import mongoose from "mongoose";

const blogHistorySchema = new mongoose.Schema({
  userId: { type: String, required: true },
  postId: { type: String, required: true },
  title: { type: String, required: true },
  visitedAt: { type: Date, default: Date.now },
}, { timestamps: true, versionKey: false });

blogHistorySchema.index({ userId: 1, postId: 1 }, { unique: true });
blogHistorySchema.index({ userId: 1, visitedAt: -1 });

const BlogHistory = mongoose.models.BlogHistory || mongoose.model("BlogHistory", blogHistorySchema, "bloghistory");
export default BlogHistory;
