"use client";

import { motion } from "framer-motion";
import { CARD_HOVER, CARD_TRANSITION } from "./motion-config";
import { usePrefersReducedMotion } from "./use-prefers-reduced-motion";

type MotionCardProps = {
  children: React.ReactNode;
  className?: string;
  interactive?: boolean;
  as?: "div" | "article" | "section";
};

export function MotionCard({
  children,
  className = "",
  interactive = false,
  as = "div",
}: MotionCardProps) {
  const reducedMotion = usePrefersReducedMotion();
  const Component = motion[as];

  if (reducedMotion) {
    const Tag = as;
    return <Tag className={`nexo-card-surface ${className}`}>{children}</Tag>;
  }

  return (
    <Component
      className={`nexo-card-surface ${interactive ? "nexo-card-clickable" : ""} ${className}`}
      initial="rest"
      whileHover="hover"
      variants={CARD_HOVER}
      transition={CARD_TRANSITION}
    >
      {children}
    </Component>
  );
}
