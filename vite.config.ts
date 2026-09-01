import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// Served from the root of a domain on Vercel. An absolute base keeps the
// service worker's scope and the manifest's start_url pointing at the same
// place, which is what makes the installed app open offline.
export default defineConfig({
  plugins: [react()],
  base: '/',
  server: { host: true },
})
