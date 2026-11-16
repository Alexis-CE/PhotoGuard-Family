import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';
import { svelte } from '@sveltejs/vite-plugin-svelte';

// base './' → los assets se resuelven de forma relativa, así el build funciona
// en GitHub Pages bajo cualquier nombre de repo (https://usuario.github.io/repo/).
export default defineConfig({
  base: './',
  plugins: [svelte()],
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
