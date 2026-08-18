import { Suspense } from "react";
import RegieDesk from "./regie-desk";

export const metadata = {
  title: "Voorstel — Regie",
  description: "Hiring manager + drie namen + bericht. Jij verstuurt.",
};

export default function RegiePage() {
  return (
    <Suspense
      fallback={
        <div className="grid min-h-dvh place-items-center text-sm text-[var(--muted)]">Regie laden…</div>
      }
    >
      <RegieDesk />
    </Suspense>
  );
}
