import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { visualizer } from 'rollup-plugin-visualizer';
import path from 'path';
import { defineConfig, loadEnv } from 'vite';

export default defineConfig(({ mode }) => {
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
    worker: {
      format: 'es',
    },
    build: {
      sourcemap: true,
      // Use esbuild minifier — faster and smaller than default
      minify: 'esbuild',
      // Raise warning bar slightly since we're actively splitting chunks
      chunkSizeWarningLimit: 600,
      rollupOptions: {
        output: {
          // Function-based manualChunks gives full control over which modules
          // land in which bundle. Routes are already lazy-loaded by the router;
          // this ensures they are NEVER accidentally pulled into index.js.
          manualChunks(id) {
            // ── React core ────────────────────────────────────────────────────
            if (
              id.includes('node_modules/react/') ||
              id.includes('node_modules/react-dom/') ||
              id.includes('node_modules/react-window/')
            ) {
              return 'react-vendor';
            }

            // ── Animation (separate from icons so icons don't pull motion) ───
            if (id.includes('node_modules/motion') || id.includes('node_modules/framer-motion')) {
              return 'motion-vendor';
            }

            // ── Icons ─────────────────────────────────────────────────────────
            if (id.includes('node_modules/lucide-react') || id.includes('node_modules/@phosphor-icons')) {
              return 'icons-vendor';
            }

            // ── Supabase ──────────────────────────────────────────────────────
            if (id.includes('node_modules/@supabase')) {
              return 'supabase';
            }

            // ── AI vendor (tiny, keep isolated) ──────────────────────────────
            if (id.includes('node_modules/@google/genai')) {
              return 'ai-vendor';
            }

            // ── PDF / reporting (only needed on the Reports page) ─────────────
            if (id.includes('node_modules/jspdf') || id.includes('node_modules/jspdf-autotable')) {
              return 'reports-vendor';
            }

            // ── DOMPurify ─────────────────────────────────────────────────────
            if (id.includes('node_modules/dompurify') || id.includes('node_modules/purify')) {
              return 'purify-vendor';
            }

            // ── Charts / data-viz ─────────────────────────────────────────────
            if (
              id.includes('node_modules/recharts') ||
              id.includes('node_modules/d3-') ||
              id.includes('node_modules/victory')
            ) {
              return 'charts-vendor';
            }

            // ── Heavy feature pages (lazy by router, but explicit chunks ──────
            // ── prevent them landing in the root index.js bundle) ─────────────
            if (id.includes('/pages/dashboard/AdminPanel')) {
              return 'AdminPanel';
            }
            if (id.includes('/pages/dashboard/LogisticsPanel')) {
              return 'LogisticsPanel';
            }
            if (id.includes('/pages/workspace/MeetingsPage')) {
              return 'MeetingsPage';
            }
            if (id.includes('/pages/resources/FinancePage')) {
              return 'FinancePage';
            }
            if (id.includes('/pages/workspace/DecisionsPage')) {
              return 'DecisionsPage';
            }
            if (id.includes('/pages/mission-control/MissionControlPage')) {
              return 'MissionControlPage';
            }
            if (id.includes('/pages/workspace/ReportsCenter')) {
              return 'ReportsCenter';
            }
            if (id.includes('/pages/control/AnalyticsPage')) {
              return 'AnalyticsPage';
            }
            if (id.includes('/services/syntheticStressTest')) {
              return 'syntheticStressTest';
            }

            // ── Execution engine ──────────────────────────────────────────────
            if (
              id.includes('/pages/execution/') ||
              id.includes('/pages/board/') ||
              id.includes('/pages/sprints/') ||
              id.includes('/pages/timeline/') ||
              id.includes('/pages/backlog/')
            ) {
              return 'ExecutionSystem';
            }

            // ── Public / landing pages ────────────────────────────────────────
            if (
              id.includes('/landing/LandingPage') ||
              id.includes('/landing/PrivacyPage') ||
              id.includes('/landing/TermsPage') ||
              id.includes('/landing/SecurityPage') ||
              id.includes('/landing/CompliancePage')
            ) {
              return 'landing';
            }

            // Everything else falls into the default index.js chunk
          },
        },
      },
    },
    server: {
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      // Do not modify — file watching is disabled to prevent flickering during agent edits.
      hmr: process.env.DISABLE_HMR !== 'true',
      // Disable file watching when DISABLE_HMR is true to save CPU during agent edits.
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
    },
  };
});
