import path from 'path';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, '.', '');
  return {
    plugins: [react()],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, './src'),
      },
    },
    server: {
      host: '0.0.0.0',
      strictPort: true,
      allowedHosts: ['app.ratecaster.xyz'],
      port: 8080,
      open: true, // Open browser on start
      proxy: {
        '/api': {
          target: 'http://localhost:3001',
          changeOrigin: true,
         // rewrite: (path) => path.replace(/^\/api/, '/api'),
        },
        '/socket.io': {
          target: 'http://localhost:3001',
          ws: true,
        },
      },
    },
    build: {
      outDir: 'dist',
    },
  };
});
