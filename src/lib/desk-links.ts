/** Deep-links tussen Bureaus → Radar → Kansen → Voorstel. */

export function radarHref(opts: {
  companyId?: string | null;
  openingId?: string | null;
  /** Eindklantnaam wanneer nog geen radar-match (HM via LinkedIn). */
  q?: string | null;
}): string {
  const p = new URLSearchParams();
  if (opts.companyId) p.set("id", opts.companyId);
  if (opts.openingId) p.set("opening", opts.openingId);
  if (opts.q?.trim()) p.set("q", opts.q.trim());
  const s = p.toString();
  return s ? `/radar?${s}` : "/radar";
}

export function regieHref(opts: {
  companyId?: string | null;
  openingId?: string | null;
}): string {
  if (!opts.companyId) return "/regie";
  const p = new URLSearchParams();
  p.set("id", opts.companyId);
  if (opts.openingId) p.set("opening", opts.openingId);
  return `/regie?${p.toString()}`;
}

export function kansenHref(id: string) {
  return `/kansen?id=${encodeURIComponent(id)}`;
}
