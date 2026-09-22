"use client";

import { useEffect, useState } from "react";
import type {
  RestaurantOnboardingOptions,
  RestaurantOnboardingResult,
} from "@/lib/restaurants/onboarding-types";

type Props = {
  open: boolean;
  onClose: () => void;
  onCreated: () => void;
};

const emptyOptions: RestaurantOnboardingOptions = {
  marcas: [],
  empresas: [],
};

export function RestaurantOnboardingModal({
  open,
  onClose,
  onCreated,
}: Props) {
  const [options, setOptions] = useState<RestaurantOnboardingOptions>(emptyOptions);
  const [loadingOptions, setLoadingOptions] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState<RestaurantOnboardingResult | null>(null);

  const [nombre, setNombre] = useState("");
  const [direccion, setDireccion] = useState("");
  const [ciudad, setCiudad] = useState("");
  const [marcaId, setMarcaId] = useState("");
  const [empresaId, setEmpresaId] = useState("");
  const [placeId, setPlaceId] = useState("");
  const [googleMapsUrl, setGoogleMapsUrl] = useState("");

  useEffect(() => {
    if (!open) return;

    setLoadingOptions(true);
    setError("");

    fetch("/api/restaurants/onboarding/options", {
      credentials: "include",
    })
      .then(async (response) => {
        const body = await response.json();
        if (!response.ok) {
          throw new Error(body?.error || "No se pudieron cargar las opciones.");
        }
        return body as RestaurantOnboardingOptions;
      })
      .then((body) => {
        setOptions(body);
        if (body.marcas[0]) {
          setMarcaId((current) => current || String(body.marcas[0].id));
        }
        if (body.empresas[0]) {
          setEmpresaId((current) => current || String(body.empresas[0].id));
        }
      })
      .catch((reason) => {
        setError(
          reason instanceof Error
            ? reason.message
            : "No se pudieron cargar las opciones."
        );
      })
      .finally(() => setLoadingOptions(false));
  }, [open]);

  function reset() {
    setNombre("");
    setDireccion("");
    setCiudad("");
    setPlaceId("");
    setGoogleMapsUrl("");
    setResult(null);
    setError("");
  }

  function closeModal() {
    reset();
    onClose();
  }

  async function createRestaurant() {
    setSaving(true);
    setError("");

    try {
      const response = await fetch("/api/restaurants/onboarding/create", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          nombre,
          direccion,
          ciudad,
          marcaId: Number(marcaId),
          empresaId: Number(empresaId),
          placeId,
          googleMapsUrl,
        }),
      });

      const body = await response.json();
      if (!response.ok) {
        throw new Error(body?.error || "No se pudo crear el restaurante.");
      }

      setResult(body as RestaurantOnboardingResult);
      onCreated();
    } catch (reason) {
      setError(
        reason instanceof Error
          ? reason.message
          : "No se pudo crear el restaurante."
      );
    } finally {
      setSaving(false);
    }
  }

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/70 px-4 py-8 backdrop-blur-sm">
      <button
        type="button"
        aria-label="Cerrar"
        onClick={closeModal}
        className="absolute inset-0 cursor-default"
      />

      <div className="relative z-[1] w-full max-w-3xl rounded-3xl border border-white/[0.09] bg-[#09070f] p-5 shadow-2xl sm:p-6">
        <div className="flex items-start justify-between gap-4 border-b border-white/[0.07] pb-5">
          <div>
            <span className="rounded-full border border-violet-400/20 bg-violet-500/10 px-2.5 py-1 text-[10px] font-medium uppercase tracking-[0.12em] text-violet-200">
              Alta guiada V1
            </span>
            <h2 className="mt-3 text-xl font-semibold text-white">
              Añadir restaurante
            </h2>
            <p className="mt-2 max-w-xl text-xs leading-5 text-gray-500">
              Crea el local en Nexo y deja registradas sus integraciones. No necesitas
              entrar manualmente en Supabase.
            </p>
          </div>

          <button
            type="button"
            onClick={closeModal}
            className="rounded-xl border border-white/[0.08] bg-white/[0.03] px-3 py-2 text-xs text-gray-400 hover:text-white"
          >
            Cerrar
          </button>
        </div>

        {result ? (
          <div className="py-6">
            <div className="rounded-2xl border border-emerald-400/20 bg-emerald-400/[0.07] p-5">
              <p className="text-sm font-semibold text-emerald-200">
                Restaurante creado correctamente
              </p>
              <p className="mt-1 text-xs text-emerald-100/60">
                {result.nombre} · ID Nexo {result.id}
              </p>
            </div>

            <div className="mt-5 space-y-2">
              <div className="flex items-center justify-between rounded-xl border border-white/[0.07] bg-white/[0.025] px-4 py-3">
                <span className="text-sm text-gray-300">Nexo / Supabase</span>
                <span className="text-xs font-medium text-emerald-300">🟢 Creado</span>
              </div>
              <div className="flex items-center justify-between rounded-xl border border-white/[0.07] bg-white/[0.025] px-4 py-3">
                <span className="text-sm text-gray-300">Google Maps / Place ID</span>
                <span className="text-xs font-medium text-emerald-300">🟢 Registrado</span>
              </div>
              <div className="flex items-center justify-between rounded-xl border border-amber-400/15 bg-amber-400/[0.05] px-4 py-3">
                <span className="text-sm text-gray-300">Apify</span>
                <span className="text-xs font-medium text-amber-200">🟡 Pendiente conexión</span>
              </div>
            </div>

            <p className="mt-4 text-xs leading-5 text-gray-500">
              En la siguiente fase, Nexo utilizará esta fila pendiente para dar de alta
              automáticamente el restaurante en Apify y verificar que empiezan a entrar
              reseñas.
            </p>

            <div className="mt-6 flex justify-end">
              <button
                type="button"
                onClick={closeModal}
                className="rounded-xl bg-gradient-to-r from-violet-600 to-purple-600 px-4 py-2.5 text-xs font-semibold text-white"
              >
                Terminar
              </button>
            </div>
          </div>
        ) : (
          <div className="py-6">
            {loadingOptions ? (
              <div className="h-56 animate-pulse rounded-2xl border border-white/[0.07] bg-white/[0.025]" />
            ) : (
              <>
                <div className="grid gap-4 sm:grid-cols-2">
                  <label className="space-y-2 sm:col-span-2">
                    <span className="text-xs font-medium text-gray-400">
                      Nombre del restaurante *
                    </span>
                    <input
                      value={nombre}
                      onChange={(event) => setNombre(event.target.value)}
                      placeholder="Ej. Burger King Pamplona Iturrama"
                      className="w-full rounded-xl border border-white/[0.08] bg-[#0d0a13] px-3 py-2.5 text-sm text-white outline-none placeholder:text-gray-700 focus:border-violet-400/30"
                    />
                  </label>

                  <label className="space-y-2">
                    <span className="text-xs font-medium text-gray-400">Empresa *</span>
                    <select
                      value={empresaId}
                      onChange={(event) => setEmpresaId(event.target.value)}
                      className="w-full rounded-xl border border-white/[0.08] bg-[#0d0a13] px-3 py-2.5 text-sm text-gray-200 outline-none"
                    >
                      {options.empresas.map((item) => (
                        <option key={item.id} value={item.id}>
                          {item.nombre}
                        </option>
                      ))}
                    </select>
                  </label>

                  <label className="space-y-2">
                    <span className="text-xs font-medium text-gray-400">Marca *</span>
                    <select
                      value={marcaId}
                      onChange={(event) => setMarcaId(event.target.value)}
                      className="w-full rounded-xl border border-white/[0.08] bg-[#0d0a13] px-3 py-2.5 text-sm text-gray-200 outline-none"
                    >
                      {options.marcas.map((item) => (
                        <option key={item.id} value={item.id}>
                          {item.nombre}
                        </option>
                      ))}
                    </select>
                  </label>

                  <label className="space-y-2">
                    <span className="text-xs font-medium text-gray-400">Ciudad</span>
                    <input
                      value={ciudad}
                      onChange={(event) => setCiudad(event.target.value)}
                      placeholder="Pamplona"
                      className="w-full rounded-xl border border-white/[0.08] bg-[#0d0a13] px-3 py-2.5 text-sm text-white outline-none placeholder:text-gray-700"
                    />
                  </label>

                  <label className="space-y-2">
                    <span className="text-xs font-medium text-gray-400">Dirección</span>
                    <input
                      value={direccion}
                      onChange={(event) => setDireccion(event.target.value)}
                      placeholder="Calle, número..."
                      className="w-full rounded-xl border border-white/[0.08] bg-[#0d0a13] px-3 py-2.5 text-sm text-white outline-none placeholder:text-gray-700"
                    />
                  </label>
                </div>

                <div className="mt-5 rounded-2xl border border-violet-400/10 bg-violet-500/[0.04] p-4">
                  <p className="text-sm font-medium text-white">Google Maps</p>
                  <p className="mt-1 text-xs leading-5 text-gray-500">
                    En esta primera versión necesitamos el Place ID para enlazar futuras
                    reseñas con el restaurante correcto. Después automatizaremos su
                    obtención desde el enlace.
                  </p>

                  <div className="mt-4 grid gap-4">
                    <label className="space-y-2">
                      <span className="text-xs font-medium text-gray-400">Place ID *</span>
                      <input
                        value={placeId}
                        onChange={(event) => setPlaceId(event.target.value)}
                        placeholder="ChIJ..."
                        className="w-full rounded-xl border border-white/[0.08] bg-[#0d0a13] px-3 py-2.5 text-sm text-white outline-none placeholder:text-gray-700"
                      />
                    </label>

                    <label className="space-y-2">
                      <span className="text-xs font-medium text-gray-400">
                        Enlace de Google Maps
                      </span>
                      <input
                        value={googleMapsUrl}
                        onChange={(event) => setGoogleMapsUrl(event.target.value)}
                        placeholder="https://maps.google.com/..."
                        className="w-full rounded-xl border border-white/[0.08] bg-[#0d0a13] px-3 py-2.5 text-sm text-white outline-none placeholder:text-gray-700"
                      />
                    </label>
                  </div>
                </div>

                {error ? (
                  <p className="mt-4 rounded-xl border border-rose-400/15 bg-rose-400/[0.06] px-3 py-2.5 text-xs text-rose-200">
                    {error}
                  </p>
                ) : null}

                <div className="mt-6 flex flex-wrap items-center justify-between gap-3 border-t border-white/[0.07] pt-5">
                  <p className="text-[11px] text-gray-600">
                    Se comprobará que el Place ID no exista antes de guardar.
                  </p>
                  <button
                    type="button"
                    onClick={createRestaurant}
                    disabled={
                      saving ||
                      !nombre.trim() ||
                      !placeId.trim() ||
                      !marcaId ||
                      !empresaId
                    }
                    className="rounded-xl bg-gradient-to-r from-violet-600 to-purple-600 px-4 py-2.5 text-xs font-semibold text-white transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    {saving ? "Creando restaurante..." : "Crear restaurante"}
                  </button>
                </div>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
