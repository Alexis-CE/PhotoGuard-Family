# PhotoGuard Family Edition

Aplicación web familiar y privada para proteger fotos con marcas de agua. **Local-first:** las
fotos se procesan en el dispositivo y no se envían a ningún servidor. Sin cuentas, sin analítica.

## Estado: Fase 1

| Sección | Estado |
|---|---|
| **Proteger** | ✅ Importar, vista previa fiel, patrón + emblema de texto, 3 modos, exportar JPEG/PNG |
| Emblem Studio, Presets, Por lotes, Verify | ⏳ Pantalla «próximamente» (no operativas) |
| Marcas invisibles, quitar fondo, IA, firmas | ❌ No incluido en esta fase |

## Ejecutar

```bash
npm install
npm run dev        # servidor local (http://localhost:5173)
npm run check      # TypeScript + svelte-check
npm test           # pruebas del motor (Vitest)
npm run build      # genera dist/ listo para GitHub Pages
npm run preview    # sirve dist/ para probar el build
```

Requiere Node 20.19+ o 22.12+.

## Despliegue en GitHub Pages

`vite.config.ts` usa `base: './'`, así el build funciona bajo cualquier nombre de repo.
El workflow `.github/workflows/deploy.yml` compila y publica en cada push a `main`.
En GitHub: *Settings → Pages → Source: GitHub Actions*.

## Estructura

```
src/
  lib/
    engines/    motor de render (sin UI): canvas, layout, render, image, fonts
    state/      estado de la app (runes de Svelte 5)
    components/ piezas de UI reutilizables
    types/      modelo de configuración
    utils/      validación de archivos y helpers puros
  routes/       pantallas (Protect, ComingSoon)
tests/          Vitest (layout, render con contexto falso, utilidades)
docs/           decisiones técnicas
LICENSES/       licencias de dependencias
```

Ver [docs/DECISIONS.md](docs/DECISIONS.md) para el porqué de cada decisión.
