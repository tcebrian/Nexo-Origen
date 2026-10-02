/**
 * Identidad visual de cada marca para el informe mensual en imagen (PNG).
 * La plantilla es única: solo cambian estos colores y el logo. Los colores
 * semánticos (verde / ámbar / rojo de estado y estrellas) son iguales en todas.
 */
export type MonthlyImageTheme = {
  id: string;
  /** Nombre completo de la marca tal y como se muestra en la cabecera. */
  displayName: string;
  /** Logo en /public pensado para fondo claro. */
  logo: string;
  /** Si el logo no se lee sobre blanco (p. ej. amarillo), color de la pastilla oscura sobre la que se coloca. */
  logoTile?: string;
  /** Color principal: KPIs, píldoras de semana, subtítulo. */
  primary: string;
  /** Color secundario: segundo motivo, detalles. */
  secondary: string;
  /** Tercer color de motivos / acentos oscuros. */
  brown: string;
  /** Fondo del pie de página. */
  footer: string;
  /** Texto de la fecha de generación sobre el pie (debe contrastar con `footer`). */
  footerAccent: string;
};

const BURGER_KING: MonthlyImageTheme = {
  id: "bk",
  displayName: "Burger King",
  logo: "design/burger-king/bk-logo.png",
  primary: "#FF4B0B",
  secondary: "#FF6500",
  brown: "#542100",
  footer: "#421B06",
  footerAccent: "#FF7A1A",
};

const THEMES: { match: RegExp; theme: MonthlyImageTheme }[] = [
  { match: /burger|^bk\b/, theme: BURGER_KING },
  {
    match: /popeyes|^pp\b/,
    theme: { id: "pp", displayName: "Popeyes", logo: "design/popeyes/pp-logo.png", primary: "#ED6A25", secondary: "#F2A93B", brown: "#A83913", footer: "#3A1A0C", footerAccent: "#F2A93B" },
  },
  {
    match: /santa gloria|^sg\b/,
    theme: { id: "sg", displayName: "Santa Gloria", logo: "design/santa-gloria/sg-logo.png", primary: "#CE6F23", secondary: "#DEA263", brown: "#632A07", footer: "#0C2A16", footerAccent: "#DEA263" },
  },
  {
    match: /ribs/,
    theme: { id: "rb", displayName: "Ribs", logo: "design/ribs/rb-logo.png", primary: "#B5342A", secondary: "#C9982F", brown: "#7A221B", footer: "#241209", footerAccent: "#C9982F" },
  },
  {
    match: /sibuya/,
    theme: { id: "sb", displayName: "Sibuya", logo: "design/sibuya/sb-logo.png", primary: "#B3392F", secondary: "#A8834A", brown: "#2B2E33", footer: "#1A1C1F", footerAccent: "#C9A56A" },
  },
  {
    match: /volapie|volapi/,
    theme: { id: "tv", displayName: "Taberna Volapié", logo: "design/taberna-volapie/tv-logo.png", primary: "#8A6F3A", secondary: "#A8894F", brown: "#535B46", footer: "#363C2E", footerAccent: "#C9A867" },
  },
  {
    match: /tim hortons|^th\b|hortons/,
    theme: { id: "th", displayName: "Tim Hortons", logo: "design/tim-hortons/th-logo.png", primary: "#D5011F", secondary: "#C9982F", brown: "#4A2C1D", footer: "#2E1A10", footerAccent: "#E0A93A" },
  },
  {
    match: /vault/,
    theme: { id: "va", displayName: "Vault", logo: "design/vault/va-logo.png", logoTile: "#0B0A0C", primary: "#C9302C", secondary: "#8A8A8E", brown: "#17161A", footer: "#0B0A0C", footerAccent: "#E0A93A" },
  },
];

const normalize = (value: string) =>
  value.trim().normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

export function resolveMonthlyImageTheme(brand: string): MonthlyImageTheme {
  const key = normalize(brand);
  return THEMES.find((entry) => entry.match.test(key))?.theme ?? { ...BURGER_KING, id: "generic", displayName: brand.trim() };
}
