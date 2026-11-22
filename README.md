# PhotoGuard Family Edition

Aplicación web familiar y privada para proteger fotos con marcas de agua. **Local-first:** las
fotos se procesan en el dispositivo y no se envían a ningún servidor. Sin cuentas, sin analítica.

- **Android / iOS:** instalable como app (PWA).
- **Windows / Linux / macOS:** se usa en el navegador (sin app nativa).
- **Privacidad:** al exportar siempre se eliminan los metadatos EXIF (incluido GPS), sin opción para conservarlos.
- **Tipografías:** Inter, Roboto, Montserrat y Source Sans 3, locales y sin conexión ([licencias](LICENSES/FONTS.md)).

## Estado

| Sección | Estado |
|---|---|
| **Inicio** | ✅ Punto de entrada con todas las herramientas (no recuerda la última usada) |
| **Proteger** | ✅ Importar, vista previa fiel, patrón + emblema de texto, 3 modos, exportar JPEG/PNG |
| Emblem Studio, Presets, Por lotes, Verify | ⏳ Pantalla «próximamente» (no operativas) |
| **PWA** | ✅ Manifest, iconos, offline, avisos de actualización |
| Marcas invisibles, quitar fondo, IA, firmas | ❌ No incluido todavía |

## Ejecutar

```bash
npm install
npm run dev          # servidor local (http://localhost:5173). El Service Worker NO corre en dev.
npm run check        # TypeScript + svelte-check
npm test             # pruebas (Vitest)
npm run build        # genera dist/ (con sw.js y manifest)
npm run preview      # sirve dist/ para probar la PWA
npm run serve:pages  # sirve dist/ bajo /photoguard-family/ (simula GitHub Pages)
npm run verify:pwa   # build + verificación en un Chrome real (instalabilidad, offline, actualizaciones)
npm run icons        # regenera los iconos PNG (public/icons)
npm run fonts        # re-copia las fuentes WOFF2 y sus licencias desde @fontsource (public/fonts)
```

Requiere Node 20.19+ o 22.12+.

## Despliegue en GitHub Pages

`vite.config.ts` usa `base: './'`: todo (assets, manifest, Service Worker) es relativo y funciona bajo
cualquier nombre de repo. El workflow `.github/workflows/deploy.yml` compila y publica en cada push a
`main`. En GitHub: *Settings → Pages → Source: GitHub Actions*.

## Documentación

- [docs/PWA.md](docs/PWA.md): instalación por plataforma, offline, actualizaciones, limitaciones y compatibilidad.
- [docs/DECISIONS.md](docs/DECISIONS.md): decisiones técnicas.
- [LICENSES/](LICENSES/README.md): licencias de dependencias; [LICENSES/FONTS.md](LICENSES/FONTS.md): tipografías.

## Estructura

```
src/
  lib/
    engines/    motor de render (sin UI): canvas, layout, render, image, fonts
    services/   PWA (registro, actualizaciones, instalación) y recursos offline
    state/      estado de la app (runes de Svelte 5)
    components/ piezas de UI reutilizables
    types/      modelo de configuración
    utils/      validación de archivos y detección de plataforma
  routes/       pantallas (Home, Protect, ComingSoon)
scripts/        iconos, servidor de subruta y verificación PWA
tests/          Vitest
docs/           decisiones y guía PWA
LICENSES/       licencias de dependencias
```
