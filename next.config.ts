import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ["puppeteer", "playwright", "playwright-core", "sharp", "@sparticuz/chromium"],
  // El binario de Chromium de @sparticuz/chromium (carpeta bin/*.br) no se
  // detecta con el análisis estático normal de rutas usadas por Vercel para
  // decidir qué incluir en cada función — hay que declararlo a mano o la
  // función se despliega sin el navegador y captureNegativeReviewAlertPng
  // falla en producción aunque funcione en local.
  outputFileTracingIncludes: {
    "/api/generate-negative-review-image": ["./node_modules/@sparticuz/chromium/bin/**/*"],
    "/api/notifications/whatsapp-alert-image": ["./node_modules/@sparticuz/chromium/bin/**/*"],
  },
  images: {
    formats: ["image/avif", "image/webp"],
    qualities: [75, 90],
    remotePatterns: [
      {
        protocol: "https",
        hostname: "**.supabase.co",
        pathname: "/storage/v1/object/public/**",
      },
    ],
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
