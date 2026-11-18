# Licencias de dependencias

Todas las dependencias de la Fase 1 son de desarrollo; el bundle publicado incluye únicamente
el runtime de Svelte.

| Paquete | Uso | Licencia* |
|---|---|---|
| svelte | UI (runtime incluido en el bundle) | MIT |
| vite | build y servidor de desarrollo | MIT |
| @sveltejs/vite-plugin-svelte | integración Svelte–Vite | MIT |
| typescript | tipado | Apache-2.0 |
| svelte-check | verificación de tipos | MIT |
| vitest | pruebas | MIT |
| vite-plugin-pwa | manifest + Service Worker (build) | MIT |
| workbox-build / workbox-window | precache y registro del SW | MIT |
| @types/node | tipos para vite.config.ts | MIT |

\* Según lo conocido al escribir esto. Verificar en el campo `license` de cada paquete
(`npm ls --all` / repositorio oficial) antes de publicar. Cada nueva dependencia debe registrarse
aquí **antes** de añadirse; en especial las de quitar fondo (revisar AGPL-3.0 y licencias de modelos).

No se incluyen fuentes ni imágenes de terceros en esta fase.
