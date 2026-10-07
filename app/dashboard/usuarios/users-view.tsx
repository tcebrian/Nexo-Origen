"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

type UserListItem = {
  id: string;
  nombre: string;
  email: string;
  rol: string;
  empresaNombre: string | null;
  restaurantCount: number;
};

type Detail = {
  user: { id: string; nombre: string; email: string; rol: string; empresaId: number | null; empresaNombre: string | null };
  selection: { restaurantIds: number[]; marcaIds: number[] };
  effective: { count: number; restaurants: { id: number; name: string; brand: string; city: string }[] };
  options: {
    empresas: { id: number; nombre: string }[];
    marcas: { id: number; nombre: string; empresaIds: number[] }[];
    restaurants: { id: number; name: string; city: string; brand: string; marcaId: number | null; empresaId: number | null }[];
  };
};

const ROLE_LABELS: Record<string, string> = {
  super_admin: "Super administrador",
  empresa_admin: "Administrador de empresa",
  marca_admin: "Administrador de marca",
  restaurante_user: "Supervisor / restaurante",
};

/** Roles que se pueden asignar desde aquí (super_admin no se gestiona desde la web). */
const EDITABLE_ROLES = ["restaurante_user", "marca_admin", "empresa_admin"] as const;

const ROLE_HINT: Record<string, string> = {
  restaurante_user: "Ve solo los restaurantes que marques. Ideal para supervisores que cambian de locales.",
  marca_admin: "Ve todos los restaurantes de las marcas que marques, incluidos los nuevos.",
  empresa_admin: "Ve todos los restaurantes de su empresa, incluidos los nuevos. No hace falta marcar nada.",
};

async function fetchJson<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, { cache: "no-store", ...init });
  const data = (await response.json().catch(() => null)) as (T & { error?: string }) | null;
  if (!response.ok) throw new Error(data?.error ?? String(response.status));
  return data as T;
}

const norm = (value: string) => value.toLowerCase().normalize("NFD").replace(/\p{M}/gu, "");

function Editor({ userId, onSaved }: { userId: string; onSaved: () => void }) {
  const [detail, setDetail] = useState<Detail | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [rol, setRol] = useState("");
  const [empresaId, setEmpresaId] = useState("");
  const [restaurantIds, setRestaurantIds] = useState<Set<number>>(new Set());
  const [marcaIds, setMarcaIds] = useState<Set<number>>(new Set());
  const [query, setQuery] = useState("");
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ kind: "ok" | "error"; text: string } | null>(null);

  const load = useCallback(async () => {
    try {
      const data = await fetchJson<Detail>(`/api/platform/users/${userId}`);
      setDetail(data);
      setRol(data.user.rol);
      setEmpresaId(data.user.empresaId === null ? "" : String(data.user.empresaId));
      setRestaurantIds(new Set(data.selection.restaurantIds));
      setMarcaIds(new Set(data.selection.marcaIds));
      setLoadError(null);
    } catch (error) {
      setLoadError(error instanceof Error ? error.message : "No se pudo cargar el usuario");
    }
  }, [userId]);

  useEffect(() => {
    void load();
  }, [load]);

  const empresa = Number(empresaId);
  const restaurants = useMemo(
    () =>
      (detail?.options.restaurants ?? [])
        .filter((item) => item.empresaId === empresa)
        .filter((item) => query.trim() === "" || norm(`${item.name} ${item.city} ${item.brand}`).includes(norm(query))),
    [detail, empresa, query]
  );
  const brands = useMemo(() => {
    const groups = new Map<string, typeof restaurants>();
    for (const item of restaurants) groups.set(item.brand || "Sin marca", [...(groups.get(item.brand || "Sin marca") ?? []), item]);
    return [...groups];
  }, [restaurants]);
  const marcas = (detail?.options.marcas ?? []).filter((marca) => marca.empresaIds.includes(empresa));

  if (loadError) return <p className="text-sm text-rose-300">{loadError}</p>;
  if (!detail) return <p className="text-sm text-gray-500">Cargando…</p>;

  const readOnly = detail.user.rol === "super_admin";
  const editable = !readOnly;
  const roleChanged = rol !== detail.user.rol;

  function toggle(set: Set<number>, id: number, apply: (next: Set<number>) => void) {
    const next = new Set(set);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    apply(next);
  }

  async function save() {
    setSaving(true);
    setMessage(null);
    try {
      const saved = await fetchJson<Detail>(`/api/platform/users/${userId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          rol,
          empresaId: empresa,
          restaurantIds: rol === "restaurante_user" ? [...restaurantIds] : [],
          marcaIds: rol === "marca_admin" ? [...marcaIds] : [],
        }),
      });
      setDetail(saved);
      setRestaurantIds(new Set(saved.selection.restaurantIds));
      setMarcaIds(new Set(saved.selection.marcaIds));
      setMessage({ kind: "ok", text: `Guardado. Ahora ve ${saved.effective.count} restaurantes en la web y por WhatsApp.` });
      onSaved();
    } catch (error) {
      setMessage({ kind: "error", text: error instanceof Error ? error.message : "No se pudo guardar" });
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-4">
      <div>
        <p className="text-lg font-semibold text-white">{detail.user.nombre}</p>
        <p className="text-xs text-gray-500">{detail.user.email}</p>
      </div>

      {readOnly ? (
        <p className="rounded-xl border border-white/[0.08] bg-white/[0.03] px-4 py-3 text-sm text-gray-400">
          Un super administrador ve todo y no se gestiona desde aquí.
        </p>
      ) : (
        <>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block text-[11px] text-gray-500">
              Rol
              <select
                className="mt-1 w-full rounded-xl border border-white/[0.08] bg-[#0d0a14] px-3 py-2 text-[13px] text-white"
                value={rol}
                onChange={(event) => setRol(event.target.value)}
              >
                {EDITABLE_ROLES.map((item) => (
                  <option key={item} value={item}>
                    {ROLE_LABELS[item]}
                  </option>
                ))}
              </select>
            </label>
            <label className="block text-[11px] text-gray-500">
              Empresa
              <select
                className="mt-1 w-full rounded-xl border border-white/[0.08] bg-[#0d0a14] px-3 py-2 text-[13px] text-white"
                value={empresaId}
                onChange={(event) => {
                  setEmpresaId(event.target.value);
                  // Los restaurantes y marcas son de una empresa: al cambiarla se reinician.
                  setRestaurantIds(new Set());
                  setMarcaIds(new Set());
                }}
              >
                <option value="">Selecciona…</option>
                {detail.options.empresas.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.nombre}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <p className="text-xs text-gray-500">{ROLE_HINT[rol]}</p>
          {roleChanged ? (
            <p className="text-xs text-amber-200">
              Al cambiar de rol se eliminan las asignaciones del rol anterior: el acceso depende siempre del rol actual.
            </p>
          ) : null}

          {rol === "restaurante_user" && empresaId !== "" ? (
            <div>
              <input
                type="search"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Buscar restaurante…"
                className="mb-3 w-full rounded-xl border border-white/[0.08] bg-white/[0.04] px-3.5 py-2 text-[13px] text-white placeholder:text-gray-600 focus:border-violet-400/40 focus:outline-none"
              />
              <div className="max-h-[360px] space-y-3 overflow-y-auto rounded-xl border border-white/[0.06] p-3">
                {brands.length === 0 ? <p className="text-xs text-gray-500">Sin resultados.</p> : null}
                {brands.map(([brand, items]) => (
                  <div key={brand}>
                    <p className="mb-1 text-[10px] font-semibold uppercase tracking-[0.1em] text-gray-500">{brand}</p>
                    <div className="grid gap-1 sm:grid-cols-2">
                      {items.map((item) => (
                        <label key={item.id} className="flex items-center gap-2 text-[13px] text-gray-200">
                          <input
                            type="checkbox"
                            className="accent-violet-500"
                            checked={restaurantIds.has(item.id)}
                            onChange={() => toggle(restaurantIds, item.id, setRestaurantIds)}
                          />
                          {item.name}
                          {item.city ? <span className="text-[11px] text-gray-600">{item.city}</span> : null}
                        </label>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
              <p className="mt-2 text-xs text-gray-400">{restaurantIds.size} restaurantes seleccionados</p>
            </div>
          ) : null}

          {rol === "marca_admin" && empresaId !== "" ? (
            <div>
              <div className="grid gap-1 rounded-xl border border-white/[0.06] p-3 sm:grid-cols-2">
                {marcas.length === 0 ? <p className="text-xs text-gray-500">Esta empresa no tiene marcas.</p> : null}
                {marcas.map((marca) => (
                  <label key={marca.id} className="flex items-center gap-2 text-[13px] text-gray-200">
                    <input
                      type="checkbox"
                      className="accent-violet-500"
                      checked={marcaIds.has(marca.id)}
                      onChange={() => toggle(marcaIds, marca.id, setMarcaIds)}
                    />
                    {marca.nombre}
                  </label>
                ))}
              </div>
              <p className="mt-2 text-xs text-gray-400">{marcaIds.size} marcas seleccionadas</p>
            </div>
          ) : null}
        </>
      )}

      <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] px-4 py-3">
        <p className="text-xs text-gray-500">
          Acceso efectivo hoy (el mismo en la web, WhatsApp e informes):{" "}
          <span className="font-medium text-gray-200">{detail.effective.count} restaurantes</span>
        </p>
      </div>

      {message ? (
        <p role="status" className={`text-xs ${message.kind === "ok" ? "text-emerald-300" : "text-rose-300"}`}>
          {message.text}
        </p>
      ) : null}

      {editable ? (
        <button
          type="button"
          onClick={() => void save()}
          disabled={saving || empresaId === ""}
          className="rounded-xl border border-violet-400/30 bg-violet-500/25 px-5 py-2.5 text-[13px] font-medium text-white transition hover:bg-violet-500/35 disabled:cursor-not-allowed disabled:border-white/[0.06] disabled:bg-white/[0.03] disabled:text-gray-600"
        >
          {saving ? "Guardando…" : "Guardar cambios"}
        </button>
      ) : null}
    </div>
  );
}

export function UsersView({ initialUserId }: { initialUserId: string | null }) {
  const [users, setUsers] = useState<UserListItem[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(initialUserId);

  const loadUsers = useCallback(async () => {
    try {
      const data = await fetchJson<{ users: UserListItem[] }>("/api/platform/users");
      setUsers(data.users);
      setError(null);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "No se pudieron cargar los usuarios");
    }
  }, []);

  useEffect(() => {
    void loadUsers();
  }, [loadUsers]);

  return (
    <div className="mx-auto max-w-[1200px] space-y-5 pb-12">
      <header>
        <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[var(--nexo-text-tertiary)]">Acceso</p>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight text-white">Usuarios y permisos</h1>
        <p className="mt-2 max-w-2xl text-sm text-gray-400">
          Aquí se decide qué restaurantes ve cada persona. Lo que se guarda vale igual para la web, para WhatsApp y para
          los informes: no hay que configurarlo en ningún otro sitio.
        </p>
      </header>

      {error ? <p className="text-sm text-rose-300">{error}</p> : null}

      <div className="grid gap-5 lg:grid-cols-[340px_1fr]">
        <div className="space-y-2">
          {users === null ? <p className="text-sm text-gray-500">Cargando…</p> : null}
          {users?.map((user) => (
            <button
              key={user.id}
              type="button"
              onClick={() => setSelectedId(user.id)}
              className={`block w-full rounded-2xl border px-4 py-3 text-left transition ${
                selectedId === user.id
                  ? "border-violet-400/30 bg-violet-500/[0.12]"
                  : "border-white/[0.08] bg-white/[0.03] hover:bg-white/[0.05]"
              }`}
            >
              <p className="text-sm font-medium text-white">{user.nombre || user.email}</p>
              <p className="text-xs text-gray-500">{ROLE_LABELS[user.rol] ?? user.rol}</p>
              <p className="mt-1 text-[11px] text-gray-600">
                {user.empresaNombre ?? "Sin empresa"} · {user.restaurantCount} restaurantes
              </p>
            </button>
          ))}
        </div>

        <section className="min-h-[300px] rounded-3xl border border-white/[0.08] bg-white/[0.025] p-5">
          {selectedId ? (
            <Editor key={selectedId} userId={selectedId} onSaved={() => void loadUsers()} />
          ) : (
            <p className="text-sm text-gray-500">Selecciona una persona para ver y cambiar sus restaurantes.</p>
          )}
        </section>
      </div>
    </div>
  );
}
