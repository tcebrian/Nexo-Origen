import { normalizeEmployeeName } from "./detect";

/** Palabras que nunca son nombres de persona. */
const DENY_EXACT = new Set(
  [
    // Marcas y negocio
    "google", "burger", "king", "popeyes", "gloria", "hortons", "hambar", "nexo", "origen",
    "mcdonalds", "starbucks", "whopper", "menu", "menus", "combo", "combos",
    // Lugar / negocio
    "restaurante", "local", "tienda", "caja", "mostrador", "cocina", "drive", "autoservicio",
    "baño", "bano", "wc", "mesa", "mesas", "barra", "terraza", "parking",
    // Roles (sin nombre propio)
    "camarero", "camarera", "encargado", "encargada", "gerente", "empleado", "empleada",
    "mozo", "moza", "azafata", "dependiente", "trabajador", "trabajadora", "personal", "equipo",
    "cliente", "clientes", "usuario", "usuaria",
    // Reseña / meta
    "reseña", "resena", "comentario", "estrellas", "estrella", "valoracion", "valoración",
    "sin", "nombre", "desconocido", "unknown", "anonimo", "anónimo", "ninguno", "ninguna",
    "null", "undefined", "n/a", "na",
    // Determinantes / pronombres
    "todo", "todos", "todas", "nada", "algo", "otro", "otra", "otros", "otras",
    "este", "esta", "estos", "estas", "ese", "esa", "esos", "esas", "aquel", "aquella",
    "mismo", "misma", "mismos", "mismas", "cada", "cual", "cuales", "cuáles",
    // Adverbios / conectores frecuentes en reseñas
    "muy", "mas", "más", "menos", "tan", "tanto", "siempre", "nunca", "jamás", "jamas",
    "hoy", "ayer", "ahora", "antes", "despues", "después", "luego", "despues",
    "aqui", "aquí", "alli", "allí", "donde", "cuando", "porque", "aunque", "pero", "sino",
    "como", "cómo", "que", "cual", "quien", "quién",
    // Adjetivos / valoraciones
    "excelente", "bueno", "buena", "buen", "malo", "mala", "mal", "peor", "mejor",
    "genial", "fatal", "horrible", "perfecto", "perfecta", "increible", "increíble",
    "regular", "normal", "rapido", "rápido", "lento", "lenta", "sucio", "sucia", "limpio", "limpia",
    "amable", "antipatico", "antipático", "educado", "educada", "majo", "maja",
    // Servicio / motivos de reseña
    "servicio", "atencion", "atención", "comida", "producto", "productos", "pedido", "pedidos",
    "calidad", "limpieza", "higiene", "espera", "tiempo", "cola", "fila", "error", "falta",
    "ruido", "saturacion", "saturación", "ambiente", "precio", "precios", "tarda", "tardan",
    "hamburguesa", "hamburguesas", "patatas", "patata", "bebida", "bebidas", "helado", "postre",
    "carne", "pollo", "whopper", "nuggets", "refresco", "cafe", "café",
    // Días
    "lunes", "martes", "miercoles", "miércoles", "jueves", "viernes", "sabado", "sábado", "domingo",
    // Turnos / genéricos
    "mañana", "manana", "tarde", "noche", "turno", "festivo", "verano", "invierno",
    // Ciudades frecuentes en la red (no son empleados)
    "tudela", "utebo", "zaragoza", "pamplona", "madrid", "barcelona", "valencia", "sevilla",
    "bilbao", "logroño", "logrono", "huesca", "calatayud", "ejeca", "ejeca",
    // Verbos que a veces van capitalizados al inicio de frase
    "pedir", "esperar", "comer", "volver", "recomendar", "mejorar", "repetir", "encargar",
    "gracias", "por", "favor", "disculpa", "perdon", "perdón",
    // Otros
    "grupo", "cadena", "franquicia", "sucursal", "sucursales", "centro", "plaza",
  ].map((w) => w.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase())
);

const DENY_PREFIXES = ["auto", "mini", "super", "mega", "ultra", "extra"];

const PARTICLES = new Set(["de", "del", "la", "las", "los", "y", "i"]);

export type NameValidationContext = {
  source: "field" | "text";
  restaurantName?: string;
};

function normalizeToken(token: string): string {
  return normalizeEmployeeName(token);
}

function restaurantTokens(restaurantName?: string): Set<string> {
  if (!restaurantName) return new Set();
  return new Set(
    restaurantName
      .split(/[\s,.-]+/)
      .map((t) => normalizeToken(t))
      .filter((t) => t.length >= 3)
  );
}

function isDeniedToken(token: string, restaurantWords: Set<string>): boolean {
  const n = normalizeToken(token);
  if (!n || n.length < 2) return true;
  if (DENY_EXACT.has(n)) return true;
  if (restaurantWords.has(n)) return true;
  if (/^\d+$/.test(n)) return true;
  if (/^(x|xx|xxx|na|n\/a)$/.test(n)) return true;
  if (DENY_PREFIXES.some((p) => n.startsWith(p) && n.length > p.length + 2)) return true;
  // Sustantivos abstractos / categorías
  if (/(cion|sion|miento|dad|ez|ura|aje|ismo|idad)$/.test(n) && n.length > 5) return true;
  return false;
}

function isValidNameToken(token: string, ctx: NameValidationContext, restaurantWords: Set<string>): boolean {
  const trimmed = token.trim();
  if (!trimmed || trimmed.length < 2) return false;
  if (PARTICLES.has(normalizeToken(trimmed))) return true;
  if (trimmed.length > 18) return false;
  if (!/^[\p{L}'-]+$/u.test(trimmed)) return false;
  if (isDeniedToken(trimmed, restaurantWords)) return false;

  if (ctx.source === "text") {
    // En texto libre exigimos mayúscula inicial (nombre propio)
    if (!/^[A-ZÁÉÍÓÚÑ]/.test(trimmed)) return false;
    if (trimmed === trimmed.toUpperCase() && trimmed.length > 3) return false;
  }

  return true;
}

function countValidNameParts(parts: string[], ctx: NameValidationContext, restaurantWords: Set<string>): number {
  return parts.filter((p) => {
    const n = normalizeToken(p);
    if (PARTICLES.has(n)) return false;
    return isValidNameToken(p, ctx, restaurantWords);
  }).length;
}

/** Normaliza para mostrar: "josé martínez" → "José Martínez" */
export function formatEmployeeDisplayName(raw: string): string {
  return raw
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .map((part) => {
      const lower = part.toLowerCase();
      if (PARTICLES.has(lower)) return lower;
      return lower.charAt(0).toUpperCase() + lower.slice(1);
    })
    .join(" ");
}

/**
 * ¿Parece un nombre de persona real?
 * - Campos de BD: acepta nombre compuesto si al menos una parte es válida.
 * - Texto de reseña: reglas más estrictas (sin palabras sueltas dudosas).
 */
export function isEmployeePersonName(raw: string, ctx: NameValidationContext): boolean {
  const cleaned = raw.trim().replace(/\s+/g, " ");
  if (!cleaned || cleaned.length < 3 || cleaned.length > 48) return false;

  const lower = cleaned.toLowerCase();
  if (/^(sin nombre|no consta|desconocido|n\/a|na|null|—|-)$/i.test(lower)) return false;
  if (/[@#0-9]/.test(cleaned)) return false;
  if (/^(falta|error|tiempo|calidad|limpieza|atencion|atención|producto|servicio)\b/i.test(lower)) {
    return false;
  }

  const restaurantWords = restaurantTokens(ctx.restaurantName);
  const primary = cleaned.split(/[,;/|]/)[0]?.trim() ?? cleaned;
  const parts = primary.split(/\s+/).filter(Boolean);

  if (parts.length === 0) return false;

  const validParts = countValidNameParts(parts, ctx, restaurantWords);
  if (validParts === 0) return false;

  // Una sola palabra: solo desde campo BD o contexto muy claro en texto
  if (parts.length === 1) {
    if (ctx.source === "field") {
      return isValidNameToken(parts[0], ctx, restaurantWords);
    }
    // Texto: una palabra suelta solo si parece nombre propio claro (≥4 letras, no denegada)
    const token = parts[0];
    const n = normalizeToken(token);
    return n.length >= 4 && isValidNameToken(token, ctx, restaurantWords);
  }

  // Nombre compuesto: al menos 2 partes válidas, o 1 válida + partículas (María de la Cruz)
  if (validParts >= 2) return true;
  if (validParts === 1 && parts.length >= 2) {
    const onlyValid = parts.find((p) => isValidNameToken(p, ctx, restaurantWords));
    return Boolean(onlyValid && normalizeToken(onlyValid).length >= 4);
  }

  return false;
}

export function sanitizeEmployeeFieldValue(raw: string): string | null {
  const primary = raw.trim().split(/[,;/|]/)[0]?.trim() ?? "";
  if (!primary) return null;
  if (!isEmployeePersonName(primary, { source: "field" })) return null;
  return formatEmployeeDisplayName(primary);
}

export type ExtractedName = {
  name: string;
  confidence: number;
};

/**
 * Extrae nombres solo con patrones de alta confianza (rol + nombre, gracias a…, atendió…).
 */
export function extractPersonNamesFromComment(
  text: string,
  restaurantName?: string
): ExtractedName[] {
  const found = new Map<string, number>();
  const ctx: NameValidationContext = { source: "text", restaurantName };

  const patterns: { regex: RegExp; confidence: number }[] = [
    {
      regex:
        /(?:camarer[oa]s?|encargad[oa]|gerente|emplead[oa]|mozo[a]?|azafat[oa]|dependient[ea]|trabajador[a]?)\s+([A-ZÁÉÍÓÚÑ][\p{L}'-]+(?:\s+(?:de|del|la|las|los|y)\s+[A-ZÁÉÍÓÚÑ][\p{L}'-]+|\s+[A-ZÁÉÍÓÚÑ][\p{L}'-]+)*)/giu,
      confidence: 0.92,
    },
    {
      regex: /(?:gracias a)\s+([A-ZÁÉÍÓÚÑ][\p{L}'-]+(?:\s+[A-ZÁÉÍÓÚÑ][\p{L}'-]+)?)/giu,
      confidence: 0.88,
    },
    {
      regex: /(?:atendió|atendio|atiende|atiendió|atiendio)\s+([A-ZÁÉÍÓÚÑ][\p{L}'-]+(?:\s+[A-ZÁÉÍÓÚÑ][\p{L}'-]+)?)/giu,
      confidence: 0.85,
    },
    {
      regex:
        /([A-ZÁÉÍÓÚÑ][\p{L}'-]+(?:\s+[A-ZÁÉÍÓÚÑ][\p{L}'-]+)?)\s+(?:nos atendió|nos atendio|nos sirvió|nos sirvio|nos ayudó|nos ayudo|muy amable|muy atent[oa])/giu,
      confidence: 0.8,
    },
  ];

  for (const { regex, confidence } of patterns) {
    for (const match of text.matchAll(regex)) {
      const candidate = match[1]?.trim();
      if (!candidate) continue;
      if (!isEmployeePersonName(candidate, ctx)) continue;

      const display = formatEmployeeDisplayName(candidate);
      const prev = found.get(display) ?? 0;
      found.set(display, Math.max(prev, confidence));
    }
  }

  return Array.from(found.entries()).map(([name, confidence]) => ({ name, confidence }));
}
