import path from 'path';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
    // Read env with Vite's convention; only VITE_* is exposed by default
    const env = loadEnv(mode, '.', '');
    const viteGeminiKey = env.VITE_GEMINI_API_KEY || env.GEMINI_API_KEY || '';
    return {
      // For GitHub Pages under /culinarylens
      base: '/culinarylens/',
      server: {
        port: 3000,
        host: '0.0.0.0',
      },
      plugins: [react()],
      define: {
        // Expose a single canonical key the app uses
        'process.env.API_KEY': JSON.stringify(viteGeminiKey),
      },
      resolve: {
        alias: {
          '@': path.resolve(__dirname, '.'),
        }
      }
    };
});
