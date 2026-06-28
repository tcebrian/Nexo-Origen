/**
 * Debe ser `true` en producción. El acceso depende únicamente de Supabase Auth.
 */
export const AUTH_ENABLED = process.env.NEXT_PUBLIC_AUTH_ENABLED === "true";

/**
 * Fase 2: filtrar datos por empresa / marca / restaurante.
 * Mientras sea false, todos los roles ven los mismos datos (solo cambian menú y rutas).
 */
export const DATA_SCOPING_ENABLED =
  process.env.NEXT_PUBLIC_DATA_SCOPING_ENABLED === "true";
