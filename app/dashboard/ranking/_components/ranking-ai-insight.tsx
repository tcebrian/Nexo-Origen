import { shell, sectionPad, textKicker } from "./ui/ranking-styles";

export function RankingAiInsight({ insight }: { insight: string }) {
  return (
    <div className={`${shell} ${sectionPad}`}>
      <div className="flex items-start gap-3">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[var(--nexo-radius)] border border-[var(--nexo-accent-border)] bg-[var(--nexo-accent-muted)]">
          <svg className="h-4 w-4 text-[var(--nexo-accent)]" viewBox="0 0 24 24" fill="currentColor">
            <path d="M12 2l2.4 7.4H22l-6 4.6 2.3 7L12 17.8 5.7 21l2.3-7-6-4.6h7.6L12 2z" />
          </svg>
        </div>
        <div>
          <p className={`${textKicker} text-[var(--nexo-accent)]`}>Resumen de red</p>
          <p className="mt-2 max-w-3xl text-[15px] leading-relaxed text-[var(--nexo-text-secondary)]">
            {insight}
          </p>
        </div>
      </div>
    </div>
  );
}
