"use client";

import { useEffect, useRef, useState } from "react";
import { usePrefersReducedMotion } from "./use-prefers-reduced-motion";

type AnimatedNumberProps = {
  value: number;
  decimals?: number;
  duration?: number;
  className?: string;
  formatter?: (value: number) => string;
};

function easeOutCubic(t: number) {
  return 1 - (1 - t) ** 3;
}

export function AnimatedNumber({
  value,
  decimals = 0,
  duration = 0.75,
  className,
  formatter,
}: AnimatedNumberProps) {
  const reducedMotion = usePrefersReducedMotion();
  const [display, setDisplay] = useState(reducedMotion ? value : 0);
  const frameRef = useRef<number | null>(null);
  const startRef = useRef<number | null>(null);
  const fromRef = useRef(0);

  useEffect(() => {
    if (reducedMotion) {
      setDisplay(value);
      return;
    }

    fromRef.current = display;
    startRef.current = null;

    const step = (timestamp: number) => {
      if (startRef.current === null) startRef.current = timestamp;
      const elapsed = timestamp - startRef.current;
      const progress = Math.min(elapsed / (duration * 1000), 1);
      const next = fromRef.current + (value - fromRef.current) * easeOutCubic(progress);
      setDisplay(next);
      if (progress < 1) {
        frameRef.current = requestAnimationFrame(step);
      }
    };

    frameRef.current = requestAnimationFrame(step);
    return () => {
      if (frameRef.current !== null) cancelAnimationFrame(frameRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- animate from current display
  }, [value, duration, reducedMotion]);

  const text = formatter
    ? formatter(display)
    : display.toLocaleString("es-ES", {
        minimumFractionDigits: decimals,
        maximumFractionDigits: decimals,
      });

  return <span className={className}>{text}</span>;
}
