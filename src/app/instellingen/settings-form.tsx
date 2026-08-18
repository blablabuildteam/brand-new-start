"use client";

import { FormEvent, useEffect, useState } from "react";
import { WorkspaceBar } from "@/components/workspace-bar";
import { DEFAULT_ROLES, type HuntSettings } from "@/lib/hunt";

export default function SettingsForm() {
  const [hunt, setHunt] = useState<HuntSettings | null>(null);
  const [rolesText, setRolesText] = useState("");
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    fetch("/api/settings")
      .then((r) => {
        if (r.status === 401) {
          window.location.href = "/login?next=/instellingen";
          return null;
        }
        return r.json();
      })
      .then((j: HuntSettings | null) => {
        if (!j) return;
        setHunt(j);
        setRolesText(j.roles.join("\n"));
      });
  }, []);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!hunt) return;
    setError("");
    setSaved(false);
    const roles = rolesText
      .split(/\n|,/)
      .map((r) => r.trim())
      .filter(Boolean);
    const res = await fetch("/api/settings", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: hunt.name,
        market: hunt.market,
        roles,
        requireContract: hunt.requireContract,
      }),
    });
    if (!res.ok) {
      setError("Opslaan mislukt");
      return;
    }
    const next = (await res.json()) as HuntSettings;
    setHunt(next);
    setRolesText(next.roles.join("\n"));
    setSaved(true);
  }

  return (
    <div className="flex min-h-dvh flex-col">
      <WorkspaceBar current="instellingen" />
      <main className="mx-auto w-full max-w-[640px] flex-1 px-5 py-8 md:px-8">
        <h1 className="text-2xl font-bold" style={{ fontFamily: "var(--display)" }}>
          Kader
        </h1>
        <p className="mt-2 text-sm leading-relaxed text-[var(--muted)]">
          Rollen die je zoekt, en of het contracting moet zijn. Sync en radar filteren hierop.
        </p>

        {!hunt ? (
          <p className="mt-8 text-sm text-[var(--muted)]">Laden…</p>
        ) : (
          <form onSubmit={onSubmit} className="mt-8 space-y-5">
            <label className="block text-sm font-medium">
              Workspace
              <input
                className="mt-1 w-full rounded-[var(--radius)] border border-[var(--line)] bg-[var(--surface)] px-3 py-2"
                value={hunt.name}
                onChange={(e) => setHunt({ ...hunt, name: e.target.value })}
              />
            </label>

            <label className="block text-sm font-medium">
              Markt
              <input
                className="mt-1 w-full rounded-[var(--radius)] border border-[var(--line)] bg-[var(--surface)] px-3 py-2"
                value={hunt.market}
                onChange={(e) => setHunt({ ...hunt, market: e.target.value })}
              />
            </label>

            <label className="block text-sm font-medium">
              Rollen
              <span className="mt-0.5 block text-[0.75rem] font-normal text-[var(--muted)]">
                Eén per regel.
              </span>
              <textarea
                rows={12}
                className="mt-1 w-full rounded-[var(--radius)] border border-[var(--line)] bg-[var(--surface)] px-3 py-2 font-mono text-sm"
                value={rolesText}
                onChange={(e) => setRolesText(e.target.value)}
              />
            </label>

            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={hunt.requireContract}
                onChange={(e) => setHunt({ ...hunt, requireContract: e.target.checked })}
              />
              Alleen contract / ZZP / interim
            </label>

            {error ? <p className="text-sm text-[var(--warn)]">{error}</p> : null}
            {saved ? <p className="text-sm text-[var(--green)]">Opgeslagen. Volgende sync volgt dit kader.</p> : null}

            <div className="flex flex-wrap items-center gap-3">
              <button
                type="submit"
                className="rounded-[var(--radius)] bg-[var(--ink)] px-4 py-2 text-sm font-semibold text-white"
              >
                Opslaan
              </button>
              <button
                type="button"
                className="text-sm text-[var(--muted)] hover:text-[var(--ink)]"
                onClick={() => {
                  setHunt({ ...hunt, roles: DEFAULT_ROLES });
                  setRolesText(DEFAULT_ROLES.join("\n"));
                }}
              >
                Standaardrollen
              </button>
            </div>
          </form>
        )}
      </main>
    </div>
  );
}
