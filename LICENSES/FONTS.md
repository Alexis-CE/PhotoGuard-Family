# Tipografías incluidas

PhotoGuard empaqueta **cuatro familias** como WOFF2 locales (subset latino, pesos 400 y 700). No se usa
Google Fonts, ningún CDN ni solicitudes externas: las fuentes se sirven desde `/fonts` y quedan en el
precache del Service Worker, así funcionan sin conexión.

| Familia | id estable | Pesos | Versión (@fontsource) | Licencia (`package.json`) | Primera línea del LICENSE empaquetado |
|---|---|---|---|---|---|
| Inter | `inter` | 400, 700 | 5.3.0 | OFL-1.1 | Copyright 2016 The Inter Project Authors (https://github.com/rsms/inter) |
| Roboto | `roboto` | 400, 700 | 5.3.0 | OFL-1.1 | Copyright 2011 The Roboto Project Authors (https://github.com/googlefonts/roboto-classic) |
| Montserrat | `montserrat` | 400, 700 | 5.3.0 | OFL-1.1 | Copyright 2011 The Montserrat Project Authors (https://github.com/JulietaUla/Montserrat) |
| Source Sans 3 | `source-sans-3` | 400, 700 | 5.3.1 | OFL-1.1 | Google Inc. |

Los **ids son estables** (se guardarán en los presets): `inter`, `roboto`, `montserrat`, `source-sans-3`.
La negrita de la interfaz (casilla «Negrita») usa el peso real 700; el resto, 400.

## Procedencia y reproducción

- Origen: paquetes npm `@fontsource/*` (Fontsource), copiados con `npm run fonts` (`scripts/sync-fonts.mjs`),
  que **falla** si un paquete no declara `OFL-1.1`. Los archivos resultantes están commiteados en
  `public/fonts` (la app no depende de `node_modules` ni de la red).
- Se usan sin modificar: ni se renombran ni se tocan los archivos tal como los distribuye Fontsource.
- Licencias: `LICENSES/fonts/<id>-OFL-1.1.txt` y una copia idéntica junto a las fuentes publicadas
  (`public/fonts/<id>/LICENSE.txt`), porque la OFL exige que el texto acompañe a la redistribución.

## Licencias verificadas

- Las cuatro familias están bajo **SIL Open Font License 1.1**: lo declara el `package.json` de cada paquete
  y lo confirma el texto del `LICENSE` que incluye (se comprueba en `tests/fonts.test.ts`).
- **Roboto:** la versión empaquetada es OFL-1.1, **no** Apache-2.0 (el texto del LICENSE no menciona Apache).
- **Source Sans 3:** el LICENSE de Fontsource solo trae el encabezado «Google Inc.». El titular original del
  diseño es Adobe, con nombre de fuente reservado («Source») según las fuentes consultadas (copyright de Debian
  y publicaciones de Adobe). 🔍 Antes de una distribución pública amplia conviene revisar el `OFL.txt` del
  repositorio oficial de Adobe. Al no modificar ni renombrar los archivos, la restricción del nombre reservado
  no se activa.
- Ninguno de los cuatro LICENSE empaquetados declara «Reserved Font Name» en su línea de copyright.
- Condiciones OFL a respetar: conservar el texto de licencia con las fuentes, no venderlas por separado y no
  usar el nombre de los autores para promocionar PhotoGuard.

## Tamaño

| Archivo | Bytes | SHA-256 (16 primeros) |
|---|---|---|
| `inter-latin-400-normal.woff2` | 23664 | `8909904ab6c872eb…` |
| `inter-latin-700-normal.woff2` | 24356 | `6f56409fd3d64bb8…` |
| `roboto-latin-400-normal.woff2` | 21884 | `425c0713a8176f92…` |
| `roboto-latin-700-normal.woff2` | 22240 | `b9d66d1708156f76…` |
| `montserrat-latin-400-normal.woff2` | 18780 | `e66bcd2761ab6924…` |
| `montserrat-latin-700-normal.woff2` | 18824 | `f9d9e65b15372ceb…` |
| `source-sans-3-latin-400-normal.woff2` | 15696 | `0f73f35e08cde0a2…` |
| `source-sans-3-latin-700-normal.woff2` | 15596 | `ae35266f2ab0d531…` |

**Total: 161040 bytes (~157 KiB).** El precache pasó de 16 a 24 entradas (≈ 118 → 278 KiB).

## Carga y render

- `@font-face` en `src/styles/fonts.css` (`font-display: block`).
- Antes de **dibujar la vista previa** y antes de **exportar**, `ensureFontsLoaded` espera
  `document.fonts.load()` de la familia y peso exactos que usa el render. Si la fuente no carga, la
  exportación se cancela con un mensaje: nunca se exporta con una fuente sustituta.
- Verificado en Chrome real (`npm run verify:pwa`): las 8 caras cargan sin red; cada familia y la negrita
  producen exportaciones distintas; la vista previa coincide con la exportación (diferencia media < 4/255).

## Limitaciones

- Subset **latino**: caracteres fuera de él (p. ej. cirílico, griego, emoji) usan la fuente genérica del
  dispositivo y pueden verse distinto entre equipos.
- Para añadir pesos o idiomas habría que ampliar los archivos (más descarga) y registrar su licencia aquí.