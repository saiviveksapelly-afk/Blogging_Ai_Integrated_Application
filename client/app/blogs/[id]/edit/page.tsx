"use client";

import { Suspense } from "react";
import { useParams } from "next/navigation";
import { BlogEditor } from "../../BlogEditor";

function EditBlogContent() {
  const params = useParams<{ id: string }>();
  return <BlogEditor postId={params.id} />;
}

export default function EditBlogPage() {
  return <Suspense fallback={<main className="min-h-screen bg-[#f7f6f2] px-5 py-20 text-center text-sm text-zinc-500">Loading editor…</main>}><EditBlogContent /></Suspense>;
}
