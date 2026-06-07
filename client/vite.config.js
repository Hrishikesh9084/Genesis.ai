import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://localhost:5000' || "https://genesis-ai-tu97.vercel.app  ",
        changeOrigin: true,
      },
    },
  },
});
