import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { visualizer } from 'rollup-plugin-visualizer';
import path from 'path';
import {defineConfig, loadEnv} from 'vite';

export default defineConfig(({mode}) => {
  const env = loadEnv(mode, '.', '');

  // GitHub Pages serves from /{repo-name}/ — use the base path injected by
  // actions/configure-pages, or '/' for local dev / Docker deployments.
  const base = env.VITE_BASE_PATH || '/';

  return {
    base,
    plugins: [react(), tailwindcss(), visualizer({ open: false, filename: 'stats.html' })],
    define: {
      'process.env.GEMINI_API_KEY': JSON.stringify(env.GEMINI_API_KEY),
    },
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    build: {
      sourcemap: true,
      chunkSizeWarningLimit: 800,
      rollupOptions: {
        output: {
          manualChunks: {
            'react-vendor': ['react', 'react-dom', 'react-window'],
            'ui-vendor': ['lucide-react', '@phosphor-icons/react', 'motion/react', 'motion'],
            'supabase': ['@supabase/supabase-js'],
            'reports-vendor': ['jspdf', 'jspdf-autotable'],
            'ai-vendor': ['@google/genai']
          },
        },
      },
    },
    server: {
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      // Do not modifyâ€”file watching is disabled to prevent flickering during agent edits.
      hmr: process.env.DISABLE_HMR !== 'true',
      // Disable file watching when DISABLE_HMR is true to save CPU during agent edits.
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
    },
  };
});
