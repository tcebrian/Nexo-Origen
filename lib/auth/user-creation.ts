/**
 * Alta de usuarios de Nexo desde la web (solo super_admin). Validación pura del
 * formulario y de la nueva contraseña. El tipo de usuario visible se traduce al rol
 * técnico en el servidor: el navegador NUNCA envía un rol, y no existe ningún campo
 * de contraseña en el alta (la persona la crea ella misma con un enlace seguro).
 */

export const USER_KINDS = [
  { id: "empresa", label: "Administrador empresa", rol: "empresa_admin" },
  { id: "marca", label: "Responsable de marca", rol: "marca_admin" },
  { id: "restaurantes", label: "Cuenta de restaurantes", rol: "restaurante_user" },
] as const;

export type UserKindId = (typeof USER_KINDS)[number]["id"];
export type UserKindRole = (typeof USER_KINDS)[number]["rol"];

export const MAX_USER_NAME_CHARS = 100;
const MAX_EMAIL_CHARS = 254;
// Forma razonable de un email; la validación real es la de Supabase Auth.
const EMAIL_RE = /^[^\s@<>()[\]\\,;:"]+@[^\s@<>()[\]\\,;:"]+\.[^\s@<>()[\]\\,;:"]{2,}$/;

export type ParsedNewUser =
  | {
      ok: true;
      nombre: string;
      email: string;
      empresaId: number;
      rol: UserKindRole;
      restaurantIds: unknown;
      marcaIds: unknown;
    }
  | { ok: false; error: string };

/**
 * Valida nombre, email, empresa y tipo. Las listas de restaurantes y marcas se
 * devuelven sin validar: las valida `validateUserAccess` contra la empresa elegida.
 */
export function parseNewUserBody(body: unknown): ParsedNewUser {
  const record = body && typeof body === "object" ? (body as Record<string, unknown>) : {};

  const nombre = typeof record.nombre === "string" ? record.nombre.trim() : "";
  if (nombre === "" || Array.from(nombre).length > MAX_USER_NAME_CHARS) return { ok: false, error: "Nombre no válido" };

  const email = typeof record.email === "string" ? record.email.trim().toLowerCase() : "";
  if (email === "" || email.length > MAX_EMAIL_CHARS || !EMAIL_RE.test(email)) return { ok: false, error: "Email no válido" };

  const empresaId = record.empresaId;
  if (typeof empresaId !== "number" || !Number.isSafeInteger(empresaId) || empresaId <= 0) {
    return { ok: false, error: "Empresa no válida" };
  }

  const kind = USER_KINDS.find((item) => item.id === record.tipo);
  if (!kind) return { ok: false, error: "Tipo de usuario no válido" };

  return { ok: true, nombre, email, empresaId, rol: kind.rol, restaurantIds: record.restaurantIds, marcaIds: record.marcaIds };
}

export const MIN_PASSWORD_CHARS = 10;

/** Reglas de la contraseña que elige la propia persona al activar su cuenta. */
export function validateNewPassword(password: string, confirmation: string): { ok: true } | { ok: false; error: string } {
  if (Array.from(password).length < MIN_PASSWORD_CHARS) {
    return { ok: false, error: `La contraseña debe tener al menos ${MIN_PASSWORD_CHARS} caracteres.` };
  }
  if (password !== confirmation) return { ok: false, error: "Las contraseñas no coinciden." };
  return { ok: true };
}
