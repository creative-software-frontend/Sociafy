/**
 * Single source of truth for backend API / Socket.IO URLs.
 *
 * All values derive from VITE_API_URL (the backend origin), e.g.
 *   http://localhost:5000  (development)
 *   https://backend-host-url (production)
 *
 * There is deliberately NO localhost fallback: the production build validates
 * that VITE_API_URL is set, so a missing value surfaces as an error instead of
 * silently pointing the app at localhost.
 */

const raw: string | undefined = import.meta.env.VITE_API_URL;

// Normalize to the origin: strip trailing "/api" (legacy) and trailing slashes.
export const API_ORIGIN: string = (raw || '')
    .replace(/\/api\/?$/, '')
    .replace(/\/+$/, '');

export const API_URL: string = `${API_ORIGIN}/api`;
export const SOCKET_URL: string = API_ORIGIN;

/**
 * Resolve a backend media path (e.g. `/uploads/...`) against the configured
 * origin so it works in both development and production.
 */
export function resolveMediaUrl(url?: string | null): string {
    if (!url) return '';
    if (/^(https?:)?\/\//.test(url) || url.startsWith('data:')) return url;
    return `${API_ORIGIN}${url.startsWith('/') ? '' : '/'}${url}`;
}

if (!API_ORIGIN) {
    console.error('[config] VITE_API_URL is not set. Backend API and Socket.IO URLs are empty.');
}