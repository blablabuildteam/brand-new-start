import type { Metadata } from "next";
import HomeDesk from "./home-desk";
import { PRODUCT } from "@/lib/product-brand";

export const metadata: Metadata = {
  title: `${PRODUCT.name} — ${PRODUCT.tagline}`,
  description: PRODUCT.lede,
};

export default function Home() {
  return <HomeDesk />;
}
