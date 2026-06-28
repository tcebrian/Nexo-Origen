import Link from "next/link";
import { entityCard, glass, linkAccent, textBody, textPageTitle } from "./ui/nexo-styles";

type RelatedLink = {
  label: string;
  href: string;
  description?: string;
};

export function SectionPage({
  title,
  description,
  related = [],
}: {
  title: string;
  description?: string;
  related?: RelatedLink[];
}) {
  return (
    <>
      <div className="mb-8 pt-2">
        <Link href="/dashboard" className={`mb-4 inline-flex items-center gap-2 ${linkAccent}`}>
          <span aria-hidden>←</span>
          Volver al inicio
        </Link>
        <h2 className={textPageTitle}>{title}</h2>
        {description && <p className={`mt-2 max-w-2xl ${textBody}`}>{description}</p>}
      </div>

      <div className={`${glass} p-8`}>
        <p className={textBody}>
          Esta sección está en preparación. Mientras tanto, puedes seguir explorando el dashboard desde las
          áreas relacionadas.
        </p>

        {related.length > 0 && (
          <div className="mt-6 grid gap-3 sm:grid-cols-2">
            {related.map((item) => (
              <Link key={item.href} href={item.href} className={`${entityCard} block`}>
                <p className="text-sm font-medium text-[var(--nexo-text)]">{item.label}</p>
                {item.description && (
                  <p className="mt-1 text-xs text-[var(--nexo-text-secondary)]">{item.description}</p>
                )}
              </Link>
            ))}
          </div>
        )}
      </div>
    </>
  );
}
