import type { Metadata } from "next";
import { TalentoPage } from "./_components/talento-page";

export const metadata: Metadata = {
  title: "Talento | Nexo Origen",
  description:
    "Empleados más mencionados por los clientes, reconocimiento y oportunidades de mejora.",
};

export default function Page() {
  return <TalentoPage />;
}
