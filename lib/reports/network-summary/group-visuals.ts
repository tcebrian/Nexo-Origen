import type { NetworkReportGroupId } from "./brand-groups";

export type NetworkSummaryGroupVisual = {
  logo: string;
  heroImage: string | null;
  /** Varias fotos en la cabecera en vez de una sola (informes multi-marca como Grupo Hámbar). */
  heroImages?: string[];
  /** Muestra la columna "Marca" en la tabla de locales (informes multi-marca). */
  showBrandColumn?: boolean;
  ink: string;
  accent: string;
  accentDark: string;
  cream: string;
  creamDeep: string;
  card: string;
  wordmarkFont: string;
  brandTitle: string;
  brandSubtitle: string;
  footerTagline: string;
};

export const NETWORK_SUMMARY_GROUP_VISUALS: Record<NetworkReportGroupId, NetworkSummaryGroupVisual> = {
  bk: {
    logo: "/brands/burger-king-transparent.png",
    heroImage: "/design/burger-king/bk-burger.png",
    ink: "#1a1108",
    accent: "#e4720d",
    accentDark: "#a11d14",
    cream: "#fff8f0",
    creamDeep: "#ffe9d1",
    card: "#ffffff",
    wordmarkFont: '"Anton", sans-serif',
    brandTitle: "BURGER KING",
    brandSubtitle: "EXPERIENCIA DEL CLIENTE",
    footerTagline: "Cada reseña es una oportunidad para mejorar el servicio.",
  },
  pp: {
    logo: "/brands/popeyes-transparent.png",
    heroImage: "/design/popeyes/pp-tenders.png",
    ink: "#2b1206",
    accent: "#d9531e",
    accentDark: "#7c2410",
    cream: "#fff6ee",
    creamDeep: "#ffe3cc",
    card: "#ffffff",
    wordmarkFont: '"Anton", sans-serif',
    brandTitle: "POPEYES",
    brandSubtitle: "EXPERIENCIA DEL CLIENTE",
    footerTagline: "Analizamos cada reseña para seguir mejorando.",
  },
  sg: {
    logo: "/brands/santa-gloria-transparent.png",
    heroImage: "/design/santa-gloria/sg-croissant-plate.png",
    ink: "#2c2016",
    accent: "#8a5a34",
    accentDark: "#5c3a1f",
    cream: "#faf5ec",
    creamDeep: "#efe3cf",
    card: "#ffffff",
    wordmarkFont: '"Playfair Display", serif',
    brandTitle: "SANTA GLORIA",
    brandSubtitle: "EXPERIENCIA DEL CLIENTE",
    footerTagline: "Pasión por el buen café y los detalles.",
  },
  th: {
    logo: "/brands/tim-hortons-transparent.png",
    heroImage: "/design/tim-hortons/th-donuts.png",
    ink: "#2a0d0d",
    accent: "#c8102e",
    accentDark: "#7c0a1c",
    cream: "#fff5f0",
    creamDeep: "#fbdede",
    card: "#ffffff",
    wordmarkFont: '"Anton", sans-serif',
    brandTitle: "TIM HORTONS",
    brandSubtitle: "EXPERIENCIA DEL CLIENTE",
    footerTagline: "Cada taza compartida también deja una historia.",
  },
  vault: {
    logo: "/brands/vault.svg",
    heroImage: null,
    ink: "#f2d70e",
    accent: "#f2d70e",
    accentDark: "#17161a",
    cream: "#17161a",
    creamDeep: "#221f26",
    card: "#201d24",
    wordmarkFont: '"Anton", sans-serif',
    brandTitle: "VAULT",
    brandSubtitle: "EXPERIENCIA DEL CLIENTE",
    footerTagline: "Cada reseña abre la puerta a mejorar.",
  },
  hambar: {
    logo: "/brands/grupo-hambar-transparent.png",
    heroImage: null,
    heroImages: ["/design/sibuya/sb-sushi.png", "/design/ribs/rb-ribs.png", "/design/taberna-volapie/tv-product1.png"],
    showBrandColumn: true,
    ink: "#f2ead8",
    accent: "#c9a24b",
    accentDark: "#8a2a24",
    cream: "#141210",
    creamDeep: "#1d1a17",
    card: "#1d1a17",
    wordmarkFont: '"Playfair Display", serif',
    brandTitle: "GRUPO HÁMBAR",
    brandSubtitle: "EXPERIENCIA DEL CLIENTE",
    footerTagline: "Cada experiencia que escuchamos es una oportunidad para ser extraordinarios.",
  },
};
