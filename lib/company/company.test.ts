import { readFileSync } from "node:fs";
import path from "node:path";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextResponse } from "next/server";
import { filterKpiRowsByScope, filterResenasByScope, assertRestauranteInScope } from "@/lib/auth/data-scope";
import { canAccessMarca, canAccessRestaurante, isUnrestrictedScope } from "@/lib/auth/permissions";
import type { Perfil, UserScope } from "@/lib/auth/types";
import type { KpiRestaurantRow } from "@/lib/supabase/kpi-restaurantes";
import type { ResenaRow } from "@/lib/supabase/resenas";
import {
  ACTIVE_COMPANY_COOKIE,
  encodeCompanyCookie,
  narrowScopeToCompany,
  parseCompanyCookie,
  parseCompanyId,
  pickActiveCompany,
  resolveCompanyAccess,
  validateCompanySelection,
  type CompanyRecord,
  type RestaurantRecord,
} from "./access";
import { buildCompanyCards, defaultDashboardPeriod, formatCompanyAverage } from "./cards";
import { sessionKeyFromAccessToken } from "./session-key";

const read = (file: string) => readFileSync(path.join(process.cwd(), file), "utf-8");

// Datos de prueba: dos empresas con sus restaurantes (nada de nombres reales en la lógica) -------------------
const hambar: CompanyRecord = { id: 1, name: "Grupo Hambar", active: true };
const vault: CompanyRecord = { id: 2, name: "Vault", active: true };
const companies = [hambar, vault];
const restaurants: RestaurantRecord[] = [
  { id: 10, companyId: 1, brandId: 100 },
  { id: 11, companyId: 1, brandId: 100 },
  { id: 12, companyId: 1, brandId: 101 },
  { id: 20, companyId: 2, brandId: 200 },
];

const access = (over: Partial<Parameters<typeof resolveCompanyAccess>[0]> = {}) =>
  resolveCompanyAccess({ rol: "super_admin", perfilCompanyId: null, permittedRestaurantIds: null, companies, restaurants, ...over });

describe("empresas permitidas", () => {
  it("usuario con UNA empresa: entra directamente (empresa activa automática, sin cookie)", () => {
    const one = access({ rol: "empresa_admin", perfilCompanyId: 1, permittedRestaurantIds: [10, 11, 12] });
    expect(one.companies).toEqual([{ id: 1, name: "Grupo Hambar" }]);
    expect(pickActiveCompany(one, undefined)).toEqual({ id: 1, name: "Grupo Hambar" });
  });

  it("usuario con DOS empresas: ve el selector (no hay empresa activa hasta elegir) y aparecen todas sus empresas", () => {
    const two = access({ rol: "marca_admin", permittedRestaurantIds: [10, 20] });
    expect(two.companies.map((c) => c.name)).toEqual(["Grupo Hambar", "Vault"]);
    expect(pickActiveCompany(two, undefined)).toBeNull();
  });

  it("no aparecen empresas sin permiso", () => {
    const only = access({ rol: "restaurante_user", permittedRestaurantIds: [20] });
    expect(only.companies).toEqual([{ id: 2, name: "Vault" }]);
    expect(access({ rol: "restaurante_user", permittedRestaurantIds: [] }).companies).toEqual([]);
  });

  it("de cada empresa solo los restaurantes que el usuario puede ver, nunca los de otra", () => {
    const partial = access({ rol: "marca_admin", permittedRestaurantIds: [10, 12, 20] });
    expect(partial.restaurantIdsByCompany.get(1)).toEqual([10, 12]);
    expect(partial.restaurantIdsByCompany.get(2)).toEqual([20]);
  });

  it("super_admin: todas las empresas activas según la base de datos (nada fijo en el código)", () => {
    const admin = access();
    expect(admin.companies.map((c) => c.id)).toEqual([1, 2]);
    expect(admin.restaurantIdsByCompany.get(1)).toEqual([10, 11, 12]);
    expect(admin.restaurantIdsByCompany.get(2)).toEqual([20]);
    // Una empresa inactiva no se ofrece.
    const withInactive = access({ companies: [...companies, { id: 9, name: "Cerrada", active: false }] });
    expect(withInactive.companies.map((c) => c.id)).toEqual([1, 2]);
  });

  it("empresas nuevas aparecen dinámicamente, sin tocar código", () => {
    const extra: CompanyRecord[] = [
      ...companies,
      { id: 3, name: "Empresa 3", active: true },
      { id: 4, name: "Empresa 4", active: true },
      { id: 5, name: "Empresa 5", active: true },
    ];
    const rest = [...restaurants, { id: 30, companyId: 3, brandId: null }, { id: 40, companyId: 4, brandId: null }];
    const admin = access({ companies: extra, restaurants: rest });
    expect(admin.companies.map((c) => c.name)).toEqual(["Empresa 3", "Empresa 4", "Empresa 5", "Grupo Hambar", "Vault"]);
    // Un usuario con asignaciones en la 3 y la 4 las ve automáticamente.
    const user = access({ rol: "marca_admin", permittedRestaurantIds: [30, 40], companies: extra, restaurants: rest });
    expect(user.companies.map((c) => c.id)).toEqual([3, 4]);
  });

  it("empresa_admin conserva su empresa aunque aún no tenga restaurantes", () => {
    const empty = access({ rol: "empresa_admin", perfilCompanyId: 2, permittedRestaurantIds: [], restaurants: [] });
    expect(empty.companies).toEqual([{ id: 2, name: "Vault" }]);
    expect(access({ rol: "marca_admin", perfilCompanyId: 2, permittedRestaurantIds: [], restaurants: [] }).companies).toEqual([]);
  });
});

describe("empresa activa: la cookie nunca es una autoridad", () => {
  const two = access({ rol: "marca_admin", permittedRestaurantIds: [10, 20] });
  const onlyHambar = access({ rol: "empresa_admin", perfilCompanyId: 1, permittedRestaurantIds: [10, 11, 12] });

  it("seleccionar una empresa permitida establece el contexto", () => {
    expect(validateCompanySelection(two, 2)).toEqual({ ok: true, company: { id: 2, name: "Vault" } });
    expect(validateCompanySelection(two, "1")).toEqual({ ok: true, company: { id: 1, name: "Grupo Hambar" } });
    expect(pickActiveCompany(two, "2")).toEqual({ id: 2, name: "Vault" });
  });

  it("seleccionar una empresa NO permitida falla (403) y valores raros se rechazan (400)", () => {
    expect(validateCompanySelection(onlyHambar, 2)).toEqual({ ok: false, status: 403, error: "No tienes acceso a esa empresa" });
    for (const bad of [undefined, null, "", "abc", "1; drop", -1, 0, 1.5, "01x", {}, [1], "9".repeat(30)]) {
      expect(validateCompanySelection(two, bad), String(bad)).toMatchObject({ ok: false, status: 400 });
    }
  });

  it("modificar la cookie/empresa_id a mano no salta los permisos: se ignora", () => {
    // Quien solo tiene Grupo Hambar manda la cookie de Vault → sigue en la suya.
    expect(pickActiveCompany(onlyHambar, "2")).toEqual({ id: 1, name: "Grupo Hambar" });
    // Quien tiene dos y manda una tercera inexistente → no hay empresa activa (debe elegir).
    expect(pickActiveCompany(two, "3")).toBeNull();
    expect(pickActiveCompany(two, "2 OR 1=1")).toBeNull();
  });

  it("parseCompanyId solo acepta enteros positivos", () => {
    expect(parseCompanyId("12")).toBe(12);
    expect(parseCompanyId(" 7 ")).toBe(7);
    for (const bad of ["0", "-3", "1.5", "1e3", "", "x", null, undefined, true]) expect(parseCompanyId(bad)).toBeNull();
  });
});

// Alcance acotado: el filtro NO es visual ----------------------------------------------------------------
const superScope: UserScope = { rol: "super_admin", empresaId: null, empresaNombre: null, marcaIds: null, restauranteIds: null, brandIds: null };
const kpi = (id: number): KpiRestaurantRow => ({
  restaurante_id: id, restaurante: `R${id}`, ciudad: "", marca: "", total_resenas: 0, media_total: 0,
  resenas_negativas: 0, resenas_positivas: 0, ultima_resena: null, estado: "", media_google: null, total_resenas_google: null,
});
const resena = (id: number, restaurante: number) => ({ id, restaurante_id: restaurante }) as unknown as ResenaRow;

describe("el alcance acotado a la empresa aplica a TODO el código existente", () => {
  const admin = access();
  const scopeOf = (companyId: number) =>
    narrowScopeToCompany(superScope, admin.companies.find((c) => c.id === companyId)!, {
      restaurantIds: admin.restaurantIdsByCompany.get(companyId)!,
      marcaIds: [],
      brandIds: [],
    });

  it("super_admin sin acotar sigue sin restricciones; acotado a una empresa, ya no", () => {
    expect(isUnrestrictedScope(superScope)).toBe(true);
    expect(isUnrestrictedScope(scopeOf(1))).toBe(false);
    expect(canAccessRestaurante(scopeOf(1), 10)).toBe(true);
    expect(canAccessRestaurante(scopeOf(1), 20)).toBe(false);
    expect(canAccessMarca(scopeOf(1), 1)).toBe(false);
  });

  it("no se mezclan restaurantes ni reseñas entre empresas (también para super_admin)", () => {
    const all = [kpi(10), kpi(11), kpi(12), kpi(20)];
    expect(filterKpiRowsByScope(all, scopeOf(1)).map((r) => r.restaurante_id)).toEqual([10, 11, 12]);
    expect(filterKpiRowsByScope(all, scopeOf(2)).map((r) => r.restaurante_id)).toEqual([20]);

    const reviews = [resena(1, 10), resena(2, 20), resena(3, 12), resena(4, 20)];
    expect(filterResenasByScope(reviews, scopeOf(1)).map((r) => r.id)).toEqual([1, 3]);
    expect(filterResenasByScope(reviews, scopeOf(2)).map((r) => r.id)).toEqual([2, 4]);
    expect(assertRestauranteInScope(scopeOf(1), 20)).toBe(false);
    expect(assertRestauranteInScope(scopeOf(2), 20)).toBe(true);
  });

  it("cambiar de empresa cambia los datos", () => {
    const reviews = [resena(1, 10), resena(2, 20)];
    const before = filterResenasByScope(reviews, scopeOf(1)).map((r) => r.id);
    const after = filterResenasByScope(reviews, scopeOf(2)).map((r) => r.id);
    expect(before).toEqual([1]);
    expect(after).toEqual([2]);
  });

  it("sin empresa activa el alcance está vacío: ningún dato hasta elegir (deny by default)", () => {
    const none = narrowScopeToCompany(superScope, null, { restaurantIds: [], marcaIds: [], brandIds: [] });
    expect(isUnrestrictedScope(none)).toBe(false);
    expect(filterKpiRowsByScope([kpi(10), kpi(20)], none)).toEqual([]);
    expect(filterResenasByScope([resena(1, 10)], none)).toEqual([]);
    expect(none.empresaId).toBeNull();
  });

  it("el alcance acotado fija la empresa y mantiene el rol", () => {
    const scope = scopeOf(2);
    expect(scope).toMatchObject({ rol: "super_admin", empresaId: "2", empresaNombre: "Vault", restauranteIds: [20] });
  });
});

// Tarjetas: media global por empresa con el motor canónico --------------------------------------------------
describe("tarjetas de la pantalla de selección", () => {
  // Reseñas de prueba por restaurante: [reseñas, suma de estrellas].
  const reviewsByRestaurant = new Map<number, [number, number]>([
    [10, [10, 40]],
    [11, [30, 150]],
    [12, [0, 0]],
    [20, [5, 25]],
  ]);
  const admin = access();
  const calls: { ids: number[]; period: { startKey: string; endKey: string } }[] = [];

  // "Motor canónico" simulado: media GLOBAL ponderada por reseñas del conjunto de restaurantes recibido.
  const engine = vi.fn(async (ids: number[], period: { startKey: string; endKey: string }) => {
    calls.push({ ids, period });
    const total = ids.reduce((sum, id) => sum + (reviewsByRestaurant.get(id)?.[0] ?? 0), 0);
    const stars = ids.reduce((sum, id) => sum + (reviewsByRestaurant.get(id)?.[1] ?? 0), 0);
    return total > 0 ? stars / total : null;
  });

  beforeEach(() => {
    calls.length = 0;
    engine.mockClear();
  });

  const build = (over: Partial<Parameters<typeof buildCompanyCards>[0]> = {}) =>
    buildCompanyCards({
      access: admin,
      catalogIds: new Set([10, 11, 12, 20]),
      period: { startKey: "2026-10-12", endKey: "2026-10-18" },
      fetchNetworkAverage: engine,
      ...over,
    });

  it("la media de cada tarjeta corresponde SOLO a los restaurantes de esa empresa", async () => {
    const cards = await build();
    expect(cards.map((c) => c.name)).toEqual(["Grupo Hambar", "Vault"]);
    expect(calls.find((c) => c.ids.includes(10))!.ids).toEqual([10, 11, 12]);
    expect(calls.find((c) => c.ids.includes(20))!.ids).toEqual([20]);
    expect(cards[0]!.average).toBeCloseTo(190 / 40, 10); // 4,75
    expect(cards[1]!.average).toBeCloseTo(5, 10);
  });

  it("es la media global ponderada, no una media de medias", async () => {
    const [hambarCard] = await build();
    const meanOfMeans = (40 / 10 + 150 / 30) / 2; // 4,5
    expect(hambarCard!.average).not.toBeCloseTo(meanOfMeans, 3);
    expect(hambarCard!.average).toBeCloseTo(4.75, 10);
  });

  it("solo entran los restaurantes del catálogo canónico y los permitidos al usuario", async () => {
    const restricted = resolveCompanyAccess({ rol: "marca_admin", perfilCompanyId: null, permittedRestaurantIds: [10, 20], companies, restaurants });
    await build({ access: restricted, catalogIds: new Set([10, 20, 11]) });
    expect(calls.map((c) => c.ids).sort()).toEqual([[10], [20]]);
  });

  it("empresa sin reseñas/restaurantes → '—', y un fallo del motor no tumba la pantalla", async () => {
    const cards = await build({ catalogIds: new Set([10]), fetchNetworkAverage: vi.fn(async () => { throw new Error("rpc"); }) });
    expect(cards.map((c) => c.average)).toEqual([null, null]);
    expect(formatCompanyAverage(null)).toBe("—");
    expect(formatCompanyAverage(4.3449)).toBe("4,34");
    expect(formatCompanyAverage(5)).toBe("5,00");
    const none = await build({ catalogIds: new Set() });
    expect(none.map((c) => c.average)).toEqual([null, null]);
    expect(engine).not.toHaveBeenCalled();
  });

  it("usa el periodo por defecto del dashboard: la semana natural actual (lunes a domingo, Madrid)", () => {
    expect(defaultDashboardPeriod(new Date("2026-10-14T10:00:00Z"))).toEqual({ startKey: "2026-10-12", endKey: "2026-10-18" });
    expect(defaultDashboardPeriod(new Date("2026-10-18T21:30:00Z"))).toEqual({ startKey: "2026-10-12", endKey: "2026-10-18" });
    expect(defaultDashboardPeriod(new Date("2026-10-18T23:30:00Z"))).toEqual({ startKey: "2026-10-19", endKey: "2026-10-25" });
  });

  it("el cálculo de media reutiliza el motor canónico existente (sin fórmulas nuevas)", () => {
    const wiring = read("lib/company/cards.server.ts");
    expect(wiring).toContain('import { fetchSupabaseCanonicalReputationMetrics } from "@/lib/supabase/reputation-metrics.server"');
    expect(wiring).toContain("network_media_exacta");
    expect(wiring).not.toMatch(/\.reduce\(|ratingSum|rating_sum|\/ total/);
    // El dashboard llama a esa MISMA función con el mismo catálogo.
    const dashboard = read("lib/dashboard-data.ts");
    expect(dashboard).toContain("fetchSupabaseCanonicalReputationMetrics(bounds.startKey, bounds.endKey, restaurantIds)");
    expect(wiring).toContain("fetchAllKpiRows");
    expect(dashboard).toContain("fetchAllKpiRows");
  });
});

// Ruta de selección ------------------------------------------------------------------------------------
const requireApiAuth = vi.fn();
vi.mock("server-only", () => ({}));
vi.mock("@/lib/auth/api-auth", () => ({ requireApiAuth }));
const getCurrentSessionKey = vi.fn();
vi.mock("@/lib/company/session-key.server", () => ({ getCurrentSessionKey }));

const route = await import("@/app/api/company/select/route");
const sessionWith = (list: { id: number; name: string }[], rol = "marca_admin") => ({
  ok: true,
  session: { userId: "u-1", perfil: { rol }, companies: list },
});
const post = (body: unknown) =>
  route.POST(new Request("https://nexo.example/api/company/select", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }));

describe("POST /api/company/select", () => {
  beforeEach(() => vi.resetAllMocks());

  it("empresa permitida → 200 y cookie httpOnly con esa empresa", async () => {
    requireApiAuth.mockResolvedValue(sessionWith([{ id: 1, name: "Grupo Hambar" }, { id: 2, name: "Vault" }]));
    const res = await post({ companyId: 2 });
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ company: { id: 2, name: "Vault" } });
    const cookie = res.headers.get("set-cookie") ?? "";
    expect(cookie).toContain(`${ACTIVE_COMPANY_COOKIE}=2`);
    expect(cookie.toLowerCase()).toContain("httponly");
    expect(cookie.toLowerCase()).toContain("samesite=lax");
    expect(cookie).toContain("Path=/");
  });

  it("empresa no permitida → 403 y NO se guarda ninguna cookie; modificar el id no sirve", async () => {
    requireApiAuth.mockResolvedValue(sessionWith([{ id: 1, name: "Grupo Hambar" }]));
    for (const attempt of [2, "2", 3]) {
      const res = await post({ companyId: attempt });
      expect(res.status).toBe(403);
      expect(res.headers.get("set-cookie")).toBeNull();
    }
    expect((await post({ companyId: "1 OR 1=1" })).status).toBe(400);
    expect((await post({})).status).toBe(400);
  });

  it("las empresas permitidas salen de la sesión del servidor, no del cuerpo", async () => {
    requireApiAuth.mockResolvedValue(sessionWith([{ id: 1, name: "Grupo Hambar" }]));
    const res = await post({ companyId: 2, companies: [{ id: 2, name: "Vault" }], empresa_id: 2, allowed: [2] });
    expect(res.status).toBe(403);
  });

  it("sin sesión → 401", async () => {
    requireApiAuth.mockResolvedValue({ ok: false, response: NextResponse.json({ error: "No autenticado" }, { status: 401 }) });
    expect((await post({ companyId: 1 })).status).toBe(401);
  });
});

// Contexto de servidor (sesión → empresas → alcance) ---------------------------------------------------------
const loadCompanyDirectory = vi.fn();
const fetchUserScope = vi.fn();
vi.mock("@/lib/company/directory.server", () => ({ loadCompanyDirectory }));
vi.mock("@/lib/auth/scopes", () => ({ fetchUserScope }));

const { resolveCompanyContext } = await import("./context.server");

const directory = {
  companies,
  restaurants,
  brandNameById: new Map([[100, "Burger King"], [101, "Popeyes"], [200, "Vault"]]),
};
const perfil = (rol: Perfil["rol"], empresaId: string | null = null): Perfil => ({
  id: "u-1", userId: "u-1", rol, nombre: null, email: null, empresaId, mustChangePassword: false,
});

describe("resolveCompanyContext", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    loadCompanyDirectory.mockResolvedValue(directory);
  });

  it("1 empresa: entra directo y el alcance queda limitado a ella", async () => {
    fetchUserScope.mockResolvedValue({ ...superScope, rol: "empresa_admin", restauranteIds: [10, 11, 12] });
    const ctx = await resolveCompanyContext({
      userId: "u-1", perfil: perfil("empresa_admin", "1"), baseScope: { ...superScope, rol: "empresa_admin", restauranteIds: [10, 11, 12] }, cookieValue: undefined,
    });
    expect(ctx.activeCompany).toEqual({ id: 1, name: "Grupo Hambar" });
    expect(ctx.scope.restauranteIds).toEqual([10, 11, 12]);
    expect(ctx.scope.marcaIds).toEqual([100, 101]);
    expect(ctx.scope.empresaNombre).toBe("Grupo Hambar");
  });

  it("2 empresas sin elegir: no hay empresa activa y el alcance está vacío; con cookie válida, solo esa", async () => {
    const base = { ...superScope, rol: "marca_admin" as const, restauranteIds: [10, 20] };
    const first = await resolveCompanyContext({ userId: "u-1", perfil: perfil("marca_admin", "1"), baseScope: base, cookieValue: undefined });
    expect(first.companies.map((c) => c.id)).toEqual([1, 2]);
    expect(first.activeCompany).toBeNull();
    expect(first.scope.restauranteIds).toEqual([]);

    const chosen = await resolveCompanyContext({ userId: "u-1", perfil: perfil("marca_admin", "1"), baseScope: base, cookieValue: "2" });
    expect(chosen.activeCompany).toEqual({ id: 2, name: "Vault" });
    expect(chosen.scope.restauranteIds).toEqual([20]);
  });

  it("super_admin: empresas desde la base de datos, y acotado a la elegida ve solo sus restaurantes", async () => {
    const key = "abcdef0123456789abcdef01";
    const ctx = await resolveCompanyContext({ userId: "u-1", perfil: perfil("super_admin"), baseScope: superScope, cookieValue: encodeCompanyCookie(1, key), sessionKey: key });
    expect(ctx.companies.map((c) => c.name)).toEqual(["Grupo Hambar", "Vault"]);
    expect(ctx.scope.restauranteIds).toEqual([10, 11, 12]);
    expect(isUnrestrictedScope(ctx.scope)).toBe(false);
    expect(fetchUserScope).not.toHaveBeenCalled();
  });

  it("alcance base sin restricción para un rol no super_admin → se usa el alcance REAL por rol para las empresas", async () => {
    fetchUserScope.mockResolvedValue({ ...superScope, rol: "empresa_admin", restauranteIds: [20] });
    const ctx = await resolveCompanyContext({
      userId: "u-1", perfil: perfil("empresa_admin", "2"), baseScope: { ...superScope, rol: "empresa_admin" }, cookieValue: "1",
    });
    expect(fetchUserScope).toHaveBeenCalledWith("u-1", expect.anything());
    expect(ctx.companies).toEqual([{ id: 2, name: "Vault" }]);
    expect(ctx.activeCompany).toEqual({ id: 2, name: "Vault" }); // la cookie de la 1 se ignora
    expect(ctx.scope.restauranteIds).toEqual([20]);
  });

  it("fallo al leer la base de datos → sin empresas ni datos (deny by default)", async () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    loadCompanyDirectory.mockRejectedValue(new Error("boom"));
    const ctx = await resolveCompanyContext({ userId: "u-1", perfil: perfil("super_admin"), baseScope: superScope, cookieValue: "1" });
    expect(ctx.companies).toEqual([]);
    expect(ctx.activeCompany).toBeNull();
    expect(ctx.scope.restauranteIds).toEqual([]);
    spy.mockRestore();
  });
});

// Cableado e interfaz ----------------------------------------------------------------------------------------
describe("cableado", () => {
  it("la sesión del servidor resuelve la empresa y entrega el alcance acotado a todo el código existente", () => {
    const session = read("lib/auth/session.ts");
    expect(session).toContain("resolveCompanyContext(");
    expect(session).toContain("ACTIVE_COMPANY_COOKIE");
    expect(session).toContain("const scope = company.scope;");
    expect(session).toContain("activeCompany: company.activeCompany");
  });

  it("el dashboard exige empresa activa y la pantalla de selección vive en /seleccionar-empresa", () => {
    const layout = read("app/dashboard/layout.tsx");
    expect(layout).toContain("if (!session.activeCompany)");
    expect(layout).toContain("redirect(COMPANY_SELECTION_PATH)");
    expect(read("lib/company/access.ts")).toContain('COMPANY_SELECTION_PATH = "/seleccionar-empresa"');
  });

  it("pantalla de selección: una empresa → directo; varias → tarjetas con SOLO nombre y media", () => {
    const page = read("app/seleccionar-empresa/page.tsx");
    expect(page).toContain("session.companies.length === 1");
    expect(page).toContain('redirect("/dashboard")');
    expect(page).toContain("Selecciona tu empresa");
    const picker = read("app/seleccionar-empresa/company-picker.tsx");
    expect(picker).toContain("{card.name}");
    expect(picker).toContain("formatCompanyAverage(card.average)");
    expect(picker).toContain("⭐");
    expect(picker).toContain("/api/company/select");
    expect(picker).not.toMatch(/restaurantes|marcas|reseñas/i);
  });

  it("selector de empresa en el dashboard: solo con 2 o más empresas y recarga los datos al cambiar", () => {
    const switcher = read("app/dashboard/_components/company-switcher.tsx");
    expect(switcher).toContain("if (companies.length < 2) return null;");
    expect(switcher).toContain("/api/company/select");
    expect(switcher).toContain('window.location.assign("/dashboard")');
    const shell = read("app/dashboard/_components/dashboard-shell.tsx");
    expect(shell).toContain("companies.length > 1 ? <CompanySwitcher />");
  });

  it("la caché del navegador del dashboard es por empresa", () => {
    expect(read("app/dashboard/_hooks/use-dashboard-data.ts")).toContain("activeCompany?.id");
  });

  it("no hay ninguna empresa escrita en el código de la selección", () => {
    for (const file of ["lib/company/access.ts", "lib/company/cards.ts", "lib/company/context.server.ts", "lib/company/directory.server.ts", "app/seleccionar-empresa/page.tsx", "app/seleccionar-empresa/company-picker.tsx", "app/dashboard/_components/company-switcher.tsx"]) {
      expect(read(file), file).not.toMatch(/hambar|hámbar|vault/i);
    }
  });
});

// Super_admin: cada sesión nueva empieza en la selección --------------------------------------------------------
const token = (claims: Record<string, unknown>) =>
  `h.${Buffer.from(JSON.stringify(claims)).toString("base64url")}.s`;

describe("super_admin: login nuevo → siempre selección de empresa", () => {
  const list = access({ rol: "super_admin" });
  const fresh = (sessionKey: string | null) => ({ requireFreshSelection: true, sessionKey });

  it("la clave de sesión cambia en cada login y se mantiene al renovar el token", () => {
    const login1 = sessionKeyFromAccessToken(token({ session_id: "sess-aaa", iat: 1000 }));
    const refreshed = sessionKeyFromAccessToken(token({ session_id: "sess-aaa", iat: 4600 }));
    const login2 = sessionKeyFromAccessToken(token({ session_id: "sess-bbb", iat: 9000 }));
    expect(login1).toMatch(/^[0-9a-f]{24}$/);
    expect(refreshed).toBe(login1);
    expect(login2).not.toBe(login1);
    // Respaldo: momento del login (amr) si el token no trae session_id.
    expect(sessionKeyFromAccessToken(token({ amr: [{ method: "password", timestamp: 1700000000 }], iat: 1 }))).toMatch(/^[0-9a-f]{24}$/);
    for (const bad of [null, undefined, "", "x", "a.!!.c", token({})]) expect(sessionKeyFromAccessToken(bad as string)).toBeNull();
  });

  it("cookie de una sesión anterior (otro login) → no vale: empieza en la selección", () => {
    const oldKey = sessionKeyFromAccessToken(token({ session_id: "sess-aaa" }));
    const newKey = sessionKeyFromAccessToken(token({ session_id: "sess-bbb" }));
    const cookie = encodeCompanyCookie(1, oldKey);
    expect(pickActiveCompany(list, cookie, fresh(newKey))).toBeNull();
  });

  it("durante la misma sesión se mantiene la empresa activa (refresh y navegación no vuelven al selector)", () => {
    const key = sessionKeyFromAccessToken(token({ session_id: "sess-aaa" }));
    const cookie = encodeCompanyCookie(2, key);
    expect(pickActiveCompany(list, cookie, fresh(key))).toEqual({ id: 2, name: "Vault" });
    expect(pickActiveCompany(list, cookie, fresh(key))).toEqual({ id: 2, name: "Vault" });
  });

  it("puede cambiar de empresa con el switcher dentro de la sesión", () => {
    const key = sessionKeyFromAccessToken(token({ session_id: "sess-aaa" }));
    expect(pickActiveCompany(list, encodeCompanyCookie(1, key), fresh(key))?.id).toBe(1);
    expect(pickActiveCompany(list, encodeCompanyCookie(2, key), fresh(key))?.id).toBe(2);
  });

  it("la cookie antigua de 30 días (sin clave de sesión) deja de dar entrada directa", () => {
    expect(pickActiveCompany(list, "1", fresh("abcdef0123456789abcdef01"))).toBeNull();
    expect(pickActiveCompany(list, "2", fresh(null))).toBeNull();
  });

  it("sin clave de sesión fiable no se acepta ninguna cookie (falla cerrado)", () => {
    expect(pickActiveCompany(list, encodeCompanyCookie(1, "abcdef0123456789abcdef01"), fresh(null))).toBeNull();
  });

  it("aunque solo exista UNA empresa, super_admin no entra automáticamente: ve la selección", () => {
    const single = access({ rol: "super_admin", companies: [hambar], restaurants: restaurants.filter((r) => r.companyId === 1) });
    expect(single.companies).toHaveLength(1);
    expect(pickActiveCompany(single, undefined, fresh("abcdef0123456789abcdef01"))).toBeNull();
  });

  it("cookie manipulada: clave ajena o formato raro se ignoran", () => {
    const key = "abcdef0123456789abcdef01";
    for (const raw of ["2.zzzz", "2.", "2.abc.def", "2..", ".abcdef0123456789abcdef01", encodeCompanyCookie(2, "ffffffffffffffffffffffff")]) {
      expect(pickActiveCompany(list, raw, fresh(key)), raw).toBeNull();
    }
    expect(parseCompanyCookie("2.abcdef0123456789abcdef01")).toEqual({ companyId: 2, sessionKey: "abcdef0123456789abcdef01" });
    expect(parseCompanyCookie("2")).toEqual({ companyId: 2, sessionKey: null });
  });

  it("usuarios normales: comportamiento idéntico al anterior (una empresa entra directo; cookie sin atar sigue valiendo)", () => {
    const one = access({ rol: "empresa_admin", perfilCompanyId: 1, permittedRestaurantIds: [10, 11, 12] });
    const two = access({ rol: "marca_admin", permittedRestaurantIds: [10, 20] });
    expect(pickActiveCompany(one, undefined)).toEqual({ id: 1, name: "Grupo Hambar" });
    expect(pickActiveCompany(one, undefined, { requireFreshSelection: false, sessionKey: "otra" })).toEqual({ id: 1, name: "Grupo Hambar" });
    expect(pickActiveCompany(two, undefined)).toBeNull();
    expect(pickActiveCompany(two, "2")).toEqual({ id: 2, name: "Vault" });
    // Una cookie con clave sigue funcionando para ellos.
    expect(pickActiveCompany(two, "2.abcdef0123456789abcdef01")).toEqual({ id: 2, name: "Vault" });
  });
});

describe("super_admin en el contexto de servidor", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    loadCompanyDirectory.mockResolvedValue(directory);
  });
  const KEY = "abcdef0123456789abcdef01";

  it("login nuevo (clave distinta) → sin empresa activa y sin datos hasta elegir", async () => {
    const ctx = await resolveCompanyContext({
      userId: "u-1", perfil: perfil("super_admin"), baseScope: superScope, cookieValue: encodeCompanyCookie(1, "ffffffffffffffffffffffff"), sessionKey: KEY,
    });
    expect(ctx.activeCompany).toBeNull();
    expect(ctx.scope.restauranteIds).toEqual([]);
    expect(ctx.companies.map((c) => c.id)).toEqual([1, 2]);
  });

  it("misma sesión → empresa activa y alcance acotado, como antes", async () => {
    const ctx = await resolveCompanyContext({
      userId: "u-1", perfil: perfil("super_admin"), baseScope: superScope, cookieValue: encodeCompanyCookie(2, KEY), sessionKey: KEY,
    });
    expect(ctx.activeCompany).toEqual({ id: 2, name: "Vault" });
    expect(ctx.scope.restauranteIds).toEqual([20]);
  });

  it("un usuario normal con una empresa sigue entrando directo aunque cambie su sesión", async () => {
    const base = { ...superScope, rol: "empresa_admin" as const, restauranteIds: [10, 11, 12] };
    const ctx = await resolveCompanyContext({
      userId: "u-1", perfil: perfil("empresa_admin", "1"), baseScope: base, cookieValue: undefined, sessionKey: KEY,
    });
    expect(ctx.activeCompany).toEqual({ id: 1, name: "Grupo Hambar" });
  });
});

describe("cookie de super_admin: de sesión, atada a la sesión y olvidada al cerrar sesión", () => {
  beforeEach(() => vi.resetAllMocks());
  const list = [{ id: 1, name: "Grupo Hambar" }, { id: 2, name: "Vault" }];

  it("POST de super_admin: cookie '<empresa>.<clave>' SIN caducidad (de sesión)", async () => {
    requireApiAuth.mockResolvedValue(sessionWith(list, "super_admin"));
    getCurrentSessionKey.mockResolvedValue("abcdef0123456789abcdef01");
    const res = await post({ companyId: 2 });
    const cookie = res.headers.get("set-cookie") ?? "";
    expect(cookie).toContain(`${ACTIVE_COMPANY_COOKIE}=2.abcdef0123456789abcdef01`);
    expect(cookie.toLowerCase()).toContain("httponly");
    expect(cookie.toLowerCase()).not.toContain("max-age");
    expect(cookie.toLowerCase()).not.toContain("expires");
  });

  it("POST de usuario normal: igual que antes ('<empresa>' con 30 días)", async () => {
    requireApiAuth.mockResolvedValue(sessionWith(list, "marca_admin"));
    const res = await post({ companyId: 1 });
    const cookie = res.headers.get("set-cookie") ?? "";
    expect(cookie).toContain(`${ACTIVE_COMPANY_COOKIE}=1;`);
    expect(cookie.toLowerCase()).toContain("max-age=2592000");
    expect(getCurrentSessionKey).not.toHaveBeenCalled();
  });

  it("DELETE olvida la empresa activa (cookie expirada)", async () => {
    const res = await route.DELETE();
    const cookie = (res.headers.get("set-cookie") ?? "").toLowerCase();
    expect(cookie).toContain(`${ACTIVE_COMPANY_COOKIE}=;`);
    expect(cookie).toContain("max-age=0");
  });

  it("cerrar sesión borra la empresa activa en el servidor", () => {
    const logoutRoute = read("app/api/auth/logout/route.ts");
    expect(logoutRoute).toContain("ACTIVE_COMPANY_COOKIE");
    expect(logoutRoute).toContain("maxAge: 0");
    expect(read("app/dashboard/_components/use-logout.ts")).toContain("/api/auth/logout");
  });

  it("la sesión del servidor ata la elección a la sesión actual y la pantalla de selección no salta para super_admin", () => {
    const session = read("lib/auth/session.ts");
    expect(session).toContain("sessionKey: sessionKeyFromAccessToken(authSession?.access_token)");
    const page = read("app/seleccionar-empresa/page.tsx");
    expect(page).toContain('if (!superAdmin && session.companies.length === 1) redirect("/dashboard");');
    // El dashboard no obliga a volver al selector mientras haya empresa activa en la sesión.
    expect(read("app/dashboard/layout.tsx")).toContain("if (!session.activeCompany)");
  });
});
