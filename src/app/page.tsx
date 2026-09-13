import type { Metadata } from "next";
import HomeDesk from "./home-desk";

export const metadata: Metadata = {
  title: "Regie — Kansen zien vóór de rest",
  description:
    "Spot contracting-kansen sneller, schat ze op waarde, ontgrendel de opdrachtgever en zet plaatsing klaar — jij houdt de regie.",
};

export default function Home() {
  return <HomeDesk />;
}
