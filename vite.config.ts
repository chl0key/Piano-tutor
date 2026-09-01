import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// base: './' keeps the build portable — works from GitHub Pages, a static host,
// or a file server on your laptop that your phone can reach over wifi.
export default defineConfig({
  plugins: [react()],
  base: './',
  server: { host: true },
})
