/**
 * Base URL for Guardian API requests. Leave this empty to make browser requests
 * relative to the current origin so a dev proxy or reverse proxy can forward them.
 * Set it only when the browser should call a public backend URL directly.
 */
export const apiBaseUrl = (import.meta.env.VITE_BACKEND_URL as string | undefined) ?? "";
