"use client";

import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";

/** Pila de drawers abiertos: Escape y el foco solo actúan sobre el de arriba. */
const openStack: string[] = [];

/**
 * Panel lateral que entra por la derecha (en móvil ocupa todo el ancho).
 * - Cabecera fija con título y X SIEMPRE visible.
 * - Se cierra con la X, con Escape y pulsando fuera; el padre decide en `onRequestClose` (p. ej.
 *   preguntar si hay cambios sin guardar).
 * - Cuerpo con scroll interno y pie fijo opcional.
 */
export function Drawer({
  open,
  title,
  onRequestClose,
  children,
  footer,
  description,
}: {
  open: boolean;
  title: string;
  onRequestClose: () => void;
  children: ReactNode;
  footer?: ReactNode;
  description?: string;
}) {
  const id = useId();
  const titleId = `${id}-title`;
  const panelRef = useRef<HTMLDivElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const requestCloseRef = useRef(onRequestClose);
  const [mounted, setMounted] = useState(false);
  const [shown, setShown] = useState(false);

  useEffect(() => {
    requestCloseRef.current = onRequestClose;
  });

  useEffect(() => {
    setMounted(true);
  }, []);

  // Entrada animada y gestión del foco.
  useEffect(() => {
    if (!open) {
      setShown(false);
      return;
    }
    const previous = document.activeElement as HTMLElement | null;
    openStack.push(id);
    const frame = requestAnimationFrame(() => {
      setShown(true);
      closeRef.current?.focus();
    });

    const onKeyDown = (event: KeyboardEvent) => {
      if (openStack[openStack.length - 1] !== id) return;
      if (event.key === "Escape") {
        event.preventDefault();
        requestCloseRef.current();
        return;
      }
      if (event.key === "Tab" && panelRef.current) {
        const focusable = panelRef.current.querySelectorAll<HTMLElement>(
          'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
        );
        if (focusable.length === 0) return;
        const first = focusable[0]!;
        const last = focusable[focusable.length - 1]!;
        if (event.shiftKey && document.activeElement === first) {
          event.preventDefault();
          last.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault();
          first.focus();
        }
      }
    };
    document.addEventListener("keydown", onKeyDown);

    return () => {
      cancelAnimationFrame(frame);
      document.removeEventListener("keydown", onKeyDown);
      const index = openStack.indexOf(id);
      if (index >= 0) openStack.splice(index, 1);
      previous?.focus?.();
    };
  }, [open, id]);

  if (!mounted || !open) return null;

  return createPortal(
    <div className="fixed inset-0 z-[70]">
      <button
        type="button"
        tabIndex={-1}
        aria-label="Cerrar panel"
        onClick={() => requestCloseRef.current()}
        className={`absolute inset-0 bg-black/60 backdrop-blur-[2px] transition-opacity duration-200 motion-reduce:transition-none ${shown ? "opacity-100" : "opacity-0"}`}
      />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className={`absolute inset-y-0 right-0 flex w-full max-w-full flex-col border-l border-white/[0.1] bg-[#0b0812] shadow-2xl transition-transform duration-200 ease-out motion-reduce:transition-none sm:w-[460px] ${
          shown ? "translate-x-0" : "translate-x-full"
        }`}
      >
        <header className="flex shrink-0 items-start gap-3 border-b border-white/[0.08] px-5 py-4">
          <div className="min-w-0 flex-1">
            <h2 id={titleId} className="truncate text-[15px] font-semibold text-white">
              {title}
            </h2>
            {description ? <p className="mt-0.5 truncate text-xs text-gray-500">{description}</p> : null}
          </div>
          <button
            ref={closeRef}
            type="button"
            onClick={() => requestCloseRef.current()}
            aria-label="Cerrar"
            className="-mr-1.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-gray-400 transition hover:bg-white/[0.08] hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-400/60"
          >
            <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" aria-hidden>
              <path d="M6 6l12 12M18 6 6 18" />
            </svg>
          </button>
        </header>

        <div className="nexo-sidebar-scroll min-h-0 flex-1 overflow-y-auto px-5 py-5">{children}</div>

        {footer ? <footer className="shrink-0 border-t border-white/[0.08] bg-[#0b0812] px-5 py-4">{footer}</footer> : null}
      </div>
    </div>,
    document.body
  );
}

/** Aviso en línea "cambios sin guardar" para el pie de un drawer. */
export function DiscardNotice({ onKeep, onDiscard }: { onKeep: () => void; onDiscard: () => void }) {
  return (
    <div role="alert" className="mb-3 rounded-xl border border-amber-300/20 bg-amber-300/[0.07] px-3.5 py-3">
      <p className="text-[13px] font-medium text-amber-100">Tienes cambios sin guardar</p>
      <p className="mt-0.5 text-xs text-amber-100/70">Si cierras ahora, se perderán.</p>
      <div className="mt-3 flex gap-2">
        <button
          type="button"
          onClick={onKeep}
          className="rounded-lg border border-white/[0.12] bg-white/[0.06] px-3 py-1.5 text-xs font-medium text-white transition hover:bg-white/[0.1]"
        >
          Seguir editando
        </button>
        <button
          type="button"
          onClick={onDiscard}
          className="rounded-lg px-3 py-1.5 text-xs font-medium text-amber-100 transition hover:bg-white/[0.06]"
        >
          Descartar cambios
        </button>
      </div>
    </div>
  );
}
