import { copyFileSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { defineConfig, loadEnv, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

const pkg = JSON.parse(readFileSync('./package.json', 'utf-8'));

/** GitHub Pages serves 404.html for unknown routes — copy index.html so SPA routing works. */
function ghPages404(): Plugin {
  return {
    name: 'gh-pages-404',
    closeBundle() {
      try {
        copyFileSync('dist/index.html', 'dist/404.html');
      } catch { /* dev server — no dist yet */ }
    },
  };
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  const appName = env.VITE_APP_NAME || 'SevensManager';

  return {
  define: {
    __APP_VERSION__: JSON.stringify(pkg.version),
  },
  base: '/sevensmanager/',
  plugins: [
    react(),
    ghPages404(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['7smanager.svg'],
      manifest: {
        name: appName,
        short_name: appName,
        description: 'Rugby sevens squad, matches, and analytics (PWA)',
        theme_color: '#0f1419',
        background_color: '#0f1419',
        display: 'standalone',
        orientation: 'portrait-primary',
        start_url: './',
        icons: [
          {
            src: '7smanager.svg',
            sizes: '512x512',
            type: 'image/svg+xml',
            purpose: 'any maskable',
          },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2}'],
      },
    }),
  ],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'src'),
    },
  },
};
});
