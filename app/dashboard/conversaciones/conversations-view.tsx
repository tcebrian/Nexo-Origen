"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { canSubmitDraft } from "@/lib/conversations/compose";
import { describeDeliveryStatus, type DeliveryIndicator } from "@/lib/conversations/delivery-status";
import {
  MAX_OUTBOUND_TEXT_CHARS,
  WHATSAPP_TEXT_MAX_CHARS,
  countMessageParts,
  textLength,
} from "@/lib/conversations/text-chunks";
import type { ReportFormat, ReportOptions, ReportTypeId } from "@/lib/conversations/report-catalog";
import {
  filterConversations,
  type ConversationListItem,
  type ConversationMessage,
} from "@/lib/conversations/read-model";

const LIST_POLL_MS = 15_000;
const MESSAGES_POLL_MS = 8_000;

const timeFormat = new Intl.DateTimeFormat("es-ES", {
  hour: "2-digit",
  minute: "2-digit",
  timeZone: "Europe/Madrid",
});
const dayFormat = new Intl.DateTimeFormat("es-ES", {
  day: "2-digit",
  month: "short",
  timeZone: "Europe/Madrid",
});
const dayKeyFormat = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Madrid" });
const dayLongFormat = new Intl.DateTimeFormat("es-ES", {
  weekday: "long",
  day: "numeric",
  month: "long",
  timeZone: "Europe/Madrid",
});

function parseDate(value: string | null): Date | null {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

/** Hora si es hoy; si no, día corto. */
function formatListTime(value: string | null): string {
  const date = parseDate(value);
  if (!date) return "";
  return dayKeyFormat.format(date) === dayKeyFormat.format(new Date())
    ? timeFormat.format(date)
    : dayFormat.format(date);
}

function formatMessageTime(value: string): string {
  const date = parseDate(value);
  return date ? timeFormat.format(date) : "";
}

function dayKey(value: string): string {
  const date = parseDate(value);
  return date ? dayKeyFormat.format(date) : "";
}

function formatDayLabel(value: string): string {
  const date = parseDate(value);
  return date ? dayLongFormat.format(date) : "";
}

function initialOf(name: string): string {
  const first = Array.from(name.replace(/^\+/, "").trim())[0];
  return first ? first.toUpperCase() : "?";
}

const STATUS_LABEL = { open: "Abierta", closed: "Cerrada" } as const;

async function fetchJson<T>(url: string): Promise<T> {
  const response = await fetch(url, { cache: "no-store" });
  if (!response.ok) throw new Error(String(response.status));
  return (await response.json()) as T;
}

/** Ejecuta `task` cada `ms` mientras la pestaña esté visible. */
function useSoftPolling(task: () => void, ms: number, enabled: boolean) {
  const taskRef = useRef(task);
  useEffect(() => {
    taskRef.current = task;
  });

  useEffect(() => {
    if (!enabled) return;
    const id = window.setInterval(() => {
      if (document.visibilityState === "visible") taskRef.current();
    }, ms);
    return () => window.clearInterval(id);
  }, [ms, enabled]);
}

function Avatar({ name, size = "md" }: { name: string; size?: "md" | "lg" }) {
  return (
    <span
      className={`flex shrink-0 items-center justify-center rounded-full border border-violet-400/20 bg-violet-500/15 font-semibold text-violet-200 ${
        size === "lg" ? "h-10 w-10 text-sm" : "h-11 w-11 text-sm"
      }`}
      aria-hidden
    >
      {initialOf(name)}
    </span>
  );
}

function ConversationRow({
  item,
  active,
  onSelect,
}: {
  item: ConversationListItem;
  active: boolean;
  onSelect: () => void;
}) {
  return (
    <li>
      <button
        type="button"
        onClick={onSelect}
        aria-current={active ? "true" : undefined}
        className={`flex w-full items-center gap-3 border-b border-white/[0.05] px-4 py-3 text-left transition ${
          active ? "bg-violet-500/[0.12]" : "hover:bg-white/[0.04]"
        }`}
      >
        <Avatar name={item.displayName} />
        <span className="min-w-0 flex-1">
          <span className="flex items-baseline justify-between gap-2">
            <span className="truncate text-[13px] font-medium text-white">{item.displayName}</span>
            <span className="shrink-0 text-[10px] text-gray-500">
              {formatListTime(item.lastMessageAt)}
            </span>
          </span>
          <span className="mt-0.5 flex items-center justify-between gap-2">
            <span className="truncate text-xs text-gray-400">
              {item.lastMessagePreview ?? "Sin mensajes"}
            </span>
            {item.status === "closed" ? (
              <span className="shrink-0 rounded-full border border-white/[0.08] px-1.5 py-0.5 text-[9px] uppercase tracking-[0.08em] text-gray-500">
                Cerrada
              </span>
            ) : null}
          </span>
          {item.access.state === "linked" ? (
            <span className="mt-1 inline-block rounded-full border border-violet-400/20 bg-violet-500/10 px-2 py-0.5 text-[10px] text-violet-200">
              Vinculado · {ACCESS_ROLE_LABELS[item.access.rol] ?? item.access.rol} · {item.access.restaurantCount} restaurantes
            </span>
          ) : (
            <span className="mt-1 inline-block text-[10px] text-gray-600">Sin acceso a datos</span>
          )}
        </span>
      </button>
    </li>
  );
}

const TONE_CLASS: Record<DeliveryIndicator["tone"], string> = {
  muted: "text-gray-500",
  read: "text-violet-300",
  warning: "text-amber-200",
  error: "text-rose-300",
};

/** Checks de entrega estilo WhatsApp con la paleta de Nexo (leído en violeta). */
function DeliveryMark({ indicator }: { indicator: DeliveryIndicator }) {
  return (
    <span
      className={`inline-flex items-center gap-1 ${TONE_CLASS[indicator.tone]}`}
      title={indicator.label}
      data-delivery={indicator.kind}
    >
      <svg className="h-[11px] w-[16px]" viewBox="0 0 18 11" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
        {indicator.ticks === 0 && indicator.kind === "pending" ? (
          <>
            <circle cx="9" cy="5.5" r="4" />
            <path d="M9 3.4v2.3l1.5 1" />
          </>
        ) : indicator.kind === "failed" ? (
          <path d="M9 2.2v3.6M9 8.4h.01" />
        ) : indicator.ticks === 0 ? (
          <path d="M5 5.5h8" />
        ) : (
          <>
            <path d="M1.5 6.2l3 3L10.5 2.5" />
            {indicator.ticks === 2 ? <path d="M6.7 8.7l.8.8 6.2-7" /> : null}
          </>
        )}
      </svg>
      {indicator.showLabel ? (
        <span className="text-[10px]">{indicator.label}</span>
      ) : (
        <span className="sr-only">{indicator.label}</span>
      )}
    </span>
  );
}

function MessageBubble({ message, now }: { message: ConversationMessage; now: number }) {
  const outbound = message.direction === "outbound";
  const isText = message.contentType === "text";
  // Solo los salientes llevan estado de entrega.
  const indicator = outbound
    ? describeDeliveryStatus(message.status, now - (parseDate(message.timestamp)?.getTime() ?? now))
    : null;

  return (
    <div className={`flex ${outbound ? "justify-end" : "justify-start"}`}>
      <div
        className={`max-w-[78%] rounded-2xl px-3.5 py-2 text-[13px] leading-relaxed ${
          outbound
            ? "rounded-br-md border border-violet-400/25 bg-violet-500/20 text-white"
            : "rounded-bl-md border border-white/[0.08] bg-white/[0.05] text-gray-100"
        }`}
      >
        {isText ? (
          <p className="whitespace-pre-wrap break-words">{message.text}</p>
        ) : (
          <>
            <p className="font-medium">{message.label}</p>
            {message.filename ? (
              <p className="mt-0.5 break-all text-xs text-gray-400">{message.filename}</p>
            ) : null}
            {message.caption ? (
              <p className="mt-1 whitespace-pre-wrap break-words">{message.caption}</p>
            ) : null}
          </>
        )}
        <p className="mt-1 flex items-center justify-end gap-1.5 text-[10px] text-gray-500">
          <span>{formatMessageTime(message.timestamp)}</span>
          {indicator ? <DeliveryMark indicator={indicator} /> : null}
        </p>
      </div>
    </div>
  );
}

function MessageThread({ messages }: { messages: ConversationMessage[] }) {
  const bottomRef = useRef<HTMLDivElement>(null);
  // Reloj para distinguir "Enviando" de "Sin confirmar" (un pending antiguo).
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 30_000);
    return () => window.clearInterval(id);
  }, []);
  const lastId = messages[messages.length - 1]?.id;

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ block: "end" });
  }, [lastId]);

  return (
    <div className="flex-1 space-y-2 overflow-y-auto px-4 py-4 sm:px-6">
      {messages.map((message, index) => {
        const key = dayKey(message.timestamp);
        const previous = messages[index - 1];
        const showDay = key !== "" && (!previous || dayKey(previous.timestamp) !== key);
        return (
          <div key={message.id} className="space-y-2">
            {showDay ? (
              <p className="py-2 text-center text-[10px] uppercase tracking-[0.1em] text-gray-600">
                {formatDayLabel(message.timestamp)}
              </p>
            ) : null}
            <MessageBubble message={message} now={now} />
          </div>
        );
      })}
      <div ref={bottomRef} />
    </div>
  );
}

function EmptyState({ title }: { title: string }) {
  return (
    <div className="flex h-full flex-col items-center justify-center px-6 py-10 text-center">
      <span className="mb-3 flex h-12 w-12 items-center justify-center rounded-2xl border border-violet-400/20 bg-violet-500/10 text-violet-300">
        <svg
          className="h-6 w-6"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden
        >
          <path d="M5 6.5A2.5 2.5 0 0 1 7.5 4h9A2.5 2.5 0 0 1 19 6.5v6a2.5 2.5 0 0 1-2.5 2.5H10l-4 3v-3h1.5A2.5 2.5 0 0 1 5 12.5v-6Z" />
        </svg>
      </span>
      <p className="text-sm font-medium text-gray-200">{title}</p>
    </div>
  );
}

/** Lo que se manda al servidor: solo identificadores. El tipo, formato y periodo salen de las opciones del servidor. */
type ReportSelection = {
  reportType: ReportTypeId;
  format: ReportFormat;
  period: number;
  restaurantId?: number;
  groupId?: string;
};

const numberFormat = new Intl.NumberFormat("es-ES");

const selectClass =
  "w-full rounded-xl border border-white/[0.08] bg-[#0d0a14] px-3 py-2 text-[13px] text-white focus:border-violet-400/40 focus:outline-none disabled:opacity-50";

/**
 * Panel "📊 Informe de Nexo". No conoce ningún informe concreto: tipos, formatos,
 * periodos, restaurantes y redes llegan de `/api/conversations/report-options`
 * (catálogo del servidor), así que un informe nuevo aparece sin tocar este componente.
 */
function ReportPanel({
  sending,
  onCancel,
  onSend,
}: {
  sending: boolean;
  onCancel: () => void;
  onSend: (selection: ReportSelection) => void;
}) {
  const [options, setOptions] = useState<ReportOptions | null>(null);
  const [loadError, setLoadError] = useState(false);
  const [typeId, setTypeId] = useState("");
  const [subjectId, setSubjectId] = useState("");
  const [period, setPeriod] = useState("0");
  const [formatChoice, setFormatChoice] = useState("");

  useEffect(() => {
    let cancelled = false;
    fetchJson<ReportOptions>("/api/conversations/report-options")
      .then((data) => {
        if (!cancelled) setOptions(data);
      })
      .catch(() => {
        if (!cancelled) setLoadError(true);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  // El tipo elegido (o el primero disponible) decide sujeto, periodos y formatos.
  const type = options?.types.find((item) => item.id === typeId) ?? options?.types[0] ?? null;
  const format = type?.formats.find((item) => item.id === formatChoice)?.id ?? type?.formats[0]?.id ?? null;
  const periodOffset = type?.periods.some((item) => String(item.offset) === period) ? period : "0";

  const brands = useMemo(() => {
    const groups = new Map<string, ReportOptions["restaurants"]>();
    for (const restaurant of options?.restaurants ?? []) {
      groups.set(restaurant.brand, [...(groups.get(restaurant.brand) ?? []), restaurant]);
    }
    return [...groups];
  }, [options]);

  const ready = Boolean(type && format && subjectId !== "");

  function send() {
    if (!type || !format || subjectId === "") return;
    onSend({
      reportType: type.id,
      format,
      period: Number(periodOffset),
      ...(type.subject === "restaurant" ? { restaurantId: Number(subjectId) } : { groupId: subjectId }),
    });
  }

  return (
    <div className="mb-2 rounded-xl border border-white/[0.08] bg-white/[0.03] p-3">
      <p className="mb-2 text-[13px] font-medium text-white">📊 Informe de Nexo</p>

      {loadError ? (
        <p className="text-xs text-rose-300">No se pudieron cargar las opciones de informe.</p>
      ) : !options || !type ? (
        <p className="text-xs text-gray-500">Cargando…</p>
      ) : (
        <div className="grid gap-2 sm:grid-cols-3">
          <label className="block text-[11px] text-gray-500">
            Tipo de informe
            <select
              className={`${selectClass} mt-1`}
              value={type.id}
              disabled={sending}
              onChange={(event) => {
                setTypeId(event.target.value);
                // Sujeto y periodo dependen del tipo: se reinician.
                setSubjectId("");
                setPeriod("0");
                setFormatChoice("");
              }}
            >
              {options.types.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.label}
                </option>
              ))}
            </select>
          </label>

          {type.subject === "restaurant" ? (
            <label className="block text-[11px] text-gray-500">
              Restaurante
              <select
                className={`${selectClass} mt-1`}
                value={subjectId}
                disabled={sending}
                onChange={(event) => setSubjectId(event.target.value)}
              >
                <option value="">Selecciona…</option>
                {brands.map(([brand, restaurants]) => (
                  <optgroup key={brand} label={brand}>
                    {restaurants.map((restaurant) => (
                      <option key={restaurant.id} value={restaurant.id}>
                        {restaurant.name}
                      </option>
                    ))}
                  </optgroup>
                ))}
              </select>
            </label>
          ) : (
            <label className="block text-[11px] text-gray-500">
              Marca o red
              <select
                className={`${selectClass} mt-1`}
                value={subjectId}
                disabled={sending}
                onChange={(event) => setSubjectId(event.target.value)}
              >
                <option value="">Selecciona…</option>
                {options.groups.map((group) => (
                  <option key={group.id} value={group.id}>
                    {group.label}
                  </option>
                ))}
              </select>
            </label>
          )}

          <label className="block text-[11px] text-gray-500">
            Periodo
            <select
              className={`${selectClass} mt-1`}
              value={periodOffset}
              disabled={sending}
              onChange={(event) => setPeriod(event.target.value)}
            >
              {type.periods.map((item) => (
                <option key={item.offset} value={item.offset}>
                  {item.label}
                </option>
              ))}
            </select>
          </label>
        </div>
      )}

      {type ? (
        <fieldset className="mt-3 flex items-center gap-4" disabled={sending}>
          <legend className="sr-only">Formato</legend>
          <span className="text-[11px] text-gray-500">Formato</span>
          {type.formats.map((option) => (
            <label key={option.id} className="flex items-center gap-1.5 text-[13px] text-gray-200">
              <input
                type="radio"
                name="report-format"
                value={option.id}
                checked={format === option.id}
                onChange={() => setFormatChoice(option.id)}
                className="accent-violet-500"
              />
              {option.label}
            </label>
          ))}
        </fieldset>
      ) : null}

      <div className="mt-3 flex items-center justify-end gap-2">
        <button
          type="button"
          onClick={onCancel}
          disabled={sending}
          className="rounded-xl px-3 py-2 text-[13px] text-gray-400 transition hover:text-white disabled:opacity-40"
        >
          Cancelar
        </button>
        <button
          type="button"
          disabled={sending || !ready}
          onClick={send}
          className="rounded-xl border border-violet-400/30 bg-violet-500/25 px-4 py-2 text-[13px] font-medium text-white transition hover:bg-violet-500/35 disabled:cursor-not-allowed disabled:border-white/[0.06] disabled:bg-white/[0.03] disabled:text-gray-600"
        >
          {sending ? "Enviando…" : "Enviar por WhatsApp"}
        </button>
      </div>
    </div>
  );
}

function Composer({
  conversationId,
  onSent,
}: {
  conversationId: string;
  onSent: (messages: ConversationMessage[]) => void;
}) {
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [reportOpen, setReportOpen] = useState(false);
  // Mismo id mientras se reintenta la MISMA operación; el servidor no reenvía lo ya enviado.
  const requestIdRef = useRef<string | null>(null);
  const reportRequestRef = useRef<{ key: string; requestId: string } | null>(null);
  const sendingRef = useRef(false);

  function updateDraft(value: string) {
    setDraft(value);
    // Texto distinto = mensaje distinto = petición nueva.
    requestIdRef.current = null;
  }

  /** Envía una operación; devuelve true si el servidor la completó. */
  async function post(url: string, init: RequestInit): Promise<boolean> {
    if (sendingRef.current) return false;
    sendingRef.current = true;
    setSending(true);
    setError(null);

    try {
      const response = await fetch(url, init);
      const data = (await response.json().catch(() => null)) as {
        messages?: ConversationMessage[];
        error?: string;
      } | null;

      // Aunque falle, algunos mensajes de la operación pueden haberse enviado.
      if (data?.messages?.length) onSent(data.messages);
      if (response.ok) return true;

      setError(data?.error ?? "No se pudo enviar el mensaje");
      return false;
    } catch {
      setError("No se pudo conectar. Comprueba la conversación antes de reenviar.");
      return false;
    } finally {
      sendingRef.current = false;
      setSending(false);
    }
  }

  async function submitText() {
    if (sendingRef.current || !canSubmitDraft(draft, false)) return;
    requestIdRef.current ??= crypto.randomUUID();

    const ok = await post(`/api/conversations/${conversationId}/messages`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text: draft, requestId: requestIdRef.current }),
    });
    if (ok) {
      requestIdRef.current = null;
      setDraft("");
    }
  }

  async function submitReport(selection: ReportSelection) {
    // La misma selección reutiliza el requestId (doble clic o reintento no duplican).
    const key = JSON.stringify(selection);
    if (reportRequestRef.current?.key !== key) {
      reportRequestRef.current = { key, requestId: crypto.randomUUID() };
    }

    const ok = await post(`/api/conversations/${conversationId}/reports`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...selection, requestId: reportRequestRef.current.requestId }),
    });
    if (ok) {
      reportRequestRef.current = null;
      setReportOpen(false);
    }
  }

  const length = textLength(draft.trim());
  const parts = countMessageParts(draft);
  const showCounter = length > WHATSAPP_TEXT_MAX_CHARS * 0.8;

  return (
    <div className="border-t border-white/[0.07] p-3">
      {error ? (
        <p role="alert" className="mb-2 px-1 text-xs text-rose-300">
          {error}
        </p>
      ) : null}

      {reportOpen ? (
        <ReportPanel
          sending={sending}
          onCancel={() => {
            setReportOpen(false);
            setError(null);
          }}
          onSend={(selection) => void submitReport(selection)}
        />
      ) : null}

      <form
        className="flex items-end gap-2"
        onSubmit={(event) => {
          event.preventDefault();
          void submitText();
        }}
      >
        <div className="relative">
          <button
            type="button"
            onClick={() => setMenuOpen((open) => !open)}
            disabled={sending}
            aria-label="Adjuntar"
            aria-expanded={menuOpen}
            className="flex h-[42px] w-[42px] items-center justify-center rounded-xl border border-white/[0.08] bg-white/[0.04] text-gray-400 transition hover:text-white disabled:cursor-not-allowed disabled:opacity-40"
          >
            <svg
              className="h-[18px] w-[18px]"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.6"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden
            >
              <path d="m20 11-8.2 8.2a5 5 0 0 1-7-7l8.5-8.5a3.4 3.4 0 0 1 4.8 4.8l-8.5 8.5a1.8 1.8 0 0 1-2.5-2.5L15 6.5" />
            </svg>
          </button>
          {menuOpen ? (
            <div className="absolute bottom-12 left-0 z-10 w-52 overflow-hidden rounded-xl border border-white/[0.1] bg-[#0d0a14] py-1 shadow-xl">
              <button
                type="button"
                onClick={() => {
                  setMenuOpen(false);
                  setError(null);
                  setReportOpen(true);
                }}
                className="block w-full px-3.5 py-2 text-left text-[13px] text-gray-200 hover:bg-white/[0.06]"
              >
                📊 Informe de Nexo
              </button>
            </div>
          ) : null}
        </div>

        <textarea
          value={draft}
          onChange={(event) => updateDraft(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing) {
              event.preventDefault();
              void submitText();
            }
          }}
          rows={1}
          placeholder="Escribe un mensaje"
          aria-label="Mensaje"
          className="max-h-32 min-h-[42px] flex-1 resize-none rounded-xl border border-white/[0.08] bg-white/[0.04] px-3.5 py-2.5 text-[13px] text-white placeholder:text-gray-600 focus:border-violet-400/40 focus:outline-none"
        />
        <button
          type="submit"
          disabled={!canSubmitDraft(draft, sending)}
          className="h-[42px] shrink-0 rounded-xl border border-violet-400/30 bg-violet-500/25 px-4 text-[13px] font-medium text-white transition hover:bg-violet-500/35 disabled:cursor-not-allowed disabled:border-white/[0.06] disabled:bg-white/[0.03] disabled:text-gray-600"
        >
          {sending ? "Enviando…" : "Enviar"}
        </button>
      </form>

      {showCounter || parts > 1 ? (
        <p
          className={`mt-1.5 px-1 text-right text-[11px] ${length > MAX_OUTBOUND_TEXT_CHARS ? "text-rose-300" : "text-gray-500"}`}
        >
          {parts > 1 ? `Se enviará en ${parts} mensajes · ` : ""}
          {numberFormat.format(length)} / {numberFormat.format(MAX_OUTBOUND_TEXT_CHARS)}
        </p>
      ) : null}
    </div>
  );
}

type ContactAccess = {
  displayName: string;
  phone: string;
  linkedUser: { id: string; nombre: string; rol: string; empresaNombre: string | null } | null;
  access: { count: number; restaurants: { id: number; name: string; brand: string; city: string }[] };
};

type LinkableUser = { id: string; nombre: string; rol: string; empresaNombre: string | null; linkedElsewhere: boolean };

const ACCESS_ROLE_LABELS: Record<string, string> = {
  super_admin: "Super administrador",
  empresa_admin: "Administrador de empresa",
  marca_admin: "Administrador de marca",
  restaurante_user: "Supervisor / restaurante",
};

/**
 * Persona de Nexo vinculada al contacto y su acceso efectivo. Solo vincula y
 * muestra: los restaurantes NO se editan aquí, sino en "Usuarios y permisos".
 */
function ContactAccessPanel({ conversationId }: { conversationId: string }) {
  const [contact, setContact] = useState<ContactAccess | null>(null);
  const [users, setUsers] = useState<LinkableUser[] | null>(null);
  const [choice, setChoice] = useState("");
  const [changing, setChanging] = useState(false);
  const [showRestaurants, setShowRestaurants] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetchJson<ContactAccess>(`/api/conversations/${conversationId}/contact`)
      .then((data) => {
        if (!cancelled) setContact(data);
      })
      .catch(() => {
        if (!cancelled) setError("No se pudo cargar el acceso del contacto.");
      });
    return () => {
      cancelled = true;
    };
  }, [conversationId]);

  async function startChange() {
    setChanging(true);
    setError(null);
    try {
      const data = await fetchJson<{ users: LinkableUser[] }>(`/api/conversations/${conversationId}/linkable-users`);
      setUsers(data.users);
    } catch {
      setError("No se pudieron cargar los usuarios.");
    }
  }

  async function link(usuarioId: string | null) {
    setBusy(true);
    setError(null);
    try {
      const response = await fetch(`/api/conversations/${conversationId}/contact`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ usuarioId }),
      });
      const data = (await response.json().catch(() => null)) as (ContactAccess & { error?: string }) | null;
      if (!response.ok || !data) {
        setError(data?.error ?? "No se pudo guardar el vínculo");
        return;
      }
      setContact(data);
      setChanging(false);
      setChoice("");
      setShowRestaurants(false);
    } catch {
      setError("No se pudo guardar el vínculo");
    } finally {
      setBusy(false);
    }
  }

  if (!contact) {
    return <div className="border-b border-white/[0.07] px-4 py-3 text-xs text-gray-500">{error ?? "Cargando…"}</div>;
  }

  const linked = contact.linkedUser;
  const picking = changing || !linked;

  return (
    <div className="space-y-2 border-b border-white/[0.07] bg-white/[0.02] px-4 py-3 text-[13px]">
      <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-gray-500">Usuario Nexo vinculado</p>

      {linked ? (
        <div className="space-y-1">
          <p className="font-medium text-white">{linked.nombre}</p>
          <p className="text-xs text-gray-400">
            {ACCESS_ROLE_LABELS[linked.rol] ?? linked.rol}
            {linked.empresaNombre ? ` · ${linked.empresaNombre}` : ""}
          </p>
          <p className="text-xs text-gray-400">
            Acceso efectivo hoy: <span className="font-medium text-gray-200">{contact.access.count} restaurantes</span>
          </p>
        </div>
      ) : (
        <p className="text-xs text-amber-200">
          Sin usuario vinculado: este contacto puede escribir, pero no puede consultar datos ni recibir informes.
        </p>
      )}

      {picking ? (
        <div className="flex flex-wrap items-center gap-2">
          <select
            value={choice}
            onChange={(event) => setChoice(event.target.value)}
            onFocus={() => {
              if (!users) void startChange();
            }}
            disabled={busy}
            aria-label="Usuario de Nexo"
            className="min-w-[220px] rounded-xl border border-white/[0.08] bg-[#0d0a14] px-3 py-2 text-[13px] text-white"
          >
            <option value="">Elige un usuario…</option>
            {(users ?? []).map((user) => (
              <option key={user.id} value={user.id} disabled={user.linkedElsewhere}>
                {user.nombre} · {ACCESS_ROLE_LABELS[user.rol] ?? user.rol}
                {user.linkedElsewhere ? " (ya vinculado a otro teléfono)" : ""}
              </option>
            ))}
          </select>
          <button
            type="button"
            disabled={busy || choice === ""}
            onClick={() => void link(choice)}
            className="rounded-xl border border-violet-400/30 bg-violet-500/25 px-3.5 py-2 text-[13px] font-medium text-white transition hover:bg-violet-500/35 disabled:cursor-not-allowed disabled:opacity-40"
          >
            Vincular
          </button>
          {linked ? (
            <button type="button" onClick={() => setChanging(false)} className="text-xs text-gray-400 hover:text-white">
              Cancelar
            </button>
          ) : null}
        </div>
      ) : (
        <div className="flex flex-wrap items-center gap-3 text-xs">
          <button type="button" onClick={() => setShowRestaurants((open) => !open)} className="text-violet-300 hover:text-violet-200">
            {showRestaurants ? "Ocultar restaurantes" : "Ver restaurantes"}
          </button>
          <a href={`/dashboard/usuarios?user=${linked!.id}`} className="text-violet-300 hover:text-violet-200">
            Gestionar permisos
          </a>
          <button type="button" onClick={() => void startChange()} disabled={busy} className="text-gray-400 hover:text-white">
            Cambiar usuario
          </button>
          <button type="button" onClick={() => void link(null)} disabled={busy} className="text-gray-400 hover:text-rose-300">
            Desvincular
          </button>
        </div>
      )}

      {showRestaurants && linked ? (
        <ul className="max-h-40 space-y-0.5 overflow-y-auto rounded-xl border border-white/[0.06] p-2 text-xs text-gray-300">
          {contact.access.restaurants.length === 0 ? <li className="text-gray-500">Ningún restaurante.</li> : null}
          {contact.access.restaurants.map((restaurant) => (
            <li key={restaurant.id}>
              {restaurant.name} <span className="text-gray-600">{restaurant.brand}</span>
            </li>
          ))}
        </ul>
      ) : null}

      {error ? (
        <p role="alert" className="text-xs text-rose-300">
          {error}
        </p>
      ) : null}
    </div>
  );
}

type NewContactUser = { id: string; nombre: string; rol: string; empresaNombre: string | null; linkedElsewhere: boolean };

type NewContactResult = { existing: boolean; conversationId: string | null; linked: boolean };

/**
 * Alta manual de un contacto de WhatsApp. Solo vincula teléfono ↔ persona de Nexo:
 * los restaurantes NO se eligen aquí, salen de los permisos de esa persona.
 */
function NewContactForm({
  onClose,
  onCreated,
}: {
  onClose: () => void;
  /** Se llama tras crear o reutilizar el contacto; abre su conversación si existe. */
  onCreated: (conversationId: string | null) => void;
}) {
  const [nombre, setNombre] = useState("");
  const [prefijo, setPrefijo] = useState("+34");
  const [telefono, setTelefono] = useState("");
  const [usuarioId, setUsuarioId] = useState("");
  const [users, setUsers] = useState<NewContactUser[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<NewContactResult | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetchJson<{ users: NewContactUser[] }>("/api/conversations/contacts")
      .then((data) => {
        if (!cancelled) setUsers(data.users);
      })
      .catch(() => {
        if (!cancelled) setError("No se pudieron cargar los usuarios de Nexo.");
      });
    return () => {
      cancelled = true;
    };
  }, []);

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
          usuarioId: usuarioId === "" ? null : usuarioId,
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

  const fieldClass =
    "w-full rounded-xl border border-white/[0.08] bg-[#0d0a14] px-3 py-2 text-[13px] text-white placeholder:text-gray-600 focus:border-violet-400/40 focus:outline-none";

  return (
    <div className="space-y-2 border-b border-white/[0.07] bg-white/[0.02] p-3">
      <div className="flex items-center justify-between">
        <p className="text-[13px] font-medium text-white">Nuevo contacto</p>
        <button type="button" onClick={onClose} className="text-xs text-gray-400 hover:text-white">
          Cerrar
        </button>
      </div>

      {result ? (
        <div className="space-y-2 rounded-xl border border-amber-400/20 bg-amber-400/[0.06] p-3">
          <p className="text-[13px] font-medium text-amber-200">Este número ya existe.</p>
          <p className="text-xs text-gray-400">
            {result.linked
              ? "Ya está vinculado a un usuario de Nexo."
              : "Todavía no está vinculado a ningún usuario: no tiene acceso a datos."}{" "}
            No se ha cambiado su nombre ni su vínculo.
          </p>
          <div className="flex gap-3">
            {result.conversationId ? (
              <button
                type="button"
                onClick={() => {
                  onCreated(result.conversationId);
                  onClose();
                }}
                className="rounded-xl border border-violet-400/30 bg-violet-500/25 px-3.5 py-2 text-[13px] font-medium text-white transition hover:bg-violet-500/35"
              >
                Abrir conversación
              </button>
            ) : null}
            <button type="button" onClick={onClose} className="text-xs text-gray-400 hover:text-white">
              Cerrar
            </button>
          </div>
        </div>
      ) : (
        <form
          className="space-y-2"
          onSubmit={(event) => {
            event.preventDefault();
            void submit();
          }}
        >
          <input
            value={nombre}
            onChange={(event) => setNombre(event.target.value)}
            placeholder="Nombre"
            aria-label="Nombre"
            maxLength={100}
            className={fieldClass}
          />
          <div className="flex gap-2">
            <input
              value={prefijo}
              onChange={(event) => setPrefijo(event.target.value)}
              aria-label="Prefijo del país"
              inputMode="tel"
              className={`${fieldClass} w-[72px] shrink-0`}
            />
            <input
              value={telefono}
              onChange={(event) => setTelefono(event.target.value)}
              placeholder="Teléfono"
              aria-label="Teléfono"
              inputMode="tel"
              className={fieldClass}
            />
          </div>
          <select
            value={usuarioId}
            onChange={(event) => setUsuarioId(event.target.value)}
            aria-label="Usuario Nexo vinculado (opcional)"
            className={fieldClass}
          >
            <option value="">Usuario Nexo vinculado (opcional)</option>
            {(users ?? []).map((user) => (
              <option key={user.id} value={user.id} disabled={user.linkedElsewhere}>
                {user.nombre} · {ACCESS_ROLE_LABELS[user.rol] ?? user.rol}
                {user.linkedElsewhere ? " (ya vinculado a otro teléfono)" : ""}
              </option>
            ))}
          </select>
          <p className="text-[11px] text-gray-500">
            Sin usuario vinculado, el contacto puede escribir pero no tiene acceso a datos. Los restaurantes se gestionan en
            Usuarios y permisos.
          </p>
          {error ? (
            <p role="alert" className="text-xs text-rose-300">
              {error}
            </p>
          ) : null}
          <button
            type="submit"
            disabled={busy || telefono.trim() === ""}
            className="w-full rounded-xl border border-violet-400/30 bg-violet-500/25 px-3.5 py-2 text-[13px] font-medium text-white transition hover:bg-violet-500/35 disabled:cursor-not-allowed disabled:opacity-40"
          >
            {busy ? "Creando…" : "Crear contacto"}
          </button>
        </form>
      )}
    </div>
  );
}

export function ConversationsView() {
  const [conversations, setConversations] = useState<ConversationListItem[] | null>(null);
  const [listError, setListError] = useState(false);
  const [query, setQuery] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [messages, setMessages] = useState<ConversationMessage[] | null>(null);
  const [messagesError, setMessagesError] = useState(false);
  const selectedRef = useRef<string | null>(null);
  const [accessOpenFor, setAccessOpenFor] = useState<string | null>(null);
  const [newContactOpen, setNewContactOpen] = useState(false);

  const loadList = useCallback(async () => {
    try {
      const data = await fetchJson<{ conversations: ConversationListItem[] }>("/api/conversations");
      setConversations(data.conversations);
      setListError(false);
    } catch {
      setListError(true);
    }
  }, []);

  const loadMessages = useCallback(async (id: string) => {
    try {
      const data = await fetchJson<{ messages: ConversationMessage[] }>(
        `/api/conversations/${id}/messages`
      );
      // Ignora respuestas de una conversación que ya no está seleccionada.
      if (selectedRef.current !== id) return;
      setMessages(data.messages);
      setMessagesError(false);
    } catch {
      if (selectedRef.current === id) setMessagesError(true);
    }
  }, []);

  useEffect(() => {
    void loadList();
  }, [loadList]);

  useSoftPolling(() => void loadList(), LIST_POLL_MS, true);
  useSoftPolling(
    () => {
      if (selectedId) void loadMessages(selectedId);
    },
    MESSAGES_POLL_MS,
    selectedId !== null
  );

  function select(id: string) {
    selectedRef.current = id;
    setSelectedId(id);
    setMessages(null);
    setMessagesError(false);
    void loadMessages(id);
  }

  function back() {
    selectedRef.current = null;
    setSelectedId(null);
    setMessages(null);
  }

  const visible = useMemo(
    () => (conversations ? filterConversations(conversations, query) : []),
    [conversations, query]
  );
  const selected = conversations?.find((item) => item.id === selectedId) ?? null;

  return (
    <div className="space-y-4">
      <header>
        <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[var(--nexo-text-tertiary)]">
          Nexo Conversations
        </p>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight text-white">Conversaciones</h1>
      </header>

      <div className="flex h-[calc(100vh-14rem)] min-h-[460px] overflow-hidden rounded-3xl border border-white/[0.08] bg-white/[0.025] lg:h-[calc(100vh-11rem)]">
        {/* Lista */}
        <aside
          className={`${selected ? "hidden md:flex" : "flex"} w-full shrink-0 flex-col border-r border-white/[0.07] md:w-[340px]`}
        >
          <div className="border-b border-white/[0.07] p-3">
            <button
              type="button"
              onClick={() => setNewContactOpen((open) => !open)}
              aria-expanded={newContactOpen}
              className="mb-2 w-full rounded-xl border border-violet-400/25 bg-violet-500/10 px-3.5 py-2 text-[13px] font-medium text-violet-200 transition hover:bg-violet-500/20"
            >
              + Nuevo contacto
            </button>
            <input
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Buscar por nombre o teléfono"
              aria-label="Buscar conversaciones"
              className="w-full rounded-xl border border-white/[0.08] bg-white/[0.04] px-3.5 py-2 text-[13px] text-white placeholder:text-gray-600 focus:border-violet-400/40 focus:outline-none"
            />
          </div>

          {newContactOpen ? (
            <NewContactForm
              onClose={() => setNewContactOpen(false)}
              onCreated={(conversationId) => {
                void loadList();
                if (conversationId) select(conversationId);
              }}
            />
          ) : null}

          <div className="min-h-0 flex-1 overflow-y-auto">
            {conversations === null ? (
              <p className="px-4 py-6 text-center text-xs text-gray-500">
                {listError ? "No se pudieron cargar las conversaciones." : "Cargando…"}
              </p>
            ) : conversations.length === 0 ? (
              <EmptyState title="No hay conversaciones todavía." />
            ) : visible.length === 0 ? (
              <p className="px-4 py-6 text-center text-xs text-gray-500">
                Ninguna conversación coincide con la búsqueda.
              </p>
            ) : (
              <ul>
                {visible.map((item) => (
                  <ConversationRow
                    key={item.id}
                    item={item}
                    active={item.id === selectedId}
                    onSelect={() => select(item.id)}
                  />
                ))}
              </ul>
            )}
          </div>
        </aside>

        {/* Chat */}
        <section className={`${selected ? "flex" : "hidden md:flex"} min-w-0 flex-1 flex-col`}>
          {selected ? (
            <>
              <div className="flex items-center gap-3 border-b border-white/[0.07] px-4 py-3">
                <button
                  type="button"
                  onClick={back}
                  aria-label="Volver a la lista"
                  className="rounded-lg p-1.5 text-gray-400 transition hover:bg-white/[0.06] hover:text-white md:hidden"
                >
                  <svg
                    className="h-5 w-5"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.75"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    aria-hidden
                  >
                    <path d="m15 6-6 6 6 6" />
                  </svg>
                </button>
                <Avatar name={selected.displayName} size="lg" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-white">{selected.displayName}</p>
                  <p className="truncate text-xs text-gray-500">{selected.phone}</p>
                </div>
                <button
                  type="button"
                  onClick={() => setAccessOpenFor((current) => (current === selected.id ? null : selected.id))}
                  aria-expanded={accessOpenFor === selected.id}
                  className="shrink-0 rounded-full border border-white/[0.08] px-2.5 py-1 text-[10px] font-medium text-gray-300 transition hover:bg-white/[0.06] hover:text-white"
                >
                  Acceso
                </button>
                <span
                  className={`shrink-0 rounded-full border px-2.5 py-1 text-[10px] font-medium ${
                    selected.status === "open"
                      ? "border-emerald-400/20 bg-emerald-400/10 text-emerald-200"
                      : "border-white/[0.08] bg-white/[0.03] text-gray-400"
                  }`}
                >
                  {STATUS_LABEL[selected.status]}
                </span>
              </div>

              {accessOpenFor === selected.id ? <ContactAccessPanel key={selected.id} conversationId={selected.id} /> : null}

              <div className="flex min-h-0 flex-1 flex-col">
                {messages === null ? (
                  <p className="m-auto text-xs text-gray-500">
                    {messagesError ? "No se pudieron cargar los mensajes." : "Cargando…"}
                  </p>
                ) : messages.length === 0 ? (
                  <EmptyState title="Esta conversación no tiene mensajes." />
                ) : (
                  <MessageThread key={selected.id} messages={messages} />
                )}
              </div>

              <Composer
                key={selected.id}
                conversationId={selected.id}
                onSent={(sent) => {
                  setMessages((current) => {
                    if (!current) return current;
                    const known = new Set(current.map((m) => m.id));
                    const fresh = sent.filter((m) => !known.has(m.id));
                    return fresh.length > 0 ? [...current, ...fresh] : current;
                  });
                  void loadList();
                }}
              />
            </>
          ) : (
            <EmptyState title="Selecciona una conversación" />
          )}
        </section>
      </div>
    </div>
  );
}
