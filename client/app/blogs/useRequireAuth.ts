"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { CURRENT_USER_STORAGE_KEY, readCurrentUser } from "./data";
import { migrateLegacyBrowserData } from "./api";

type AuthState = "checking" | "authorized" | "redirecting";
let verifiedSession: { userId: string; expiresAt: number } | null = null;
const SESSION_CACHE_MS = 2 * 60 * 1000;

export function clearAuthCache() {
  verifiedSession = null;
}

export function AuthTransition({ redirecting = false }: { redirecting?: boolean }) {
  return <main role="status" aria-live="polite" className="grid min-h-screen place-items-center bg-[#f7f6f2] px-5 text-center text-sm text-zinc-500">
    <div className="flex flex-col items-center">
      <span aria-hidden="true" className="h-10 w-10 animate-spin rounded-full border-[3px] border-[#eadbd2] border-t-[#a9664c]" />
      <span className="mt-4">{redirecting ? "Taking you to login…" : "Opening your page…"}</span>
      <span aria-hidden="true" className="mt-4 h-1 w-40 overflow-hidden rounded-full bg-[#e8e3d9]"><span className="block h-full w-1/2 animate-pulse rounded-full bg-[#c88f72]" /></span>
    </div>
  </main>;
}

/** Protect client-only routes whose demo identity is stored in localStorage. */
export function useRequireAuth() {
  const router = useRouter();
  const [authState, setAuthState] = useState<AuthState>("checking");

  useEffect(() => {
    let active = true;
    let requestId = 0;
    const checkSession = async () => {
      const id = ++requestId;
      const localUser = readCurrentUser();
      if (!localUser) {
        clearAuthCache();
        if (active && id === requestId) { setAuthState("redirecting"); router.replace("/login"); }
        return;
      }
      if (verifiedSession?.userId === localUser.id && verifiedSession.expiresAt > Date.now()) {
        if (active && id === requestId) setAuthState("authorized");
        void migrateLegacyBrowserData(localUser.id).catch(() => undefined);
        return;
      }
      if (active && id === requestId) setAuthState("checking");
      try {
        const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:5000";
        const response = await fetch(`${apiUrl}/api/auth/me`, { credentials: "include", cache: "no-store" });
        const payload = await response.json().catch(() => ({}));
        const valid = response.ok && payload.user?.id === localUser.id;
        if (!active || id !== requestId) return;
        if (valid) {
          verifiedSession = { userId: localUser.id, expiresAt: Date.now() + SESSION_CACHE_MS };
          setAuthState("authorized");
          void migrateLegacyBrowserData(localUser.id).catch(() => undefined);
        }
        else {
          clearAuthCache();
          window.localStorage.removeItem(CURRENT_USER_STORAGE_KEY);
          setAuthState("redirecting");
          router.replace("/login");
        }
      } catch {
        if (!active || id !== requestId) return;
        // Preserve the signed-in shell during a brief backend outage. Protected
        // writes still require a valid backend session and report their own errors.
        if (verifiedSession?.userId === localUser.id && verifiedSession.expiresAt > Date.now()) setAuthState("authorized");
        else { setAuthState("redirecting"); router.replace("/login"); }
      }
    };

    void checkSession();
    // Recheck when navigating Back/Forward, restoring a cached page, or logging
    // out in another tab. This closes the browser-history path after logout.
    window.addEventListener("popstate", checkSession);
    window.addEventListener("pageshow", checkSession);
    window.addEventListener("storage", checkSession);
    return () => {
      active = false;
      window.removeEventListener("popstate", checkSession);
      window.removeEventListener("pageshow", checkSession);
      window.removeEventListener("storage", checkSession);
    };
  }, [router]);

  return authState;
}
