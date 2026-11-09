import mongoose from "mongoose";

const deletedDemoPostSchema = new mongoose.Schema({
  _id: { type: String },
  deletedAt: { type: Date, default: Date.now },
}, { versionKey: false });

const DeletedDemoPost = mongoose.models.DeletedDemoPost || mongoose.model("DeletedDemoPost", deletedDemoPostSchema, "deleteddemoposts");
export default DeletedDemoPost;
