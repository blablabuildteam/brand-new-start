import type { Metadata } from "next";
import HomeDesk from "./home-desk";

export const metadata: Metadata = {
  title: "Regie — Recruitment-desk",
  description:
    "Kies je vak: werving & selectie (permanent, binnenkort) of contracting (interim & ZZP).",
};

export default function Home() {
  return <HomeDesk />;
}
