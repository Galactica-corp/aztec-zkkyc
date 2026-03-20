/**
 * In Vite dev we always use same-origin `/api` requests so the dev server proxy can
 * forward them internally. Direct browser-to-backend URLs are only used outside dev.
 */
export const apiBaseUrl = import.meta.env.DEV
  ? ""
  : ((import.meta.env.VITE_BACKEND_URL as string | undefined) ?? "");
