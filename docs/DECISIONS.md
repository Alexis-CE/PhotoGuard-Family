# Decisiones técnicas (Fase 1)

## Un solo camino de render
`renderComposition()` (`src/lib/engines/render.ts`) lo usan la vista previa y la exportación.
Todas las medidas son **relativas al lado corto de la imagen** (%), por eso la preview a 1600 px
y la exportación a 12 MP dan la misma composición. El motor no conoce Svelte ni el DOM.

## La interfaz nunca toca la imagen
El canvas de exportación se crea aparte (`exportPhoto`), se compone solo con foto + marcas y se
libera al terminar. Sidebar, botones y etiquetas son HTML fuera de ese canvas.

## Capa temporal por marca
Cada marca se dibuja opaca en una capa y se compone una vez con su opacidad. Evita que el
contorno («Grosor») y el relleno se sumen y que las repeticiones solapadas se oscurezcan.

## Grosor
Se implementa con un contorno del mismo color (`strokeText`), en % del tamaño de la fuente. Se
eligió sobre `font-weight` porque las fuentes del sistema no tienen todos los pesos y el control
no cambiaría nada en varias de ellas.

## Patrón
`layout.ts` calcula los centros en un marco sin rotar, centrado en la foto; el render rota ese
marco. Cubre toda la imagen con cualquier ángulo. Tope de 4000 repeticiones para proteger móviles.
Hay medio paso de desfase para que el centro quede en un hueco y no choque con el emblema.

## EXIF
`createImageBitmap(file, { imageOrientation: 'from-image' })`; si el navegador no lo soporta,
se decodifica con `<img>`, que aplica EXIF por defecto. Las dimensiones ya vienen orientadas.
El canvas no copia metadatos: la exportación **no conserva EXIF ni GPS** (comportamiento deseado
para privacidad; se volverá una opción explícita).

## Rendimiento y memoria
- La vista previa trabaja sobre un búfer reducido (lado largo ≤ 1600 px), no sobre la foto completa.
- Al cambiar de foto se cierra el `ImageBitmap` anterior y se pone a 0 el tamaño de los canvas.
- Exportación limitada a ~16.7 MP (límite conservador de canvas en iOS Safari). Si la foto lo
  supera se reduce sin deformar y la app lo avisa. 🔍 Verificar el límite real en dispositivos.
- Hoy el render se hace en el hilo principal. `canvas.ts` ya usa `OffscreenCanvas` cuando existe
  y el motor no depende del DOM: moverlo a un Web Worker es el siguiente paso (necesario para lotes).

## Validación de archivos
Extensión + tamaño (≤ 80 MB) + firma binaria (JPEG/PNG/WEBP). No se confía solo en la extensión.

## Fuentes
Fuentes del sistema por ahora. Un mismo texto puede verse distinto entre dispositivos. Antes de
los presets se empaquetarán fuentes con licencia libre (OFL) en `public/fonts`.

## Emblemas de imagen (preparado, no implementado)
`EmblemConfig` es un tipo con `kind`. El render despacha por `kind` con comprobación exhaustiva,
así añadir `kind: 'image'` obliga a implementarlo en el compilador. No hay controles ni código
de imagen todavía.

## Sin IA ni red
No hay dependencias, llamadas, servicios ni interfaces de IA. La IA queda pospuesta hasta que el
propietario la autorice expresamente. La app no hace peticiones de red con datos del usuario.

## Dependencias (solo desarrollo; el bundle final solo lleva Svelte)
svelte, vite, @sveltejs/vite-plugin-svelte, typescript, svelte-check, vitest.

---

# Fase 2: PWA

## Service Worker con `vite-plugin-pwa` (Workbox `generateSW`, modo `prompt`)
Se eligió el plugin (permitido en el alcance) en lugar de escribir el SW a mano: genera el precache
con hashes y gestiona el ciclo de vida. Compatible con Vite 8 (peer deps del paquete). Sin
`skipWaiting`/`clientsClaim` automáticos: la versión nueva queda en espera hasta que el usuario acepta.

## Registro propio
`injectRegister: false`; el registro vive en `src/lib/services/pwa.svelte.ts` para controlar el flujo
(aviso, posponer, confirmación, bloqueo si hay trabajo en curso). En desarrollo no se registra SW.

## Privacidad de la caché
Solo se precachea el «app shell». No hay `runtimeCaching`; las fotos nunca pasan por el SW.
Los modelos futuros usarán una Cache aparte (`photoguard-models-v1`) que el SW no limpia.

## Inicio como punto de entrada
`workspace.section` arranca siempre en `home` y `initNavigation()` reemplaza `history.state` en cada
carga (si no, el navegador restauraría la última herramienta al recargar). Pila de historial máxima
`[Inicio, herramienta]` para que «Atrás» en Android vuelva a Inicio.

## Instalación solo en móvil
`beforeinstallprompt` se captura únicamente si la plataforma es Android/iOS (detección pura y testeada
en `utils/platform.ts`). En escritorio no se promueve; el navegador puede ofrecer su propia opción.
iOS no tiene API: se muestran instrucciones.

## Iconos
Generados sin dependencias (`scripts/make-icons.mjs`) con la misma geometría que `icon.svg`.
`maskable` y `apple-touch-icon` van a sangre (sin esquinas transparentes).

## Actualizar recarga la página
Hoy el estado (foto abierta, ajustes) vive en memoria; por eso se pide confirmación si hay una foto y
se bloquea mientras se importa/exporta. Cuando existan presets en IndexedDB, los ajustes persistirán.

## Dependencias nuevas (solo desarrollo)
vite-plugin-pwa, workbox-build, workbox-window, @types/node. `npm audit` marca 4 avisos moderados en la
cadena `minimatch → glob → workbox-build`; son herramientas de build (no van al bundle) y hay 0 en
dependencias de producción. No se aplicó `--force` (haría un downgrade incompatible).
