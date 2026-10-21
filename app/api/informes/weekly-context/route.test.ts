import { beforeEach, describe, expect, it, vi } from "vitest";
import type { UserScope } from "@/lib/auth/types";

// Datos ficticios: Hambar Test = restaurantes 1-4, Vault Test = restaurante 5.
const scopeVault: UserScope = {
  rol: "empresa_admin",
  empresaId: "vault-test",
  empresaNombre: "Vault Test",
  marcaIds: [],
  restauranteIds: [5],
  brandIds: [],
};
const scopeSuperAdmin: UserScope = {
  rol: "super_admin",
  empresaId: null,
  empresaNombre: null,
  marcaIds: null,
  restauranteIds: null,
  brandIds: null,
};

const requireApiAuth = vi.fn();
const computeWeeklyContext = vi.fn();

vi.mock("@/lib/auth/api-auth", () => ({ requireApiAuth: (r: Request) => requireApiAuth(r) }));
vi.mock("@/lib/reports/negative-reviews/weekly-context", () => ({
  computeWeeklyContext: (...a: unknown[]) => computeWeeklyContext(...a),
}));

import { GET } from "./route";

const call = (restauranteId: number) =>
  GET(
    new Request(
      `http://test.local/api/informes/weekly-context?restauranteId=${restauranteId}&reviewDate=2026-01-05`
    )
  );

describe("GET /api/informes/weekly-context — aislamiento por empresa", () => {
  beforeEach(() => {
    requireApiAuth.mockReset();
    computeWeeklyContext.mockReset();
    computeWeeklyContext.mockResolvedValue({ ok: true });
  });

  it("usuario Vault pidiendo restaurante de Hambar => 403 y sin calcular", async () => {
    requireApiAuth.mockResolvedValue({ ok: true, session: { scope: scopeVault } });
    const res = await call(1);
    expect(res.status).toBe(403);
    expect(computeWeeklyContext).not.toHaveBeenCalled();
  });

  it("usuario Vault con su restaurante => 200", async () => {
    requireApiAuth.mockResolvedValue({ ok: true, session: { scope: scopeVault } });
    const res = await call(5);
    expect(res.status).toBe(200);
    expect(computeWeeklyContext).toHaveBeenCalledWith(5, "2026-01-05");
  });

  it("super_admin => 200 en cualquier restaurante", async () => {
    requireApiAuth.mockResolvedValue({ ok: true, session: { scope: scopeSuperAdmin } });
    expect((await call(1)).status).toBe(200);
    expect((await call(5)).status).toBe(200);
  });
});
