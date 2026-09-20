import { resolve } from "node:path";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [react()],
  root: resolve(__dirname, "src/preview"),
  publicDir: false,
  server: {
    port: 4173,
    host: "127.0.0.1",
  },
});
