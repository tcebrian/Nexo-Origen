"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { glass } from "../_components/styles";
import { IconSparkle } from "./_components/ui/icons";
import {
  AI_ANALYSIS_STEPS,
  answerReviewQuestion,
  generatePeriodInsights,
  getChatPresets,
  type AiChatMessage,
} from "@/lib/reviews/ai-engine";
import { formatDeltaPoints } from "@/lib/reviews/impact-display";
import type { Review, ReviewPriority, ReviewSentiment } from "@/lib/reviews/types";

function StarRating({ rating }: { rating: number }) {
  return (
    <div className="flex items-center gap-px">
      {[1, 2, 3, 4, 5].map((star) => (
        <svg
          key={star}
          className={`h-3.5 w-3.5 ${star <= rating ? "text-amber-400" : "text-white/10"}`}
          viewBox="0 0 24 24"
          fill="currentColor"
        >
          <path d="M12 2l2.09 6.26L20.5 9.27l-5 3.64L16.82 20 12 16.77 7.18 20l1.32-7.09-5-3.64 6.41-.99L12 2z" />
        </svg>
      ))}
    </div>
  );
}

function SentimentBadge({ sentiment }: { sentiment: Review["sentiment"] }) {
  const styles = {
    positiva: "border-emerald-400/25 bg-emerald-500/10 text-emerald-300",
    negativa: "border-red-400/25 bg-red-500/10 text-red-300",
    neutral: "border-amber-400/25 bg-amber-500/10 text-amber-300",
  };
  const labels = { positiva: "Positiva", negativa: "Negativa", neutral: "Neutral" };
  return (
    <span className={`rounded-lg border px-2.5 py-1 text-[11px] font-medium ${styles[sentiment]}`}>
      {labels[sentiment]}
    </span>
  );
}

function AiLoadingState({ step }: { step: number }) {
  return (
    <div className="rounded-2xl border border-violet-400/15 bg-violet-500/[0.06] p-6">
      <div className="mb-5 flex items-center gap-3">
        <span className="relative flex h-10 w-10 items-center justify-center rounded-xl border border-violet-400/25 bg-violet-500/15">
          <span className="absolute h-full w-full animate-ping rounded-xl bg-violet-500/20" />
          <IconSparkle className="h-4 w-4 text-violet-200" />
        </span>
        <div>
          <p className="text-sm font-medium text-violet-100">NEXO IA analizando</p>
          <p className="text-[11px] text-gray-500">Procesando reseña en tiempo real</p>
        </div>
      </div>
      <div className="space-y-3">
        {AI_ANALYSIS_STEPS.map((label, index) => {
          const done = index < step;
          const active = index === step;
          return (
            <div key={label} className="flex items-center gap-3 text-[12px]">
              <span
                className={`flex h-5 w-5 items-center justify-center rounded-full border text-[10px] ${
                  done
                    ? "border-emerald-400/30 bg-emerald-500/15 text-emerald-300"
                    : active
                      ? "border-violet-400/30 bg-violet-500/15 text-violet-200"
                      : "border-white/[0.08] text-gray-600"
                }`}
              >
                {done ? "✓" : index + 1}
              </span>
              <span className={active ? "text-violet-100" : done ? "text-gray-400" : "text-gray-600"}>{label}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function motiveTagClass(sentiment: ReviewSentiment) {
  if (sentiment === "positiva") return "border-emerald-400/20 bg-emerald-500/10 text-emerald-200";
  if (sentiment === "neutral") return "border-amber-400/20 bg-amber-500/10 text-amber-200";
  return "border-red-400/20 bg-red-500/10 text-red-200";
}

function priorityClass(priority: ReviewPriority, sentiment: ReviewSentiment) {
  if (priority === "Alta" || sentiment === "negativa") {
    return {
      box: "border-red-400/15 bg-red-500/[0.06]",
      badge: "border-red-400/30 bg-red-500/15 text-red-200",
    };
  }
  if (priority === "Media") {
    return {
      box: "border-amber-400/15 bg-amber-500/[0.06]",
      badge: "border-amber-400/30 bg-amber-500/15 text-amber-200",
    };
  }
  return {
    box: "border-emerald-400/15 bg-emerald-500/[0.06]",
    badge: "border-emerald-400/30 bg-emerald-500/15 text-emerald-200",
  };
}

function ReviewAiChat({ review, analysis }: { review: Review; analysis: Review["ai"] }) {
  const [messages, setMessages] = useState<AiChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [typing, setTyping] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setMessages([
      {
        role: "assistant",
        content: `He analizado la reseña de ${review.author}. Puedes preguntarme sobre urgencia, impacto, causa raíz o la respuesta sugerida.`,
      },
    ]);
    setInput("");
    setTyping(false);
  }, [review.id, review.author]);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, typing]);

  async function sendQuestion(question: string) {
    if (!question.trim() || typing) return;
    setMessages((prev) => [...prev, { role: "user", content: question }]);
    setInput("");
    setTyping(true);
    await new Promise((r) => setTimeout(r, 650));
    const answer = answerReviewQuestion(review, question, analysis);
    setMessages((prev) => [...prev, { role: "assistant", content: answer }]);
    setTyping(false);
  }

  return (
    <div className="overflow-hidden rounded-2xl border border-white/[0.06] bg-black/20">
      <div className="border-b border-white/[0.06] px-4 py-3">
        <p className="text-[10px] font-semibold uppercase tracking-[0.1em] text-gray-600">Asistente IA</p>
        <p className="mt-0.5 text-[12px] text-gray-400">Pregunta sobre esta reseña</p>
      </div>

      <div className="max-h-44 space-y-3 overflow-y-auto px-4 py-4">
        {messages.map((msg, i) => (
          <div key={i} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
            <div
              className={`max-w-[90%] rounded-xl px-3 py-2 text-[12px] leading-relaxed ${
                msg.role === "user"
                  ? "border border-violet-400/20 bg-violet-500/15 text-violet-100"
                  : "border border-white/[0.06] bg-white/[0.03] text-gray-300"
              }`}
            >
              {msg.content}
            </div>
          </div>
        ))}
        {typing && (
          <div className="flex items-center gap-1.5 text-[11px] text-gray-500">
            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-violet-400" />
            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-violet-400 [animation-delay:150ms]" />
            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-violet-400 [animation-delay:300ms]" />
            NEXO IA escribiendo…
          </div>
        )}
        <div ref={endRef} />
      </div>

      <div className="flex flex-wrap gap-2 border-t border-white/[0.06] px-4 py-3">
        {getChatPresets().map((preset) => (
          <button
            key={preset.id}
            type="button"
            onClick={() => sendQuestion(preset.prompt)}
            className="rounded-lg border border-white/[0.08] bg-white/[0.02] px-2.5 py-1 text-[10px] text-gray-400 transition hover:border-violet-400/20 hover:text-violet-200"
          >
            {preset.label}
          </button>
        ))}
      </div>

      <form
        className="flex gap-2 border-t border-white/[0.06] p-3"
        onSubmit={(e) => {
          e.preventDefault();
          sendQuestion(input);
        }}
      >
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Escribe tu pregunta…"
          className="flex-1 rounded-xl border border-white/[0.08] bg-black/25 px-3 py-2 text-[12px] text-gray-200 outline-none focus:border-violet-400/25"
        />
        <button
          type="submit"
          className="rounded-xl border border-violet-400/25 bg-violet-500/15 px-3 py-2 text-[11px] text-violet-100 transition hover:bg-violet-500/25"
        >
          Enviar
        </button>
      </form>
    </div>
  );
}

export function PeriodAiInsights({
  reviews,
  onAnalyzePending,
  pendingCount,
  analyzing,
}: {
  reviews: Review[];
  onAnalyzePending: () => void;
  pendingCount: number;
  analyzing: boolean;
}) {
  const insight = generatePeriodInsights(reviews);

  return (
    <section className={`mb-5 overflow-hidden ${glass}`}>
      <div className="flex flex-col gap-4 border-b border-violet-400/10 bg-[linear-gradient(135deg,rgba(124,58,237,0.12),transparent)] px-5 py-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex items-start gap-3">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-violet-400/25 bg-violet-500/15 text-violet-200">
            <IconSparkle className="h-5 w-5" />
          </span>
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-violet-300/80">NEXO IA · Periodo</p>
              <span className="rounded-full border border-violet-400/20 bg-violet-500/10 px-2 py-0.5 text-[10px] text-violet-200">
                {insight.analyzedPct}% analizado
              </span>
            </div>
            <h3 className="mt-1 text-[15px] font-medium text-white">{insight.headline}</h3>
            <p className="mt-2 max-w-3xl text-[12px] leading-relaxed text-gray-400">{insight.narrative}</p>
          </div>
        </div>

        {pendingCount > 0 && (
          <button
            type="button"
            onClick={onAnalyzePending}
            disabled={analyzing}
            className="shrink-0 rounded-xl border border-violet-400/30 bg-violet-500/15 px-4 py-2.5 text-xs font-medium text-violet-100 transition hover:bg-violet-500/25 disabled:opacity-50"
          >
            {analyzing ? "Analizando…" : `Analizar ${pendingCount} pendientes`}
          </button>
        )}
      </div>

      {insight.topMotives.length > 0 ? (
        <div className="grid gap-4 px-5 py-4 sm:grid-cols-2 lg:grid-cols-4">
          {insight.topMotives.map((motive) => {
            const total = insight.topMotives.reduce((sum, item) => sum + item.count, 0);
            const pct = total > 0 ? Math.round((motive.count / total) * 100) : 0;
            return (
            <div key={motive.label} className="rounded-xl border border-white/[0.06] bg-black/20 px-4 py-3">
              <p className="text-[10px] uppercase tracking-[0.08em] text-gray-600">{motive.label}</p>
              <p className="mt-1 font-mono text-xl font-light text-white">{pct}%</p>
              <div className="mt-2 h-1 overflow-hidden rounded-full bg-white/[0.06]">
                <div className="h-full rounded-full bg-violet-500/70" style={{ width: `${pct}%` }} />
              </div>
            </div>
            );
          })}
        </div>
      ) : (
        <div className="px-5 py-4 text-[12px] text-gray-600">Sin motivos detectados en la selección actual.</div>
      )}
    </section>
  );
}

export function ReviewAiPanel({
  review,
  onClose,
  isAnalyzing,
  analysisStep,
  onAnalyze,
  onRegenerate,
  formatReviewDate,
  avatarTone,
  embedded = false,
}: {
  review: Review;
  onClose: () => void;
  isAnalyzing: boolean;
  analysisStep: number;
  onAnalyze: () => void;
  onRegenerate: () => void;
  formatReviewDate: (date: Date) => string;
  avatarTone: (seed: string) => string;
  embedded?: boolean;
}) {
  const [copied, setCopied] = useState(false);
  const ai = review.ai;
  const priorityStyles = ai ? priorityClass(ai.priority, review.sentiment) : null;

  async function copyReply() {
    if (!ai?.suggestedReply) return;
    await navigator.clipboard.writeText(ai.suggestedReply);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  const sentimentAccent = {
    positiva: "from-emerald-500/20 via-transparent to-transparent",
    negativa: "from-red-500/20 via-transparent to-transparent",
    neutral: "from-amber-500/15 via-transparent to-transparent",
  };

  return (
    <div
      className={`h-full max-h-[calc(100vh-7rem)] overflow-y-auto ${
        embedded ? "bg-transparent" : `sticky top-2 ${glass}`
      }`}
    >
      {!embedded && (
        <div className={`pointer-events-none absolute inset-x-0 top-0 h-20 bg-gradient-to-b ${sentimentAccent[review.sentiment]}`} />
      )}

      <div className="relative border-b border-white/[0.06] px-6 py-5">
        <div className="flex items-start justify-between gap-4">
          <div className="flex flex-wrap items-center gap-2">
            <SentimentBadge sentiment={review.sentiment} />
            <span className="rounded-md border border-white/[0.06] bg-black/25 px-2 py-0.5 font-mono text-[10px] text-gray-500">
              #{review.id}
            </span>
            {ai && (
              <span className="rounded-md border border-violet-400/20 bg-violet-500/10 px-2 py-0.5 text-[10px] text-violet-200">
                IA {ai.confidence}%
              </span>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex h-7 w-7 items-center justify-center rounded-md border border-white/[0.08] text-[11px] text-gray-500 transition hover:text-gray-300"
            aria-label="Cerrar detalle"
          >
            ×
          </button>
        </div>

        <div className="mt-5 flex items-start gap-4">
          <div
            className={`flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl border border-white/[0.08] bg-gradient-to-br ${avatarTone(review.author)} text-base font-semibold text-white`}
          >
            {review.initials}
          </div>
          <div className="min-w-0 flex-1">
            <h3 className="text-[17px] font-medium tracking-tight text-gray-100">{review.author}</h3>
            <div className="mt-2 flex items-center gap-3">
              <StarRating rating={review.rating} />
              <span className="font-mono text-[12px] text-gray-500">{review.rating}.0</span>
            </div>
            <div className="mt-3">
              <Link
                href={`/dashboard/restaurantes/${review.restaurantSlug}`}
                className="rounded-lg border border-white/[0.06] bg-black/20 px-2.5 py-1 text-[11px] text-gray-300 transition hover:border-violet-400/20 hover:text-violet-200"
              >
                {review.restaurant}
              </Link>
            </div>
            <p className="mt-2 text-[11px] capitalize text-gray-600">{formatReviewDate(review.date)}</p>
          </div>
        </div>
      </div>

      <div className="space-y-5 px-6 py-5">
        <div>
          <p className="mb-2.5 text-[10px] font-semibold uppercase tracking-[0.12em] text-gray-600">Comentario</p>
          <div className="rounded-2xl border border-white/[0.06] bg-black/25 px-5 py-4 text-[14px] leading-[1.7] text-gray-300">
            &ldquo;{review.text}&rdquo;
          </div>
        </div>

        {isAnalyzing ? (
          <AiLoadingState step={analysisStep} />
        ) : ai ? (
          <>
            <div className="overflow-hidden rounded-xl border border-white/[0.08] bg-black/25">
              <div className="flex items-center justify-between border-b border-white/[0.06] px-5 py-3.5">
                <div className="flex items-center gap-2.5">
                  <span className="flex h-7 w-7 items-center justify-center rounded-lg border border-violet-400/20 bg-violet-500/10">
                    <IconSparkle className="h-3.5 w-3.5 text-violet-200" />
                  </span>
                  <div>
                    <p className="text-[12px] font-medium text-gray-200">NEXO IA</p>
                    <p className="text-[10px] text-gray-600">Confianza {ai.confidence}%</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={onRegenerate}
                  className="rounded-lg border border-white/[0.08] px-2.5 py-1.5 text-[10px] text-gray-400 transition hover:border-violet-400/20 hover:text-violet-200"
                >
                  Regenerar
                </button>
              </div>

              <div className="space-y-4 p-5">
                <div className="h-1.5 overflow-hidden rounded-full bg-black/30">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-violet-600 to-purple-400 transition-all"
                    style={{ width: `${ai.confidence}%` }}
                  />
                </div>

                <div className="rounded-xl border border-white/[0.05] bg-black/20 px-4 py-4">
                  <p className="mb-2 text-[10px] font-semibold uppercase tracking-[0.1em] text-gray-600">Resumen</p>
                  <p className="text-[13px] leading-relaxed text-gray-300">{ai.summary}</p>
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <p className="mb-2 text-[10px] font-semibold uppercase tracking-[0.1em] text-gray-600">Motivos</p>
                    <div className="flex flex-wrap gap-2">
                      {ai.motives.map((m) => (
                        <span key={m} className={`rounded-lg border px-2.5 py-1 text-[11px] ${motiveTagClass(review.sentiment)}`}>
                          {m}
                        </span>
                      ))}
                    </div>
                  </div>
                  <div>
                    <p className="mb-2 text-[10px] font-semibold uppercase tracking-[0.1em] text-gray-600">Emociones</p>
                    <div className="flex flex-wrap gap-2">
                      {ai.emotions.map((e) => (
                        <span key={e} className="rounded-lg border border-violet-400/20 bg-violet-500/10 px-2.5 py-1 text-[11px] text-violet-200">
                          {e}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-3">
                  {[
                    { label: "Media anterior", value: ai.previousMedia.toFixed(2), tone: "text-gray-300" },
                    { label: "Media actual", value: ai.currentMedia.toFixed(2), tone: "text-gray-300" },
                    {
                      label: "Variación",
                      value: formatDeltaPoints(ai.impact, 2),
                      tone: ai.impact < 0 ? "text-red-400" : "text-emerald-400",
                    },
                  ].map((item) => (
                    <div key={item.label} className="rounded-xl border border-white/[0.06] bg-black/25 px-3 py-3">
                      <p className="text-[10px] uppercase tracking-[0.08em] text-gray-600">{item.label}</p>
                      <p className={`mt-1 font-mono text-lg ${item.tone}`}>{item.value}</p>
                    </div>
                  ))}
                </div>

                {priorityStyles && (
                  <div className={`flex items-center justify-between rounded-xl border px-4 py-3 ${priorityStyles.box}`}>
                    <p className="text-[12px] text-gray-400">
                      {ai.priority === "Alta"
                        ? "Requiere atención inmediata"
                        : ai.priority === "Media"
                          ? "Seguimiento recomendado"
                          : "Baja urgencia operativa"}
                    </p>
                    <span className={`rounded-lg border px-2.5 py-1 text-[11px] font-semibold ${priorityStyles.badge}`}>
                      {ai.priority}
                    </span>
                  </div>
                )}

                <div>
                  <p className="mb-2 text-[10px] font-semibold uppercase tracking-[0.1em] text-gray-600">Acción recomendada</p>
                  <p className="rounded-xl border border-white/[0.06] bg-black/25 px-4 py-3 text-[13px] leading-relaxed text-gray-300">
                    {ai.recommendedAction}
                  </p>
                </div>

                <div>
                  <div className="mb-2 flex items-center justify-between">
                    <p className="text-[10px] font-semibold uppercase tracking-[0.1em] text-gray-600">Respuesta sugerida</p>
                    <button
                      type="button"
                      onClick={copyReply}
                      className="text-[10px] text-violet-300 transition hover:text-violet-200"
                    >
                      {copied ? "Copiada ✓" : "Copiar respuesta"}
                    </button>
                  </div>
                  <p className="rounded-xl border border-emerald-400/15 bg-emerald-500/[0.06] px-4 py-3 text-[13px] leading-relaxed text-gray-300">
                    {ai.suggestedReply}
                  </p>
                </div>
              </div>
            </div>

            <ReviewAiChat review={review} analysis={ai} />
          </>
        ) : (
          <div className="rounded-2xl border border-dashed border-violet-400/20 bg-violet-500/[0.04] px-5 py-8 text-center">
            <p className="text-sm font-medium text-violet-100">Análisis IA no generado</p>
            <p className="mt-1 text-xs text-gray-500">NEXO IA puede analizar esta reseña y proponerte acciones concretas.</p>
            <button
              type="button"
              onClick={onAnalyze}
              className="mt-4 rounded-xl border border-violet-400/30 bg-violet-500/15 px-5 py-2.5 text-xs font-medium text-violet-100 transition hover:bg-violet-500/25"
            >
              Analizar con IA
            </button>
          </div>
        )}

        <div className="flex flex-wrap gap-2 border-t border-white/[0.06] pt-5">
          <Link
            href={`/dashboard/restaurantes/${review.restaurantSlug}`}
            className="rounded-xl border border-violet-400/25 bg-violet-500/10 px-4 py-2.5 text-xs font-medium text-violet-100 transition hover:bg-violet-500/20"
          >
            Ver restaurante →
          </Link>
          <Link
            href="/dashboard/nexo-prevent"
            className="rounded-xl border border-white/[0.08] bg-black/20 px-4 py-2.5 text-xs text-gray-400 transition hover:text-white"
          >
            Ver Nexo Prevent
          </Link>
        </div>
      </div>
    </div>
  );
}
