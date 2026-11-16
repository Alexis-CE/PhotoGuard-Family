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
