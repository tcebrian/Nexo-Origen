import type { Metadata } from "next";
import { InformesPage } from "./_components/informes-page";

export const metadata: Metadata = {
  title: "Informes | Nexo Origen",
  description: "Genera informes visuales de reseñas negativas para compartir con tu equipo.",
};

export default function Page() {
  return <InformesPage />;
}
