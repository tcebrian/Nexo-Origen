"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { canSubmitDraft } from "@/lib/conversations/compose";
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

/** Solo se avisa de los estados que requieren atención del usuario. */
const OUTBOUND_STATE_LABEL: Record<string, string> = {
  pending: "Sin confirmar",
  failed: "No enviado",
};

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
        </span>
      </button>
    </li>
  );
}

function MessageBubble({ message }: { message: ConversationMessage }) {
  const outbound = message.direction === "outbound";
  const isText = message.contentType === "text";

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
        <p className="mt-1 text-right text-[10px] text-gray-500">
          {outbound && OUTBOUND_STATE_LABEL[message.status] ? (
            <span
              className={message.status === "failed" ? "mr-1.5 text-rose-300" : "mr-1.5 text-amber-200"}
            >
              {OUTBOUND_STATE_LABEL[message.status]} ·
            </span>
          ) : null}
          {formatMessageTime(message.timestamp)}
        </p>
      </div>
    </div>
  );
}

function MessageThread({ messages }: { messages: ConversationMessage[] }) {
  const bottomRef = useRef<HTMLDivElement>(null);
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
            <MessageBubble message={message} />
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

function Composer({
  conversationId,
  onSent,
}: {
  conversationId: string;
  onSent: (message: ConversationMessage) => void;
}) {
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Mismo id mientras se reintenta el mismo mensaje; el servidor no reenvía si ya existe.
  const requestIdRef = useRef<string | null>(null);
  const sendingRef = useRef(false);

  function updateDraft(value: string) {
    setDraft(value);
    // Texto distinto = mensaje distinto = petición nueva.
    requestIdRef.current = null;
  }

  async function submit() {
    if (sendingRef.current || !canSubmitDraft(draft, false)) return;
    sendingRef.current = true;
    setSending(true);
    setError(null);
    requestIdRef.current ??= crypto.randomUUID();

    try {
      const response = await fetch(`/api/conversations/${conversationId}/messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: draft, requestId: requestIdRef.current }),
      });
      const data = (await response.json().catch(() => null)) as {
        message?: ConversationMessage;
        error?: string;
      } | null;

      if (response.ok && data?.message) {
        requestIdRef.current = null;
        setDraft("");
        onSent(data.message);
      } else {
        setError(data?.error ?? "No se pudo enviar el mensaje");
      }
    } catch {
      setError("No se pudo conectar. Comprueba la conversación antes de reenviar.");
    } finally {
      sendingRef.current = false;
      setSending(false);
    }
  }

  return (
    <div className="border-t border-white/[0.07] p-3">
      {error ? (
        <p role="alert" className="mb-2 px-1 text-xs text-rose-300">
          {error}
        </p>
      ) : null}
      <form
        className="flex items-end gap-2"
        onSubmit={(event) => {
          event.preventDefault();
          void submit();
        }}
      >
        <textarea
          value={draft}
          onChange={(event) => updateDraft(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing) {
              event.preventDefault();
              void submit();
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
            <input
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Buscar por nombre o teléfono"
              aria-label="Buscar conversaciones"
              className="w-full rounded-xl border border-white/[0.08] bg-white/[0.04] px-3.5 py-2 text-[13px] text-white placeholder:text-gray-600 focus:border-violet-400/40 focus:outline-none"
            />
          </div>

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
                onSent={(message) => {
                  setMessages((current) =>
                    current && !current.some((m) => m.id === message.id)
                      ? [...current, message]
                      : current
                  );
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
