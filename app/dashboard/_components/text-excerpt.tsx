"use client";

import Link from "next/link";
import { truncateByLength } from "@/lib/text/excerpt";
import { excerptLink, excerptText } from "./ui/nexo-styles";

type TextExcerptProps = {
  text: string;
  href?: string;
  maxLength?: number;
  className?: string;
  readMoreLabel?: string;
};

/** Extracto genérico para textos largos (resúmenes, recomendaciones) con enlace opcional. */
export function TextExcerpt({
  text,
  href,
  maxLength = 220,
  className = excerptText,
  readMoreLabel = "Leer más",
}: TextExcerptProps) {
  const { display, isTruncated } = truncateByLength(text, maxLength);

  return (
    <p className={className}>
      {display}
      {isTruncated && href ? (
        <Link href={href} className={excerptLink}>
          {readMoreLabel}
        </Link>
      ) : null}
    </p>
  );
}
