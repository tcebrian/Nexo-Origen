export function hashEmployeeSeed(seed: string): number {
  let hash = 0;
  for (let i = 0; i < seed.length; i += 1) {
    hash = (hash * 31 + seed.charCodeAt(i)) >>> 0;
  }
  return hash;
}

/** Paleta cohesionada — tonos cálidos y uniformes de marca */
export const ILLUSTRATION_SKIN = ["#F4D5B8", "#E8BF96", "#D4A574", "#C4956A", "#A67C52"];
export const ILLUSTRATION_SHIRT = ["#5B21B6", "#4C1D95", "#3730A3", "#1E3A5F", "#134E4A"];
export const ILLUSTRATION_HAIR = ["#1C1917", "#292524", "#44403C", "#57534E", "#78350F"];
export const ILLUSTRATION_ACCENT = ["#A78BFA", "#818CF8", "#34D399", "#F472B6", "#38BDF8"];

export function rankStyle(index: number): "gold" | "silver" | "bronze" | "default" {
  if (index === 0) return "gold";
  if (index === 1) return "silver";
  if (index === 2) return "bronze";
  return "default";
}
