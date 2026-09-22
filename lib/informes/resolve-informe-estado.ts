import type { InformeEstado } from "@/lib/informes/types";

const WATCH_THRESHOLD = 4.0;

export function resolveInformeEstado(
  media: number,
  target = 4.4
): {
  estado: InformeEstado;
  estadoLabel: string;
} {
  if (media >= target) {
    return { estado: "verde", estadoLabel: "Óptimo" };
  }
  if (media >= WATCH_THRESHOLD) {
    return { estado: "amarillo", estadoLabel: "En vigilancia" };
  }
  return { estado: "rojo", estadoLabel: "Crítico" };
}
