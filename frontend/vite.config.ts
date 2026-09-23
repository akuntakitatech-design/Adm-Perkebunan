import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Konfigurasi Vite untuk Live Preview Emergent:
// - Frontend berjalan di port 3000 (di-map oleh supervisor / ingress).
// - Ingress meneruskan /api/* ke backend (port 8001). Untuk konsistensi saat dev,
//   /api dan /uploads juga diproksi ke backend 8001 dari dev server.
// - HMR melewati HTTPS ingress di port 443.
const backendTarget = process.env.VITE_DEV_BACKEND || 'http://127.0.0.1:8001';

export default defineConfig({
  plugins: [react()],
  base: '/',
  server: {
    host: '0.0.0.0',
    port: 3000,
    strictPort: true,
    allowedHosts: true,
    hmr: {
      clientPort: 443,
      protocol: 'wss',
    },
    proxy: {
      '/api': { target: backendTarget, changeOrigin: false },
      '/uploads': { target: backendTarget, changeOrigin: false },
    },
  },
  build: {
    outDir: 'dist',
    sourcemap: false,
    rollupOptions: {
      maxParallelFileOps: 128,
    },
  },
});
