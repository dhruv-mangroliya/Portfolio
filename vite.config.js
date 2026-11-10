import react from '@vitejs/plugin-react';
import { defineConfig, loadEnv } from 'vite';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  return {
    plugins: [react()],
    server: {
      port: 5173,
      // Everything the Node server renders itself (API, crawler files, MCP, standalone pages).
      proxy: Object.fromEntries(
        ['/api', '/mcp', '/.well-known', '/robots.txt', '/sitemap.xml', '/llms.txt', '/llms-full.txt', '/favicon.svg', '/about', '/contact', '/privacy', '/terms']
          .map((p) => [p, { target: `http://localhost:${env.PORT || 5050}`, changeOrigin: false }])
      ),
    },
    build: { sourcemap: false, chunkSizeWarningLimit: 600 },
  };
});
