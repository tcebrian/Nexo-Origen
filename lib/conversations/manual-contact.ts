import { normalizeManualPhone } from "@/lib/conversations/normalize-phone";

/**
 * Alta manual de un contacto de WhatsApp (solo super_admin). Función pura de
 * validación: normaliza el teléfono con la lógica E.164 existente y valida el nombre.
 * Los permisos (tipo, empresa, restaurantes) se devuelven SIN validar: los valida
 * `validateContactAccess` contra el catálogo. La cuenta web NO interviene en el alta.
 */

export const MAX_CONTACT_NAME_CHARS = 100;

export type ParsedManualContact =
  | {
      ok: true;
      nombre: string | null;
      telefonoE164: string;
      /** tipo, empresaId, todosRestaurantes y restaurantIds, sin validar. */
      access: Record<string, unknown>;
    }
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

  return {
    ok: true,
    nombre,
    telefonoE164,
    access: {
      tipo: record.tipo,
      empresaId: record.empresaId,
      todosRestaurantes: record.todosRestaurantes,
      restaurantIds: record.restaurantIds,
    },
  };
}
