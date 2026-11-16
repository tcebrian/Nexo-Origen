"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";

type Outcome = { ok: boolean; message: string };

/**
 * Reenvía a mano UNA alerta que no llegó. El servidor decide cómo (imagen + texto si la ventana de 24 h está
 * abierta; si no, el aviso «Ver alerta») y vuelve a comprobar permisos. Tras responder, la lista se recarga
 * para mostrar el estado y el motivo actualizados.
 */
export function ResendButton({ alertId }: { alertId: string }) {
  const router = useRouter();
  const [sending, setSending] = useState(false);
  const [outcome, setOutcome] = useState<Outcome | null>(null);
  const busy = useRef(false);

  async function resend() {
    if (busy.current) return;
    busy.current = true;
    setSending(true);
    setOutcome(null);
    try {
      const response = await fetch(`/api/conversations/alert-failures/${alertId}/resend`, { method: "POST" });
      const data = (await response.json().catch(() => null)) as { ok?: boolean; message?: string; error?: string } | null;
      setOutcome({
        ok: response.ok && data?.ok === true,
        message:
          data?.message ??
          data?.error ??
          (response.status === 429 ? "Demasiados reenvíos seguidos. Espera un minuto." : "No se pudo reenviar la alerta."),
      });
      router.refresh();
    } catch {
      setOutcome({ ok: false, message: "No se pudo conectar. Revisa la conversación antes de volver a intentarlo." });
    } finally {
      busy.current = false;
      setSending(false);
    }
  }

  return (
    <div className="flex flex-col items-start gap-1.5 lg:items-end">
      <button
        type="button"
        onClick={() => void resend()}
        disabled={sending}
        className="inline-flex items-center gap-1.5 rounded-lg border border-violet-400/30 bg-violet-500/15 px-2.5 py-1 text-[12px] font-medium text-violet-100 transition hover:bg-violet-500/25 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-400/50 disabled:cursor-wait disabled:opacity-60"
      >
        <svg
          className={`h-3.5 w-3.5 ${sending ? "animate-spin" : ""}`}
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden
        >
          <path d="M21 12a9 9 0 1 1-3-6.7L21 8" />
          <path d="M21 3v5h-5" />
        </svg>
        {sending ? "Reenviando…" : "Reenviar"}
      </button>
      {outcome ? (
        <p role="status" className={`max-w-[260px] text-[11px] lg:text-right ${outcome.ok ? "text-emerald-300" : "text-rose-300"}`}>
          {outcome.message}
        </p>
      ) : null}
    </div>
  );
}
