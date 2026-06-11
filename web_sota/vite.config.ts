import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    port: 11047,
    proxy: {
      "/api": "http://127.0.0.1:11046",
      "/health": "http://127.0.0.1:11046",
    },
  },
  build: { outDir: "dist" },
});
