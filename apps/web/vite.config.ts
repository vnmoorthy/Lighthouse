import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'node:path';

const ROOT = resolve(__dirname, '.');
const API_PORT = process.env.API_PORT ?? '5174';
const WEB_PORT = Number.parseInt(process.env.WEB_PORT ?? '5173', 10);

export default defineConfig({
  root: ROOT,
  plugins: [react()],
  server: {
    port: WEB_PORT,
    strictPort: true,
    host: '127.0.0.1',
    proxy: {
      '/api': {
        target: `http://127.0.0.1:${API_PORT}`,
        changeOrigin: false,
      },
    },
  },
  build: {
    outDir: resolve(ROOT, 'dist'),
    emptyOutDir: true,
    sourcemap: true,
  },
  resolve: {
    alias: {
      '@web': resolve(ROOT, 'src'),
    },
  },
});
