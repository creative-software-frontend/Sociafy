import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')

  // Fail the production build clearly if VITE_API_URL is missing — never
  // silently fall back to localhost.
  if (mode === 'production' && !env.VITE_API_URL) {
    throw new Error(
      '[vite] Production build requires VITE_API_URL. ' +
      'Set it in .env.production or the deploy environment (e.g. VITE_API_URL=https://backend-host-url).',
    )
  }

  // Reject localhost/loopback API URLs in production so the deployed bundle can
  // never silently target a developer machine.
  if (
    mode === 'production' &&
    env.VITE_API_URL &&
    /localhost|127\.0\.0\.1|::1/.test(env.VITE_API_URL)
  ) {
    throw new Error(
      '[vite] Production build must not use a localhost API URL. ' +
      'Set VITE_API_URL to the real production backend origin (e.g. VITE_API_URL=https://backend-host-url).',
    )
  }

  // Development is allowed to default to localhost so `npm run dev` works out
  // of the box (e.g. before a developer has created .env.development).
  const define: Record<string, string> = {}
  if (mode === 'development' && !env.VITE_API_URL) {
    define['import.meta.env.VITE_API_URL'] = JSON.stringify('http://localhost:5000')
  }

  return {
    plugins: [react(), tailwindcss()],
    define,
  }
})