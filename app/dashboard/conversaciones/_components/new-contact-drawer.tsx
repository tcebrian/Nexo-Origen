"use client";

import { useEffect, useState } from "react";
import { AccessPicker } from "./access-picker";
import { DiscardNotice, Drawer } from "./drawer";
import {
  accessBody,
  fetchJson,
  fieldClass,
  labelClass,
  primaryButtonClass,
  secondaryButtonClass,
  type ContactOptions,
} from "./shared";

type NewContactResult = { existing: boolean; conversationId: string | null };

/**
 * Alta manual de un contacto de WhatsApp con sus permisos (misma llamada de siempre). No hace falta
 * cuenta web. Crear un contacto NO envía ningún WhatsApp: la activación es un paso manual aparte.
 */
export function NewContactDrawer({
  open,
  onClose,
  onCreated,
}: {
  open: boolean;
  onClose: () => void;
  /** Se llama tras crear o reutilizar el contacto; abre su conversación si existe. */
  onCreated: (conversationId: string | null) => void;
}) {
  if (!open) return null;
  return <NewContactPanel onClose={onClose} onCreated={onCreated} />;
}

function NewContactPanel({ onClose, onCreated }: { onClose: () => void; onCreated: (conversationId: string | null) => void }) {
  const [config, setConfig] = useState<ContactOptions | null>(null);
  const [nombre, setNombre] = useState("");
  const [prefijo, setPrefijo] = useState("+34");
  const [telefono, setTelefono] = useState("");
  const [tipo, setTipo] = useState("");
  const [empresaId, setEmpresaId] = useState("");
  const [todos, setTodos] = useState(false);
  const [restaurantIds, setRestaurantIds] = useState<Set<number>>(new Set());
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<NewContactResult | null>(null);
  const [confirmingClose, setConfirmingClose] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetchJson<ContactOptions>("/api/conversations/contacts")
      .then((data) => {
        if (!cancelled) setConfig(data);
      })
      .catch(() => {
        if (!cancelled) setError("No se pudieron cargar las empresas y restaurantes.");
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const dirty =
    !result &&
    (nombre.trim() !== "" || telefono.trim() !== "" || tipo !== "" || empresaId !== "" || todos || restaurantIds.size > 0);

  function requestClose() {
    if (busy) return;
    if (dirty) setConfirmingClose(true);
    else onClose();
  }

  async function submit() {
    setBusy(true);
    setError(null);
    try {
      const response = await fetch("/api/conversations/contacts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          nombre,
          countryCallingCode: prefijo,
          nationalNumber: telefono,
          ...accessBody(tipo, empresaId, todos, restaurantIds),
        }),
      });
      const data = (await response.json().catch(() => null)) as (NewContactResult & { error?: string }) | null;
      if (!response.ok || !data) {
        setError(data?.error ?? "No se pudo crear el contacto");
        return;
      }
      if (data.existing) {
        setResult(data);
      } else {
        onCreated(data.conversationId);
        onClose();
      }
    } catch {
      setError("No se pudo crear el contacto");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Drawer
      open
      title="Nuevo contacto"
      description="Contacto de WhatsApp con sus permisos"
      onRequestClose={requestClose}
      footer={
        result ? (
          <div className="flex justify-end gap-2">
            <button type="button" onClick={onClose} className={secondaryButtonClass}>
              Cerrar
            </button>
            {result.conversationId ? (
              <button
                type="button"
                onClick={() => {
                  onCreated(result.conversationId);
                  onClose();
                }}
                className={primaryButtonClass}
              >
                Abrir contacto
              </button>
            ) : null}
          </div>
        ) : (
          <>
            {confirmingClose ? <DiscardNotice onKeep={() => setConfirmingClose(false)} onDiscard={onClose} /> : null}
            {error ? (
              <p role="alert" className="mb-3 text-xs text-rose-300">
                {error}
              </p>
            ) : null}
            <div className="flex justify-end gap-2">
              <button type="button" onClick={requestClose} disabled={busy} className={secondaryButtonClass}>
                Cancelar
              </button>
              <button
                type="button"
                onClick={() => void submit()}
                disabled={busy || !config || telefono.trim() === ""}
                className={primaryButtonClass}
              >
                {busy ? "Creando…" : "Crear contacto"}
              </button>
            </div>
          </>
        )
      }
    >
      {result ? (
        <div className="space-y-2 rounded-xl border border-amber-300/20 bg-amber-300/[0.07] p-4">
          <p className="text-[13px] font-medium text-amber-100">Este número ya existe.</p>
          <p className="text-xs text-amber-100/70">No se ha cambiado nada. Ábrelo para editar su nombre, su tipo y sus restaurantes.</p>
        </div>
      ) : !config ? (
        <p className="py-6 text-center text-xs text-gray-500">{error ?? "Cargando…"}</p>
      ) : (
        <form
          className="space-y-6"
          onSubmit={(event) => {
            event.preventDefault();
            void submit();
          }}
        >
          <section className="space-y-4">
            <div>
              <label htmlFor="new-contact-name" className={labelClass}>
                Nombre
              </label>
              <input
                id="new-contact-name"
                value={nombre}
                onChange={(event) => setNombre(event.target.value)}
                placeholder="Nombre del contacto"
                maxLength={100}
                className={fieldClass}
              />
            </div>

            <div>
              <label htmlFor="new-contact-phone" className={labelClass}>
                Teléfono
              </label>
              <div className="flex gap-2">
                <input
                  value={prefijo}
                  onChange={(event) => setPrefijo(event.target.value)}
                  placeholder="+34"
                  aria-label="Prefijo del país"
                  inputMode="tel"
                  autoComplete="off"
                  className={`${fieldClass} !w-[76px] shrink-0 text-center`}
                />
                <input
                  id="new-contact-phone"
                  value={telefono}
                  onChange={(event) => setTelefono(event.target.value)}
                  placeholder="651 346 517"
                  inputMode="tel"
                  autoComplete="off"
                  className={`${fieldClass} min-w-0 flex-1`}
                />
              </div>
            </div>

            <div>
              <label htmlFor="new-contact-type" className={labelClass}>
                Tipo de contacto
              </label>
              <select id="new-contact-type" value={tipo} onChange={(event) => setTipo(event.target.value)} className={fieldClass}>
                <option value="">Sin tipo</option>
                {config.types.map((type) => (
                  <option key={type.id} value={type.id}>
                    {type.label}
                  </option>
                ))}
              </select>
              <p className="mt-1.5 text-[11px] text-gray-600">Solo descriptivo: no decide qué restaurantes ve.</p>
            </div>
          </section>

          <div className="border-t border-white/[0.06]" />

          <AccessPicker
            idPrefix="new"
            config={config}
            empresaId={empresaId}
            onEmpresa={setEmpresaId}
            todos={todos}
            onTodos={setTodos}
            restaurantIds={restaurantIds}
            onRestaurants={setRestaurantIds}
          />

          <p className="text-[11px] text-gray-500">
            No hace falta cuenta web. Crear el contacto no le envía ningún WhatsApp: podrás enviarle la activación cuando quieras desde su ficha.
          </p>
        </form>
      )}
    </Drawer>
  );
}
