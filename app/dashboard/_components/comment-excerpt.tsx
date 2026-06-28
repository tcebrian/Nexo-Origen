"use client";

import Link from "next/link";
import type { MouseEvent } from "react";
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
};

export function CommentExcerpt({
  text,
  reviewHref,
  maxLength = 140,
  className = excerptText,
  quote = true,
  readMoreLabel = "Leer más",
  onReadMoreClick,
}: CommentExcerptProps) {
  const { display, isTruncated } = truncateByLength(text, maxLength);
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
    </p>
  );
}
