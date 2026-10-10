"use client";

import { useMemo, useState } from "react";
import { AccessPicker } from "./access-picker";
import { DiscardNotice, Drawer } from "./drawer";
import {
  accessBody,
  fieldClass,
  labelClass,
  primaryButtonClass,
  secondaryButtonClass,
  type ContactDetail,
  type ContactOptions,
} from "./shared";

/**
 * Drawer de permisos del contacto: nombre, tipo (descriptivo), empresa y restaurantes.
 * Guarda con la misma llamada de siempre (PATCH al contacto): el contacto queda EXACTAMENTE con la
 * selección enviada. Cierra con X, Escape o pulsando fuera; si hay cambios sin guardar, pregunta.
 *
 * El formulario vive en un hijo con `key`: cada vez que se abre arranca desde lo guardado.
 */
export function PermissionsDrawer({
  open,
  conversationId,
  detail,
  config,
  onClose,
  onSaved,
}: {
  open: boolean;
  conversationId: string;
  detail: ContactDetail;
  config: ContactOptions;
  onClose: () => void;
  onSaved: (detail: ContactDetail) => void;
}) {
  if (!open) return null;
  return <PermissionsPanel {...{ conversationId, detail, config, onClose, onSaved }} />;
}

function sameSet(a: Set<number>, b: number[]): boolean {
  return a.size === b.length && b.every((id) => a.has(id));
}

function PermissionsPanel({
  conversationId,
  detail,
  config,
  onClose,
  onSaved,
}: {
  conversationId: string;
  detail: ContactDetail;
  config: ContactOptions;
  onClose: () => void;
  onSaved: (detail: ContactDetail) => void;
}) {
  const [nombre, setNombre] = useState(detail.nombre ?? "");
  const [tipo, setTipo] = useState(detail.tipo ?? "");
  const [empresaId, setEmpresaId] = useState(detail.selection.empresaId === null ? "" : String(detail.selection.empresaId));
  const [todos, setTodos] = useState(detail.selection.todosRestaurantes);
  const [restaurantIds, setRestaurantIds] = useState<Set<number>>(new Set(detail.selection.restaurantIds));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmingClose, setConfirmingClose] = useState(false);

  const dirty = useMemo(
    () =>
      nombre.trim() !== (detail.nombre ?? "").trim() ||
      tipo !== (detail.tipo ?? "") ||
      empresaId !== (detail.selection.empresaId === null ? "" : String(detail.selection.empresaId)) ||
      todos !== detail.selection.todosRestaurantes ||
      !sameSet(restaurantIds, detail.selection.restaurantIds),
    [nombre, tipo, empresaId, todos, restaurantIds, detail]
  );

  function requestClose() {
    if (saving) return;
    if (dirty) setConfirmingClose(true);
    else onClose();
  }

  async function save() {
    setSaving(true);
    setError(null);
    try {
      const response = await fetch(`/api/conversations/${conversationId}/contact`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nombre, ...accessBody(tipo, empresaId, todos, restaurantIds) }),
      });
      const data = (await response.json().catch(() => null)) as (ContactDetail & { error?: string }) | null;
      if (!response.ok || !data) {
        setError(data?.error ?? "No se pudo guardar el contacto");
        return;
      }
      onSaved(data);
      onClose();
    } catch {
      setError("No se pudo guardar el contacto");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Drawer
      open
      title="Permisos del contacto"
      description={detail.displayName}
      onRequestClose={requestClose}
      footer={
        <>
          {confirmingClose ? <DiscardNotice onKeep={() => setConfirmingClose(false)} onDiscard={onClose} /> : null}
          {error ? (
            <p role="alert" className="mb-3 text-xs text-rose-300">
              {error}
            </p>
          ) : null}
          <div className="flex items-center justify-between gap-3">
            <p className="text-xs text-gray-500" aria-live="polite">
              {dirty ? "Cambios sin guardar" : "Sin cambios"}
            </p>
            <div className="flex gap-2">
              <button type="button" onClick={requestClose} disabled={saving} className={secondaryButtonClass}>
                Cancelar
              </button>
              <button type="button" onClick={() => void save()} disabled={saving || !dirty} className={primaryButtonClass}>
                {saving ? "Guardando…" : "Guardar cambios"}
              </button>
            </div>
          </div>
        </>
      }
    >
      <div className="space-y-6">
        <section className="space-y-4">
          <div>
            <label htmlFor="perm-name" className={labelClass}>
              Nombre
            </label>
            <input
              id="perm-name"
              value={nombre}
              onChange={(event) => setNombre(event.target.value)}
              placeholder="Nombre del contacto"
              maxLength={100}
              className={fieldClass}
            />
          </div>
          <div>
            <label htmlFor="perm-type" className={labelClass}>
              Tipo de contacto
            </label>
            <select id="perm-type" value={tipo} onChange={(event) => setTipo(event.target.value)} className={fieldClass}>
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
          idPrefix="perm"
          config={config}
          empresaId={empresaId}
          onEmpresa={setEmpresaId}
          todos={todos}
          onTodos={setTodos}
          restaurantIds={restaurantIds}
          onRestaurants={setRestaurantIds}
        />
      </div>
    </Drawer>
  );
}
