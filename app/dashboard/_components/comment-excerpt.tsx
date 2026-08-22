"use client";

import Link from "next/link";
import { useState, type MouseEvent } from "react";
import { truncateByLength } from "@/lib/text/excerpt";
import { excerptLink, excerptText } from "./ui/nexo-styles";

type CommentExcerptProps = {
  text: string;
  reviewHref?: string;
  maxLength?: number;
  className?: string;
  quote?: boolean;
  readMoreLabel?: string;
  onReadMoreClick?: (event: MouseEvent<HTMLAnchorElement>) => void;
  /** Texto original sin traducir — si se pasa, se muestra un enlace "ver original". */
  originalText?: string;
};

export function CommentExcerpt({
  text,
  reviewHref,
  maxLength = 140,
  className = excerptText,
  quote = true,
  readMoreLabel = "Leer más",
  onReadMoreClick,
  originalText,
}: CommentExcerptProps) {
  const [showOriginal, setShowOriginal] = useState(false);
  const shown = showOriginal && originalText ? originalText : text;
  const { display, isTruncated } = truncateByLength(shown, maxLength);
  const content = quote ? `“${display}”` : display;

  return (
    <p className={className}>
      {content}
      {isTruncated && reviewHref ? (
        <Link
          href={reviewHref}
          className={excerptLink}
          onClick={onReadMoreClick}
        >
          {readMoreLabel}
        </Link>
      ) : null}
      {originalText ? (
        <button
          type="button"
          className={`${excerptLink} ml-1`}
          onClick={(event) => {
            event.preventDefault();
            event.stopPropagation();
            setShowOriginal((value) => !value);
          }}
        >
          {showOriginal ? "Ver traducción" : "Ver original"}
        </button>
      ) : null}
    </p>
  );
}
