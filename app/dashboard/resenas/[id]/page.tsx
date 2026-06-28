import type { Metadata } from "next";
import { Suspense } from "react";
import { ReviewDetailPage } from "./_components/review-detail-page";

export const metadata: Metadata = {
  title: "Detalle de reseña | Nexo Origen",
  description: "Expediente completo de opinión de cliente.",
};

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  return (
    <Suspense
      fallback={
        <div className="mx-auto max-w-[900px] space-y-6 pb-12">
          <div className="h-8 w-48 animate-pulse rounded bg-white/[0.04]" />
          <div className="h-[600px] animate-pulse rounded-2xl border border-white/[0.06] bg-white/[0.02]" />
        </div>
      }
    >
      <ReviewDetailPage reviewId={id} />
    </Suspense>
  );
}
