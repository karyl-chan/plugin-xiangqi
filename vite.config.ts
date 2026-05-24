import { defineConfig } from "vite";
import vue from "@vitejs/plugin-vue";
import { viteSingleFile } from "vite-plugin-singlefile";

export default defineConfig({
  plugins: [vue(), viteSingleFile()],
  root: "web",
  build: {
    outDir: "../dist/ui",
    emptyOutDir: true,
    target: "es2022",
    cssCodeSplit: false,
    assetsInlineLimit: 100_000_000,
    rollupOptions: {
      output: { inlineDynamicImports: true },
    },
  },
  server: {
    port: 5175,
    proxy: {
      "/api": "http://localhost:3000",
    },
  },
});
