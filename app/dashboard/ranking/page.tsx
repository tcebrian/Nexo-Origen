import type { Metadata } from "next";
import { RankingPage } from "./_components/ranking-page";

export const metadata: Metadata = {
  title: "Ranking | Nexo Origen",
  description: "Comparativa ejecutiva de rendimiento entre restaurantes de tu red.",
};

export default function Page() {
  return <RankingPage />;
}
