import type {
  DetectedIssue,
  HealthStatus,
  OperationalStatus,
} from "./types";

export function getHealthFromProtection(level: number): {
  status: HealthStatus;
  label: "Protegido" | "Vigilancia" | "Riesgo";
} {
  if (level >= 75) return { status: "protected", label: "Protegido" };
  if (level >= 45) return { status: "watch", label: "Vigilancia" };
  return { status: "risk", label: "Riesgo" };
}

export function getHealthFromOperational(status: OperationalStatus): {
  status: HealthStatus;
  label: "Protegido" | "Vigilancia" | "Riesgo";
} {
  if (status === "on_target") return { status: "protected", label: "Protegido" };
  if (status === "watch") return { status: "watch", label: "Vigilancia" };
  return { status: "risk", label: "Riesgo" };
}

const MOTIVE_LABELS: Record<string, string> = {
  Espera: "Tiempo de espera",
  Atención: "Atención al cliente",
  Calidad: "Calidad producto",
  Limpieza: "Limpieza",
  Otros: "Otros motivos",
};

export function normalizeDetectedIssues(
  motives: { name: string; value: number }[]
): DetectedIssue[] {
  return motives
    .map((m, i) => ({
      id: `issue-${i}`,
      label: MOTIVE_LABELS[m.name] ?? m.name,
      intensity: m.value,
    }))
    .sort((a, b) => b.intensity - a.intensity)
    .slice(0, 4);
}

export function buildPrimaryAction(params: {
  status: OperationalStatus;
  activeAlerts: number;
  recommendedPositiveReviews: number;
  topIssueLabel?: string;
}): string {
  const { status, activeAlerts, recommendedPositiveReviews, topIssueLabel } = params;

  if (
    status === "on_target" &&
    activeAlerts === 0 &&
    recommendedPositiveReviews === 0
  ) {
    return "No requiere actuación actualmente.";
  }

  if (recommendedPositiveReviews > 0) {
    return `Necesita aproximadamente ${recommendedPositiveReviews} reseñas positivas para reforzar su posición.`;
  }

  if (topIssueLabel?.toLowerCase().includes("espera")) {
    return "Se recomienda revisar los tiempos de espera detectados esta semana.";
  }

  if (topIssueLabel?.toLowerCase().includes("atención")) {
    return "Se recomienda reforzar la atención al cliente en sala y caja.";
  }

  if (activeAlerts > 0 && status === "critical") {
    return "Se recomienda actuar de inmediato sobre las alertas activas del local.";
  }

  if (activeAlerts > 0) {
    return "Se recomienda revisar las alertas activas antes del próximo ciclo.";
  }

  return "Monitorizar la evolución de la media durante la próxima semana.";
}

export function buildPreventRecommendation(
  healthLabel: "Protegido" | "Vigilancia" | "Riesgo",
  recommendedPositiveReviews: number
): string {
  if (healthLabel === "Protegido") {
    return "Mantener el estándar operativo. No se requiere acción preventiva.";
  }
  if (recommendedPositiveReviews > 0) {
    return `Conseguir aproximadamente ${recommendedPositiveReviews} reseñas positivas para reforzar la posición del restaurante.`;
  }
  if (healthLabel === "Riesgo") {
    return "Priorizar respuesta a incidencias y revisar los puntos críticos detectados.";
  }
  return "Vigilar la evolución semanal y responder a las reseñas recientes.";
}

export function formatRelativeTime(date: Date, now = new Date()): string {
  const diffMs = now.getTime() - date.getTime();
  const diffMin = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMin < 1) return "Ahora mismo";
  if (diffMin < 60) return `Hace ${diffMin} min`;
  if (diffHours < 24) return `Hace ${diffHours} hora${diffHours === 1 ? "" : "s"}`;
  if (diffDays === 1) return "Hace 1 día";
  if (diffDays < 7) return `Hace ${diffDays} días`;
  return date.toLocaleDateString("es-ES", { day: "numeric", month: "short" });
}

