/**
 * SEC-013 — límites de frecuencia de las operaciones SENSIBLES de la aplicación (mutaciones administrativas, envíos por
 * WhatsApp y trabajo pesado con Chromium/PDF). Lista EXPLÍCITA y deliberada: no se limita "todo POST" ni las lecturas
 * normales del dashboard, y no se limitan los webhooks, el cron, Make ni el renderer interno (autenticación propia y
 * reintentos legítimos de proveedores).
 *
 * El contador es el de SEC-006 (`consumeRateLimit`: Postgres compartido entre instancias, con respaldo en memoria).
 * La clave de cada límite es SIEMPRE `<operación>:<id del usuario autenticado en el servidor>`: nunca un dato del cliente
 * (ni el usuario objetivo, ni la conversación, ni el restaurante, ni la IP).
 *
 * Los límites de las rutas que arrancan Chromium en lote son más altos que los de una acción puntual porque la interfaz
 * las encadena a propósito (descargar "todos" los informes de una marca en un ZIP): 10/min rompería esa función.
 */

export type RateLimitRule = { limit: number; windowSeconds: number };

const MINUTE = 60;
const TEN_MINUTES = 10 * 60;

export const SENSITIVE_RATE_LIMITS = {
  // Cuenta propia
  "auth-change-password": { limit: 5, windowSeconds: 15 * MINUTE },

  // Administración de usuarios (super_admin)
  "platform-user-create": { limit: 10, windowSeconds: TEN_MINUTES },
  "platform-user-password": { limit: 10, windowSeconds: TEN_MINUTES },
  "platform-user-access": { limit: 30, windowSeconds: TEN_MINUTES },

  // Agentes y alta de restaurantes (super_admin)
  "agents-create": { limit: 20, windowSeconds: TEN_MINUTES },
  "agents-update": { limit: 20, windowSeconds: TEN_MINUTES },
  "agents-summary-preview": { limit: 20, windowSeconds: MINUTE },
  "restaurant-onboarding-create": { limit: 10, windowSeconds: TEN_MINUTES },

  // Conversations (super_admin): envíos REALES por WhatsApp Cloud y mutaciones de contactos
  "conversation-send": { limit: 30, windowSeconds: MINUTE },
  "conversation-template-test": { limit: 5, windowSeconds: MINUTE },
  "conversation-report-send": { limit: 10, windowSeconds: MINUTE },
  "conversation-activation": { limit: 10, windowSeconds: MINUTE },
  "conversation-contact-create": { limit: 30, windowSeconds: TEN_MINUTES },
  "conversation-contact-update": { limit: 30, windowSeconds: TEN_MINUTES },
  "conversation-contact-delete": { limit: 10, windowSeconds: TEN_MINUTES },
  "conversation-negative-alerts": { limit: 30, windowSeconds: TEN_MINUTES },

  // Trabajo pesado (Chromium / PDF)
  "network-summary-image": { limit: 30, windowSeconds: MINUTE }, // "descargar todo" = 6 marcas x 2 intentos
  "monthly-report-render": { limit: 40, windowSeconds: MINUTE }, // ZIP de una marca: un render por local, encadenados
  "report-pdf": { limit: 30, windowSeconds: MINUTE },
} as const satisfies Record<string, RateLimitRule>;

export type SensitiveOperation = keyof typeof SENSITIVE_RATE_LIMITS;

/**
 * Operaciones con límite que NO pasan por `SENSITIVE_RATE_LIMITS`:
 *  - `negative-review-image`: SEC-006, 10/min/usuario, definido en su propia ruta (no se duplica).
 */
export const OTHER_RATE_LIMITED_OPERATIONS = ["negative-review-image"] as const;
