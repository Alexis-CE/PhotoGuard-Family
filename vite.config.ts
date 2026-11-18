import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';
import { svelte } from '@sveltejs/vite-plugin-svelte';
import { VitePWA } from 'vite-plugin-pwa';

// base './' → los assets, el manifest y el Service Worker se resuelven de forma relativa a la
// página, así todo funciona en GitHub Pages bajo una ruta de repo (https://usuario.github.io/repo/).
export default defineConfig({
  base: './',
  plugins: [
    svelte(),
    VitePWA({
      // 'prompt': el SW nuevo queda en espera y NO toma el control hasta que el usuario acepta.
      registerType: 'prompt',
      // El registro lo hace src/lib/services/pwa.svelte.ts (necesitamos controlar el flujo).
      injectRegister: false,
      includeAssets: ['icons/icon.svg', 'icons/apple-touch-icon.png'],
      manifest: {
        id: './',
        name: 'PhotoGuard Family',
        short_name: 'PhotoGuard',
        description: 'Protege tus fotos con marcas de agua. Todo se procesa en tu dispositivo.',
        lang: 'es',
        start_url: './',
        scope: './',
        display: 'standalone',
        orientation: 'any',
        background_color: '#0f1012',
        theme_color: '#0f1012',
        icons: [
          { src: 'icons/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
          { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
          { src: 'icons/icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' }
        ]
      },
      workbox: {
        // Solo el «app shell» estático. Las fotos del usuario nunca pasan por la red ni por aquí
        // (se leen con la File API y se exportan con Blob), y no hay runtimeCaching de nada más.
        globPatterns: ['**/*.{js,css,html,svg,png,ico,webmanifest,woff2}'],
        navigateFallback: 'index.html',
        cleanupOutdatedCaches: true,
        // Sin skipWaiting/clientsClaim automáticos: la activación la decide el usuario.
        skipWaiting: false,
        clientsClaim: false
      },
      devOptions: { enabled: false }
    })
  ],
  resolve: {
    alias: {
      $lib: fileURLToPath(new URL('./src/lib', import.meta.url))
    }
  },
  build: {
    target: 'es2022'
  },
  test: {
    include: ['tests/**/*.test.ts'],
    environment: 'node'
  }
});
