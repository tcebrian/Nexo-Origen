import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createFakeDb, type FakeDb } from "@/lib/conversations/fake-supabase.test-helper";
import type { Perfil, UserRole, UserScope } from "@/lib/auth/types";

/**
 * SEC-014 — el aislamiento entre empresas está SIEMPRE activo. Antes dependía de la variable de entorno pública
 * que activaba el filtrado por empresa: sin ella, cualquier rol que no fuera super_admin recibía un alcance sin
 * restricción. Aquí se ejecuta el `fetchUserScope` REAL contra una base de datos en memoria con dos empresas
 * (Hambar y Vault) y se comprueba que el resultado es el mismo con la variable ausente, vacía, "false" o "true".
 */

let db: FakeDb;
let hasServiceRole = true;

vi.mock("server-only", () => ({}));
vi.mock("@/lib/supabase/admin", () => ({ getSupabaseAdmin: () => (hasServiceRole ? db.client : null) }));

const HAMBAR = 1;
const VAULT = 2;
const HAMBAR_RESTAURANTS = [1, 2, 3];
const VAULT_RESTAURANTS = [10, 11];
const ENV_NAME = ["NEXT_PUBLIC", "DATA", "SCOPING", "ENABLED"].join("_");

function seed(): FakeDb {
  return createFakeDb({
    empresas: [
      { id: HAMBAR, nombre: "Grupo Hambar" },
      { id: VAULT, nombre: "Vault" },
    ],
    marcas: [
      { id: 100, nombre: "Burger King" },
      { id: 200, nombre: "Popeyes" },
      { id: 300, nombre: "Vault" },
    ],
    restaurantes: [
      { id: 1, nombre: "Zizur", empresa_id: HAMBAR, marca_id: 100 },
      { id: 2, nombre: "Tudela", empresa_id: HAMBAR, marca_id: 100 },
      { id: 3, nombre: "Calahorra", empresa_id: HAMBAR, marca_id: 200 },
      { id: 10, nombre: "Vault Madrid", empresa_id: VAULT, marca_id: 300 },
      { id: 11, nombre: "Vault Sevilla", empresa_id: VAULT, marca_id: 300 },
    ],
    usuario_marcas: [
      { user_id: "u-marca-hambar", marca_id: 100 },
      { user_id: "u-marca-vacia", marca_id: 999 },
    ],
    usuario_restaurantes: [
      { user_id: "u-rest-hambar", restaurante_id: 1 },
      { user_id: "u-rest-vault", restaurante_id: 10 },
    ],
  });
}

function perfil(id: string, rol: UserRole, empresaId: number | null): Perfil {
  return { id, userId: id, rol, nombre: null, email: null, empresaId: empresaId === null ? null : String(empresaId), mustChangePassword: false };
}

const USERS = {
  hambarAdmin: perfil("u-admin-hambar", "empresa_admin", HAMBAR),
  vaultAdmin: perfil("u-admin-vault", "empresa_admin", VAULT),
  hambarMarca: perfil("u-marca-hambar", "marca_admin", HAMBAR),
  hambarRest: perfil("u-rest-hambar", "restaurante_user", HAMBAR),
  vaultRest: perfil("u-rest-vault", "restaurante_user", VAULT),
  sinEmpresaAdmin: perfil("u-sin-empresa", "empresa_admin", null),
  sinAsignaciones: perfil("u-sin-asignaciones", "restaurante_user", HAMBAR),
  marcaSinRestaurantes: perfil("u-marca-vacia", "marca_admin", HAMBAR),
  superAdmin: perfil("u-root", "super_admin", null),
};

async function load() {
  vi.resetModules();
  const scopes = await import("@/lib/auth/scopes");
  const permissions = await import("@/lib/auth/permissions");
  const dataScope = await import("@/lib/auth/data-scope");
  return { ...scopes, ...permissions, ...dataScope };
}

beforeEach(() => {
  db = seed();
  hasServiceRole = true;
});
afterEach(() => {
  vi.unstubAllEnvs();
});

/** Valores posibles de la antigua variable: ausente, vacía, "false" y "true" deben comportarse igual. */
const ENV_VALUES: (string | undefined)[] = [undefined, "", "false", "0", "true"];

describe.each(ENV_VALUES)("aislamiento entre empresas con la variable antigua = %j", (value) => {
  beforeEach(() => {
    if (value === undefined) vi.stubEnv(ENV_NAME, undefined as unknown as string);
    else vi.stubEnv(ENV_NAME, value);
  });

  it("un usuario de Hambar solo obtiene restaurantes de Hambar", async () => {
    const { fetchUserScope } = await load();
    for (const user of [USERS.hambarAdmin, USERS.hambarMarca, USERS.hambarRest]) {
      const scope = await fetchUserScope(user.id, user);
      expect(scope.restauranteIds).not.toBeNull();
      expect(scope.restauranteIds!.every((id) => HAMBAR_RESTAURANTS.includes(id))).toBe(true);
      expect(scope.restauranteIds!.some((id) => VAULT_RESTAURANTS.includes(id))).toBe(false);
    }
    expect((await fetchUserScope(USERS.hambarAdmin.id, USERS.hambarAdmin)).restauranteIds!.sort()).toEqual(HAMBAR_RESTAURANTS);
  });

  it("un usuario de Vault solo obtiene restaurantes de Vault", async () => {
    const { fetchUserScope } = await load();
    for (const user of [USERS.vaultAdmin, USERS.vaultRest]) {
      const scope = await fetchUserScope(user.id, user);
      expect(scope.restauranteIds).not.toBeNull();
      expect(scope.restauranteIds!.every((id) => VAULT_RESTAURANTS.includes(id))).toBe(true);
      expect(scope.restauranteIds!.some((id) => HAMBAR_RESTAURANTS.includes(id))).toBe(false);
    }
    expect((await fetchUserScope(USERS.vaultAdmin.id, USERS.vaultAdmin)).restauranteIds!.sort()).toEqual(VAULT_RESTAURANTS);
  });

  it("ninguno accede a la otra empresa aunque manipule los identificadores", async () => {
    const { fetchUserScope, assertRestauranteInScope, canAccessRestaurante, canAccessMarca } = await load();
    const hambar = await fetchUserScope(USERS.hambarAdmin.id, USERS.hambarAdmin);
    const vault = await fetchUserScope(USERS.vaultAdmin.id, USERS.vaultAdmin);

    for (const id of VAULT_RESTAURANTS) {
      expect(canAccessRestaurante(hambar, id)).toBe(false);
      expect(assertRestauranteInScope(hambar, id)).toBe(false);
    }
    for (const id of HAMBAR_RESTAURANTS) {
      expect(canAccessRestaurante(vault, id)).toBe(false);
      expect(assertRestauranteInScope(vault, id)).toBe(false);
    }
    // Identificadores inventados o raros tampoco abren nada.
    for (const id of [0, -1, 999, Number.NaN, Number.MAX_SAFE_INTEGER]) {
      expect(canAccessRestaurante(hambar, id)).toBe(false);
      expect(canAccessRestaurante(vault, id)).toBe(false);
    }
    expect(canAccessMarca(hambar, 300)).toBe(false); // marca de Vault
    expect(canAccessMarca(vault, 100)).toBe(false); // marca de Hambar
  });

  it("los filtros de filas descartan lo de otra empresa", async () => {
    const { fetchUserScope, filterResenasByScope, filterKpiRowsByScope, filterKpiDiarioByScope } = await load();
    const hambar = await fetchUserScope(USERS.hambarAdmin.id, USERS.hambarAdmin);
    const mixed = [1, 2, 3, 10, 11].map((restaurante_id) => ({ restaurante_id }));
    const ids = (rows: { restaurante_id: unknown }[]) => rows.map((r) => Number(r.restaurante_id)).sort();

    expect(ids(filterResenasByScope(mixed as never, hambar))).toEqual(HAMBAR_RESTAURANTS);
    expect(ids(filterKpiRowsByScope(mixed as never, hambar))).toEqual(HAMBAR_RESTAURANTS);
    expect(ids(filterKpiDiarioByScope(mixed as never, hambar))).toEqual(HAMBAR_RESTAURANTS);
    // Filas sin restaurante no se cuelan.
    expect(filterResenasByScope([{ restaurante_id: null }] as never, hambar)).toEqual([]);
  });

  it("un usuario sin empresa, sin asignaciones o con datos inconsistentes no obtiene acceso general", async () => {
    const { fetchUserScope, isUnrestrictedScope, canAccessRestaurante, filterResenasByScope } = await load();
    for (const user of [USERS.sinEmpresaAdmin, USERS.sinAsignaciones, USERS.marcaSinRestaurantes]) {
      const scope = await fetchUserScope(user.id, user);
      expect(scope.restauranteIds).toEqual([]);
      expect(isUnrestrictedScope(scope)).toBe(false);
      for (const id of [...HAMBAR_RESTAURANTS, ...VAULT_RESTAURANTS]) expect(canAccessRestaurante(scope, id)).toBe(false);
      expect(filterResenasByScope([{ restaurante_id: 1 }, { restaurante_id: 10 }] as never, scope)).toEqual([]);
    }
  });

  it("sin clave de servicio o con rol desconocido el alcance queda vacío, nunca abierto", async () => {
    hasServiceRole = false;
    const { fetchUserScope, isUnrestrictedScope } = await load();
    const noKey = await fetchUserScope(USERS.hambarAdmin.id, USERS.hambarAdmin);
    expect(noKey.restauranteIds).toEqual([]);
    expect(isUnrestrictedScope(noKey)).toBe(false);

    hasServiceRole = true;
    const unknown = await fetchUserScope("u-x", { ...USERS.hambarAdmin, rol: "inventado" as UserRole });
    expect(unknown.restauranteIds).toEqual([]);
    expect(isUnrestrictedScope(unknown)).toBe(false);
  });

  it("un fallo de lectura de la base de datos deja el alcance vacío", async () => {
    db.failures.restaurantes = { code: "XX000" };
    const { fetchUserScope, isUnrestrictedScope } = await load();
    const scope = await fetchUserScope(USERS.hambarAdmin.id, USERS.hambarAdmin);
    expect(scope.restauranteIds).toEqual([]);
    expect(isUnrestrictedScope(scope)).toBe(false);
  });

  it("super_admin conserva su alcance administrativo y nada más", async () => {
    const { fetchUserScope, isUnrestrictedScope, canAccessRestaurante, assertRestauranteInScope } = await load();
    const root = await fetchUserScope(USERS.superAdmin.id, USERS.superAdmin);
    expect(root.restauranteIds).toBeNull();
    expect(root.marcaIds).toBeNull();
    expect(isUnrestrictedScope(root)).toBe(true);
    for (const id of [...HAMBAR_RESTAURANTS, ...VAULT_RESTAURANTS]) {
      expect(canAccessRestaurante(root, id)).toBe(true);
      expect(assertRestauranteInScope(root, id)).toBe(true);
    }

    // Acotado a una empresa activa (como hace la sesión) vuelve a quedar limitado a ella.
    const narrowed: UserScope = { ...root, empresaId: String(HAMBAR), restauranteIds: HAMBAR_RESTAURANTS, marcaIds: [100, 200], brandIds: [] };
    expect(isUnrestrictedScope(narrowed)).toBe(false);
    expect(canAccessRestaurante(narrowed, 1)).toBe(true);
    expect(canAccessRestaurante(narrowed, 10)).toBe(false);
  });
});

describe("un alcance sin lista de restaurantes solo es ilimitado para super_admin", () => {
  it.each<UserRole>(["empresa_admin", "marca_admin", "restaurante_user"])("%s con listas nulas queda denegado", async (rol) => {
    const { isUnrestrictedScope, canAccessRestaurante, assertRestauranteInScope } = await load();
    const scope: UserScope = { rol, empresaId: null, empresaNombre: null, marcaIds: null, restauranteIds: null, brandIds: null };
    expect(isUnrestrictedScope(scope)).toBe(false);
    expect(canAccessRestaurante(scope, 1)).toBe(false);
    expect(assertRestauranteInScope(scope, 1)).toBe(false);
  });
});

describe("el interruptor antiguo ya no existe en el código", () => {
  const ROOT = process.cwd();
  function files(dir: string): string[] {
    return readdirSync(dir).flatMap((entry) => {
      if (["node_modules", ".next", ".git"].includes(entry)) return [];
      const full = join(dir, entry);
      if (statSync(full).isDirectory()) return files(full);
      return /\.(ts|tsx|js|mjs|json)$/.test(entry) ? [full] : [];
    });
  }
  const SOURCES = ["app", "lib", "templates", "scripts"].map((dir) => join(ROOT, dir)).filter(existsSync).flatMap(files)
    .concat(["middleware.ts", "next.config.ts", "vercel.json", ".env.example"].map((f) => join(ROOT, f)).filter(existsSync));

  it("ningún fichero lee la variable que desactivaba el aislamiento", () => {
    const offenders = SOURCES.filter((file) => !file.endsWith("company-isolation.test.ts") && readFileSync(file, "utf8").includes(ENV_NAME));
    expect(offenders).toEqual([]);
  });

  it("fetchUserScope ya no acepta una opción para saltarse el alcance", () => {
    const text = readFileSync(join(ROOT, "lib/auth/scopes.ts"), "utf8");
    expect(text).not.toContain("enforceScoping");
  });
});
