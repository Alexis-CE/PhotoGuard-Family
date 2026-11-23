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

Requiere Node 20.19+ o 22.12+.


## Documentación

- [LICENSES/](LICENSES/README.md): licencias de dependencias; [LICENSES/FONTS.md

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
