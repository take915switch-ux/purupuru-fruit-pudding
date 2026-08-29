import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "node:path";

export default defineConfig({
  root: path.resolve(__dirname, "github-pages"),
  publicDir: path.resolve(__dirname, "public"),
  base: "/purupuru-fruit-pudding/",
  plugins: [react()],
  build: {
    outDir: path.resolve(__dirname, "docs"),
    emptyOutDir: true,
  },
});
