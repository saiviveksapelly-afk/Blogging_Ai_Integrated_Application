"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { readCurrentUser } from "./data";

/** Protect client-only routes whose demo identity is stored in localStorage. */
export function useRequireAuth() {
  const router = useRouter();
  const [authorized, setAuthorized] = useState(false);

  useEffect(() => {
    const checkSession = () => {
      const hasUser = Boolean(readCurrentUser());
      setAuthorized(hasUser);
      if (!hasUser) router.replace("/login");
    };

    checkSession();
    // Recheck when navigating Back/Forward, restoring a cached page, or logging
    // out in another tab. This closes the browser-history path after logout.
    window.addEventListener("popstate", checkSession);
    window.addEventListener("pageshow", checkSession);
    window.addEventListener("storage", checkSession);
    return () => {
      window.removeEventListener("popstate", checkSession);
      window.removeEventListener("pageshow", checkSession);
      window.removeEventListener("storage", checkSession);
    };
  }, [router]);

  return authorized;
}
