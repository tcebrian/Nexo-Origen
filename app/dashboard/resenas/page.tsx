import type { Metadata } from "next";
import { Suspense } from "react";
import { ResenasPage } from "./_components/resenas-page";

export const metadata: Metadata = {
  title: "Reseñas | Nexo Origen",
  description: "Bandeja inteligente de opiniones para monitorización y gestión reputacional.",
};

export default function Page() {
  return (
    <Suspense fallback={<div className="h-96 animate-pulse rounded-2xl border border-white/[0.06] bg-white/[0.02]" />}>
      <ResenasPage />
    </Suspense>
  );
}
