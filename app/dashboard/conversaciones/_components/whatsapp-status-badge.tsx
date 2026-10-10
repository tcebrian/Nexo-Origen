/**
 * Estado de WhatsApp de un contacto, reutilizable (lista, cabecera y tarjeta).
 * Verde = activo · ámbar = activación enviada · gris = pendiente · rojo = error.
 */
export type WhatsAppBadgeState = "active" | "sent" | "pending" | "error";

const TONES: Record<WhatsAppBadgeState, { label: string; dot: string; pill: string; text: string }> = {
  active: {
    label: "WhatsApp activo",
    dot: "bg-emerald-400",
    pill: "border-emerald-400/20 bg-emerald-400/10 text-emerald-200",
    text: "text-emerald-300",
  },
  sent: {
    label: "Activación enviada",
    dot: "bg-amber-300",
    pill: "border-amber-300/20 bg-amber-300/10 text-amber-200",
    text: "text-amber-200",
  },
  pending: {
    label: "Pendiente de activación",
    dot: "bg-gray-500",
    pill: "border-white/[0.1] bg-white/[0.04] text-gray-300",
    text: "text-gray-400",
  },
  error: {
    label: "Error de envío",
    dot: "bg-rose-400",
    pill: "border-rose-400/25 bg-rose-400/10 text-rose-200",
    text: "text-rose-300",
  },
};

export function whatsappStateLabel(state: WhatsAppBadgeState): string {
  return TONES[state].label;
}

/** `pill`: con fondo y borde (cabecera). `inline`: punto y texto (lista de contactos). */
export function WhatsAppStatusBadge({
  state,
  variant = "pill",
}: {
  state: WhatsAppBadgeState;
  variant?: "pill" | "inline";
}) {
  const tone = TONES[state];
  if (variant === "inline") {
    return (
      <span className={`inline-flex min-w-0 items-center gap-1.5 text-[11px] ${tone.text}`} data-whatsapp-state={state}>
        <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${tone.dot}`} aria-hidden />
        <span className="truncate">{tone.label}</span>
      </span>
    );
  }
  return (
    <span
      className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-full border px-2.5 py-1 text-[11px] font-medium ${tone.pill}`}
      data-whatsapp-state={state}
    >
      <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${tone.dot}`} aria-hidden />
      {tone.label}
    </span>
  );
}
