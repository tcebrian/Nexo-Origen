import type { NegativeReviewAlertData } from "./types";

export type ExecutiveFact = {
  label: string;
  value: string;
};

export type AiAnalysis = {
  primaryReason: string;
  secondaryReasons: string[];
  repetitionRisk: string;
  operationalImpact: string;
};

export type SeverityDisplay = {
  label: string;
  level: string;
};

/** Textos ejecutivos derivados de los datos existentes (sin nuevos campos). */
export function buildExecutiveFacts(data: NegativeReviewAlertData): ExecutiveFact[] {
  const impactAbs = Math.abs(data.rating_impact).toFixed(2);
  const direction = data.rating_impact <= 0 ? "descenso" : "subida";
  const impactLine =
    data.rating_impact <= 0
      ? `Caída de ${impactAbs} pts en la valoración media (${data.previous_rating.toFixed(2)} → ${data.current_rating.toFixed(2)})`
      : `Subida de ${impactAbs} pts en la valoración media`;

  const risk = data.risk_level.toUpperCase();
  const repetitionRisk =
    risk === "ALTO"
      ? "Elevado — alta probabilidad de reseñas negativas similares"
      : risk === "MEDIO"
        ? "Moderado — conviene monitorizar el local de cerca"
        : "Bajo — incidente aislado con baja recurrencia esperada";

  const priority =
    risk === "ALTO"
      ? "Inmediata — actuación en las próximas 24-48 h"
      : risk === "MEDIO"
        ? "Alta — intervención esta semana"
        : "Media — seguimiento programado";

  return [
    { label: "Impacto directo en reputación", value: `${impactLine} con ${direction} visible en la media.` },
    { label: "Riesgo de repetición", value: repetitionRisk },
    { label: "Prioridad de actuación", value: priority },
  ];
}

export function buildAiAnalysis(data: NegativeReviewAlertData): AiAnalysis {
  const facts = buildExecutiveFacts(data);
  const [primary, ...secondary] = data.detected_reasons;
  const impactAbs = Math.abs(data.rating_impact).toFixed(2);
  const sign = data.rating_impact <= 0 ? "−" : "+";

  return {
    primaryReason: primary ?? "Incidencia operativa",
    secondaryReasons: secondary.length > 0 ? secondary : [],
    repetitionRisk: facts.find((f) => f.label === "Riesgo de repetición")?.value ?? "—",
    operationalImpact: `${sign}${impactAbs} pts · ${data.previous_rating.toFixed(2)} → ${data.current_rating.toFixed(2)}`,
  };
}

export function buildSeverityDisplay(data: NegativeReviewAlertData): SeverityDisplay {
  const risk = data.risk_level.toUpperCase();
  if (risk === "ALTO" || data.review_stars <= 1) {
    return { label: "Severidad", level: "CRÍTICA" };
  }
  if (risk === "MEDIO") {
    return { label: "Severidad", level: "ALTA" };
  }
  return { label: "Severidad", level: "MEDIA" };
}

/** Conclusión narrativa estilo analista de reputación. */
export function buildExecutiveConclusion(data: NegativeReviewAlertData): string {
  const location = data.restaurant_location || data.restaurant_address;
  const reasons =
    data.detected_reasons.length > 0
      ? data.detected_reasons.slice(0, 4).join(", ").toLowerCase()
      : "incidencias operativas";
  const impactAbs = Math.abs(data.rating_impact).toFixed(2);
  const risk = data.risk_level.toUpperCase();

  const opening =
    risk === "ALTO"
      ? "La situación requiere intervención prioritaria por parte de dirección de operaciones."
      : risk === "MEDIO"
        ? "Se recomienda activar protocolos de seguimiento en el establecimiento."
        : "El incidente puede gestionarse con medidas correctivas estándar.";

  return (
    `El análisis de la reseña publicada en ${data.source} por ${data.review_author} ` +
    `(${data.review_date}) evidencia un deterioro perceptible de la experiencia en ${data.restaurant_name} ` +
    `(${location}). Los motivos identificados — ${reasons} — concentran el núcleo de la insatisfacción del cliente ` +
    `y explican una caída de ${impactAbs} puntos en la valoración media. ` +
    `El nivel de riesgo ${risk} incrementa la exposición reputacional. ` +
    `${opening}`
  );
}

/** Acciones prioritarias derivadas de la recomendación y el contexto. */
export function buildPriorityActions(data: NegativeReviewAlertData): string[] {
  const actions: string[] = [data.recommendation.trim()];
  const rec = data.recommendation.toLowerCase();

  if (!rec.includes("24")) {
    actions.push("Responder al cliente en menos de 24h.");
  }

  const primary = data.detected_reasons[0];
  if (primary) {
    const snippet = primary.toLowerCase();
    if (!rec.includes(snippet.slice(0, Math.min(12, snippet.length)))) {
      actions.push(`Actuar sobre ${snippet}.`);
    }
  }

  return [...new Set(actions)].slice(0, 3);
}
