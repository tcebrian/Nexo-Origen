"use client";

import { useEffect } from "react";
import { PageErrorState } from "./_components/page-error-state";

export default function DashboardError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[dashboard/error]", error);
  }, [error]);

  return (
    <div className="flex min-h-[60vh] items-center justify-center px-6 py-12">
      <PageErrorState
        title="No se ha podido cargar esta sección"
        message="Vuelve a intentarlo. Si el problema persiste, contacta con soporte."
        onRetry={reset}
      />
    </div>
  );
}
