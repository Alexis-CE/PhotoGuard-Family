# PWA: instalación, offline y actualizaciones

PhotoGuard es una web estática. En **Android e iOS** se puede instalar como app (PWA); en
**Windows, Linux y macOS** se usa directamente en el navegador. No hay app nativa ni Tauri/Electron.

## Cómo instalar

| Plataforma | Procedimiento |
|---|---|
| **Android** (Chrome / Edge) | Abre la URL. En **Inicio** aparece la tarjeta «Instala PhotoGuard» → **Instalar**. Si no aparece: menú ⋮ → «Instalar app» / «Añadir a pantalla de inicio». |
| **iOS** (Safari) | Toca **Compartir** → **«Añadir a pantalla de inicio»** → **Añadir**. iOS no ofrece un botón programático; la app muestra estas instrucciones en Inicio. |
| **Escritorio** | Se usa en el navegador. PhotoGuard no muestra promoción de instalación. Algunos navegadores ofrecen su propia opción «Instalar» en la barra de direcciones: no se puede ni se pretende impedirlo. |

La ayuda de instalación solo aparece en móviles y se puede descartar. Una vez instalada, abre en
ventana independiente (`display: standalone`) y deja de mostrarse.

## Cómo funciona

- **Manifest** (`manifest.webmanifest`, generado por `vite-plugin-pwa`): nombre «PhotoGuard Family»,
  nombre corto «PhotoGuard», `standalone`, tema oscuro, iconos 192 y 512 (`any`) y 512 `maskable`.
  `start_url`, `scope` e `id` son `./` (relativos): funcionan bajo `/<repo>/`.
- **Iconos:** `scripts/make-icons.mjs` los genera sin dependencias (`npm run icons`). iOS usa
  `apple-touch-icon.png` (180 px) y las metaetiquetas `apple-mobile-web-app-*` de `index.html`.
- **Service Worker** (Workbox `generateSW`, modo `prompt`): precachea solo el «app shell» estático
  (HTML, JS, CSS, SVG/PNG, manifest, fuentes `.woff2` locales). **Nunca** cachea ni intercepta fotos:
  las fotos entran por la File API y salen como Blob descargado; no hay `runtimeCaching`.
- **Offline:** tras la primera carga la app queda guardada. La primera visita no está controlada por el
  SW hasta recargar una vez (no usamos `clientsClaim`, para no cambiar de versión a mitad de sesión).
- **Modelos futuros:** irán en una Cache propia, `photoguard-models-v1`, separada del precache, que
  una actualización de la app no borra (`src/lib/services/resources.ts`). En esta fase no se descarga
  ningún modelo; la función `describeMissingResource` ya genera el aviso «necesita descargar X».

## Actualizaciones

1. Cada hora y al volver a la pestaña, la app busca un `sw.js` nuevo (solo si hay conexión).
2. Si hay uno, **no se activa solo**: aparece el aviso «Hay una nueva versión» con **Actualizar** y **Más tarde**.
3. **Más tarde** lo pospone; queda el acceso «Actualización disponible» en el encabezado. Mientras
   tanto se sigue usando la versión actual.
4. Si se está **procesando** una foto (importando o exportando), **Actualizar** queda deshabilitado
   hasta que termine.
5. Si hay una **foto abierta**, pide confirmación: recargar cierra la foto y los ajustes aún no
   guardados (hoy viven solo en memoria; los presets en IndexedDB llegarán en otra fase).
6. Al aceptar se activa el SW nuevo y la app se recarga.

### Datos locales

Actualizar la app **no toca** IndexedDB, `localStorage` ni la Cache de modelos: el SW solo
administra sus propias cachés de precache (`cleanupOutdatedCaches`). Se comprueba en
`scripts/verify-pwa.mjs` (escribe datos de prueba antes de actualizar y los lee después).
**Responsabilidad futura:** si cambia el esquema de IndexedDB, hace falta una migración versionada
(los presets deben conservarse entre versiones).

## GitHub Pages

- `base: './'` en Vite: assets, manifest y SW son relativos a la página. Verificado sirviendo `dist/`
  bajo `/photoguard-family/` (`npm run serve:pages`), no solo desde `/`. El alcance del SW queda en
  `/<repo>/`.
- **Limitaciones de Pages que afectan a la PWA:**
  - No se pueden fijar cabeceras HTTP. Pages envía `cache-control: max-age=600`: tras un despliegue,
    algunos navegadores pueden tardar hasta ~10 min en ver los archivos nuevos. 🔍 Verificar en el
    primer despliegue real.
  - Sin COOP/COEP no hay `SharedArrayBuffer`: afectará a WASM con hilos cuando lleguen los modelos.
  - Un SW solo controla su ruta (`/<repo>/`); no puede cubrir el dominio entero.
  - Si el repo cambia de nombre o dominio, es otro origen/alcance: la app instalada y sus datos locales
    **no se migran** (IndexedDB es por origen).
  - Pages exige HTTPS (lo da); en local `localhost` cuenta como seguro.

## Compatibilidad

Se distinguen tres cosas: **web** (la app funciona), **instalación** (PWA) y **offline** (SW).
«Verificado» = comprobado automáticamente en este proyecto; «Esperado» = según documentación de cada
navegador, **sin probar** aquí.

| Navegador | Web | Instalación PWA | Offline |
|---|---|---|---|
| Windows – Chrome | ✅ Verificado (Chrome 157, headless) | ✅ Manifest e instalabilidad sin errores (Chromium) | ✅ Verificado (recarga sin red) |
| Windows – Edge | Esperado (Chromium) | Esperado | Esperado — *no verificado: el Edge headless no arrancó en este equipo* |
| Android – Chrome | Esperado | Esperado (`beforeinstallprompt` + «Instalar app») | Esperado |
| Android – Edge | Esperado | Esperado | Esperado |
| iOS – Safari | Esperado | Manual: «Añadir a pantalla de inicio» (sin API de instalación) | Esperado; 🔍 revisar límites de almacenamiento |
| Firefox escritorio | Esperado | Sin instalación PWA según su documentación 🔍 | Esperado (SW sí) |

Lo único que **no** se probó en ningún móvil real: instalación, icono en pantalla de inicio,
modo standalone, safe areas, selector de archivos y exportación en iOS/Android. Lista de prueba manual:

- [ ] Android: aparece «Instalar», se instala con el icono naranja y abre sin barra del navegador.
- [ ] iOS: «Añadir a pantalla de inicio» muestra el icono y abre en ventana propia.
- [ ] Modo avión → abrir la app instalada → carga Inicio y el editor.
- [ ] Importar una foto de la galería, ajustar y exportar; revisar que el archivo no tenga interfaz.
- [ ] Tras un despliegue nuevo: aviso de actualización, «Más tarde», y luego «Actualizar».

### Notas de plataforma

- **iOS:** sin `beforeinstallprompt`. Safari puede borrar el almacenamiento de sitios web no instalados
  tras un periodo sin uso (política de WebKit 🔍); instalar la app ayuda. Cuando existan presets,
  conviene la exportación ZIP como respaldo.
- **Android:** el botón «Instalar» depende de que el navegador dispare `beforeinstallprompt`; si el
  usuario lo rechaza, no vuelve a ofrecerse esa sesión.
- **Escritorio:** la experiencia completa es la web; no hay instaladores `.exe`/`.msi`.

## Probar

```bash
npm run verify:pwa   # compila y lo comprueba en un Chrome real (requiere Chrome o Edge instalado)
npm run serve:pages  # sirve dist/ en http://localhost:4180/photoguard-family/ (simula Pages)
```

`verify:pwa` comprueba: manifest e instalabilidad (CDP), iconos, alcance del SW bajo el subdirectorio,
offline, que Inicio sea siempre el punto de entrada, editor + exportación (regresión de la Fase 1),
aviso/pospuesto/confirmación/recarga de la actualización y supervivencia de IndexedDB,
`localStorage` y la Cache de modelos.
