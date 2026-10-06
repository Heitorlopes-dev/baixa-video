import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import process from "node:process";

const host = process.env.TAURI_DEV_HOST;

// https://vite.dev/config/
export default defineConfig(() => ({
  plugins: [react(), tailwindcss()],

  // O padrão do Vite é o Chrome 111+, mas o Android usa o WebView do aparelho, que pode
  // estar parado numa versão antiga (o emulador do Android 13 traz o 109). Sem isto, as
  // cores do Tailwind (oklch) somem nele e o botão Baixar fica invisível. Com o Chrome 99
  // no alvo, o Lightning CSS escreve cada cor também em hex. Abaixo do 99 não adianta:
  // o Tailwind 4 depende de @layer. O resto é o padrão do Vite (baseline-widely-available).
  build: {
    cssTarget: ["chrome99", "edge111", "firefox114", "safari16.4", "ios16.4"],
  },

  // Vite options tailored for Tauri development and only applied in `tauri dev` or `tauri build`
  //
  // 1. prevent Vite from obscuring rust errors
  clearScreen: false,
  // 2. tauri expects a fixed port, fail if that port is not available
  server: {
    port: 1420,
    strictPort: true,
    host: host || false,
    hmr: host
      ? {
          protocol: "ws",
          host,
          port: 1421,
        }
      : undefined,
    watch: {
      // 3. tell Vite to ignore watching `src-tauri`
      ignored: ["**/src-tauri/**"],
    },
  },
}));
