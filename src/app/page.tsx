import type { Metadata } from "next";
import HomeDesk from "./home-desk";

export const metadata: Metadata = {
  title: "Regie — Van opdracht naar de juiste manager",
  description:
    "Contracting-desk: kansen ophalen, eindklant bevestigen, hiring manager vinden en voorstel klaarzetten.",
};

export default function Home() {
  return <HomeDesk />;
}
