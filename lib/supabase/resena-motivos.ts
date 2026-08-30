import type { ResenaRow } from "@/lib/supabase/resenas";

/**
 * Motivo de una reseña ya clasificado por el pipeline externo de IA en la
 * tabla `resena_motivos` (una fila por `review_id`, columna `categoria` en
 * SNAKE_CASE: TIEMPO_ESPERA, CALIDAD_PRODUCTO, SIN_MOTIVO...). A diferencia
 * de `analisis_ia.motivo` (texto libre, una frase distinta por reseña), esta
 * es la única categoría realmente limpia que existe en Supabase — por eso el
 * informe de red la usa tal cual en vez de reclasificar el texto libre con
 * heurísticas propias (ver lib/reviews/classify-reason.ts, que sigue
 * usándose en el resto de la app pero no aquí).
 */
export type ResenaMotivoRow = {
  review_id: string;
  categoria: string;
};

export type ResenaMotivoIndex = Map<string, ResenaMotivoRow>;

/** Etiquetas legibles para las categorías conocidas de `resena_motivos.categoria`. */
const CATEGORIA_LABELS: Record<string, string> = {
  TIEMPO_ESPERA: "Tiempo de espera",
  PEDIDO_INCORRECTO: "Pedido incorrecto",
  ATENCION_PERSONAL: "Atención del personal",
  CALIDAD_PRODUCTO: "Calidad del producto",
  LIMPIEZA: "Limpieza",
  FALTA_PRODUCTO: "Falta de producto",
  PRECIO: "Precio",
  AMBIENTE: "Ambiente",
  SEGURIDAD_ALIMENTARIA: "Seguridad alimentaria",
  INSTALACIONES_EQUIPOS: "Instalaciones y equipos",
  DELIVERY: "Delivery",
  ORGANIZACION_OPERATIVA: "Organización operativa",
  PROMOCIONES_CUPONES: "Promociones y cupones",
  COMUNICACION_IDIOMA: "Comunicación / idioma",
  HORARIOS_RESERVAS: "Horarios y reservas",
  COBRO_REEMBOLSO: "Cobro / reembolso",
  VALORACION_INCOHERENTE: "Valoración incoherente",
  NO_OPERATIVO: "No operativo",
  SIN_MOTIVO: "Sin motivo",
  OTRO: "Otro",
};

/**
 * Emoji que referencia visualmente cada categoría — solo para las que tienen
 * un icono obvio. Las que no (p.ej. CALIDAD_PRODUCTO, más abstracta) se
 * quedan sin entrada aquí a propósito: el llamador cae entonces a la
 * primera letra del motivo como referencia visual.
 */
const CATEGORIA_EMOJI: Record<string, string> = {
  TIEMPO_ESPERA: "⏳",
  PEDIDO_INCORRECTO: "🧾",
  ATENCION_PERSONAL: "🙋",
  LIMPIEZA: "🧹",
  FALTA_PRODUCTO: "📦",
  PRECIO: "💰",
  SEGURIDAD_ALIMENTARIA: "⚠️",
  INSTALACIONES_EQUIPOS: "🔧",
  DELIVERY: "🛵",
  PROMOCIONES_CUPONES: "🏷️",
  COMUNICACION_IDIOMA: "💬",
  HORARIOS_RESERVAS: "📅",
  COBRO_REEMBOLSO: "💳",
  NO_OPERATIVO: "🚫",
};

export function categoriaMotivoEmoji(categoria: string): string | null {
  return CATEGORIA_EMOJI[categoria.trim().toUpperCase()] ?? null;
}

/** Convierte una categoría SNAKE_CASE desconocida en una etiqueta legible por defecto. */
function fallbackLabel(categoria: string): string {
  return categoria
    .toLowerCase()
    .split("_")
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

export function categoriaMotivoLabel(categoria: string): string {
  const key = categoria.trim().toUpperCase();
  return CATEGORIA_LABELS[key] ?? fallbackLabel(key) ?? categoria;
}

export function buildResenaMotivoIndex(rows: ResenaMotivoRow[]): ResenaMotivoIndex {
  const index: ResenaMotivoIndex = new Map();
  for (const row of rows) {
    const key = row.review_id.trim();
    if (key) index.set(key, row);
  }
  return index;
}

export function getMotivoForResena(
  index: ResenaMotivoIndex,
  row: Pick<ResenaRow, "review_id">
): ResenaMotivoRow | null {
  if (row.review_id == null) return null;
  const key = String(row.review_id).trim();
  if (!key) return null;
  return index.get(key) ?? null;
}
