"use client";

import { useCallback, useEffect, useState } from "react";
import { fetchJson, type ContactDetail, type ContactOptions } from "./shared";

export type ActivationError = { text: string; detail?: string };

/**
 * Ficha del contacto seleccionado (permisos guardados, acceso de hoy, cuenta web y estado de WhatsApp) y
 * las opciones de empresa/restaurantes. Misma lectura que antes: solo se carga aquí, a nivel de pantalla,
 * para que la cabecera, la tarjeta de WhatsApp y el drawer compartan los mismos datos.
 */
export function useContactDetail(conversationId: string | null) {
  const [detail, setDetail] = useState<ContactDetail | null>(null);
  const [config, setConfig] = useState<ContactOptions | null>(null);
  const [error, setError] = useState(false);
  const [activationError, setActivationError] = useState<ActivationError | null>(null);

  useEffect(() => {
    let cancelled = false;
    // Al cambiar de contacto se parte de cero (sin mostrar datos del anterior).
    queueMicrotask(() => {
      if (cancelled) return;
      setDetail(null);
      setError(false);
      setActivationError(null);
    });
    if (!conversationId) return () => void (cancelled = true);

    Promise.all([
      fetchJson<ContactDetail>(`/api/conversations/${conversationId}/contact`),
      fetchJson<ContactOptions>("/api/conversations/contacts"),
    ])
      .then(([data, options]) => {
        if (cancelled) return;
        setDetail(data);
        setConfig(options);
      })
      .catch(() => {
        if (!cancelled) setError(true);
      });
    return () => {
      cancelled = true;
    };
  }, [conversationId]);

  const reload = useCallback(async () => {
    if (!conversationId) return;
    try {
      setDetail(await fetchJson<ContactDetail>(`/api/conversations/${conversationId}/contact`));
    } catch {
      // Se mantiene lo que había.
    }
  }, [conversationId]);

  return { detail, setDetail, config, error, reload, activationError, setActivationError };
}
