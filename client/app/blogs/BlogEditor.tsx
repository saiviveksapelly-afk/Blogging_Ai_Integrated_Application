"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import type { PointerEvent as ReactPointerEvent } from "react";
import { useRouter } from "next/navigation";
import { BlogShell } from "./BlogShell";
import { readCurrentUser, type BlogPost, type CurrentUser } from "./data";
import { getPost, requestWritingSuggestions, savePost, type WritingSuggestion } from "./api";

const IMAGE_GUIDE = "Add a cover image, paste an image URL, or upload it from your device.";

function resizeImage(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("Could not read that image."));
    reader.onload = () => {
      const image = new Image();
      image.onerror = () => reject(new Error("That file is not a supported image."));
      image.onload = () => {
        const scale = Math.min(1, 1400 / image.width, 1000 / image.height);
        const canvas = document.createElement("canvas");
        canvas.width = Math.round(image.width * scale);
        canvas.height = Math.round(image.height * scale);
        canvas.getContext("2d")?.drawImage(image, 0, 0, canvas.width, canvas.height);
        resolve(canvas.toDataURL("image/jpeg", 0.78));
      };
      image.src = String(reader.result);
    };
    reader.readAsDataURL(file);
  });
}

function sanitizeContent(html: string) {
  const parsed = new DOMParser().parseFromString(html, "text/html");
  const allowed = new Set(["P", "BR", "H2", "STRONG", "B", "EM", "I", "UL", "OL", "LI", "BLOCKQUOTE", "IMG"]);
  const clean = (node: Node): Node | null => {
    if (node.nodeType === Node.TEXT_NODE) return document.createTextNode(node.textContent ?? "");
    if (!(node instanceof HTMLElement)) return null;
    if (!allowed.has(node.tagName)) {
      const fragment = document.createDocumentFragment();
      for (const child of Array.from(node.childNodes)) { const safe = clean(child); if (safe) fragment.appendChild(safe); }
      return fragment;
    }
    const safe = document.createElement(node.tagName.toLowerCase());
    if (node.tagName === "IMG") {
      const src = node.getAttribute("src") ?? "";
      if (!src.startsWith("data:image/") && !src.startsWith("https://")) return null;
      safe.setAttribute("src", src);
      safe.setAttribute("alt", node.getAttribute("alt") ?? "Blog image");
      safe.setAttribute("draggable", "false");
      safe.setAttribute("class", "blog-inline-image");
      const width = Math.min(100, Math.max(25, Number.parseInt(node.getAttribute("data-image-width") ?? node.style.maxWidth, 10) || 48));
      safe.setAttribute("data-image-width", String(width));
      const side = node.style.float === "right" ? "right" : "left";
      const margin = side === "right" ? "1rem 0 1rem 1.25rem" : "1rem 1.25rem 1rem 0";
      const clear = node.style.clear === "both" ? "both" : "none";
      safe.setAttribute("style", `max-width:${width}%;height:auto;border-radius:1rem;margin:${margin};float:${side};clear:${clear}`);
    } else {
      for (const child of Array.from(node.childNodes)) { const nested = clean(child); if (nested) safe.appendChild(nested); }
    }
    return safe;
  };
  const container = document.createElement("div");
  for (const child of Array.from(parsed.body.childNodes)) { const safe = clean(child); if (safe) container.appendChild(safe); }
  return container.innerHTML;
}

export function BlogEditor({ postId }: { postId?: string }) {
  const router = useRouter();
  const editor = useRef<HTMLDivElement>(null);
  const publishingRef = useRef(false);
  const savedRange = useRef<Range | null>(null);
  const selectedImage = useRef<HTMLImageElement | null>(null);
  const pointerImageDrag = useRef<{ image: HTMLImageElement; pointerId: number; startX: number; startY: number; active: boolean } | null>(null);
  const [existing, setExisting] = useState<BlogPost | null>(null);
  const [existingLoaded, setExistingLoaded] = useState(false);
  const [title, setTitle] = useState("");
  const [cover, setCover] = useState("");
  const [coverUrl, setCoverUrl] = useState("");
  const [tagsText, setTagsText] = useState("");
  const [notice, setNotice] = useState("");
  const [dragging, setDragging] = useState(false);
  const [coverScale, setCoverScale] = useState(115);
  const [coverPosition, setCoverPosition] = useState({ x: 50, y: 50 });
  const [bodyImageScale, setBodyImageScale] = useState(48);
  const [currentUser, setCurrentUser] = useState<CurrentUser | null>(null);
  const [identityLoaded, setIdentityLoaded] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [reviewing, setReviewing] = useState(false);
  const [suggestions, setSuggestions] = useState<WritingSuggestion[]>([]);
  const [aiNotice, setAiNotice] = useState("");

  useEffect(() => {
    const timer = window.setTimeout(() => {
      const user = readCurrentUser();
      setCurrentUser(user);
      setIdentityLoaded(true);
      if (!postId) return;
      if (!user) { setNotice("Log in before editing a story."); return; }
      void getPost(postId).then((post) => {
        if (post.ownerId !== user?.id) { setNotice("You can only edit stories you have published."); return; }
        setExisting(post); setTitle(post.title); setCover(post.image); setCoverUrl(post.image); setCoverScale(post.coverScale ?? 115); setCoverPosition(post.coverPosition ?? { x: 50, y: 50 }); setTagsText(post.tags.join(", "));
      }).catch(() => setNotice("This story could not be loaded from the server.")).finally(() => setExistingLoaded(true));
    }, 0);
    return () => window.clearTimeout(timer);
  }, [postId]);

  useEffect(() => {
    if (existing && editor.current) editor.current.innerHTML = sanitizeContent(existing.body);
  }, [existing]);

  function insertMarkup(markup: string) {
    editor.current?.focus();
    if (savedRange.current) {
      const selection = window.getSelection();
      selection?.removeAllRanges();
      selection?.addRange(savedRange.current);
      savedRange.current = null;
    }
    document.execCommand("insertHTML", false, markup);
  }

  function saveEditorSelection() {
    const selection = window.getSelection();
    if (selection?.rangeCount && editor.current?.contains(selection.anchorNode)) {
      savedRange.current = selection.getRangeAt(0).cloneRange();
    }
  }

  function startImageMove(event: ReactPointerEvent<HTMLDivElement>) {
    const image = (event.target as HTMLElement).closest("img");
    if (!(image instanceof HTMLImageElement) || !editor.current?.contains(image) || event.button !== 0) return;
    pointerImageDrag.current = { image, pointerId: event.pointerId, startX: event.clientX, startY: event.clientY, active: false };
    selectedImage.current = image;
    setBodyImageScale(Number.parseInt(image.dataset.imageWidth ?? image.style.maxWidth, 10) || 48);
    event.currentTarget.setPointerCapture(event.pointerId);
    event.preventDefault();
  }

  function trackImageMove(event: ReactPointerEvent<HTMLDivElement>) {
    const drag = pointerImageDrag.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    if (!drag.active && Math.hypot(event.clientX - drag.startX, event.clientY - drag.startY) > 5) {
      drag.active = true;
      drag.image.classList.add("editor-image-moving");
    }
    if (drag.active) event.preventDefault();
  }

  function finishImageMove(event: ReactPointerEvent<HTMLDivElement>) {
    const drag = pointerImageDrag.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    pointerImageDrag.current = null;
    drag.image.classList.remove("editor-image-moving");
    if (!drag.active) return;
    event.preventDefault();
    const range = document.caretRangeFromPoint?.(event.clientX, event.clientY);
    if (!range || !editor.current?.contains(range.startContainer)) return;
    const marker = document.createTextNode("\u200b");
    range.insertNode(marker);
    marker.parentNode?.insertBefore(drag.image, marker);
    marker.remove();
    const editorBounds = editor.current.getBoundingClientRect();
    const side = event.clientX > editorBounds.left + editorBounds.width / 2 ? "right" : "left";
    const margin = side === "right" ? "1rem 0 1rem 1.25rem" : "1rem 1.25rem 1rem 0";
    drag.image.style.float = side;
    drag.image.style.clear = "none";
    drag.image.style.margin = margin;
  }

  function cancelImageMove() {
    pointerImageDrag.current?.image.classList.remove("editor-image-moving");
    pointerImageDrag.current = null;
  }

  async function insertFiles(files: FileList | File[]) {
    const images = Array.from(files).filter((file) => file.type.startsWith("image/"));
    for (const file of images) {
      try { const url = await resizeImage(file); insertMarkup(`<img src="${url}" alt="Blog image" draggable="false" data-image-width="${bodyImageScale}" style="max-width:${bodyImageScale}%;height:auto;border-radius:1rem;margin:0.5rem 1.25rem 1rem 0;float:left;clear:both" />`); }
      catch { setNotice("That image could not be added. Try another file."); }
    }
  }

  async function chooseCover(file?: File) {
    if (!file || !file.type.startsWith("image/")) return;
    try { const image = await resizeImage(file); setCover(image); setCoverUrl(""); }
    catch { setNotice("That cover image could not be loaded."); }
  }

  async function reviewWriting() {
    const bodyText = editor.current?.innerText.trim() ?? "";
    if (!bodyText) { setAiNotice("Write some blog text first."); return; }
    setReviewing(true); setAiNotice(""); setSuggestions([]);
    try {
      const result = await requestWritingSuggestions(title, bodyText);
      setSuggestions(result);
      setAiNotice(result.length ? "Review each suggestion and accept the changes you want." : "LongCat found no spelling or grammar changes to suggest.");
    } catch (error) {
      setAiNotice(error instanceof Error ? error.message : "Could not get suggestions from LongCat.");
    } finally { setReviewing(false); }
  }

  function applySuggestion(suggestion: WritingSuggestion) {
    if (suggestion.field === "title") {
      const position = title.indexOf(suggestion.original);
      if (position < 0) return false;
      setTitle(title.slice(0, position) + suggestion.suggested + title.slice(position + suggestion.original.length));
      return true;
    }
    const root = editor.current;
    if (!root) return false;
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    let node = walker.nextNode();
    while (node) {
      const value = node.textContent ?? "";
      const position = value.indexOf(suggestion.original);
      if (position >= 0) {
        node.textContent = value.slice(0, position) + suggestion.suggested + value.slice(position + suggestion.original.length);
        return true;
      }
      node = walker.nextNode();
    }
    return false;
  }

  function acceptSuggestion(index: number) {
    const suggestion = suggestions[index];
    if (!suggestion) return;
    if (!applySuggestion(suggestion)) { setAiNotice("That text has changed since the review. Run the review again for current suggestions."); return; }
    setSuggestions((current) => current.filter((_, position) => position !== index));
    setAiNotice("Suggestion accepted in your draft. Save and publish when you are ready.");
  }

  function acceptAllSuggestions() {
    let accepted = 0;
    let nextTitle = title;
    suggestions.forEach((suggestion) => {
      if (suggestion.field === "title") {
        const position = nextTitle.indexOf(suggestion.original);
        if (position >= 0) { nextTitle = nextTitle.slice(0, position) + suggestion.suggested + nextTitle.slice(position + suggestion.original.length); accepted += 1; }
      } else if (applySuggestion(suggestion)) accepted += 1;
    });
    setTitle(nextTitle);
    setSuggestions([]);
    setAiNotice(accepted ? `Accepted ${accepted} suggestion${accepted === 1 ? "" : "s"} in your draft.` : "The suggested text has changed. Run the review again.");
  }

  async function publish() {
    // A ref locks synchronously, before React has a chance to disable the button.
    // This prevents two rapid clicks from opening two confirmations or writing two posts.
    if (publishingRef.current) return;
    publishingRef.current = true;
    if (!currentUser) { setNotice("Log in before publishing a story."); return; }
    const confirmation = existing
      ? "Save and publish these changes to your blog?"
      : "Publish this blog now? It will be visible to readers.";
    if (!window.confirm(confirmation)) { publishingRef.current = false; return; }
    const editorText = editor.current?.innerText.trim() ?? "";
    const body = sanitizeContent(editor.current?.innerHTML ?? "");
    if (!title.trim() || (!editorText && !/<img\b/i.test(body))) { setNotice("Add a title and some writing before you publish."); publishingRef.current = false; return; }
    setNotice("");
    setPublishing(true);
    const tags = Array.from(new Set(tagsText.split(",").map((tag) => tag.trim().replace(/^#/, "").toLowerCase()).filter(Boolean)));
    const publishedDate = new Date().toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
    const nextPost: BlogPost = {
      id: existing?.id ?? `story-${Date.now()}`, title: title.trim(), excerpt: editorText.slice(0, 150), body,
      author: currentUser.name, ownerId: currentUser.id, date: publishedDate, readTime: `${Math.max(1, Math.ceil(editorText.length / 900))} min read`, tags,
      image: cover || coverUrl || "/blog-covers/writing.svg", coverScale, coverPosition, accent: "#d9c8b5", likes: existing?.likes ?? 0, comments: existing?.comments ?? [],
      updatedAt: existing ? publishedDate : undefined,
    };
    try {
      const saved = await savePost(nextPost, Boolean(existing));
      router.push(`/blogs/${saved.id}`);
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "This story could not be saved to the server.");
      publishingRef.current = false;
      setPublishing(false);
    }
  }

  if (!identityLoaded) return <BlogShell><p className="py-20 text-center text-sm text-zinc-500">Loading your writing desk…</p></BlogShell>;
  if (postId && !existingLoaded) return <BlogShell><p className="py-20 text-center text-sm text-zinc-500">Loading your story…</p></BlogShell>;
  if (!currentUser) return <BlogShell><div className="mx-auto max-w-xl rounded-3xl bg-white p-8 text-center"><h1 className="font-serif text-3xl">Log in to write</h1><p className="mt-3 text-sm text-zinc-500">Your drafts and published stories belong to your account.</p><Link href="/login" className="mt-6 inline-flex rounded-full bg-[#30342e] px-5 py-3 text-sm text-white">Go to login</Link></div></BlogShell>;
  if (postId && !existing) return <BlogShell><div className="mx-auto max-w-xl rounded-3xl bg-white p-8 text-center"><h1 className="font-serif text-3xl">This isn&apos;t your story to edit</h1><p className="mt-3 text-sm text-zinc-500">Only the account that published a story can edit it.</p><Link href="/blogs/yours" className="mt-6 inline-flex rounded-full bg-[#30342e] px-5 py-3 text-sm text-white">Back to your blogs</Link></div></BlogShell>;

  return <BlogShell><div className="mx-auto max-w-3xl">
    <Link href={postId ? `/blogs/${postId}` : "/blogs"} className="mb-7 inline-flex items-center gap-2 text-sm text-zinc-500 hover:text-zinc-900">← <span>Back</span></Link>
    <p className="mb-2 text-xs font-semibold uppercase tracking-[0.18em] text-[#a26d53]">{existing ? "Your story, in progress" : "Make a little room for an idea"}</p>
    <h1 className="font-serif text-4xl tracking-tight sm:text-5xl">{existing ? "Edit your blog" : "Write a blog"}</h1>
    <p className="mt-3 text-sm leading-6 text-zinc-500">Write freely. Published stories are stored in MongoDB and shared with readers.</p>

    <div className="mt-8 space-y-6 rounded-[1.75rem] border border-black/5 bg-white p-5 shadow-sm sm:p-8">
      <label className="block"><span className="mb-2 block text-xs font-semibold uppercase tracking-[0.14em] text-zinc-500">Title</span><input value={title} onChange={(event) => setTitle(event.target.value)} maxLength={120} placeholder="Give your story a name" className="w-full border-b border-black/10 bg-transparent pb-3 font-serif text-2xl outline-none placeholder:text-zinc-300 focus:border-[#bf8263] sm:text-3xl" /></label>

      <div><span className="mb-2 block text-xs font-semibold uppercase tracking-[0.14em] text-zinc-500">Cover image</span><label onDragOver={(event) => { event.preventDefault(); setDragging(true); }} onDragLeave={() => setDragging(false)} onDrop={(event) => { event.preventDefault(); setDragging(false); void chooseCover(event.dataTransfer.files[0]); }} className={`relative grid aspect-[2.4/1] cursor-pointer place-items-center overflow-hidden rounded-2xl border border-dashed ${dragging ? "border-[#b7765c] bg-[#fbf2ed]" : "border-black/15 bg-[#f8f7f3]"}`} style={cover ? { backgroundImage: `linear-gradient(#0002,#0002),url("${cover}")`, backgroundPosition: `${coverPosition.x}% ${coverPosition.y}%`, backgroundSize: `${coverScale}% auto` } : undefined}>{cover ? <span className="rounded-full bg-white/90 px-4 py-2 text-sm">Hero preview · click to change</span> : <span className="text-center"><span className="block font-serif text-xl">Drop an image here</span><span className="mt-1 block text-xs text-zinc-500">or choose a file · JPG, PNG, WEBP</span></span>}<input className="sr-only" type="file" accept="image/*" onChange={(event) => void chooseCover(event.target.files?.[0])} /></label><p className="mt-2 text-xs text-zinc-400">Adjust the crop below; this preview matches the hero image on your published story.</p><label className="mt-4 flex items-center gap-3 text-xs text-zinc-500">Zoom <input type="range" min="100" max="180" step="5" value={coverScale} onChange={(event) => setCoverScale(Number(event.target.value))} className="flex-1 accent-[#a9664c]" /><span className="w-10 text-right tabular-nums">{coverScale}%</span></label><label className="mt-3 flex items-center gap-3 text-xs text-zinc-500">Horizontal crop <input type="range" min="0" max="100" value={coverPosition.x} onChange={(event) => setCoverPosition((position) => ({ ...position, x: Number(event.target.value) }))} className="flex-1 accent-[#a9664c]" /><span className="w-10 text-right tabular-nums">{coverPosition.x}%</span></label><label className="mt-3 flex items-center gap-3 text-xs text-zinc-500">Vertical crop <input type="range" min="0" max="100" value={coverPosition.y} onChange={(event) => setCoverPosition((position) => ({ ...position, y: Number(event.target.value) }))} className="flex-1 accent-[#a9664c]" /><span className="w-10 text-right tabular-nums">{coverPosition.y}%</span></label><div className="mt-3 flex items-center gap-3"><span className="shrink-0 text-xs text-zinc-400">or image URL</span><input aria-label="Cover image URL" value={coverUrl} onChange={(event) => { setCoverUrl(event.target.value); setCover(event.target.value); }} placeholder="https://…" className="w-full rounded-xl border border-black/10 px-3 py-2 text-xs outline-none focus:border-[#bf8263]" /></div><p className="mt-2 text-xs text-zinc-400">{IMAGE_GUIDE}</p></div>

      <div><div className="mb-2 flex flex-wrap items-center gap-1 rounded-xl bg-[#f6f5f1] p-2"><button type="button" className="format-button font-bold" onMouseDown={(event) => event.preventDefault()} onClick={() => { editor.current?.focus(); document.execCommand("bold"); }}>B</button><button type="button" className="format-button font-serif italic" onMouseDown={(event) => event.preventDefault()} onClick={() => { editor.current?.focus(); document.execCommand("italic"); }}>I</button><span className="mx-1 h-6 w-px bg-black/10" /><button type="button" className="format-button" onClick={() => insertMarkup("<h2>Section heading</h2><p><br></p>")}>H2</button><button type="button" className="format-button" onMouseDown={saveEditorSelection} onClick={() => { const input = document.createElement("input"); input.type = "file"; input.accept = "image/*"; input.onchange = () => { if (input.files) void insertFiles(input.files); }; input.click(); }}>＋ Image</button><label className="ml-2 flex items-center gap-2 text-[11px] text-zinc-500">Selected image width <input type="range" min="25" max="100" step="5" value={bodyImageScale} onChange={(event) => { const width = Number(event.target.value); setBodyImageScale(width); if (selectedImage.current) { selectedImage.current.style.maxWidth = `${width}%`; selectedImage.current.dataset.imageWidth = String(width); } }} className="w-20 accent-[#a9664c]" /><span className="w-8 tabular-nums">{bodyImageScale}%</span></label><span className="ml-auto hidden text-[11px] text-zinc-400 sm:block">Click an image to select it · text wraps beside images</span></div><div ref={editor} contentEditable suppressContentEditableWarning role="textbox" aria-label="Blog body" aria-multiline="true" data-placeholder="Start writing your story…" className="editor-content rounded-xl border border-black/5 px-4 py-5 text-[15px] leading-8 text-zinc-700" onClick={(event) => { const image = (event.target as HTMLElement).closest("img"); selectedImage.current = image instanceof HTMLImageElement ? image : null; if (selectedImage.current) setBodyImageScale(Number.parseInt(selectedImage.current.dataset.imageWidth ?? selectedImage.current.style.maxWidth, 10) || 48); }} onPointerDown={startImageMove} onPointerMove={trackImageMove} onPointerUp={finishImageMove} onPointerCancel={cancelImageMove} onDragOver={(event) => { event.preventDefault(); event.dataTransfer.dropEffect = "copy"; }} onDrop={(event) => { event.preventDefault(); const range = document.caretRangeFromPoint?.(event.clientX, event.clientY); if (range) { const selection = window.getSelection(); selection?.removeAllRanges(); selection?.addRange(range); savedRange.current = range.cloneRange(); } void insertFiles(event.dataTransfer.files); }} /></div>

      <label className="block"><span className="mb-2 block text-xs font-semibold uppercase tracking-[0.14em] text-zinc-500">Hashtags</span><input value={tagsText} onChange={(event) => setTagsText(event.target.value)} placeholder="mindfulness, writing, travel" className="w-full rounded-xl border border-black/10 px-4 py-3 text-sm outline-none focus:border-[#bf8263]" /><span className="mt-2 block text-xs text-zinc-400">Separate topics with commas. We&apos;ll add the # for you.</span></label>
      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-black/5 pt-5"><p className="text-xs text-zinc-500">Published as <strong className="font-medium text-zinc-700">{currentUser.name}</strong></p><div className="flex flex-wrap gap-2"><Link href={postId ? `/blogs/${postId}` : "/blogs"} className="rounded-full px-4 py-2.5 text-sm text-zinc-500 hover:bg-[#f5f4ef]">Cancel</Link><button type="button" disabled={reviewing || publishing} onClick={() => void reviewWriting()} className="rounded-full border border-[#c88f72] px-4 py-2.5 text-sm font-medium text-[#8b533d] disabled:opacity-50">{reviewing ? "Reviewing with LongCat…" : "Get AI suggestions"}</button><button type="button" disabled={publishing} onClick={publish} className="rounded-full bg-[#30342e] px-5 py-2.5 text-sm font-medium text-white transition hover:bg-[#484c45] disabled:cursor-not-allowed disabled:opacity-60">{publishing ? "Publishing…" : "Save changes & publish"}</button></div></div>
      {suggestions.length > 0 && <section aria-label="AI writing suggestions" className="space-y-3 rounded-2xl border border-[#c88f72]/25 bg-[#fbf7f3] p-4"><div className="flex flex-wrap items-center justify-between gap-3"><div><h2 className="font-medium text-zinc-800">LongCat suggestions</h2><p className="mt-1 text-xs text-zinc-500">Your draft changes only when you accept a suggestion.</p></div><button type="button" onClick={acceptAllSuggestions} className="rounded-full bg-[#30342e] px-4 py-2 text-xs font-medium text-white">Accept all</button></div>{suggestions.map((suggestion, index) => <article key={`${suggestion.field}-${index}`} className="rounded-xl bg-white p-4"><p className="text-[11px] font-semibold uppercase tracking-wide text-zinc-400">{suggestion.field === "title" ? "Title" : "Blog text"}</p><p className="mt-2 text-sm text-zinc-500 line-through">{suggestion.original}</p><p className="mt-1 text-sm font-medium text-zinc-800">{suggestion.suggested}</p><p className="mt-2 text-xs text-zinc-500">{suggestion.explanation}</p><div className="mt-3 flex gap-3"><button type="button" onClick={() => acceptSuggestion(index)} className="text-xs font-semibold text-[#8b533d] hover:underline">Accept</button><button type="button" onClick={() => setSuggestions((current) => current.filter((_, position) => position !== index))} className="text-xs text-zinc-500 hover:underline">Dismiss</button></div></article>)}</section>}
      {aiNotice && <p role="status" className="text-sm text-[#8b533d]">{aiNotice}</p>}
      {notice && <p role="status" className="text-sm text-[#a9664c]">{notice}</p>}
    </div>
    <p className="mt-4 text-center text-xs text-zinc-400">Your published story and its engagement are stored in MongoDB.</p>
  </div></BlogShell>;
}
