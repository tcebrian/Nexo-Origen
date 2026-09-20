import type { InformeEstado } from "@/lib/informes/types";
import { REPUTATION_TARGET, REPUTATION_WATCH_THRESHOLD } from "@/lib/reputation/rules";

export function resolveInformeEstado(media: number): {
  estado: InformeEstado;
  estadoLabel: string;
} {
  if (media >= REPUTATION_TARGET) {
    return { estado: "verde", estadoLabel: "Óptimo" };
  }
  if (media >= REPUTATION_WATCH_THRESHOLD) {
    return { estado: "amarillo", estadoLabel: "En vigilancia" };
  }
  return { estado: "rojo", estadoLabel: "Crítico" };
}
