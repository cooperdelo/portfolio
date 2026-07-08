import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Static site on Vercel. We build locally and commit the output to ../world,
// which is served at cooperdelo.com/world. Photos/videos live at the repo root
// (/photos, /videos) and are same-origin in production. In dev we proxy them to
// a tiny static server running on the repo root (port 8799).
export default defineConfig({
  plugins: [react()],
  base: '/world/',
  build: {
    outDir: '../world',
    emptyOutDir: true,
    assetsInlineLimit: 0
  },
  server: {
    port: 5175,
    proxy: {
      '/photos': { target: 'http://localhost:8799', changeOrigin: true },
      '/videos': { target: 'http://localhost:8799', changeOrigin: true }
    }
  }
});
