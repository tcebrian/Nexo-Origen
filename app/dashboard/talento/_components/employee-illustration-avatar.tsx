import {
  hashEmployeeSeed,
  ILLUSTRATION_ACCENT,
  ILLUSTRATION_HAIR,
  ILLUSTRATION_SHIRT,
  ILLUSTRATION_SKIN,
} from "@/lib/talento/avatar-seed";
import {
  rankBadgeBronze,
  rankBadgeGold,
  rankBadgeSilver,
} from "./ui/talento-styles";

type EmployeeIllustrationAvatarProps = {
  seed: string;
  size?: "sm" | "md" | "lg" | "xl";
  rank?: number;
  className?: string;
  highlight?: boolean;
};

const SIZE_PX = { sm: 40, md: 48, lg: 60, xl: 88 } as const;

function rankClass(rank: number) {
  if (rank === 1) return rankBadgeGold;
  if (rank === 2) return rankBadgeSilver;
  if (rank === 3) return rankBadgeBronze;
  return rankBadgeGold;
}

/** Avatar ilustrado premium — estilo dibujo vectorial, sin fotos. */
export function EmployeeIllustrationAvatar({
  seed,
  size = "md",
  rank,
  className = "",
  highlight = false,
}: EmployeeIllustrationAvatarProps) {
  const hash = hashEmployeeSeed(seed);
  const uid = `av-${hash}`;
  const px = SIZE_PX[size];
  const skin = ILLUSTRATION_SKIN[hash % ILLUSTRATION_SKIN.length];
  const shirt = ILLUSTRATION_SHIRT[hash % ILLUSTRATION_SHIRT.length];
  const hair = ILLUSTRATION_HAIR[hash % ILLUSTRATION_HAIR.length];
  const accent = ILLUSTRATION_ACCENT[hash % ILLUSTRATION_ACCENT.length];
  const hairStyle = hash % 4;
  const hasGlasses = hash % 5 === 0;

  return (
    <div
      className={`relative shrink-0 ${className}`}
      style={{ width: px, height: px }}
      aria-hidden
    >
      <div
        className={`absolute inset-0 rounded-full ${
          highlight
            ? "bg-violet-500/20 shadow-[0_0_28px_rgba(124,58,237,0.35)]"
            : "bg-violet-500/10 shadow-[0_8px_24px_rgba(0,0,0,0.35)]"
        }`}
      />
      <svg
        viewBox="0 0 100 100"
        width={px}
        height={px}
        className="relative overflow-visible drop-shadow-sm"
      >
        <defs>
          <linearGradient id={`${uid}-ring`} x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor={highlight ? "#A78BFA" : "rgba(167,139,250,0.5)"} />
            <stop offset="100%" stopColor={highlight ? "#6D28D9" : "rgba(109,40,217,0.25)"} />
          </linearGradient>
          <linearGradient id={`${uid}-bg`} x1="50%" y1="0%" x2="50%" y2="100%">
            <stop offset="0%" stopColor="rgba(255,255,255,0.06)" />
            <stop offset="100%" stopColor="rgba(0,0,0,0.15)" />
          </linearGradient>
          <radialGradient id={`${uid}-face`} cx="40%" cy="35%" r="65%">
            <stop offset="0%" stopColor={skin} />
            <stop offset="100%" stopColor={skin} stopOpacity="0.88" />
          </radialGradient>
        </defs>

        <circle cx="50" cy="50" r="47" fill={`url(#${uid}-bg)`} />
        <circle
          cx="50"
          cy="50"
          r="47"
          fill="none"
          stroke={`url(#${uid}-ring)`}
          strokeWidth={highlight ? 2.5 : 1.75}
        />

        {/* Hombros / uniforme */}
        <path d="M26 74 C34 62 66 62 74 74 L78 98 L22 98 Z" fill={shirt} />
        <path d="M26 74 C34 62 66 62 74 74" fill="none" stroke="rgba(255,255,255,0.12)" strokeWidth="1" />
        <circle cx="50" cy="78" r="3" fill={accent} opacity="0.85" />

        {/* Cuello */}
        <rect x="44" y="58" width="12" height="11" rx="4" fill={skin} />

        {/* Cara */}
        <ellipse cx="50" cy="45" rx="21" ry="23" fill={`url(#${uid}-face)`} />

        {/* Pelo */}
        {hairStyle === 0 && (
          <path d="M29 42 Q31 17 50 15 Q69 17 71 42 Q66 30 50 28 Q34 30 29 42" fill={hair} />
        )}
        {hairStyle === 1 && (
          <>
            <ellipse cx="50" cy="26" rx="23" ry="15" fill={hair} />
            <path d="M27 38 Q25 55 31 66 L35 60 Q29 46 31 34 Z" fill={hair} />
            <path d="M73 38 Q75 55 69 66 L65 60 Q71 46 69 34 Z" fill={hair} />
          </>
        )}
        {hairStyle === 2 && (
          <path d="M31 36 Q33 19 50 17 Q67 19 69 36 L69 46 Q50 40 31 46 Z" fill={hair} />
        )}
        {hairStyle === 3 && (
          <>
            <circle cx="50" cy="24" r="13" fill={hair} />
            <ellipse cx="50" cy="31" rx="19" ry="9" fill={hair} />
          </>
        )}

        {/* Ojos */}
        <ellipse cx="41" cy="45" rx="2.8" ry="3.5" fill="#1C1917" />
        <ellipse cx="59" cy="45" rx="2.8" ry="3.5" fill="#1C1917" />
        <circle cx="42" cy="44" r="0.9" fill="white" opacity="0.9" />
        <circle cx="60" cy="44" r="0.9" fill="white" opacity="0.9" />

        {hasGlasses && (
          <>
            <circle cx="41" cy="45" r="7" fill="none" stroke="rgba(30,41,59,0.7)" strokeWidth="1.5" />
            <circle cx="59" cy="45" r="7" fill="none" stroke="rgba(30,41,59,0.7)" strokeWidth="1.5" />
            <path d="M48 45 H52" stroke="rgba(30,41,59,0.7)" strokeWidth="1.5" />
          </>
        )}

        {/* Sonrisa */}
        <path
          d="M41 53 Q50 59 59 53"
          fill="none"
          stroke="rgba(120,53,15,0.55)"
          strokeWidth="1.75"
          strokeLinecap="round"
        />

        {/* Mejillas */}
        <ellipse cx="35" cy="50" rx="4" ry="2.5" fill="rgba(244,114,182,0.12)" />
        <ellipse cx="65" cy="50" rx="4" ry="2.5" fill="rgba(244,114,182,0.12)" />
      </svg>

      {rank != null && (
        <span className={rankClass(rank)}>{rank}</span>
      )}
    </div>
  );
}
