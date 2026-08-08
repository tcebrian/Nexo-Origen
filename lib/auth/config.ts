/**
 * Fase 2: filtrar datos por empresa / marca / restaurante.
 * Mientras sea false, todos los roles ven los mismos datos (solo cambian menú y rutas).
 */
export const DATA_SCOPING_ENABLED =
  process.env.NEXT_PUBLIC_DATA_SCOPING_ENABLED === "true";
