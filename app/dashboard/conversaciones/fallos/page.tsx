import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getAuthSession } from "@/lib/auth/session";
import { canReadConversations } from "@/lib/conversations/access";
import { FAILURES_LIMIT, listAlertFailures, type AlertFailureView } from "@/lib/alerts/negative-review/failures.server";
import type { FailureState } from "@/lib/alerts/negative-review/failures";
import { ResendButton } from "./_components/resend-button";

export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "Fallos de envío | Nexo Origen" };

type PageProps = { searchParams: Promise<{ ver?: string }> };

const dateFormat = new Intl.DateTimeFormat("es-ES", {
  day: "2-digit",
  month: "short",
  hour: "2-digit",
  minute: "2-digit",
  timeZone: "Europe/Madrid",
});

const STATE_STYLE: Record<FailureState, string> = {
  pending: "border-amber-400/25 bg-amber-400/10 text-amber-200",
  failed: "border-rose-400/25 bg-rose-400/10 text-rose-200",
  notified: "border-sky-400/25 bg-sky-400/10 text-sky-200",
  resolved: "border-emerald-400/25 bg-emerald-400/10 text-emerald-200",
  in_progress: "border-white/10 bg-white/[0.04] text-gray-300",
};

function FailureItem({ failure }: { failure: AlertFailureView }) {
  return (
    <li className="grid gap-2 px-4 py-3.5 lg:grid-cols-[150px_minmax(0,1fr)_auto] lg:items-start lg:gap-5">
      <div className="flex items-center justify-between gap-3 lg:block">
        <time dateTime={failure.createdAt} className="font-mono text-[12px] tabular-nums text-gray-400">
          {dateFormat.format(new Date(failure.createdAt))}
        </time>
        <span
          className={`inline-flex shrink-0 items-center rounded-full border px-2 py-0.5 text-[11px] font-medium lg:hidden ${STATE_STYLE[failure.state]}`}
        >
          {failure.stateLabel}
        </span>
      </div>

      <div className="min-w-0">
        <p className="text-[13px] text-gray-300">
          <span className="font-medium text-white">{failure.restaurantName}</span>
          {failure.stars !== null ? <span className="ml-1.5 font-mono tabular-nums text-gray-400">{failure.stars}★</span> : null}
          <span className="mx-1.5 text-gray-600">→</span>
          {failure.contactName}
          {failure.origin === "prueba" ? (
            <span className="ml-2 rounded-md border border-white/10 px-1.5 py-px text-[10px] uppercase tracking-wide text-gray-400">
              Prueba
            </span>
          ) : null}
        </p>
        <p className="mt-1 text-[13px] font-medium text-gray-100">{failure.reason}</p>
        {failure.note ? <p className="mt-0.5 text-[12px] text-gray-400">{failure.note}</p> : null}
        <p className="mt-1 truncate font-mono text-[11px] text-gray-600" title={failure.technical}>
          {failure.technical} · reseña {failure.resenaId}
        </p>
      </div>

      <div className="flex flex-col gap-2 lg:items-end">
        <span
          className={`hidden justify-self-end rounded-full border px-2.5 py-0.5 text-[11px] font-medium lg:inline-flex ${STATE_STYLE[failure.state]}`}
        >
          {failure.stateLabel}
        </span>
        {failure.unresolved ? <ResendButton alertId={failure.id} /> : null}
      </div>
    </li>
  );
}

export default async function AlertFailuresPage({ searchParams }: PageProps) {
  const session = await getAuthSession();
  if (!session || !canReadConversations(session.perfil.rol)) redirect("/dashboard");

  const { ver } = await searchParams;
  const showAll = ver === "todos";

  let failures: AlertFailureView[] = [];
  let loadError = false;
  try {
    failures = await listAlertFailures();
  } catch (error) {
    console.error("[alert-failures] load failed", error instanceof Error ? error.message : "unknown");
    loadError = true;
  }

  const unresolved = failures.filter((failure) => failure.unresolved);
  const visible = showAll ? failures : unresolved;
  const counts = {
    pending: failures.filter((failure) => failure.state === "pending").length,
    failed: failures.filter((failure) => failure.state === "failed").length,
    resolved: failures.filter((failure) => failure.state === "resolved" || failure.state === "notified").length,
  };

  const tab = (active: boolean) =>
    `rounded-lg px-3 py-1.5 text-[12px] font-medium transition ${
      active ? "bg-white/[0.08] text-white" : "text-gray-400 hover:text-white"
    }`;

  return (
    <div className="mx-auto max-w-[1400px] space-y-5">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <nav className="mb-2 flex items-center gap-2 text-xs text-[var(--nexo-text-tertiary)]">
            <Link href="/dashboard/conversaciones" className="transition hover:text-[var(--nexo-text-secondary)]">
              Conversaciones
            </Link>
            <span>/</span>
            <span className="text-[var(--nexo-text-secondary)]">Fallos de envío</span>
          </nav>
          <h1 className="text-2xl font-semibold tracking-tight text-white">Fallos de envío</h1>
          <p className="mt-1 max-w-2xl text-sm text-gray-500">
            Alertas de reseñas negativas que no llegaron por WhatsApp a un contacto, con el motivo de cada fallo. Las que
            siguen sin llegar se pueden reenviar a mano.
          </p>
        </div>
      </header>

      {loadError ? (
        <p role="alert" className="rounded-xl border border-rose-400/20 bg-rose-400/[0.07] px-4 py-3 text-sm text-rose-200">
          No se pudieron cargar los fallos de envío.
        </p>
      ) : (
        <section className="overflow-hidden rounded-2xl border border-white/[0.08] bg-white/[0.025]">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/[0.07] px-4 py-3">
            <dl className="flex flex-wrap items-baseline gap-x-6 gap-y-1 text-[12px] text-gray-400">
              <div className="flex items-baseline gap-1.5">
                <dt>Sin entregar</dt>
                <dd className="font-mono text-[15px] font-semibold tabular-nums text-amber-200">{counts.pending}</dd>
              </div>
              <div className="flex items-baseline gap-1.5">
                <dt>Fallidas</dt>
                <dd className="font-mono text-[15px] font-semibold tabular-nums text-rose-200">{counts.failed}</dd>
              </div>
              <div className="flex items-baseline gap-1.5">
                <dt>Resueltas o avisadas</dt>
                <dd className="font-mono text-[15px] font-semibold tabular-nums text-emerald-200">{counts.resolved}</dd>
              </div>
            </dl>
            <nav className="flex items-center gap-1 rounded-xl border border-white/[0.06] bg-black/20 p-1" aria-label="Filtro">
              <Link href="/dashboard/conversaciones/fallos" className={tab(!showAll)} aria-current={!showAll ? "page" : undefined}>
                Sin resolver
              </Link>
              <Link
                href="/dashboard/conversaciones/fallos?ver=todos"
                className={tab(showAll)}
                aria-current={showAll ? "page" : undefined}
              >
                Todos
              </Link>
            </nav>
          </div>

          {visible.length === 0 ? (
            <p className="px-4 py-10 text-center text-sm text-gray-500">
              {showAll ? "No hay ningún fallo de envío registrado." : "No hay fallos sin resolver. Todas las alertas han llegado."}
            </p>
          ) : (
            <ul className="divide-y divide-white/[0.06]">
              {visible.map((failure) => (
                <FailureItem key={failure.id} failure={failure} />
              ))}
            </ul>
          )}

          {failures.length >= FAILURES_LIMIT ? (
            <p className="border-t border-white/[0.07] px-4 py-2.5 text-[11px] text-gray-500">
              Se muestran los {FAILURES_LIMIT} fallos más recientes.
            </p>
          ) : null}
        </section>
      )}
    </div>
  );
}
