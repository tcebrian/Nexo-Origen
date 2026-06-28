import type { Metadata } from "next";
import { PreventPage } from "./_components/prevent-page";

export const metadata: Metadata = {
  title: "Nexo Prevent | Nexo Origen",
  description: "Radar de riesgo reputacional. Identifica qué restaurantes están protegidos y cuáles necesitan actuación.",
};

export default function Page() {
  return <PreventPage />;
}
