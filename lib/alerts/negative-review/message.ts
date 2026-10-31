/** Texto corto que acompaña a la imagen de una alerta negativa (sin datos del autor ni del comentario). */
export function buildAlertText(input: { restaurantName: string; stars: number; link: string | null }): string {
  const lines = [
    "🚨 Reseña negativa detectada",
    `Restaurante: ${input.restaurantName}`,
    `Valoración: ${input.stars}★`,
    "Te enviamos la captura para revisarla cuanto antes.",
  ];
  if (input.link) lines.push("", "🔗 Ver en Google Maps:", input.link);
  return lines.join("\n");
}

/** Aviso cuando la imagen de una alerta no se ha podido generar tras reintentarlo (sin datos del autor ni del comentario). */
export function buildImageFailedText(input: { restaurantName: string; stars: number; link: string | null }): string {
  const lines = [
    "⚠️ Hay una reseña negativa cuya imagen no se ha podido generar.",
    `Restaurante: ${input.restaurantName}`,
    `Valoración: ${input.stars}★`,
  ];
  if (input.link) lines.push("", "🔗 Puedes verla en Google Maps:", input.link);
  return lines.join("\n");
}

/** Pie de la vista previa de la conversación (no incluye datos del contacto). */
export function alertImagePreview(restaurantName: string): string {
  return `🚨 Alerta negativa · ${restaurantName}`;
}
