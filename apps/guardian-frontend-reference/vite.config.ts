import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react-swc";
import path from "node:path";
import { defineConfig, loadEnv } from "vite";
import { checker } from "vite-plugin-checker";
import svgr from "vite-plugin-svgr";
import tsconfigPaths from "vite-tsconfig-paths";

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const isDev = mode === "development";
  const env = loadEnv(mode, process.cwd(), "");
  const backendUrl = env.VITE_BACKEND_URL ?? "http://localhost:3005";
  const port = Number(env.VITE_PORT ?? 5173);

  return {
    resolve: {
      alias: {
        "@": path.resolve("./src"),
      },
      dedupe: ["react", "react-dom"],
    },
    optimizeDeps: {
      include: ["react", "react-dom"],
    },
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
    server: {
      port,
      // Proxy /api to backend; target comes from VITE_BACKEND_URL in .env
      proxy: {
        "/api": {
          target: backendUrl,
          changeOrigin: true,
        },
      },
    },
  };
});
