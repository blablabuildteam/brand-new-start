"use client";

import { useEffect } from "react";

/** Stuurt ongevangen UI-fouten naar /api/ops/client-error (ingelogde sessie). */
export function ClientErrorReporter() {
  useEffect(() => {
    let lastKey = "";
    let lastAt = 0;

    function report(message: string, stack?: string, source?: string) {
      const key = `${message}|${source || ""}`;
      const now = Date.now();
      if (key === lastKey && now - lastAt < 8000) return;
      lastKey = key;
      lastAt = now;
      void fetch("/api/ops/client-error", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: message.slice(0, 400),
          path: typeof window !== "undefined" ? window.location.pathname : undefined,
          stack: stack?.slice(0, 1200),
          source,
        }),
      }).catch(() => null);
    }

    function onError(ev: ErrorEvent) {
      report(ev.message || "window.error", ev.error?.stack, "window.error");
    }
    function onRejection(ev: PromiseRejectionEvent) {
      const reason = ev.reason;
      const msg =
        reason instanceof Error
          ? reason.message
          : typeof reason === "string"
            ? reason
            : "unhandledrejection";
      const stack = reason instanceof Error ? reason.stack : undefined;
      report(msg, stack, "unhandledrejection");
    }

    window.addEventListener("error", onError);
    window.addEventListener("unhandledrejection", onRejection);
    return () => {
      window.removeEventListener("error", onError);
      window.removeEventListener("unhandledrejection", onRejection);
    };
  }, []);

  return null;
}
