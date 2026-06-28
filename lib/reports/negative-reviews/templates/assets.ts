/** Decoración fija extraída del diseño de referencia (BK). */
export const NEGATIVE_REVIEW_DECOR_ASSETS = {
  beans: "/reports/negative-review/decor-beans.png",
  burger: "/reports/negative-review/decor-burger.png",
  cup: "/reports/negative-review/decor-cup.png",
  fries: "/reports/negative-review/decor-fries.png",
  sad: "/reports/negative-review/decor-sad.png",
  bkSticker: "/reports/negative-review/decor-bk-sticker.png",
} as const;

export function resolveDecorAssetUrl(base: string | undefined, path: string) {
  if (!base) return path;
  return `${base.replace(/\/$/, "")}${path}`;
}
