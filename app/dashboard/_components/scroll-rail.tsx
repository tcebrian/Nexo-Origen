"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type ReactNode,
  type RefObject,
} from "react";

type ScrollRailProps = {
  direction?: "horizontal" | "vertical";
  children: ReactNode;
  className?: string;
  viewportClassName?: string;
  step?: number;
  viewportRef?: RefObject<HTMLDivElement | null>;
  showArrows?: boolean;
  tone?: "violet" | "red";
};

function Chevron({ direction }: { direction: "left" | "right" | "up" | "down" }) {
  const paths = {
    left: "M15 18l-6-6 6-6",
    right: "M9 18l6-6-6-6",
    up: "M18 15l-6-6-6 6",
    down: "M6 9l6 6 6-6",
  };

  return (
    <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d={paths[direction]} strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function ScrollRail({
  direction = "horizontal",
  children,
  className = "",
  viewportClassName = "",
  step,
  viewportRef,
  showArrows = true,
  tone = "violet",
}: ScrollRailProps) {
  const internalRef = useRef<HTMLDivElement>(null);
  const viewport = viewportRef ?? internalRef;
  const isHorizontal = direction === "horizontal";

  const [canScrollStart, setCanScrollStart] = useState(false);
  const [canScrollEnd, setCanScrollEnd] = useState(false);

  const scrollStep = step ?? (isHorizontal ? 300 : 220);

  const updateEdges = useCallback(() => {
    const el = viewport.current;
    if (!el) return;

    const max = isHorizontal ? el.scrollWidth - el.clientWidth : el.scrollHeight - el.clientHeight;
    const pos = isHorizontal ? el.scrollLeft : el.scrollTop;

    setCanScrollStart(pos > 4);
    setCanScrollEnd(pos < max - 4);
  }, [isHorizontal, viewport]);

  useEffect(() => {
    const el = viewport.current;
    if (!el) return;

    updateEdges();

    const onScroll = () => updateEdges();
    el.addEventListener("scroll", onScroll, { passive: true });

    const observer = new ResizeObserver(updateEdges);
    observer.observe(el);
    if (el.firstElementChild) observer.observe(el.firstElementChild);

    return () => {
      el.removeEventListener("scroll", onScroll);
      observer.disconnect();
    };
  }, [updateEdges, viewport]);

  function scrollByAmount(amount: number) {
    const el = viewport.current;
    if (!el) return;
    el.scrollBy({
      left: isHorizontal ? amount : 0,
      top: isHorizontal ? 0 : amount,
      behavior: "smooth",
    });
  }

  const railClass = isHorizontal ? "scroll-rail scroll-rail-x" : "scroll-rail scroll-rail-y";
  const toneClass = tone === "red" ? "scroll-rail-tone-red" : "scroll-rail-tone-violet";

  const arrowBase =
    "absolute z-10 flex h-8 w-8 items-center justify-center rounded-full border border-white/[0.12] bg-[#0a0812]/90 text-gray-300 shadow-[0_8px_24px_rgba(0,0,0,0.45),inset_0_1px_0_rgba(255,255,255,0.08)] backdrop-blur-md transition hover:border-white/20 hover:bg-white/[0.08] hover:text-white";

  return (
    <div className={`relative ${className}`}>
      {showArrows && canScrollStart && (
        <button
          type="button"
          aria-label={isHorizontal ? "Desplazar a la izquierda" : "Desplazar arriba"}
          onClick={() => scrollByAmount(-scrollStep)}
          className={`${arrowBase} ${
            isHorizontal
              ? "left-1 top-1/2 -translate-y-1/2"
              : "left-1/2 top-1 -translate-x-1/2"
          }`}
        >
          <Chevron direction={isHorizontal ? "left" : "up"} />
        </button>
      )}

      {showArrows && canScrollEnd && (
        <button
          type="button"
          aria-label={isHorizontal ? "Desplazar a la derecha" : "Desplazar abajo"}
          onClick={() => scrollByAmount(scrollStep)}
          className={`${arrowBase} ${
            isHorizontal
              ? "right-1 top-1/2 -translate-y-1/2"
              : "bottom-1 left-1/2 -translate-x-1/2"
          }`}
        >
          <Chevron direction={isHorizontal ? "right" : "down"} />
        </button>
      )}

      {canScrollStart && (
        <span
          className={`pointer-events-none absolute z-[1] ${
            isHorizontal
              ? "inset-y-0 left-0 w-10 bg-gradient-to-r from-[#07050d] to-transparent"
              : "inset-x-0 top-0 h-10 bg-gradient-to-b from-[#07050d] to-transparent"
          }`}
        />
      )}
      {canScrollEnd && (
        <span
          className={`pointer-events-none absolute z-[1] ${
            isHorizontal
              ? "inset-y-0 right-0 w-10 bg-gradient-to-l from-[#07050d] to-transparent"
              : "inset-x-0 bottom-0 h-10 bg-gradient-to-t from-[#07050d] to-transparent"
          }`}
        />
      )}

      <div
        ref={viewport}
        className={`${railClass} ${toneClass} ${
          isHorizontal ? "overflow-x-auto overflow-y-hidden" : "overflow-y-auto overflow-x-hidden"
        } ${viewportClassName}`}
      >
        {children}
      </div>
    </div>
  );
}
