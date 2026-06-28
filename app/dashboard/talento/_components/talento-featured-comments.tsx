import Link from "next/link";
import type { TalentoFeaturedComment } from "@/lib/talento/types";
import { getReviewHref } from "@/lib/text/excerpt";
import { RestaurantBrandLine } from "../../_components/restaurant-brand-line";
import { EmployeeIllustrationAvatar } from "./employee-illustration-avatar";
import { TalentoSectionHeader } from "./talento-section-header";
import {
  listRowCard,
  talentoPanel,
  talentoPanelInner,
  talentoPanelPad,
} from "./ui/talento-styles";

type TalentoFeaturedCommentsProps = {
  comments: TalentoFeaturedComment[];
};

function formatRelative(date: Date): string {
  const days = Math.max(0, Math.floor((Date.now() - date.getTime()) / 86_400_000));
  if (days === 0) return "Hoy";
  if (days === 1) return "Hace 1 día";
  return `Hace ${days} días`;
}

function GoogleBadge() {
  return (
    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-white/[0.08] bg-white shadow-sm">
      <svg className="h-[18px] w-[18px]" viewBox="0 0 24 24" aria-hidden>
        <path
          fill="#4285F4"
          d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
        />
        <path
          fill="#34A853"
          d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
        />
        <path
          fill="#FBBC05"
          d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
        />
        <path
          fill="#EA4335"
          d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
        />
      </svg>
    </div>
  );
}

export function TalentoFeaturedComments({ comments }: TalentoFeaturedCommentsProps) {
  return (
    <section className={`${talentoPanel} ${talentoPanelPad}`}>
      <div className={talentoPanelInner} />
      <TalentoSectionHeader
        kicker="Voz del cliente"
        title="Comentarios destacados"
        description="Reseñas positivas que mencionan al equipo."
      />

      {comments.length === 0 ? (
        <p className="text-[13px] text-gray-500">Sin comentarios con mención de empleado.</p>
      ) : (
        <ul className="space-y-2.5">
          {comments.map((comment) => (
            <li key={comment.id} className={`${listRowCard} !items-start py-4`}>
              <GoogleBadge />
              <div className="min-w-0 flex-1">
                <div className="flex gap-0.5">
                  {Array.from({ length: comment.stars }).map((_, i) => (
                    <svg
                      key={i}
                      className="h-3.5 w-3.5 text-amber-400"
                      viewBox="0 0 20 20"
                      fill="currentColor"
                    >
                      <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                    </svg>
                  ))}
                </div>
                <Link
                  href={getReviewHref(comment.reviewId)}
                  className="mt-2 block text-[13px] leading-[1.65] text-gray-300 transition hover:text-violet-200"
                >
                  &ldquo;{comment.excerpt}&rdquo;
                </Link>
                <div className="mt-2.5 flex flex-wrap items-center gap-2 text-[11px] text-gray-600">
                  <RestaurantBrandLine
                    brand={comment.brand}
                    name={comment.restaurant}
                    logoSize="xs"
                    nameClassName="text-[11px]"
                  />
                  <span className="text-gray-700">·</span>
                  <span>{formatRelative(comment.date)}</span>
                </div>
              </div>
              <div className="flex flex-col items-center gap-1 pt-0.5">
                <EmployeeIllustrationAvatar seed={comment.employeeId} size="sm" />
                <span className="max-w-[72px] truncate text-[9px] text-gray-600">
                  {comment.employeeName.split(" ")[0]}
                </span>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
