"use client";

import { useEffect } from "react";

export default function AppError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[app/error]", error);
  }, [error]);

  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-[#05030A] px-6 text-center text-white">
      <p className="text-[13px] font-medium text-red-300">
        Ha ocurrido un error inesperado
      </p>
      <p className="mt-2 max-w-md text-[12px] text-gray-400">
        Vuelve a intentarlo. Si el problema persiste, contacta con soporte.
      </p>
      <button
        type="button"
        onClick={reset}
        className="mt-6 inline-flex items-center justify-center gap-2 rounded-lg border border-white/[0.14] bg-white/[0.08] px-4 py-2.5 text-[13px] font-medium text-white transition hover:bg-white/[0.12]"
      >
        Reintentar
      </button>
    </main>
  );
}
