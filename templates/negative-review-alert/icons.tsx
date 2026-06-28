import {
  NEXO_ORIGEN_LOGO_SRC,
  NEXO_ORIGEN_REPORT_ICON_SRC,
  NEXO_ORIGEN_REPORT_WORDMARK_SRC,
} from "@/app/_components/nexo-brand";

export function IconCalendar() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden>
      <rect x="3" y="5" width="18" height="16" rx="2.5" stroke="#6B46C1" strokeWidth="1.7" />
      <path d="M8 3v4M16 3v4M3 10h18" stroke="#6B46C1" strokeWidth="1.7" strokeLinecap="round" />
    </svg>
  );
}

export function IconPin() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M12 21s6.5-4.35 6.5-10.2A6.5 6.5 0 104.5 10.8C4.5 16.65 12 21 12 21z"
        stroke="#6B46C1"
        strokeWidth="1.9"
      />
      <circle cx="12" cy="10.5" r="2.4" fill="#6B46C1" />
    </svg>
  );
}

export function IconRatingArrow() {
  return (
    <span className="nra-side__arrow" aria-hidden>
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
        <path
          d="M4 12h16M14 7l5 5-5 5"
          stroke="currentColor"
          strokeWidth="2.4"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </span>
  );
}

export function IconShieldX() {
  return (
    <svg width="40" height="40" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M12 2.8l7.2 2.7v5.8c0 4.55-3.15 7.85-7.2 8.7C8.05 18.15 4.8 14.85 4.8 11.3V5.5L12 2.8z"
        fill="url(#shieldFill)"
        stroke="#FCA5A5"
        strokeWidth="1.4"
      />
      <path d="M9.2 9.4l5.6 5.6M14.8 9.4l-5.6 5.6" stroke="#FEE2E2" strokeWidth="2" strokeLinecap="round" />
      <defs>
        <linearGradient id="shieldFill" x1="5" y1="3" x2="19" y2="21">
          <stop stopColor="rgba(248,113,113,0.35)" />
          <stop offset="1" stopColor="rgba(127,29,29,0.15)" />
        </linearGradient>
      </defs>
    </svg>
  );
}

export function IconWarning() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path d="M12 3.5 4 19.5h16L12 3.5z" fill="#EF4444" />
      <path d="M12 10v4.2M12 17.2h.01" stroke="#fff" strokeWidth="2.2" strokeLinecap="round" />
    </svg>
  );
}

export function IconUser() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden>
      <circle cx="12" cy="8.2" r="3.4" stroke="#4c3d7a" strokeWidth="1.8" />
      <path
        d="M6.2 19.2c1.5-3.1 3.7-4.6 5.8-4.6s4.3 1.5 5.8 4.6"
        stroke="#4c3d7a"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
    </svg>
  );
}

export function IconClock() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden>
      <circle cx="12" cy="12" r="8.2" stroke="#4c3d7a" strokeWidth="1.8" />
      <path d="M12 8.2V12l2.8 1.8" stroke="#4c3d7a" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}

export function IconTarget() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden>
      <circle cx="12" cy="12" r="8.5" stroke="#6B46C1" strokeWidth="1.7" />
      <circle cx="12" cy="12" r="4.8" stroke="#6B46C1" strokeWidth="1.7" />
      <circle cx="12" cy="12" r="1.5" fill="#6B46C1" />
      <path d="M12 2.8v2.6M12 18.6v2.6M2.8 12h2.6M18.6 12h2.6" stroke="#6B46C1" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

export function IconBrain() {
  return (
    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M8 5.5a3 3 0 00-3 3V11a2.5 2.5 0 000 5v1.5A2.5 2.5 0 107.5 20H9M16 5.5a3 3 0 013 3V11a2.5 2.5 0 010 5v1.5A2.5 2.5 0 1116.5 20H15"
        stroke="#6B46C1"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
      <path d="M12 5.5v14" stroke="#6B46C1" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

export function IconChart() {
  return (
    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path d="M4 18.5h16" stroke="#6B46C1" strokeWidth="1.7" strokeLinecap="round" />
      <path
        d="M7 14.5l3.2-4.2 2.8 2 4.5-5.8"
        stroke="#6B46C1"
        strokeWidth="1.7"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function IconReasonAlert() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden>
      <circle cx="12" cy="12" r="11" fill="#E53935" />
      <path d="M12 7.5v5.2" stroke="#fff" strokeWidth="2.4" strokeLinecap="round" />
      <circle cx="12" cy="16.8" r="1.3" fill="#fff" />
    </svg>
  );
}

export function IconGoogleMaps() {
  return (
    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M12 2.5c-3.1 0-5.6 2.4-5.6 5.4 0 4 5.6 11.1 5.6 11.1s5.6-7.1 5.6-11.1c0-3-2.5-5.4-5.6-5.4z"
        fill="#34A853"
      />
      <circle cx="12" cy="8" r="2" fill="#fff" />
    </svg>
  );
}

export function IconAngryFace() {
  return (
    <svg width="48" height="48" viewBox="0 0 64 64" fill="none" aria-hidden>
      <circle cx="22" cy="27" r="3.5" fill="#B91C1C" />
      <circle cx="42" cy="27" r="3.5" fill="#B91C1C" />
      <path d="M18 43c6-7 22-7 28 0" stroke="#B91C1C" strokeWidth="3" strokeLinecap="round" />
      <path d="M15 21l9 6M49 21l-9 6" stroke="#B91C1C" strokeWidth="2.4" strokeLinecap="round" />
    </svg>
  );
}

export function IconLightbulb() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M9.5 17.2h5M10.2 19.8h3.6M9.6 14.6a5.4 5.4 0 118.8-7.8 5.4 5.4 0 01-8.8 7.8z"
        stroke="#EDE9FE"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path d="M12 3.2v1.2" stroke="#EDE9FE" strokeWidth="1.6" strokeLinecap="round" opacity="0.7" />
    </svg>
  );
}

export function IconClipboard() {
  return (
    <svg width="82" height="82" viewBox="0 0 88 88" fill="none" aria-hidden>
      {/* Shadow layer */}
      <ellipse cx="46" cy="78" rx="28" ry="5" fill="rgba(15,11,33,0.25)" />
      {/* Board back */}
      <rect x="22" y="22" width="44" height="54" rx="8" fill="#2E1065" />
      {/* Board front */}
      <rect x="18" y="20" width="44" height="54" rx="8" fill="url(#clipBoard)" />
      <rect x="18" y="20" width="44" height="54" rx="8" stroke="rgba(255,255,255,0.12)" strokeWidth="1" />
      {/* Clip */}
      <rect x="28" y="12" width="28" height="14" rx="5" fill="url(#clipTop)" />
      <rect x="32" y="14" width="20" height="8" rx="3" fill="rgba(255,255,255,0.15)" />
      {/* Lines */}
      <path d="M28 38h28M28 46h24M28 54h18" stroke="rgba(255,255,255,0.55)" strokeWidth="1.8" strokeLinecap="round" />
      {/* Checkmarks */}
      <path d="M56 40l4 4 9-10" stroke="#C4B5FD" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M56 50l4 4 9-10" stroke="#A78BFA" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M56 60l4 4 9-10" stroke="#8B5CF6" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
      {/* Shine */}
      <path d="M22 24c8-4 16-4 24 0" stroke="rgba(255,255,255,0.2)" strokeWidth="2" strokeLinecap="round" />
      <defs>
        <linearGradient id="clipBoard" x1="18" y1="20" x2="62" y2="74">
          <stop stopColor="#6D28D9" />
          <stop offset="0.5" stopColor="#5B21B6" />
          <stop offset="1" stopColor="#4C1D95" />
        </linearGradient>
        <linearGradient id="clipTop" x1="28" y1="12" x2="56" y2="26">
          <stop stopColor="#A78BFA" />
          <stop offset="1" stopColor="#7C3AED" />
        </linearGradient>
      </defs>
    </svg>
  );
}

export function NexoHeaderBrand({
  logoUrl,
  assetBaseUrl,
}: {
  logoUrl?: string;
  assetBaseUrl?: string;
}) {
  const abs = (path: string) => {
    if (!path) return "";
    if (path.startsWith("http://") || path.startsWith("https://") || path.startsWith("data:")) {
      return path;
    }
    if (!assetBaseUrl) return path;
    return `${assetBaseUrl.replace(/\/$/, "")}${path.startsWith("/") ? path : `/${path}`}`;
  };

  const useStackedWordmark =
    !logoUrl || logoUrl.endsWith(NEXO_ORIGEN_LOGO_SRC) || logoUrl.includes("nexo-origen-logo");

  if (useStackedWordmark) {
    return (
      <div className="nra-nexo-header">
        <div className="nra-nexo-header__row">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={abs(NEXO_ORIGEN_REPORT_ICON_SRC)}
            alt=""
            aria-hidden
            className="nra-nexo-header__icon"
          />
          <div className="nra-nexo-header__wordstack">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={abs(NEXO_ORIGEN_REPORT_WORDMARK_SRC)}
              alt="Nexo Origen"
              className="nra-nexo-header__wordmark"
            />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="nra-nexo-header">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={abs(logoUrl)} alt="Nexo Origen" className="nra-nexo-header__brand" />
    </div>
  );
}

export function StarRating({ stars, size = "md" }: { stars: number; size?: "md" | "lg" }) {
  const filled = Math.max(0, Math.min(5, Math.round(stars)));
  const dim = size === "lg" ? 30 : 17;
  const strokeWidth = size === "lg" ? "1.6" : "1.3";

  return (
    <div className={`nra-stars ${size === "lg" ? "nra-stars--lg" : ""}`} aria-label={`${filled} estrellas`}>
      {Array.from({ length: 5 }).map((_, index) => {
        const on = index < filled;
        return (
          <svg key={index} width={dim} height={dim} viewBox="0 0 24 24" aria-hidden>
            <path
              d="M12 2.2l2.7 6.5L21.5 9.4l-5 4.1 1.5 6.5L12 17.4 5.9 20l1.5-6.5-5-4.1 6.8-.7L12 2.2z"
              fill={on ? (size === "lg" ? "#E53935" : "url(#starFill)") : "none"}
              stroke={on ? (size === "lg" ? "#E53935" : "#DC2626") : "#D1D5DB"}
              strokeWidth={strokeWidth}
              strokeLinejoin="round"
              filter={on && size !== "lg" ? "url(#starGlow)" : undefined}
            />
          </svg>
        );
      })}
      {size !== "lg" ? (
        <svg width="0" height="0" aria-hidden>
          <defs>
            <linearGradient id="starFill" x1="5" y1="2" x2="19" y2="20">
              <stop stopColor="#EF4444" />
              <stop offset="1" stopColor="#DC2626" />
            </linearGradient>
            <filter id="starGlow" x="-20%" y="-20%" width="140%" height="140%">
              <feDropShadow dx="0" dy="1" stdDeviation="1" floodColor="#EF4444" floodOpacity="0.4" />
            </filter>
          </defs>
        </svg>
      ) : null}
    </div>
  );
}
