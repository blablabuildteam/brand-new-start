import RegieDesk from "./regie-desk";

export const metadata = {
  title: "Contact — Recruitment Scout",
  description: "Hiring manager, mail/tel en bericht klaarzetten. Jij verstuurt.",
};

export default async function RegiePage({
  searchParams,
}: {
  searchParams: Promise<{ id?: string; opening?: string }>;
}) {
  const params = await searchParams;
  return <RegieDesk initialId={params.id || null} initialOpening={params.opening || null} />;
}
