import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react-swc";
import path from "node:path";
import { defineConfig } from "vite";
import { checker } from "vite-plugin-checker";
import svgr from "vite-plugin-svgr";
import tsconfigPaths from "vite-tsconfig-paths";

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const isDev = mode === "development";

  return {
    plugins: [
      tailwindcss(),
      react(),
      svgr(),
      tsconfigPaths(),
      isDev &&
        checker({
          eslint: {
            lintCommand: 'eslint "./src/**/*.{ts,tsx}"',
            useFlatConfig: true,
          },
          overlay: {
            initialIsOpen: false,
          },
          typescript: true,
        }),
    ],
    resolve: {
      alias: {
        "@": path.resolve("./src"),
      },
    },
    server: {
      // Proxy /api to backend; set target to your Guardian Backend URL when needed.
      proxy: {
        "/api": {
          target: "http://localhost:3000",
          changeOrigin: true,
        },
      },
    },
  };
});
