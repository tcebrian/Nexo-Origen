/** Tipos y utilidades de la pantalla de Conversaciones (solo presentación). */

export type ContactOptions = {
  types: { id: string; label: string }[];
  options: {
    empresas: { id: number; nombre: string }[];
    restaurants: { id: number; name: string; city: string; brand: string; empresaId: number | null }[];
  };
};

export type WhatsAppState =
  | { state: "pending"; welcomeSentAt: null; activatedAt: null }
  | { state: "sent"; welcomeSentAt: string; activatedAt: null }
  | { state: "active"; welcomeSentAt: string | null; activatedAt: string };

export type ContactDetail = {
  displayName: string;
  phone: string;
  nombre: string | null;
  tipo: string | null;
  selection: { empresaId: number | null; todosRestaurantes: boolean; restaurantIds: number[] };
  access: { count: number; restaurants: { id: number; name: string; brand: string; city: string }[] };
  linkedUser: { id: string; nombre: string; rol: string; empresaNombre: string | null } | null;
  whatsapp: WhatsAppState;
  /** Interruptor "Reseñas negativas". */
  negativeAlerts: boolean;
};

export type LinkableUser = { id: string; nombre: string; rol: string; empresaNombre: string | null; linkedElsewhere: boolean };

/** Rol de la CUENTA WEB (no el tipo del contacto): nombres neutros, sin llamar "Supervisor" a una cuenta de restaurante. */
export const WEB_ACCOUNT_LABELS: Record<string, string> = {
  super_admin: "Super administrador",
  empresa_admin: "Administrador de empresa",
  marca_admin: "Administrador de marca",
  restaurante_user: "Cuenta de restaurante",
};

/** Lo que se envía al guardar: solo tipo, empresa y restaurantes. */
export function accessBody(tipo: string, empresaId: string, todos: boolean, restaurantIds: Set<number>) {
  return {
    tipo: tipo === "" ? null : tipo,
    empresaId: empresaId === "" ? null : Number(empresaId),
    todosRestaurantes: todos,
    restaurantIds: [...restaurantIds],
  };
}

export async function fetchJson<T>(url: string): Promise<T> {
  const response = await fetch(url, { cache: "no-store" });
  if (!response.ok) throw new Error(String(response.status));
  return (await response.json()) as T;
}

/** Hasta dos iniciales del nombre ("Lidia Soria" → "LS"; "+34…" → "+"→"?"). */
export function initialsOf(name: string): string {
  const words = name
    .replace(/^\+/, "")
    .trim()
    .split(/\s+/)
    .filter((word) => /\p{L}/u.test(word));
  const letters = words.slice(0, 2).map((word) => Array.from(word)[0]!.toUpperCase());
  return letters.length > 0 ? letters.join("") : "?";
}

/** "+34600111222" → "+34 600 111 222" (España con grupos de 3; otros prefijos tal cual, agrupados en bloques). */
export function formatPhone(phone: string): string {
  const match = /^\+34(\d{3})(\d{3})(\d{3})$/.exec(phone);
  if (match) return `+34 ${match[1]} ${match[2]} ${match[3]}`;
  return phone;
}

export function formatDateTime(iso: string): string {
  const date = new Date(iso);
  return Number.isNaN(date.getTime())
    ? ""
    : date.toLocaleString("es-ES", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit", timeZone: "Europe/Madrid" });
}

export function pluralRestaurants(count: number): string {
  return `${count} ${count === 1 ? "restaurante" : "restaurantes"}`;
}

/** Marcas únicas de los restaurantes, en el orden en que aparecen. */
export function brandsOf(restaurants: { brand: string }[]): string[] {
  return [...new Set(restaurants.map((restaurant) => restaurant.brand).filter((brand) => brand !== ""))];
}

export const fieldClass =
  "w-full rounded-xl border border-white/[0.08] bg-[#0d0a14] px-3 py-2 text-[13px] text-white placeholder:text-gray-600 transition focus:border-violet-400/50 focus:outline-none focus:ring-2 focus:ring-violet-500/20";
export const labelClass = "mb-1.5 block text-[11px] font-medium uppercase tracking-[0.08em] text-gray-400";
export const primaryButtonClass =
  "inline-flex items-center justify-center gap-2 rounded-xl border border-violet-400/30 bg-violet-600/80 px-4 py-2 text-[13px] font-medium text-white transition hover:bg-violet-500/80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-400/60 disabled:cursor-not-allowed disabled:opacity-40";
export const secondaryButtonClass =
  "inline-flex items-center justify-center gap-2 rounded-xl border border-white/[0.1] bg-white/[0.04] px-4 py-2 text-[13px] font-medium text-gray-200 transition hover:bg-white/[0.08] hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-400/50 disabled:cursor-not-allowed disabled:opacity-40";
