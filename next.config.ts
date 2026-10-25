import { readdirSync } from "node:fs";
import type { NextConfig } from "next";


/** Todos los archivos de `public/design/<marca>/` que no figuran en `keep` (rutas "./public/design/..."). */
function unusedDesignFiles(keep: string[]): string[] {
  const kept = new Set(keep);
  const files: string[] = [];
  for (const entry of readdirSync("./public/design", { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;
    for (const file of readdirSync(`./public/design/${entry.name}`)) {
      const path = `./public/design/${entry.name}/${file}`;
      if (!kept.has(path)) files.push(path);
    }
  }
  return files;
}

const CHROMIUM_FILES = ["./node_modules/playwright-core/**/*", "./node_modules/@sparticuz/chromium/bin/**/*"];

// Assets de /public que leen las plantillas mensuales (`lib/reports/monthly/html.ts` para el PDF y
// `lib/reports/monthly/image/*` para la imagen).
const MONTHLY_ASSETS = [
  "./public/reports/monthly/cover-brain.png",
  "./public/nexo-origen-wordmark-text.png",
  "./public/nexo-origen-report-icon.png",
  "./public/nexo-origen-report-wordmark.png",
  "./public/fonts/inter-400-normal.woff2",
  "./public/fonts/inter-500-normal.woff2",
  "./public/fonts/inter-700-normal.woff2",
  "./public/fonts/inter-800-normal.woff2",
  "./public/fonts/roboto-condensed-variable.woff2",
  "./public/fonts/playfair-display-400-italic.woff2",
  "./public/fonts/playfair-display-700-normal.woff2",
  "./public/fonts/playfair-display-800-normal.woff2",
  // Logos por marca (`themes.ts` y las plantillas por marca).
  "./public/design/burger-king/bk-logo.png",
  "./public/design/popeyes/pp-logo.png",
  "./public/design/popeyes/pp-wordmark-2.png",
  "./public/design/santa-gloria/sg-logo.png",
  "./public/design/ribs/rb-logo.png",
  "./public/design/sibuya/sb-logo.png",
  "./public/design/taberna-volapie/tv-logo.png",
  "./public/design/tim-hortons/th-logo.png",
  "./public/design/tim-hortons/th-network-header.png",
  "./public/design/vault/va-logo.png",
];

// Lo que NO lee ninguna ruta mensual. Las exclusiones y las inclusiones no se solapan: así el resultado
// no depende de si Next aplica primero unas u otras.
const MONTHLY_UNUSED_PUBLIC = [
  "./public/brands/**",
  "./public/images/**",
  "./public/reports/headers/**",
  "./public/reports/negative-review/**",
  "./public/*.svg",
  "./public/fondo.png",
  "./public/nexo-logo.png",
  "./public/nexo-origen-logo.png",
  "./public/nexo-origen-icon.png",
  "./public/nexo-origen-report-hero-source.png",
  "./public/debug-*.png",
  "./public/design/README.md",
  "./public/design/*.png",
  // Resto de /public/design: todo lo que no está en MONTHLY_ASSETS (calculado, así nunca se solapa con ellas).
  ...unusedDesignFiles(MONTHLY_ASSETS),
  "./public/fonts/allura-*",
  "./public/fonts/anton-*",
  "./public/fonts/barlow-*",
  "./public/fonts/montserrat-*",
  "./public/fonts/oswald-*",
  "./public/fonts/inter-600-*",
  "./public/fonts/playfair-display-600-*",
  "./public/fonts/playfair-display-400-normal.woff2",
];

/**
 * Cabeceras defensivas del navegador (SEC-010), para TODAS las rutas.
 *
 * - `frame-ancestors 'none'` (+ `X-Frame-Options: DENY` como respaldo heredado): ninguna web puede incrustar Nexo en
 *   un iframe (clickjacking sobre usuarios, permisos, contactos, Conversations...). Es una CSP MÍNIMA a propósito:
 *   NO se define `default-src`, `script-src`, `style-src`, `img-src`, `connect-src` ni `font-src`, porque una CSP
 *   completa puede romper Next.js, Supabase o el renderer y se estudiará aparte.
 * - `frame-ancestors` solo controla quién EMBEBE la página: Chromium (renderer interno) abre las plantillas como
 *   documento principal, así que no le afecta.
 * - Camera/micrófono/geolocalización/Topics: Nexo no usa esas APIs del navegador (se comprobó en el código).
 * - HSTS no se añade aquí: Vercel ya lo envía en el dominio de producción (`max-age=63072000`). Sin `includeSubDomains`
 *   ni `preload` a propósito: afectarían a otros subdominios de nexoorigen.com.
 */
const SECURITY_HEADERS = [
  { key: "Content-Security-Policy", value: "frame-ancestors 'none'" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), browsing-topics=()" },
];

/**
 * Única excepción demostrada: `/preview/network-summary` incrusta en un iframe la plantilla
 * `/templates/network-summary/...` del MISMO origen para previsualizarla. Esa plantilla solo se puede enmarcar desde
 * Nexo mismo (`'self'` / SAMEORIGIN); desde cualquier otro origen sigue bloqueada.
 */
const SAME_ORIGIN_FRAME_HEADERS = [
  { key: "Content-Security-Policy", value: "frame-ancestors 'self'" },
  { key: "X-Frame-Options", value: "SAMEORIGIN" },
];

const nextConfig: NextConfig = {
  // El indicador de dev de Next (el badge "N" flotante) no existe en
  // producción (next start), pero en local se solapa con las plantillas de
  // informes al hacer capturas/QA visual — lo desactivamos para no
  // confundirlo con un logo real de la plantilla.
  devIndicators: false,
  serverExternalPackages: ["playwright-core", "sharp", "@sparticuz/chromium"],
  // Chromium (playwright-core + @sparticuz/chromium), sharp y los assets de las plantillas viven SOLO en el
  // renderer interno (`/api/internal/render`). Las rutas públicas de informes, alertas y Conversations
  // preparan los datos y le piden el PDF/imagen (`lib/render/internal-render-client.ts`), así que no
  // importan nada de eso y no lo empaquetan.
  //
  // El análisis estático de Next no detecta bien los `require()` dinámicos de playwright-core (p. ej.
  // browsers.json) ni el binario de Chromium de @sparticuz/chromium (carpeta bin/*.br), por eso se incluyen
  // a mano. playwright-core pesa ~13 MB, así que se incluye entero en vez de perseguir archivo a archivo.
  //
  // /public: las plantillas leen assets con `path.join(process.cwd(), "public", ...)` y Next, al no poder
  // resolver el nombre, mete TODO /public (~31 MB). Se incluyen exactamente los archivos que leen
  // (MONTHLY_ASSETS) y se excluye el resto. Si una plantilla pasa a leer otro archivo de /public, hay que
  // quitarlo de MONTHLY_UNUSED_PUBLIC y añadirlo a MONTHLY_ASSETS (las dos listas no se solapan).
  outputFileTracingIncludes: {
    "/api/internal/render": [...CHROMIUM_FILES, ...MONTHLY_ASSETS],
  },
  outputFileTracingExcludes: {
    "/api/internal/render": MONTHLY_UNUSED_PUBLIC,
  },
  images: {
    formats: ["image/avif", "image/webp"],
    qualities: [75, 90],
    remotePatterns: [
      {
        protocol: "https",
        // Host EXACTO de nuestro proyecto (SEC-004): un comodín dejaría al optimizador descargar archivos de
        // cualquier proyecto Supabase ajeno.
        hostname: "tsbkcaxbgzfnpqmihabb.supabase.co",
        pathname: "/storage/v1/object/public/**",
      },
    ],
  },
  // Si dos reglas coinciden y fijan la misma cabecera, gana la ÚLTIMA (por eso la excepción va después).
  async headers() {
    return [
      { source: "/:path*", headers: SECURITY_HEADERS },
      { source: "/templates/network-summary/:path*", headers: SAME_ORIGIN_FRAME_HEADERS },
    ];
  },
  async redirects() {
    return [
      { source: "/configuracion", destination: "/dashboard/ajustes", permanent: false },
      { source: "/restaurantes", destination: "/dashboard/restaurantes", permanent: false },
      { source: "/restaurantes/:path*", destination: "/dashboard/restaurantes/:path*", permanent: false },
      { source: "/resenas", destination: "/dashboard/resenas", permanent: false },
      { source: "/resenas/:path*", destination: "/dashboard/resenas/:path*", permanent: false },
      { source: "/alertas", destination: "/dashboard/alertas", permanent: false },
      { source: "/ranking", destination: "/dashboard/ranking", permanent: false },
      { source: "/nexo-prevent", destination: "/dashboard/nexo-prevent", permanent: false },
      { source: "/informes", destination: "/dashboard/informes", permanent: false },
      { source: "/talento", destination: "/dashboard/talento", permanent: false },
    ];
  },
};

export default nextConfig;
