import { normalizeManualPhone } from "@/lib/conversations/normalize-phone";
import { isValidConversationId } from "@/lib/conversations/read-model";

/**
 * Alta manual de un contacto de WhatsApp (solo super_admin). Función pura de
 * validación: normaliza el teléfono con la lógica E.164 existente y descarta
 * cualquier otro campo. El formulario solo vincula teléfono ↔ persona de Nexo:
 * NO acepta restaurantes, rol, empresa ni permisos de ningún tipo.
 */

export const MAX_CONTACT_NAME_CHARS = 100;

export type ParsedManualContact =
  | { ok: true; nombre: string | null; telefonoE164: string; usuarioId: string | null }
  | { ok: false; error: string };

export function parseManualContactBody(body: unknown): ParsedManualContact {
  const record = body && typeof body === "object" ? (body as Record<string, unknown>) : {};

  // El prefijo de país lo elige la persona de forma explícita: nunca se infiere.
  const telefonoE164 = normalizeManualPhone({
    countryCallingCode: typeof record.countryCallingCode === "string" ? record.countryCallingCode : null,
    nationalNumber: typeof record.nationalNumber === "string" ? record.nationalNumber : null,
  });
  if (!telefonoE164) return { ok: false, error: "Teléfono no válido. Indica el prefijo del país y el número." };

  let nombre: string | null = null;
  if (record.nombre !== undefined && record.nombre !== null) {
    if (typeof record.nombre !== "string") return { ok: false, error: "Nombre no válido" };
    const trimmed = record.nombre.trim();
    if (Array.from(trimmed).length > MAX_CONTACT_NAME_CHARS) {
      return { ok: false, error: `El nombre supera los ${MAX_CONTACT_NAME_CHARS} caracteres` };
    }
    nombre = trimmed === "" ? null : trimmed;
  }

  let usuarioId: string | null = null;
  if (record.usuarioId !== undefined && record.usuarioId !== null && record.usuarioId !== "") {
    if (typeof record.usuarioId !== "string" || !isValidConversationId(record.usuarioId)) {
      return { ok: false, error: "Usuario no válido" };
    }
    usuarioId = record.usuarioId;
  }

  return { ok: true, nombre, telefonoE164, usuarioId };
}
