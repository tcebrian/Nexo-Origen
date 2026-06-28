import { IA_NO_ANALYSIS, IA_NO_DATA } from "@/lib/reviews/analisis-ia-constants";
import type { Review } from "@/lib/reviews/types";
import type { AnalisisIaRow } from "@/lib/supabase/analisis-ia";
import type { ResenaRow } from "@/lib/supabase/resenas";

export const REVIEW_PRIMARY_REASONS = [
  "Tiempo de espera",
  "Pedido incorrecto",
  "Atención al cliente",
  "Calidad producto",
  "Limpieza",
  "Falta de producto",
  "Precio",
  "Ambiente/local",
  "Empleado mencionado",
  "Sin comentario",
  "Otros",
] as const;

export type ReviewPrimaryReason = (typeof REVIEW_PRIMARY_REASONS)[number];

export type ClassifyReviewReasonInput = {
  comentario?: string | null;
  resumen_ia?: string | null;
  analisis_ia?: string | null;
  recomendacion_ia?: string | null;
  empleado_mencionado?: string | null;
  /** Alias de campos Supabase / Review */
  resumen?: string | null;
  motivo?: string | null;
  recomendacion?: string | null;
  text?: string | null;
  employeeMentioned?: string | null;
};

type WeightedPattern = { pattern: RegExp; score: number };

const COMMENT_WEIGHT = 3;
const RESUMEN_WEIGHT = 2;
const IA_MOTIVO_WEIGHT = 1;
const RECOMENDACION_WEIGHT = 1;

const TIEMPO_PATTERNS: WeightedPattern[] = [
  { pattern: /exceso de (tiempo|espera|demora)/i, score: 7 },
  { pattern: /demasiado tiempo|mucho tiempo|muy largo (el )?tiempo/i, score: 7 },
  { pattern: /tiempos? (de )?espera|espera (larga|demasiada|excesiva|interminable)/i, score: 7 },
  { pattern: /(tardaron?|tardó|tardanza|tardan|demoraron?|demoró)\b/i, score: 5 },
  { pattern: /(tardaron?|tardó|demoraron?|demoró).{0,40}(mucho|bastante|demasiado|eternidad)/i, score: 6 },
  { pattern: /\b(esperando|esperamos|esperar|espera)\b/i, score: 4 },
  { pattern: /\b(demora|retraso)\b/i, score: 5 },
  { pattern: /(servicio|atención|atencion|cocina).{0,20}(lent[oa]s?|tard)/i, score: 5 },
  { pattern: /\b(cola|fila)\b/i, score: 4 },
  { pattern: /\b\d+\s*minutos?\b/i, score: 3 },
  { pattern: /\bwaiting\b|\bdelay\b|\bslow service\b/i, score: 4 },
  { pattern: /(traer|servir|llegó|llego|sacar).{0,30}(tard|demor)/i, score: 6 },
  { pattern: /(tard|demor|esper).{0,30}(comida|pedido|plato|cena|menú|menu|hamburguesa)/i, score: 7 },
  { pattern: /(comida|pedido|plato|cena|menú|menu|hamburguesa).{0,30}(tard|demor|esper)/i, score: 7 },
  { pattern: /una (eternidad|hora) (para|esperando)/i, score: 6 },
];

const PEDIDO_PATTERNS: WeightedPattern[] = [
  { pattern: /pedido incorrecto|comanda incorrecta|orden incorrecta/i, score: 7 },
  { pattern: /\bequivocad[oa]s?\b/i, score: 5 },
  { pattern: /error (en (el|la) )?(pedido|comanda|orden)/i, score: 6 },
  { pattern: /\bincomplet[oa]s?\b/i, score: 5 },
  { pattern: /wrong order/i, score: 6 },
  { pattern: /\bfaltaba\b/i, score: 4 },
  { pattern: /no era lo que pedí|no era lo que pedi/i, score: 6 },
  { pattern: /(me|nos) (dieron|trajeron|sirvieron).{0,25}(otro|distinto|diferente|mal)/i, score: 5 },
];

const ATENCION_PATTERNS: WeightedPattern[] = [
  { pattern: /atención al cliente|atencion al cliente/i, score: 7 },
  { pattern: /calidad del servicio|calidad de (la )?atención|calidad de (la )?atencion/i, score: 6 },
  { pattern: /\b(trato|amabilidad|cortes[ií]a)\b/i, score: 4 },
  { pattern: /\b(amable|borde|maleducad[oa]s?|groser[oa]s?|antipátic[oa]s?)\b/i, score: 5 },
  { pattern: /\b(personal|emplead[oa]s?|staff|camarer[oa]s?|dependient[ea]s?)\b/i, score: 3 },
  { pattern: /mal (trato|servicio)|pésimo servicio|pesimo servicio/i, score: 6 },
  { pattern: /\bservice\b/i, score: 2 },
];

const CALIDAD_PATTERNS: WeightedPattern[] = [
  { pattern: /\b(frí[oa]s?|fri[oa]s?|quemad[oa]s?|sec[oa]s?|crud[oa]s?|dura|gomosa|aguada|sosa)\b/i, score: 6 },
  { pattern: /(mal|pésim[oa]|pesim[oa]|horrible|pésimo|pesimo)\s+(sabor|calidad)/i, score: 7 },
  { pattern: /mala calidad|pésima calidad|pesima calidad|calidad (mala|baja|pésima|pesima)/i, score: 7 },
  { pattern: /(sin sabor|poco sabor|mal sabor|sabor (malo|raro|extraño))/i, score: 6 },
  { pattern: /temperatura (inadecuada|incorrecta|fría|fria)/i, score: 6 },
  { pattern: /(hamburguesa|patata|pollo|carne|pizza|postre|bebida|café|cafe|plato|menú|menu).{0,35}(frí[oa]|fri[oa]|quemad|sec|crud|mal[oa]|insípid)/i, score: 6 },
  { pattern: /\bcold\b|\bburnt\b|\braw\b|\bundercooked\b/i, score: 6 },
  { pattern: /ingredientes?.{0,20}(frescos?|malos?|podrid|baratos?)/i, score: 4 },
];

const LIMPIEZA_PATTERNS: WeightedPattern[] = [
  { pattern: /\b(sucio|sucia|manchad[oa]s?|inmund[oa])\b/i, score: 6 },
  { pattern: /\blimpieza\b/i, score: 4 },
  { pattern: /\b(baño|aseos|wc)\b/i, score: 4 },
  { pattern: /(mesa|suelo|mantel).{0,20}(sucio|manchad|grasient)/i, score: 5 },
  { pattern: /\bdirty\b|\bhigiene\b/i, score: 5 },
];

const FALTA_PRODUCTO_PATTERNS: WeightedPattern[] = [
  { pattern: /\bno había\b|\bno habia\b/i, score: 6 },
  { pattern: /\bagotad[oa]s?\b/i, score: 6 },
  { pattern: /\bsin stock\b|\bno disponible\b|\bunavailable\b/i, score: 6 },
  { pattern: /\bno tenían\b|\bno tenian\b/i, score: 6 },
  { pattern: /sin (patatas?|bebida|postre|menú|menu|hamburguesa|producto)/i, score: 5 },
];

const PRECIO_PATTERNS: WeightedPattern[] = [
  { pattern: /\b(caro|cara|carísim[oa]s?|carisim[oa]s?)\b/i, score: 5 },
  { pattern: /\bprecio(s)? (altos?|excesivos?|desorbitados?)/i, score: 6 },
  { pattern: /\bexpensive\b|\bcostos[oa]s?\b/i, score: 5 },
  { pattern: /no vale (la pena|lo que cuesta)/i, score: 5 },
];

const AMBIENTE_PATTERNS: WeightedPattern[] = [
  { pattern: /\bruido\b/i, score: 5 },
  { pattern: /\b(ambiente|local)\b/i, score: 2 },
  { pattern: /\b(calor|sofocante)\b/i, score: 4 },
  { pattern: /fr[ií]o en (sala|local)/i, score: 4 },
  { pattern: /\b(saturad[oa]|abarrotad[oa]|lleno)\b/i, score: 4 },
];

const REASON_PATTERN_GROUPS: { reason: ReviewPrimaryReason; patterns: WeightedPattern[] }[] = [
  { reason: "Tiempo de espera", patterns: TIEMPO_PATTERNS },
  { reason: "Pedido incorrecto", patterns: PEDIDO_PATTERNS },
  { reason: "Atención al cliente", patterns: ATENCION_PATTERNS },
  { reason: "Calidad producto", patterns: CALIDAD_PATTERNS },
  { reason: "Limpieza", patterns: LIMPIEZA_PATTERNS },
  { reason: "Falta de producto", patterns: FALTA_PRODUCTO_PATTERNS },
  { reason: "Precio", patterns: PRECIO_PATTERNS },
  { reason: "Ambiente/local", patterns: AMBIENTE_PATTERNS },
];

const PRIORITY_ORDER: ReviewPrimaryReason[] = [
  "Tiempo de espera",
  "Pedido incorrecto",
  "Atención al cliente",
  "Calidad producto",
  "Limpieza",
  "Falta de producto",
  "Precio",
  "Ambiente/local",
  "Empleado mencionado",
  "Otros",
];

const TIEMPO_SIGNAL_RE =
  /tiempos?|espera|esperando|tard|demor|cola|fila|retraso|minutos?\s+(de\s+)?espera/i;

const FOOD_QUALITY_SIGNAL_RE =
  /frí[oa]|fri[oa]|quemad|sec[oa]|crud|sabor|mala calidad|pésima calidad|pesima calidad|temperatura|insípid|gomos|aguad/i;

const EMPTY_COMMENT_RE = /^(sin comentario|sin texto|n\/a|-)?$/i;
const IA_PLACEHOLDER_RE = new RegExp(
  `^(${IA_NO_DATA}|${IA_NO_ANALYSIS}|análisis pendiente|analisis pendiente)$`,
  "i"
);

function normalizeText(value: string | null | undefined): string {
  return (value ?? "").trim();
}

function isMeaningfulText(value: string | null | undefined): boolean {
  const text = normalizeText(value);
  if (!text) return false;
  if (EMPTY_COMMENT_RE.test(text)) return false;
  if (IA_PLACEHOLDER_RE.test(text)) return false;
  return true;
}

function resolveClassifyFields(
  review: ClassifyReviewReasonInput | ResenaRow | Review,
  analisis?: AnalisisIaRow | null
): ClassifyReviewReasonInput {
  if ("rating" in review && "text" in review) {
    const typed = review as Review;
    return {
      comentario: typed.text,
      resumen_ia: typed.ai?.summary,
      analisis_ia: typed.ai?.motives?.join(" "),
      recomendacion_ia: typed.recommendedAction,
      empleado_mencionado: typed.employeeMentioned,
    };
  }

  const row = review as ResenaRow;
  const ia = analisis ?? null;

  return {
    comentario: row.comentario,
    resumen_ia: ia?.resumen,
    analisis_ia: ia?.motivo,
    recomendacion_ia: ia?.recomendacion,
    empleado_mencionado: ia?.empleado_mencionado,
  };
}

function hasEmployeeMention(fields: ClassifyReviewReasonInput, corpus: string): boolean {
  const employee = fields.empleado_mencionado ?? fields.employeeMentioned ?? null;

  if (isMeaningfulText(employee)) return true;

  return /\b(emplead[oa]|camarer[oa]|dependient[ea]|encargad[oa]|gerente|manager)\b/i.test(corpus);
}

function scorePatterns(text: string, patterns: WeightedPattern[]): number {
  if (!text) return 0;

  let total = 0;
  for (const { pattern, score } of patterns) {
    if (pattern.test(text)) total += score;
  }
  return total;
}

function addWeightedScore(
  scores: Map<ReviewPrimaryReason, number>,
  reason: ReviewPrimaryReason,
  text: string,
  patterns: WeightedPattern[],
  weight: number
): void {
  const points = scorePatterns(text, patterns) * weight;
  if (points > 0) {
    scores.set(reason, (scores.get(reason) ?? 0) + points);
  }
}

function mapKnownMotivoLabel(motivo: string): { reason: ReviewPrimaryReason; confidence: number } | null {
  const lower = motivo.trim().toLowerCase();
  if (!lower) return null;

  if (/tiempo.*espera|espera.*larga|demora|tardanza|retraso|^espera$/.test(lower)) {
    return { reason: "Tiempo de espera", confidence: 6 };
  }
  if (/pedido incorrecto|error (de )?pedido|error (de )?comanda|comanda incorrecta/.test(lower)) {
    return { reason: "Pedido incorrecto", confidence: 6 };
  }
  if (/atención|atencion|trato|servicio al cliente|calidad del servicio/.test(lower)) {
    return { reason: "Atención al cliente", confidence: 5 };
  }
  if (/limpieza|higiene|sucio/.test(lower)) {
    return { reason: "Limpieza", confidence: 5 };
  }
  if (/falta de producto|sin stock|agotad|no disponible/.test(lower)) {
    return { reason: "Falta de producto", confidence: 5 };
  }
  if (/precio|caro|costos/.test(lower)) {
    return { reason: "Precio", confidence: 5 };
  }
  if (/ambiente|ruido|saturaci|local/.test(lower)) {
    return { reason: "Ambiente/local", confidence: 4 };
  }
  if (/empleado/.test(lower)) {
    return { reason: "Empleado mencionado", confidence: 5 };
  }
  if (
    /calidad.{0,20}(producto|comida|plato|hamburguesa|patata)|producto.{0,20}mal[oa]|comida.{0,20}(frí|fri|quemad|sec|crud|mal)/.test(
      lower
    )
  ) {
    return { reason: "Calidad producto", confidence: 5 };
  }
  if (/^calidad$|calidad (en|de) la comida|mala comida/.test(lower)) {
    return { reason: "Calidad producto", confidence: 2 };
  }

  return null;
}

function applyIaMotivoScores(
  scores: Map<ReviewPrimaryReason, number>,
  rawMotivo: string,
  commentText: string
): void {
  const commentLower = commentText.toLowerCase();
  const commentHasTiempo = TIEMPO_SIGNAL_RE.test(commentLower);
  const commentHasFoodQuality = FOOD_QUALITY_SIGNAL_RE.test(commentLower);

  for (const part of rawMotivo.split(/[|;\n,]+/)) {
    const mapped = mapKnownMotivoLabel(part);
    if (!mapped) continue;

    let confidence = mapped.confidence;

    if (
      mapped.reason === "Calidad producto" &&
      commentHasTiempo &&
      !commentHasFoodQuality
    ) {
      confidence = 0;
    }

    if (confidence > 0) {
      scores.set(
        mapped.reason,
        (scores.get(mapped.reason) ?? 0) + confidence * IA_MOTIVO_WEIGHT
      );
    }
  }
}

function applyConflictResolution(
  scores: Map<ReviewPrimaryReason, number>,
  commentText: string
): void {
  const commentLower = commentText.toLowerCase();
  const tiempoScore = scores.get("Tiempo de espera") ?? 0;
  const calidadScore = scores.get("Calidad producto") ?? 0;

  if (!commentLower) return;

  const commentTiempo = scorePatterns(commentLower, TIEMPO_PATTERNS) * COMMENT_WEIGHT;
  const commentCalidad = scorePatterns(commentLower, CALIDAD_PATTERNS) * COMMENT_WEIGHT;

  if (commentTiempo >= 9 && commentCalidad < 6) {
    scores.set("Calidad producto", Math.min(calidadScore, 1));
  }

  if (TIEMPO_SIGNAL_RE.test(commentLower) && !FOOD_QUALITY_SIGNAL_RE.test(commentLower)) {
    if (tiempoScore >= 6 && calidadScore > 0 && calidadScore <= tiempoScore + 2) {
      scores.set("Calidad producto", Math.min(calidadScore, 2));
    }
  }
}

function pickPrimaryReason(
  scores: Map<ReviewPrimaryReason, number>,
  hasEmployee: boolean
): ReviewPrimaryReason {
  if (hasEmployee) {
    scores.set("Empleado mencionado", (scores.get("Empleado mencionado") ?? 0) + 8);
  }

  let bestReason: ReviewPrimaryReason = "Otros";
  let bestScore = 0;

  for (const reason of PRIORITY_ORDER) {
    const score = scores.get(reason) ?? 0;
    if (score > bestScore) {
      bestScore = score;
      bestReason = reason;
    } else if (score > 0 && score === bestScore) {
      const currentIndex = PRIORITY_ORDER.indexOf(bestReason);
      const candidateIndex = PRIORITY_ORDER.indexOf(reason);
      if (candidateIndex < currentIndex) {
        bestReason = reason;
      }
    }
  }

  return bestScore > 0 ? bestReason : "Otros";
}

function buildReasonScores(fields: ClassifyReviewReasonInput): Map<ReviewPrimaryReason, number> {
  const comment = normalizeText(fields.comentario ?? fields.text);
  const resumen = normalizeText(fields.resumen_ia ?? fields.resumen);
  const recomendacion = normalizeText(fields.recomendacion_ia ?? fields.recomendacion);
  const rawMotivo = normalizeText(fields.analisis_ia ?? fields.motivo);

  const scores = new Map<ReviewPrimaryReason, number>();

  for (const group of REASON_PATTERN_GROUPS) {
    addWeightedScore(scores, group.reason, comment, group.patterns, COMMENT_WEIGHT);
    addWeightedScore(scores, group.reason, resumen, group.patterns, RESUMEN_WEIGHT);
    addWeightedScore(scores, group.reason, recomendacion, group.patterns, RECOMENDACION_WEIGHT);
  }

  if (rawMotivo) {
    applyIaMotivoScores(scores, rawMotivo, comment);
  }

  applyConflictResolution(scores, comment);

  return scores;
}

/**
 * Devuelve motivos detectados ordenados por relevancia (principal + secundarios).
 */
export function classifyReviewReasons(
  review: ClassifyReviewReasonInput | ResenaRow | Review,
  analisis?: AnalisisIaRow | null
): ReviewPrimaryReason[] {
  const fields = resolveClassifyFields(review, analisis);
  const hasComment = isMeaningfulText(fields.comentario ?? fields.text);
  const corpus = [
    fields.comentario ?? fields.text,
    fields.resumen_ia ?? fields.resumen,
    fields.analisis_ia ?? fields.motivo,
  ]
    .map(normalizeText)
    .filter(isMeaningfulText)
    .join(" ");

  const hasEmployee = hasEmployeeMention(fields, corpus);

  if (!corpus && !hasEmployee) {
    return hasComment ? ["Otros"] : ["Sin comentario"];
  }

  const scores = buildReasonScores(fields);
  if (hasEmployee) {
    scores.set("Empleado mencionado", (scores.get("Empleado mencionado") ?? 0) + 8);
  }

  const ranked = PRIORITY_ORDER.filter((reason) => (scores.get(reason) ?? 0) > 0).sort(
    (a, b) => {
      const diff = (scores.get(b) ?? 0) - (scores.get(a) ?? 0);
      if (diff !== 0) return diff;
      return PRIORITY_ORDER.indexOf(a) - PRIORITY_ORDER.indexOf(b);
    }
  );

  return ranked.length > 0 ? ranked : ["Otros"];
}

/**
 * Clasifica una reseña en un motivo principal a partir del comentario y del análisis IA ya guardado.
 * Prioriza el comentario real del cliente frente a etiquetas IA genéricas o erróneas.
 */
export function classifyReviewReason(
  review: ClassifyReviewReasonInput | ResenaRow | Review,
  analisis?: AnalisisIaRow | null
): ReviewPrimaryReason {
  return classifyReviewReasons(review, analisis)[0] ?? "Otros";
}

/** Alias semántico del valor devuelto por `classifyReviewReason`. */
export function getMotivoPrincipal(
  review: ClassifyReviewReasonInput | ResenaRow | Review,
  analisis?: AnalisisIaRow | null
): ReviewPrimaryReason {
  return classifyReviewReason(review, analisis);
}

export function reasonToSlug(reason: ReviewPrimaryReason): string {
  return reason
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/(^_|_$)/g, "");
}
