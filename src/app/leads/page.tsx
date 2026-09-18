import LeadsDesk from "./leads-desk";
import { getSession } from "@/lib/auth";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Recruiter feed — Recruitment Scout",
  description: "Recruiter-feed: recruiter-feeds, eindklant bevestigen en review.",
};

export default async function LeadsPage() {
  const session = await getSession();
  if (!session) redirect("/login?next=/leads");
  return <LeadsDesk />;
}
