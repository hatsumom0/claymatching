import { defineConfig } from "vite";

export default defineConfig({
  build: {
    copyPublicDir: false,
    emptyOutDir: true,
    outDir: "site/claymatching/sui-dist",
    rolldownOptions: {
      input: "site/claymatching-sui-src/sui-wallet.js",
      output: {
        chunkFileNames: "chunks/[name]-[hash].js",
        entryFileNames: "sui-wallet.js",
      },
    },
  },
});
