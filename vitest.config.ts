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
      "lib/reports/network-summary/**/*.test.ts",
    ],
  },
});
