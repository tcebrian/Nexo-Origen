"use client";

import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { createPortal } from "react-dom";
import type { Review } from "@/lib/reviews/types";
import { textKicker } from "./resenas-styles";

/** Caja de campo individual: etiqueta + contenido — patrón de detalle de reseña. */
export function MetaBlock({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="rounded-xl border border-[var(--nexo-border)] bg-[var(--nexo-inset)] px-4 py-3.5">
      <p className={textKicker}>{label}</p>
      <div className="mt-2">{children}</div>
    </div>
  );
}

const avatarGradients = [
  "from-violet-200 to-violet-400 text-violet-900",
  "from-blue-200 to-blue-400 text-blue-900",
  "from-emerald-200 to-emerald-400 text-emerald-900",
  "from-rose-200 to-rose-400 text-rose-900",
  "from-amber-200 to-amber-400 text-amber-900",
];

export function avatarTone(seed: string) {
  let hash = 0;
  for (let i = 0; i < seed.length; i += 1) hash = (hash + seed.charCodeAt(i) * (i + 1)) % avatarGradients.length;
  return avatarGradients[hash];
}

export function StarRating({ rating, size = "sm" }: { rating: number; size?: "sm" | "md" | "lg" }) {
  const starSize =
    size === "lg" ? "h-5 w-5" : size === "md" ? "h-4 w-4" : "h-3.5 w-3.5";
  return (
    <div className="flex items-center gap-px">
      {[1, 2, 3, 4, 5].map((star) => (
        <svg
          key={star}
          className={`${starSize} ${star <= rating ? "text-amber-500" : "text-[var(--nexo-border-strong)]"}`}
          viewBox="0 0 24 24"
          fill="currentColor"
        >
          <path d="M12 2l2.09 6.26L20.5 9.27l-5 3.64L16.82 20 12 16.77 7.18 20l1.32-7.09-5-3.64 6.41-.99L12 2z" />
        </svg>
      ))}
    </div>
  );
}

export function GoogleBadge() {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-md border border-[var(--nexo-border)] bg-[var(--nexo-inset)] px-2.5 py-1 text-xs text-[var(--nexo-text-secondary)]">
      <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none">
        <path
          d="M12 11.2v3.6h5c-.2 1.2-1.6 3.5-5 3.5-3 0-5.5-2.5-5.5-5.5S9 7.3 12 7.3c1.7 0 2.9.7 3.6 1.3l2.5-2.4C16.8 4.8 14.6 4 12 4 7.6 4 4 7.6 4 12s3.6 8 8 8c4.6 0 7.7-3.2 7.7-7.8 0-.5 0-.9-.1-1.2H12z"
          fill="#4285F4"
        />
      </svg>
      Google Maps
    </span>
  );
}

export function SentimentBadge({ sentiment, compact = false }: { sentiment: Review["sentiment"]; compact?: boolean }) {
  const styles = {
    positiva: "border-[var(--nexo-success-border)] bg-[var(--nexo-success-muted)] text-[var(--nexo-success)]",
    negativa: "border-[var(--nexo-critical-border)] bg-[var(--nexo-critical-muted)] text-[var(--nexo-critical)]",
    neutral: "border-[var(--nexo-watch-border)] bg-[var(--nexo-watch-muted)] text-[var(--nexo-watch)]",
  };
  const dots = {
    positiva: "bg-[var(--nexo-success)]",
    negativa: "bg-[var(--nexo-critical)]",
    neutral: "bg-[var(--nexo-watch)]",
  };
  const labels = { positiva: "Positiva", negativa: "Negativa", neutral: "Neutral" };

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-lg border font-medium ${compact ? "px-2.5 py-1 text-xs" : "px-3 py-1.5 text-sm"} ${styles[sentiment]}`}
    >
      <span className={`h-1.5 w-1.5 rounded-full ${dots[sentiment]}`} />
      {labels[sentiment]}
    </span>
  );
}

type FilterSelectProps = {
  label: string;
  value: string;
  options: { value: string; label: string }[];
  onChange: (value: string) => void;
  defaultValue?: string;
  compact?: boolean;
  disabled?: boolean;
};

export function FilterSelect({
  label,
  value,
  options,
  onChange,
  defaultValue,
  compact = false,
  disabled = false,
}: FilterSelectProps) {
  const [open, setOpen] = useState(false);
  const [menuStyle, setMenuStyle] = useState<CSSProperties>({});
  const containerRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  const selected = options.find((o) => o.value === value)?.label ?? value;
  const isActive = defaultValue ? value !== defaultValue : value !== "todos" && value !== "todas";

  const updatePosition = () => {
    const trigger = triggerRef.current;
    if (!trigger) return;

    const rect = trigger.getBoundingClientRect();
    const menuWidth = Math.max(rect.width, compact ? 200 : 220);
    const maxHeight = 280;
    const gap = 8;
    const viewportPadding = 12;

    let top = rect.bottom + gap;
    const spaceBelow = window.innerHeight - rect.bottom - viewportPadding;

    if (spaceBelow < maxHeight && rect.top > spaceBelow) {
      top = Math.max(viewportPadding, rect.top - maxHeight - gap);
    }

    let left = rect.left;
    if (left + menuWidth > window.innerWidth - viewportPadding) {
      left = window.innerWidth - menuWidth - viewportPadding;
    }
    left = Math.max(viewportPadding, left);

    setMenuStyle({
      position: "fixed",
      top,
      left,
      width: menuWidth,
      maxHeight,
      zIndex: 9999,
    });
  };

  useLayoutEffect(() => {
    if (!open) return;
    updatePosition();
    window.addEventListener("resize", updatePosition);
    window.addEventListener("scroll", updatePosition, true);
    return () => {
      window.removeEventListener("resize", updatePosition);
      window.removeEventListener("scroll", updatePosition, true);
    };
  }, [open, compact]);

  useEffect(() => {
    if (!open) return;

    function handleClickOutside(event: MouseEvent) {
      const target = event.target as Node;
      if (containerRef.current?.contains(target) || menuRef.current?.contains(target)) return;
      setOpen(false);
    }

    function handleEscape(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }

    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleEscape);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleEscape);
    };
  }, [open]);

  const menu =
    open && typeof document !== "undefined"
      ? createPortal(
          <div
            ref={menuRef}
            style={menuStyle}
            className="overflow-auto rounded-xl border border-white/[0.12] bg-[#0c0a14]/98 py-1 shadow-[0_24px_80px_rgba(0,0,0,0.65)] backdrop-blur-2xl"
            role="listbox"
            aria-label={label}
          >
            {options.map((option) => (
              <button
                key={option.value}
                type="button"
                role="option"
                aria-selected={option.value === value}
                onClick={() => {
                  onChange(option.value);
                  setOpen(false);
                }}
                className={`flex w-full px-3.5 py-2.5 text-left text-[13px] transition hover:bg-white/[0.06] ${
                  option.value === value ? "bg-violet-500/12 text-violet-100" : "text-gray-300"
                }`}
              >
                {option.label}
              </button>
            ))}
          </div>,
          document.body
        )
      : null;

  return (
    <div ref={containerRef} className={`relative ${compact ? "min-w-[148px]" : "min-w-[168px]"}`}>
      <button
        ref={triggerRef}
        type="button"
        aria-expanded={open}
        aria-haspopup="listbox"
        disabled={disabled}
        onClick={() => {
          if (disabled) return;
          setOpen((v) => !v);
        }}
        className={`flex w-full items-center justify-between gap-3 rounded-xl border px-3.5 py-2.5 text-left text-xs transition disabled:cursor-not-allowed disabled:opacity-45 ${
          isActive
            ? "border-violet-400/30 bg-violet-500/12 text-violet-100"
            : "border-white/[0.08] bg-black/35 text-gray-200 hover:border-white/[0.14]"
        } ${open ? "border-violet-400/35 ring-1 ring-violet-500/20" : ""}`}
      >
        <span className="min-w-0">
          <span className="block text-[10px] font-semibold uppercase tracking-[0.1em] text-gray-600">
            {label}
          </span>
          <span className="mt-0.5 block truncate text-[12px]">{selected}</span>
        </span>
        <svg
          className={`h-3.5 w-3.5 shrink-0 text-gray-500 transition ${open ? "rotate-180" : ""}`}
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
        >
          <path d="M6 9l6 6 6-6" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>
      {menu}
    </div>
  );
}
