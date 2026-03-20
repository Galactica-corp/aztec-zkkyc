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
  const proxyTarget = env.BACKEND_PROXY_TARGET ?? "http://localhost:3005";
  const port = Number(env.VITE_PORT ?? 3005);

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
      // Keep the proxy target server-only. Values prefixed with VITE_ are exposed
      // to browser code, which would leak Docker-internal hostnames to clients.
      proxy: {
        "/api": {
          target: proxyTarget,
          changeOrigin: true,
        },
      },
    },
  };
});
