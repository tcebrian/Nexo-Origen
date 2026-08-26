import type { Metadata } from "next";
import { InformesPage } from "./_components/informes-page";

export const metadata: Metadata = {
  title: "Informes | Nexo Origen",
  description: "Genera informes automáticos por marca: semanales, mensuales y trimestrales.",
};

export default function Page() {
  return <InformesPage />;
}
