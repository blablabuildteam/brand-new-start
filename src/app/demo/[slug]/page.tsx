import type { Metadata } from "next";
import { redirect } from "next/navigation";
import DemoGate from "../demo-gate";
import { getDemoProspect } from "@/lib/demo-prospects";

export const metadata: Metadata = {
  title: "Demo — Recruitment Scout",
  description: "Gepersonaliseerde demo-werkplek met voorbeelddata.",
  robots: { index: false, follow: false },
};

type Props = { params: Promise<{ slug: string }> };

export default async function PersonalizedDemoPage({ params }: Props) {
  const { slug } = await params;
  const prospect = getDemoProspect(slug);
  if (!prospect) return <DemoGate />;
  redirect(`/api/auth/demo-slug?slug=${encodeURIComponent(prospect.slug)}`);
}
