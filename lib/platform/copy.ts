/** Copy ejecutivo de la plataforma — centralizado para evitar hardcode en JSX. */

export const MODULE_QUESTIONS = {
  home: "¿Cómo está mi red hoy?",
  restaurants: "¿Qué locales necesitan atención?",
  reviews: "¿Qué opiniones requieren revisión?",
  alerts: "¿Dónde tengo problemas ahora?",
  prevent: "¿Qué debo hacer para no bajar del objetivo?",
  ranking: "¿Quién mejora y quién cae?",
  talent: "¿Qué empleados destacan o necesitan seguimiento?",
  reports: "¿Qué informe puedo consultar o enviar?",
} as const;

export const COPY = {
  homeTitle: "Inicio",
  homeGreeting: (name: string) => `Buenos días, ${name}`,
  executiveSummary: "Resumen ejecutivo",
  priorityActions: "Acciones prioritarias",
  lastUpdated: "Última actualización",
  networkStatus: "Estado de la red",
  requiresAttention: "Requieren atención",
  weeklyFindings: "Hallazgos de la semana",
  reputationStatus: "Estado de reputación",
  viewActionPlan: "Ver plan de acción",
  viewAllAlerts: "Ver todas las alertas",
  viewAllRestaurants: "Ver todos los restaurantes",
  positivesNeeded: "Reseñas positivas necesarias",
  negativesTolerance: "Negativas que soporta",
  recommendedAction: "Acción recomendada",
  onTarget: "En objetivo",
  onWatch: "En vigilancia",
  critical: "Críticos",
  totalLocations: "Locales en red",
  networkMedia: "Media de la red",
  noAttentionNeeded: "Ningún local requiere intervención inmediata en este periodo.",
  pendingActivation: "Pendiente de activar",
} as const;
