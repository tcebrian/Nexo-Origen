export const PAGE_ENTER = {
  initial: { opacity: 0, y: 12 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: 8 },
  transition: { duration: 0.25, ease: [0, 0, 0.2, 1] as const },
};

export const STAGGER_ROW = {
  hidden: { opacity: 0, x: -8 },
  show: { opacity: 1, x: 0 },
};

export const STAGGER_CHILD_DELAY = 0.08;

export const PANEL_SLIDE = {
  initial: { opacity: 0, x: 24 },
  animate: { opacity: 1, x: 0 },
  exit: { opacity: 0, x: 16 },
  transition: { duration: 0.28, ease: [0, 0, 0.2, 1] as const },
};

export const BACKDROP_FADE = {
  initial: { opacity: 0 },
  animate: { opacity: 1 },
  exit: { opacity: 0 },
  transition: { duration: 0.2 },
};

export const CARD_HOVER = {
  rest: { scale: 1, y: 0 },
  hover: { scale: 1.01, y: -2 },
};

export const CARD_TRANSITION = { duration: 0.2, ease: [0.4, 0, 0.2, 1] as const };

export const CHART_DRAW_MS = 900;
