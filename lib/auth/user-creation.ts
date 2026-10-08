/**
 * Alta de usuarios de Nexo desde la web (solo super_admin). Validación pura del
 * formulario y de las contraseñas. El tipo de usuario visible se traduce al rol
 * técnico en el servidor: el navegador NUNCA envía un rol.
 *
 * La contraseña inicial la fija el super_admin y solo viaja servidor → Supabase Auth:
 * no se guarda en ninguna tabla, no se registra y no se devuelve en ninguna respuesta.
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
      /** Contraseña inicial tal cual (sin recortar). Solo para Supabase Auth. */
      password: string;
      /** Obligar a cambiarla al primer acceso (por defecto sí). */
      mustChangePassword: boolean;
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

  const passwordCheck = validatePasswordValue(record.password);
  if (!passwordCheck.ok) return passwordCheck;

  if (record.mustChangePassword !== undefined && typeof record.mustChangePassword !== "boolean") {
    return { ok: false, error: "Opción de cambio de contraseña no válida" };
  }

  const empresaId = record.empresaId;
  if (typeof empresaId !== "number" || !Number.isSafeInteger(empresaId) || empresaId <= 0) {
    return { ok: false, error: "Empresa no válida" };
  }

  const kind = USER_KINDS.find((item) => item.id === record.tipo);
  if (!kind) return { ok: false, error: "Tipo de usuario no válido" };

  return {
    ok: true,
    nombre,
    email,
    password: record.password as string,
    mustChangePassword: record.mustChangePassword !== false,
    empresaId,
    rol: kind.rol,
    restaurantIds: record.restaurantIds,
    marcaIds: record.marcaIds,
  };
}

export const MIN_PASSWORD_CHARS = 10;
/** Supabase Auth (bcrypt) ignora lo que pase de 72 caracteres: se rechaza en vez de truncarlo en silencio. */
export const MAX_PASSWORD_CHARS = 72;

/** Reglas de una contraseña: texto de 10 a 72 caracteres, sin recortar espacios. */
export function validatePasswordValue(password: unknown): { ok: true } | { ok: false; error: string } {
  if (typeof password !== "string") return { ok: false, error: "Contraseña no válida" };
  const length = Array.from(password).length;
  if (length < MIN_PASSWORD_CHARS) {
    return { ok: false, error: `La contraseña debe tener al menos ${MIN_PASSWORD_CHARS} caracteres.` };
  }
  if (length > MAX_PASSWORD_CHARS) {
    return { ok: false, error: `La contraseña no puede superar los ${MAX_PASSWORD_CHARS} caracteres.` };
  }
  return { ok: true };
}

/** Contraseña nueva + repetición (formularios de cambio de contraseña). */
export function validateNewPassword(password: string, confirmation: string): { ok: true } | { ok: false; error: string } {
  const check = validatePasswordValue(password);
  if (!check.ok) return check;
  if (password !== confirmation) return { ok: false, error: "Las contraseñas no coinciden." };
  return { ok: true };
}
