import { Suspense } from "react";
import LoginPage from "./login-form";

export default function Page() {
  return (
    <Suspense fallback={<main className="min-h-dvh grid place-items-center">Laden…</main>}>
      <LoginPage />
    </Suspense>
  );
}
