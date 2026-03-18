/**
 * Base URL for Guardian API requests. When set (e.g. in .env as VITE_BACKEND_URL),
 * the frontend calls the backend directly. When empty, requests are relative to the
 * current origin (Vite proxy can forward them in dev).
 */
export const apiBaseUrl = (import.meta.env.VITE_BACKEND_URL as string | undefined) ?? "";
