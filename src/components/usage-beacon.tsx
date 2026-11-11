"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";

const INTERVAL_MS = 2 * 60_000;

/** Stille presence-ping zolang de tab zichtbaar is — alleen voor gebruiksmonitor (admin). */
export function UsageBeacon() {
  const pathname = usePathname();

  useEffect(() => {
    let cancelled = false;

    async function ping() {
      if (cancelled || document.visibilityState !== "visible") return;
      try {
        await fetch("/api/ops/presence", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ path: pathname || "/" }),
          keepalive: true,
        });
      } catch {
        /* ignore */
      }
    }

    void ping();
    const id = window.setInterval(() => void ping(), INTERVAL_MS);
    function onVis() {
      if (document.visibilityState === "visible") void ping();
    }
    document.addEventListener("visibilitychange", onVis);
    return () => {
      cancelled = true;
      window.clearInterval(id);
      document.removeEventListener("visibilitychange", onVis);
    };
  }, [pathname]);

  return null;
}
