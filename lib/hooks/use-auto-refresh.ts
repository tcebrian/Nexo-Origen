"use client";

import { useEffect } from "react";

/** Refresco silencioso cada N ms sin bloquear la UI. */
export function useAutoRefresh(
  callback: (silent: boolean) => void | Promise<void>,
  intervalMs = 30_000,
  deps: unknown[] = []
) {
  useEffect(() => {
    const tick = () => {
      void callback(true);
    };

    const id = window.setInterval(tick, intervalMs);
    return () => window.clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [intervalMs, callback, ...deps]);
}
