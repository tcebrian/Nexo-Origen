import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

/**
 * Estructura de la pantalla de Conversaciones (solo presentación): lista de contactos, cabecera,
 * tarjeta de WhatsApp, resumen de permisos y drawers. Las pruebas leen el código porque el entorno
 * de tests no monta React; las reglas de datos tienen sus propios tests.
 */
const root = path.join(process.cwd(), "app/dashboard/conversaciones");
const read = (file: string) => readFileSync(path.join(root, file), "utf-8");

describe("estados de WhatsApp reutilizables", () => {
  const badge = read("_components/whatsapp-status-badge.tsx");

  it("cuatro estados con su texto y su color (verde, ámbar, gris, rojo)", () => {
    for (const text of ["WhatsApp activo", "Activación enviada", "Pendiente de activación", "Error de envío"]) {
      expect(badge).toContain(text);
    }
    expect(badge).toMatch(/active:[\s\S]*emerald/);
    expect(badge).toMatch(/sent:[\s\S]*amber/);
    expect(badge).toMatch(/pending:[\s\S]*gray/);
    expect(badge).toMatch(/error:[\s\S]*rose/);
  });

  it("la lista y la cabecera usan el mismo componente", () => {
    const view = read("conversations-view.tsx");
    expect(view).toContain('<WhatsAppStatusBadge state={item.whatsapp} variant="inline" />');
    expect(view).toContain("<WhatsAppStatusBadge state={whatsappState} />");
    expect(read("_components/contact-info-panel.tsx")).toContain("<WhatsAppStatusBadge state={badge} />");
  });
});

describe("lista de contactos", () => {
  const view = read("conversations-view.tsx");

  it("tarjeta compacta: iniciales, nombre, tipo · restaurantes, estado y actividad reciente", () => {
    expect(view).toContain("initialsOf(name)");
    expect(view).toContain("contactTypeLabel(item.access.tipo)");
    expect(view).toContain("pluralRestaurants(item.access.restaurantCount)");
    expect(view).toContain("Actividad reciente");
    expect(view).toContain("Sin acceso a datos");
  });

  it("el seleccionado queda resaltado y hay buscador", () => {
    expect(view).toContain('aria-current={active ? "true" : undefined}');
    expect(view).toContain("border-violet-400/35 bg-violet-500/[0.14]");
    expect(view).toContain("Buscar por nombre o teléfono");
  });
});

describe("cabecera del contacto", () => {
  const view = read("conversations-view.tsx");

  it("avatar, nombre, rol, teléfono, estado y línea discreta de restaurantes y marcas", () => {
    expect(view).toContain("formatPhone(selected.phone)");
    expect(view).toContain("brandsOf(contact.detail.access.restaurants)");
    expect(view).toMatch(/asignados|asignado/);
    expect(view).toContain("Sin restaurantes asignados");
  });
});

describe("tarjetas de la ficha", () => {
  const panel = read("_components/contact-info-panel.tsx");

  it("WhatsApp: pendiente, enviada y activa, con las acciones de siempre", () => {
    expect(panel).toContain("Todavía no se ha enviado la activación");
    expect(panel).toContain("Esperando confirmación del contacto");
    expect(panel).toContain("Este contacto puede recibir información de Nexo");
    expect(panel).toContain("Enviar activación");
    expect(panel).toContain("Reenviar activación");
    // Reutiliza la ruta existente; no hay llamadas nuevas.
    expect(panel).toContain("/activation");
  });

  it("Permisos: solo un resumen con empresa, acceso y restaurantes; el formulario va en el drawer", () => {
    expect(panel).toContain("Editar permisos");
    expect(panel).toContain("Empresa");
    expect(panel).toContain("Acceso");
    // Ni checkboxes ni el selector de restaurantes en la pantalla normal.
    expect(panel).not.toContain('type="checkbox"');
    expect(panel).not.toContain("AccessPicker");
  });
});

describe("drawers", () => {
  const drawer = read("_components/drawer.tsx");
  const permissions = read("_components/permissions-drawer.tsx");

  it("se cierran con la X (siempre visible), con Escape y pulsando fuera", () => {
    expect(drawer).toContain('aria-label="Cerrar"');
    expect(drawer).toContain('event.key === "Escape"');
    expect(drawer).toContain('aria-label="Cerrar panel"');
    expect(drawer).toContain('role="dialog"');
    expect(drawer).toContain('aria-modal="true"');
    // La cabecera no forma parte de la zona con scroll.
    expect(drawer.indexOf("<header")).toBeLessThan(drawer.indexOf("overflow-y-auto"));
  });

  it("ancho de unos 460 px en escritorio, a pantalla completa en móvil, con pie fijo", () => {
    expect(drawer).toContain("sm:w-[460px]");
    expect(drawer).toContain("w-full");
    expect(drawer).toContain("<footer");
  });

  it("permisos: empresa, todos / concretos, buscador, contador y pie con Cancelar y Guardar cambios", () => {
    const picker = read("_components/access-picker.tsx");
    for (const text of ["Todos los restaurantes", "Restaurantes concretos", "Buscar restaurante", "seleccionados"]) {
      expect(picker).toContain(text);
    }
    expect(permissions).toContain("Cancelar");
    expect(permissions).toContain("Guardar cambios");
    // Misma llamada de guardado de siempre.
    expect(permissions).toContain("`/api/conversations/${conversationId}/contact`");
    expect(permissions).toContain('method: "PATCH"');
  });

  it("con cambios sin guardar pregunta antes de cerrar", () => {
    expect(permissions).toContain("setConfirmingClose(true)");
    expect(permissions).toContain("DiscardNotice");
    expect(drawer).toContain("Tienes cambios sin guardar");
    expect(read("_components/new-contact-drawer.tsx")).toContain("DiscardNotice");
  });
});

describe("responsive", () => {
  const view = read("conversations-view.tsx");

  it("tres zonas en escritorio ancho; en pantallas más estrechas, la información en un drawer", () => {
    expect(view).toContain("min-[1360px]:block");
    expect(view).toContain("min-[1360px]:hidden");
    expect(view).toContain("Información del contacto");
  });

  it("en móvil la lista y la conversación van en pantallas separadas", () => {
    expect(view).toContain('${selected ? "hidden md:flex" : "flex"}');
    expect(view).toContain('${selected ? "flex" : "hidden md:flex"}');
    expect(view).toContain('aria-label="Volver a la lista"');
  });
});
