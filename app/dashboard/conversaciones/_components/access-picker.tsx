"use client";

import { useMemo, useState } from "react";
import { fieldClass, labelClass, pluralRestaurants, type ContactOptions } from "./shared";

const normalize = (value: string) => value.toLowerCase().normalize("NFD").replace(/\p{M}/gu, "");

/**
 * Empresa y restaurantes de un contacto: "Todos los restaurantes" o "Restaurantes concretos".
 * Los permisos salen SOLO de aquí (empresa + selección): el tipo del contacto es descriptivo.
 * Lo comparten el alta de contactos y el drawer de permisos, para que se comporten igual.
 */
export function AccessPicker({
  config,
  empresaId,
  onEmpresa,
  todos,
  onTodos,
  restaurantIds,
  onRestaurants,
  idPrefix,
}: {
  config: ContactOptions;
  empresaId: string;
  onEmpresa: (value: string) => void;
  todos: boolean;
  onTodos: (value: boolean) => void;
  restaurantIds: Set<number>;
  onRestaurants: (value: Set<number>) => void;
  idPrefix: string;
}) {
  const [query, setQuery] = useState("");

  const ofCompany = useMemo(
    () => config.options.restaurants.filter((restaurant) => restaurant.empresaId === Number(empresaId)),
    [config, empresaId]
  );

  const brands = useMemo(() => {
    const groups = new Map<string, ContactOptions["options"]["restaurants"]>();
    const text = normalize(query.trim());
    for (const restaurant of ofCompany) {
      if (text !== "" && !normalize(`${restaurant.name} ${restaurant.city} ${restaurant.brand}`).includes(text)) continue;
      const brand = restaurant.brand || "Sin marca";
      groups.set(brand, [...(groups.get(brand) ?? []), restaurant]);
    }
    return [...groups];
  }, [ofCompany, query]);

  function toggle(id: number) {
    const next = new Set(restaurantIds);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    onRestaurants(next);
  }

  function setBrand(items: { id: number }[], selected: boolean) {
    const next = new Set(restaurantIds);
    for (const item of items) {
      if (selected) next.add(item.id);
      else next.delete(item.id);
    }
    onRestaurants(next);
  }

  return (
    <div className="space-y-5">
      <div>
        <label htmlFor={`${idPrefix}-company`} className={labelClass}>
          Empresa
        </label>
        <select
          id={`${idPrefix}-company`}
          value={empresaId}
          onChange={(event) => {
            onEmpresa(event.target.value);
            // Los restaurantes son de una empresa: al cambiarla se reinicia la selección.
            onRestaurants(new Set());
            onTodos(false);
            setQuery("");
          }}
          className={fieldClass}
        >
          <option value="">Sin empresa (sin acceso a datos)</option>
          {config.options.empresas.map((empresa) => (
            <option key={empresa.id} value={empresa.id}>
              {empresa.nombre}
            </option>
          ))}
        </select>
      </div>

      {empresaId === "" ? (
        <p className="rounded-xl border border-white/[0.06] bg-white/[0.02] px-3.5 py-3 text-xs text-gray-500">
          Sin empresa, el contacto puede escribir pero no tiene acceso a datos de ningún restaurante.
        </p>
      ) : (
        <fieldset>
          <legend className={labelClass}>Acceso a restaurantes</legend>
          <div className="grid gap-2">
            {(
              [
                { value: true, title: "Todos los restaurantes", hint: `Los ${ofCompany.length} actuales y los que se añadan en el futuro.` },
                { value: false, title: "Restaurantes concretos", hint: "Eliges uno a uno cuáles puede consultar." },
              ] as const
            ).map((option) => {
              const checked = todos === option.value;
              return (
                <label
                  key={String(option.value)}
                  className={`flex cursor-pointer items-start gap-3 rounded-xl border px-3.5 py-3 transition focus-within:ring-2 focus-within:ring-violet-400/40 ${
                    checked ? "border-violet-400/40 bg-violet-500/[0.12]" : "border-white/[0.08] bg-white/[0.02] hover:bg-white/[0.04]"
                  }`}
                >
                  <input
                    type="radio"
                    name={`${idPrefix}-scope`}
                    checked={checked}
                    onChange={() => onTodos(option.value)}
                    className="mt-0.5 accent-violet-500"
                  />
                  <span>
                    <span className="block text-[13px] font-medium text-white">{option.title}</span>
                    <span className="mt-0.5 block text-xs text-gray-500">{option.hint}</span>
                  </span>
                </label>
              );
            })}
          </div>

          {!todos ? (
            <div className="mt-4 space-y-3">
              <input
                type="search"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Buscar restaurante…"
                aria-label="Buscar restaurante"
                className={fieldClass}
              />

              <div className="space-y-4">
                {brands.length === 0 ? <p className="py-4 text-center text-xs text-gray-500">Sin resultados.</p> : null}
                {brands.map(([brand, items]) => {
                  const selectedHere = items.filter((item) => restaurantIds.has(item.id)).length;
                  const allSelected = selectedHere === items.length;
                  return (
                    <section key={brand}>
                      <div className="mb-1.5 flex items-center justify-between gap-3">
                        <h3 className="truncate text-[11px] font-semibold uppercase tracking-[0.1em] text-gray-500">
                          {brand} <span className="font-normal text-gray-600">· {selectedHere}/{items.length}</span>
                        </h3>
                        <button
                          type="button"
                          onClick={() => setBrand(items, !allSelected)}
                          className="shrink-0 text-[11px] font-medium text-violet-300 transition hover:text-violet-200"
                        >
                          {allSelected ? "Quitar todos" : "Marcar todos"}
                        </button>
                      </div>
                      <ul className="divide-y divide-white/[0.05] overflow-hidden rounded-xl border border-white/[0.07]">
                        {items.map((item) => (
                          <li key={item.id}>
                            <label className="flex cursor-pointer items-center gap-3 px-3.5 py-2.5 text-[13px] text-gray-200 transition hover:bg-white/[0.04]">
                              <input
                                type="checkbox"
                                className="accent-violet-500"
                                checked={restaurantIds.has(item.id)}
                                onChange={() => toggle(item.id)}
                              />
                              <span className="min-w-0 flex-1 truncate">{item.name}</span>
                              {item.city ? <span className="shrink-0 text-[11px] text-gray-600">{item.city}</span> : null}
                            </label>
                          </li>
                        ))}
                      </ul>
                    </section>
                  );
                })}
              </div>

              <p className="text-xs text-gray-400" aria-live="polite">
                <span className="font-medium text-gray-200">{pluralRestaurants(restaurantIds.size)}</span>{" "}
                {restaurantIds.size === 1 ? "seleccionado" : "seleccionados"}
              </p>
            </div>
          ) : null}
        </fieldset>
      )}
    </div>
  );
}
