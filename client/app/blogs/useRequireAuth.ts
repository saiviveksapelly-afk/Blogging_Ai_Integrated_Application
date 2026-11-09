"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { CURRENT_USER_STORAGE_KEY, readCurrentUser } from "./data";
import { migrateLegacyBrowserData } from "./api";

/** Protect client-only routes whose demo identity is stored in localStorage. */
export function useRequireAuth() {
  const router = useRouter();
  const [authorized, setAuthorized] = useState(false);

  useEffect(() => {
    let active = true;
    let requestId = 0;
    const checkSession = async () => {
      const id = ++requestId;
      const localUser = readCurrentUser();
      if (!localUser) {
        if (active && id === requestId) { setAuthorized(false); router.replace("/login"); }
        return;
      }
      try {
        const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:5000";
        const response = await fetch(`${apiUrl}/api/auth/me`, { credentials: "include", cache: "no-store" });
        const payload = await response.json().catch(() => ({}));
        const valid = response.ok && payload.user?.id === localUser.id;
        if (!active || id !== requestId) return;
        if (valid) {
          try { await migrateLegacyBrowserData(localUser.id); } catch { /* Keep legacy data locally and retry on the next protected-page visit. */ }
          if (active && id === requestId) setAuthorized(true);
        }
        else {
          window.localStorage.removeItem(CURRENT_USER_STORAGE_KEY);
          setAuthorized(false);
          router.replace("/login");
        }
      } catch {
        if (!active || id !== requestId) return;
        setAuthorized(false);
        router.replace("/login");
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

  return authorized;
}
