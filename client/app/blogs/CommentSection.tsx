"use client";

import { useState } from "react";
import type { FormEvent } from "react";
import { UserAvatar } from "./UserAvatar";
import type { BlogPost, CurrentUser } from "./data";

export function CommentSection({ post, currentUser, onChange }: { post: BlogPost; currentUser: CurrentUser | null; onChange: (post: BlogPost) => void }) {
  const [commentText, setCommentText] = useState("");
  const [replyingTo, setReplyingTo] = useState<number | null>(null);
  const [replyText, setReplyText] = useState("");
  const [editingComment, setEditingComment] = useState<number | null>(null);
  const [editingCommentText, setEditingCommentText] = useState("");
  const [editingReply, setEditingReply] = useState<{ comment: number; reply: number } | null>(null);
  const [editingReplyText, setEditingReplyText] = useState("");

  function saveComments(comments: BlogPost["comments"]) {
    onChange({ ...post, comments });
  }

  function addComment(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!currentUser || !commentText.trim()) return;
    saveComments([...post.comments, { author: currentUser.name, userId: currentUser.id, avatarURL: currentUser.avatarURL, text: commentText.trim(), date: "Just now", replies: [] }]);
    setCommentText("");
  }

  function addReply(event: FormEvent<HTMLFormElement>, commentIndex: number) {
    event.preventDefault();
    if (!currentUser || !replyText.trim()) return;
    saveComments(post.comments.map((comment, index) => index === commentIndex
      ? { ...comment, replies: [...(comment.replies ?? []), { author: currentUser.name, userId: currentUser.id, avatarURL: currentUser.avatarURL, text: replyText.trim(), date: "Just now" }] }
      : comment));
    setReplyText(""); setReplyingTo(null);
  }

  function saveCommentEdit(event: FormEvent<HTMLFormElement>, commentIndex: number) {
    event.preventDefault();
    if (!editingCommentText.trim()) return;
    saveComments(post.comments.map((comment, index) => index === commentIndex ? { ...comment, text: editingCommentText.trim() } : comment));
    setEditingComment(null); setEditingCommentText("");
  }

  function deleteComment(commentIndex: number) {
    if (!window.confirm("Delete this comment and its replies?")) return;
    saveComments(post.comments.filter((_, index) => index !== commentIndex));
  }

  function saveReplyEdit(event: FormEvent<HTMLFormElement>, commentIndex: number, replyIndex: number) {
    event.preventDefault();
    if (!editingReplyText.trim()) return;
    const comments = post.comments.map((comment, index) => index === commentIndex
      ? { ...comment, replies: (comment.replies ?? []).map((reply, position) => position === replyIndex ? { ...reply, text: editingReplyText.trim() } : reply) }
      : comment);
    saveComments(comments); setEditingReply(null); setEditingReplyText("");
  }

  function deleteReply(commentIndex: number, replyIndex: number) {
    if (!window.confirm("Delete this reply?")) return;
    saveComments(post.comments.map((comment, index) => index === commentIndex
      ? { ...comment, replies: (comment.replies ?? []).filter((_, position) => position !== replyIndex) }
      : comment));
  }

  return <section className="mx-auto mt-12 max-w-3xl">
    <div className="mb-6"><p className="mb-2 text-xs font-semibold uppercase tracking-[0.16em] text-[#a26d53]">The conversation</p><h2 className="font-serif text-3xl">Responses <span className="text-zinc-400">({post.comments.length})</span></h2></div>
    {currentUser ? <form onSubmit={addComment} className="flex gap-3 rounded-2xl border border-black/5 bg-white p-4 sm:p-5"><UserAvatar name={currentUser.name} avatarURL={currentUser.avatarURL} className="h-10 w-10 shrink-0" /><div className="min-w-0 flex-1"><label htmlFor="new-comment" className="mb-2 block text-sm font-semibold">{currentUser.name}</label><textarea id="new-comment" value={commentText} onChange={(event) => setCommentText(event.target.value)} rows={3} maxLength={1000} placeholder="Write a thoughtful comment…" className="w-full resize-y rounded-xl bg-[#f7f6f2] p-4 text-sm leading-6 outline-none focus:ring-2 focus:ring-[#c88f72]/30" /><div className="mt-3 flex justify-end"><button className="rounded-full bg-[#30342e] px-5 py-2.5 text-sm text-white hover:bg-[#484c45]">Post comment</button></div></div></form> : <p className="rounded-2xl bg-white p-5 text-sm text-zinc-500">Log in to join the conversation.</p>}
    <div className="mt-6 space-y-4">{post.comments.map((comment, commentIndex) => {
      const ownsComment = Boolean(currentUser && currentUser.id === comment.userId);
      return <article key={`${comment.userId ?? comment.author}-${commentIndex}`} className="rounded-2xl bg-white p-5">
        <div className="flex gap-3"><UserAvatar name={comment.author} avatarURL={comment.avatarURL} className="h-10 w-10 shrink-0" /><div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center justify-between gap-2"><p className="text-sm font-semibold text-zinc-800">{comment.author}</p><time className="text-xs text-zinc-400">{comment.date}</time></div>
          {editingComment === commentIndex ? <form onSubmit={(event) => saveCommentEdit(event, commentIndex)} className="mt-2"><textarea autoFocus rows={3} maxLength={1000} value={editingCommentText} onChange={(event) => setEditingCommentText(event.target.value)} className="w-full rounded-xl bg-[#f7f6f2] p-3 text-sm leading-6 outline-none focus:ring-2 focus:ring-[#c88f72]/30" /><div className="mt-2 flex gap-2"><button className="rounded-full bg-[#30342e] px-4 py-2 text-xs text-white">Save edit</button><button type="button" onClick={() => setEditingComment(null)} className="rounded-full px-3 py-2 text-xs text-zinc-500">Cancel</button></div></form> : <p className="mt-2 border-t border-black/5 pt-3 text-sm leading-7 text-zinc-600">{comment.text}</p>}
          <div className="mt-3 flex gap-4">{currentUser && <button type="button" onClick={() => { setReplyingTo(replyingTo === commentIndex ? null : commentIndex); setReplyText(""); }} className="text-xs font-semibold text-[#9b674e] hover:underline">{replyingTo === commentIndex ? "Cancel reply" : "Reply"}</button>}{ownsComment && editingComment !== commentIndex && <button type="button" onClick={() => { setEditingComment(commentIndex); setEditingCommentText(comment.text); }} className="text-xs text-zinc-500 hover:underline">Edit</button>}{ownsComment && <button type="button" onClick={() => deleteComment(commentIndex)} className="text-xs text-zinc-500 hover:text-red-700 hover:underline">Delete</button>}</div>
          {replyingTo === commentIndex && currentUser && <form onSubmit={(event) => addReply(event, commentIndex)} className="mt-4 flex gap-2 border-l-2 border-[#e8e3d9] pl-3"><UserAvatar name={currentUser.name} avatarURL={currentUser.avatarURL} className="h-8 w-8 shrink-0" /><div className="min-w-0 flex-1"><label className="mb-1 block text-xs font-semibold">{currentUser.name}</label><textarea autoFocus rows={2} maxLength={1000} value={replyText} onChange={(event) => setReplyText(event.target.value)} placeholder={`Reply to ${comment.author}…`} className="w-full rounded-xl bg-[#f7f6f2] p-3 text-sm outline-none focus:ring-2 focus:ring-[#c88f72]/30" /><button className="mt-2 rounded-full bg-[#30342e] px-4 py-2 text-xs text-white">Post reply</button></div></form>}
          {Boolean(comment.replies?.length) && <div className="mt-4 space-y-3 border-l-2 border-[#e8e3d9] pl-4">{comment.replies?.map((reply, replyIndex) => {
            const ownsReply = Boolean(currentUser && currentUser.id === reply.userId);
            const isEditing = editingReply?.comment === commentIndex && editingReply.reply === replyIndex;
            return <div key={`${reply.userId ?? reply.author}-${replyIndex}`} className="flex gap-2"><UserAvatar name={reply.author} avatarURL={reply.avatarURL} className="h-8 w-8 shrink-0" /><div className="min-w-0 flex-1"><div className="flex flex-wrap items-center justify-between gap-2"><p className="text-xs font-semibold text-zinc-800">{reply.author}</p><time className="text-[11px] text-zinc-400">{reply.date}</time></div>{isEditing ? <form onSubmit={(event) => saveReplyEdit(event, commentIndex, replyIndex)} className="mt-2"><textarea autoFocus rows={2} maxLength={1000} value={editingReplyText} onChange={(event) => setEditingReplyText(event.target.value)} className="w-full rounded-xl bg-[#f7f6f2] p-3 text-sm outline-none focus:ring-2 focus:ring-[#c88f72]/30" /><div className="mt-2 flex gap-2"><button className="rounded-full bg-[#30342e] px-3 py-1.5 text-xs text-white">Save</button><button type="button" onClick={() => setEditingReply(null)} className="text-xs text-zinc-500">Cancel</button></div></form> : <p className="mt-2 border-t border-black/5 pt-2 text-sm leading-6 text-zinc-600">{reply.text}</p>}{ownsReply && <div className="mt-2 flex gap-3"><button type="button" onClick={() => { setEditingReply({ comment: commentIndex, reply: replyIndex }); setEditingReplyText(reply.text); }} className="text-xs text-zinc-500 hover:underline">Edit</button><button type="button" onClick={() => deleteReply(commentIndex, replyIndex)} className="text-xs text-zinc-500 hover:text-red-700 hover:underline">Delete</button></div>}</div></div>;
          })}</div>}
        </div></div>
      </article>;
    })}</div>
  </section>;
}
