import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { menuItems, restaurantUserMenuItems, settingsMenuItem, isMenuItemActive } from "@/app/dashboard/_components/menu";
import { canAccessSection } from "@/lib/auth/permissions";
import type { UserRole } from "@/lib/auth/types";
import { buildNavigation, hasActiveItem } from "@/lib/dashboard/navigation";

/** Mismos filtros que `DashboardShell`: elementos del rol + Ajustes, filtrados por `canAccessSection`. */
function allowedFor(rol: UserRole, opts: { singleRestaurant?: boolean } = {}) {
  return [...(rol === "restaurante_user" ? restaurantUserMenuItems : menuItems), settingsMenuItem]
    .filter((item) => canAccessSection(rol, item.section))
    .filter((item) => !(opts.singleRestaurant && item.section === "restaurantes"));
}
const names = (items: { name: string }[]) => items.map((item) => item.name);

describe("escritorio", () => {
  it("super_admin: principales en su orden y el resto dentro de Más", () => {
    const { main, more } = buildNavigation(allowedFor("super_admin"), "desktop");
    expect(names(main)).toEqual(["Inicio", "Restaurantes", "Reseñas", "Conversaciones", "Alertas", "Informes"]);
    expect(names(more)).toEqual(["Ranking", "Nexo Prevent", "Talento", "Agentes", "Integraciones", "Usuarios", "Ajustes"]);
  });

  it("empresa_admin y marca_admin: solo lo que su rol ya permitía (sin Conversaciones, Informes, Usuarios ni Ajustes)", () => {
    for (const rol of ["empresa_admin", "marca_admin"] as const) {
      const { main, more } = buildNavigation(allowedFor(rol), "desktop");
      expect(names(main)).toEqual(["Inicio", "Restaurantes", "Reseñas", "Alertas"]);
      expect(names(more)).toEqual(["Ranking", "Nexo Prevent"]);
    }
  });

  it("restaurante_user: su menú reducido y sin Más", () => {
    const { main, more } = buildNavigation(allowedFor("restaurante_user"), "desktop");
    expect(names(main)).toEqual(["Inicio", "Reseñas", "Alertas"]);
    expect(more).toEqual([]);
  });

  it("con un único restaurante sigue sin lista de Restaurantes", () => {
    const { main } = buildNavigation(allowedFor("empresa_admin", { singleRestaurant: true }), "desktop");
    expect(names(main)).toEqual(["Inicio", "Reseñas", "Alertas"]);
  });
});

describe("móvil", () => {
  it("super_admin: 4 accesos principales y todo lo demás en Más", () => {
    const { main, more } = buildNavigation(allowedFor("super_admin"), "mobile");
    expect(names(main)).toEqual(["Inicio", "Reseñas", "Conversaciones", "Alertas"]);
    expect(names(more)).toEqual(["Restaurantes", "Informes", "Ranking", "Nexo Prevent", "Talento", "Agentes", "Integraciones", "Usuarios", "Ajustes"]);
  });

  it("empresa_admin: Conversaciones no aparece porque no tiene permiso; Restaurantes baja a Más", () => {
    const { main, more } = buildNavigation(allowedFor("empresa_admin"), "mobile");
    expect(names(main)).toEqual(["Inicio", "Reseñas", "Alertas"]);
    expect(names(more)).toEqual(["Restaurantes", "Ranking", "Nexo Prevent"]);
  });

  it("restaurante_user: tres accesos y Más vacío (la hoja solo trae periodo y usuario)", () => {
    const { main, more } = buildNavigation(allowedFor("restaurante_user"), "mobile");
    expect(names(main)).toEqual(["Inicio", "Reseñas", "Alertas"]);
    expect(more).toEqual([]);
  });
});

describe("permisos y rutas intactos", () => {
  const sections = (items: { section: string }[]) => items.map((item) => item.section).sort();

  it("la navegación solo reparte: ningún elemento aparece ni desaparece respecto al filtro por rol", () => {
    for (const rol of ["super_admin", "empresa_admin", "marca_admin", "restaurante_user"] as const) {
      const allowed = allowedFor(rol);
      for (const layout of ["desktop", "mobile"] as const) {
        const { main, more } = buildNavigation(allowed, layout);
        expect(sections([...main, ...more])).toEqual(sections(allowed));
      }
    }
  });

  it("no se muestra nada que el rol no pueda usar", () => {
    const { main, more } = buildNavigation(allowedFor("marca_admin"), "desktop");
    for (const item of [...main, ...more]) expect(canAccessSection("marca_admin", item.section)).toBe(true);
    expect(names([...main, ...more])).not.toContain("Usuarios");
  });

  it("una sección sin sitio asignado cae en Más (no se pierde)", () => {
    const extra = { name: "Nueva", icon: "home" as const, href: "/dashboard/nueva", section: "insights-ia" as const };
    const { more } = buildNavigation([...allowedFor("empresa_admin"), extra], "desktop");
    expect(names(more)).toContain("Nueva");
  });

  it("las rutas son las de siempre", () => {
    const { main, more } = buildNavigation(allowedFor("super_admin"), "desktop");
    const hrefs = Object.fromEntries([...main, ...more].map((item) => [item.name, item.href]));
    expect(hrefs).toMatchObject({
      Inicio: "/dashboard",
      Conversaciones: "/dashboard/conversaciones",
      Ranking: "/dashboard/ranking",
      Usuarios: "/dashboard/usuarios",
      Ajustes: "/dashboard/ajustes",
    });
  });
});

describe("sección activa dentro de Más", () => {
  const { more } = buildNavigation(allowedFor("super_admin"), "desktop");

  it("detecta una página de Más (y sus subrutas) para abrir el desplegable", () => {
    expect(hasActiveItem(more, "/dashboard/usuarios", isMenuItemActive)).toBe(true);
    expect(hasActiveItem(more, "/dashboard/ranking/algo", isMenuItemActive)).toBe(true);
    expect(hasActiveItem(more, "/dashboard/ajustes", isMenuItemActive)).toBe(true);
  });

  it("las páginas principales no abren Más", () => {
    for (const route of ["/dashboard", "/dashboard/resenas", "/dashboard/conversaciones", "/dashboard/informes/mensual"]) {
      expect(hasActiveItem(more, route, isMenuItemActive)).toBe(false);
    }
  });
});

describe("estructura del sidebar", () => {
  const read = (file: string) => readFileSync(path.join(process.cwd(), file), "utf-8");

  it("el usuario va fijo al pie con Cambiar contraseña y Cerrar sesión, y ya no hay enlace permanente", () => {
    const menu = read("app/dashboard/_components/user-menu.tsx");
    expect(menu).toContain("/auth/change-password");
    expect(menu).toContain("Cerrar sesión");
    expect(menu).toContain('aria-haspopup="menu"');
    expect(menu).toContain("Escape");

    const shell = read("app/dashboard/_components/dashboard-shell.tsx");
    expect(shell).toContain("<UserMenu />");
    expect(shell).not.toContain("Cambiar contraseña");
    expect(shell).not.toContain("LogoutButton");
    // La zona de navegación hace scroll y el bloque de usuario queda fuera de ella.
    expect(shell).toMatch(/overflow-y-auto[^"]*"[\s\S]*?<MoreMenu/);
  });
});
