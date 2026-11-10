import react from '@vitejs/plugin-react';
import { defineConfig, loadEnv } from 'vite';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  return {
    plugins: [react()],
    server: {
      port: 5173,
      proxy: { '/api': { target: `http://localhost:${env.PORT || 5050}`, changeOrigin: false } },
    },
    build: { sourcemap: false, chunkSizeWarningLimit: 600 },
  };
});
