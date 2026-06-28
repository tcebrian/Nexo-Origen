"use client";

import Link from "next/link";
import type { ComponentProps } from "react";

type MotionLinkProps = ComponentProps<typeof Link> & {
  showArrow?: boolean;
};

export function MotionLink({ children, className = "", showArrow = true, ...props }: MotionLinkProps) {
  return (
    <Link {...props} className={`nexo-btn-motion group ${className}`}>
      <span>{children}</span>
      {showArrow ? <span className="nexo-btn-arrow" aria-hidden>→</span> : null}
    </Link>
  );
}

export function MotionButton({
  children,
  className = "",
  showArrow = false,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { showArrow?: boolean }) {
  return (
    <button type="button" {...props} className={`nexo-btn-motion group ${className}`}>
      <span>{children}</span>
      {showArrow ? <span className="nexo-btn-arrow" aria-hidden>→</span> : null}
    </button>
  );
}
