"use client";

export function AuthTransition({ unavailable = false }: { unavailable?: boolean }) {
  return (
    <main role={unavailable ? "alert" : "status"} aria-live="polite" className="grid min-h-screen place-items-center bg-[#f7f6f2] px-5 text-center text-sm text-zinc-500">
      <div className="flex flex-col items-center">
        {unavailable ? <>
          <p>The server is still unavailable after waiting. Your sign-in has not been cleared.</p>
          <button type="button" onClick={() => window.location.reload()} className="mt-4 rounded-full bg-[#30342e] px-4 py-2 text-white">Try again</button>
        </> : <>
          <span aria-hidden="true" className="h-10 w-10 animate-spin rounded-full border-[3px] border-[#eadbd2] border-t-[#a9664c]" />
          <span className="mt-4 inline-flex items-center gap-1.5">Loading<span aria-hidden="true" className="inline-block h-4 w-[2px] animate-pulse bg-[#a9664c]" /></span>
          <span aria-hidden="true" className="mt-4 h-1 w-40 overflow-hidden rounded-full bg-[#e8e3d9]"><span className="block h-full w-1/2 animate-pulse rounded-full bg-[#c88f72]" /></span>
        </>}
      </div>
    </main>
  );
}
