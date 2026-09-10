import type { Metadata } from "next";
import HomeDesk from "./home-desk";

export const metadata: Metadata = {
  title: "Regie",
  description: "Van opdracht naar de juiste hiring manager — contracting en permanent.",
};

export default function Home() {
  return <HomeDesk />;
}
