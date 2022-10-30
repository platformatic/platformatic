import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "node:path";

export default defineConfig({
  // https://github.com/vitejs/vite/issues/6215#issuecomment-1076980852
  plugins: [react({ jsxRuntime: "classic" })],
  build: {
    outDir: "dist",
    lib: {
      entry: path.resolve(__dirname, "src/index.js"),
      name: "db-ra-data-rest",
      formats: ["es", "umd"],
      fileName: (format) => `index.${format}.js`,
    },
    rollupOptions: {
      external: ["react", "react-dom", "styled-components"],
      output: {
        globals: {
          react: "React",
          "react-dom": "ReactDOM",
          "styled-components": "styled",
        },
      },
    },
  },
});
