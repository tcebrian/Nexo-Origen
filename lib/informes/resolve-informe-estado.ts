import type { InformeEstado } from "@/lib/informes/types";
import { REPUTATION_TARGET } from "@/lib/review-metrics";

const WATCH_THRESHOLD = 4.0;

export function resolveInformeEstado(media: number): {
  estado: InformeEstado;
  estadoLabel: string;
} {
  if (media >= REPUTATION_TARGET) {
    return { estado: "verde", estadoLabel: "Óptimo" };
  }
  if (media >= WATCH_THRESHOLD) {
    return { estado: "amarillo", estadoLabel: "En vigilancia" };
  }
  return { estado: "rojo", estadoLabel: "Crítico" };
}
