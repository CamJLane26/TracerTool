import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
// @ts-expect-error – vite-plugin-cesium-build's typings use `export =` but the ESM
// distribution has a default export; this import works fine at runtime.
import cesium from "vite-plugin-cesium-build";

export default defineConfig({
  plugins: [
    react(),
    // IIFE mode (default): injects the pre-built Cesium.js script tag, avoiding
    // the need to ESM-bundle thousands of Cesium source files at dev time.
    // css:true auto-injects Cesium widgets.css.
    cesium({ css: true }),
  ],
});
