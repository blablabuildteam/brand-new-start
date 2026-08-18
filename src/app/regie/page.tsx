import { Suspense } from "react";
import RegieDesk from "./regie-desk";

export const metadata = {
  title: "Regie — vacature naar plaatsing",
  description: "Hiring manager + drie ZZP’ers + berichten. Bench inwisselbaar per licentie.",
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
