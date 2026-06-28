import type { Metadata } from "next";
import { AlertasPage } from "./_components/alertas-page";

export const metadata: Metadata = {
  title: "Alertas | Nexo Origen",
  description: "Centro de incidencias ejecutivas para identificar qué restaurantes requieren atención.",
};

export default function Page() {
  return <AlertasPage />;
}
