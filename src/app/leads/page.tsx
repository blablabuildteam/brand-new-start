import LeadsDesk from "./leads-desk";
import { getSession } from "@/lib/auth";
import { loadHuntSettings } from "@/lib/hunt";
import { listAgencyLeads } from "@/lib/opportunity";
import { listSyncRuns } from "@/lib/sync-log";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Recruiter feed — Recruitment Scout",
  description: "Recruiter-feed: recruiter-feeds, eindklant bevestigen en review.",
};

export default async function LeadsPage() {
  const session = await getSession();
  if (!session) redirect("/login?next=/leads");
  await loadHuntSettings();
  const [data, runs] = await Promise.all([listAgencyLeads(), listSyncRuns(40)]);
  const feed = runs.find((r) => r.channel === "recruiter-feed") || null;
  const last = runs[0] || null;
  return (
    <LeadsDesk
      initial={{
        ...data,
        sync: {
          lastFeed: feed
            ? { at: feed.at, kept: feed.kept, fetched: feed.fetched, mode: feed.mode }
            : null,
          last: last ? { at: last.at, channel: last.channel, label: last.label } : null,
        },
      }}
    />
  );
}
