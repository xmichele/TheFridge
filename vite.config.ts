import { fileURLToPath, URL } from 'node:url';

import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';
import { defineConfig } from 'vitest/config';

const githubPagesBase = '/TheFridge/';

export default defineConfig(({ command }) => {
  const base = command === 'serve' ? '/' : githubPagesBase;

  return {
    base,
    plugins: [
      react(),
      VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg', 'apple-touch-icon.png', 'icons/*.png'],
      manifest: {
        name: 'The Fridge',
        short_name: 'The Fridge',
        description:
          'Gestisci dispensa, ricette, piano pasti e lista della spesa anche offline.',
        theme_color: '#234034',
        background_color: '#f6f0e1',
        display: 'standalone',
        start_url: base,
        scope: base,
        lang: 'it',
        shortcuts: [
          {
            name: 'Aggiungi ingrediente',
            short_name: 'Ingrediente',
            url: `${base}pantry`,
            description: 'Apri la dispensa e aggiungi un ingrediente',
          },
          {
            name: 'Nuova ricetta',
            short_name: 'Ricetta',
            url: `${base}recipes/new`,
            description: 'Crea una nuova ricetta',
          },
          {
            name: 'Lista spesa',
            short_name: 'Spesa',
            url: `${base}shopping-list`,
            description: 'Apri la lista della spesa',
          },
        ],
        icons: [
          {
            src: `${base}icons/pwa-192.png`,
            sizes: '192x192',
            type: 'image/png',
          },
          {
            src: `${base}icons/pwa-512.png`,
            sizes: '512x512',
            type: 'image/png',
          },
          {
            src: `${base}icons/maskable-512.png`,
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          },
          {
            src: `${base}apple-touch-icon.png`,
            sizes: '180x180',
            type: 'image/png',
          },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg,webmanifest,json}'],
        globIgnores: ['support/original-recipes-support.json', 'support/original-recipes-details/*.json'],
        navigateFallback: 'index.html',
        maximumFileSizeToCacheInBytes: 12 * 1024 * 1024,
      },
      devOptions: {
        enabled: true,
      },
      }),
    ],
    resolve: {
      alias: {
        '@': fileURLToPath(new URL('./src', import.meta.url)),
      },
    },
    test: {
      environment: 'jsdom',
      setupFiles: './vitest.setup.ts',
      css: true,
    },
  };
});
