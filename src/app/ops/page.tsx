import { redirect } from "next/navigation";
import { getSession, isAdmin } from "@/lib/auth";
import OpsDesk from "./ops-desk";

export const metadata = {
  title: "Ops — Recruitment Scout",
  description: "Activity- en errorlog voor blablabuild.",
};

export const dynamic = "force-dynamic";

export default async function OpsPage() {
  const session = await getSession();
  if (!session) redirect("/login");
  if (!isAdmin(session)) redirect("/");
  return <OpsDesk />;
}
