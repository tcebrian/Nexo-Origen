import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: { "@": fileURLToPath(new URL("./", import.meta.url)) },
  },
  test: {
    environment: "node",
    include: [
      "lib/conversations/**/*.test.ts",
      "lib/supabase/conversations-*.test.ts",
      "lib/whatsapp/**/*.test.ts",
      "lib/auth/**/*.test.ts",
      "lib/reports/network-summary/**/*.test.ts",
      "lib/render/**/*.test.ts",
      "lib/dashboard/**/*.test.ts",
      "lib/reports/daily/**/*.test.ts",
      "lib/alerts/**/*.test.ts",
      "lib/reviews/**/*.test.ts",
      "lib/talento/**/*.test.ts",
    ],
  },
});
