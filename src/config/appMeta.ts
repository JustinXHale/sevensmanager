import appLogoUrl from '/7smanager.svg?url';

/** Display name in the shell header. Override with `VITE_APP_NAME` in `.env`. */
export const APP_DISPLAY_NAME = import.meta.env.VITE_APP_NAME ?? 'SevensManager';

/** Bundled URL from `public/7smanager.svg` — `?url` so path is correct with base in dev and prod. */
export const APP_LOGO_URL = appLogoUrl;
