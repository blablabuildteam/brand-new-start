import { redirect } from "next/navigation";

/** Oude Kosten-URL → Sync (ophalen + kosten + wanneer weer). */
export default function CostsRedirectPage() {
  redirect("/sync");
}
