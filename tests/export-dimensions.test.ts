import { readFileSync } from 'node:fs';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { exportPhoto, type LoadedPhoto } from '../src/lib/engines/image';
import { DEFAULT_CONFIG, type ProtectionConfig } from '../src/lib/types/watermark';
import { MAX_CANVAS_PIXELS } from '../src/lib/utils/files';

// Sin navegador no hay document.fonts: aquí solo importa el tamaño, no la tipografía.
vi.mock('../src/lib/engines/fontLoader', () => ({
  ensureFontsLoaded: vi.fn(async () => undefined),
  FontLoadError: class FontLoadError extends Error {}
}));

/** Tamaño real del búfer del canvas en el momento de codificar el archivo. */
const encoded: { width: number; height: number; type: string }[] = [];

class FakeOffscreenCanvas {
  constructor(
    public width: number,
    public height: number
  ) {}
  getContext() {
    return new Proxy(
      {},
      {
        get: (_t, key) => (key === 'measureText' ? (text: string) => ({ width: text.length * 10 }) : () => undefined),
        set: () => true
      }
    );
  }
  async convertToBlob(options: { type: string }) {
    encoded.push({ width: this.width, height: this.height, type: options.type });
    return new Blob(['x'], { type: options.type });
  }
}

function photo(width: number, height: number): LoadedPhoto {
  return {
    name: 'prueba.jpg',
    width,
    height,
    full: {} as CanvasImageSource,
    preview: {} as LoadedPhoto['preview'],
    previewWidth: Math.round(width / 4),
    previewHeight: Math.round(height / 4),
    dispose: () => undefined
  };
}

const withConfig = (patch: (config: ProtectionConfig) => void): ProtectionConfig => {
  const config = structuredClone(DEFAULT_CONFIG);
  patch(config);
  return config;
};

beforeEach(() => {
  encoded.length = 0;
  vi.stubGlobal('OffscreenCanvas', FakeOffscreenCanvas);
});
afterEach(() => vi.unstubAllGlobals());

/**
 * Valores FIJOS: son los que producía el motor antes del rediseño móvil. Si cambian, la
 * resolución de exportación cambió (el rediseño solo puede tocar la presentación visual).
 */
describe('resolución de exportación (independiente del tamaño en pantalla)', () => {
  it.each([
    ['foto de teléfono 3072×4080 (12.5 MP)', 3072, 4080, 3072, 4080],
    ['4000×3000', 4000, 3000, 4000, 3000],
    ['800×600', 800, 600, 800, 600],
    ['24 MP (6000×4000) se limita al máximo del navegador', 6000, 4000, 5016, 3344]
  ])('%s', async (_label, w, h, expectedW, expectedH) => {
    const result = await exportPhoto(photo(w, h), structuredClone(DEFAULT_CONFIG));
    expect([result.width, result.height]).toEqual([expectedW, expectedH]);
    // El búfer que realmente se codifica tiene esas mismas dimensiones.
    expect([encoded[0].width, encoded[0].height]).toEqual([expectedW, expectedH]);
    expect(expectedW * expectedH).toBeLessThanOrEqual(MAX_CANVAS_PIXELS);
  });

  it('el modo, el formato y la calidad no cambian las dimensiones', async () => {
    const sizes = new Set<string>();
    for (const mode of ['pattern', 'emblem', 'both'] as const) {
      for (const format of ['jpeg', 'png'] as const) {
        const result = await exportPhoto(
          photo(3072, 4080),
          withConfig((c) => {
            c.mode = mode;
            c.export.format = format;
          })
        );
        sizes.add(`${result.width}×${result.height}`);
      }
    }
    expect([...sizes]).toEqual(['3072×4080']);
  });

  it('la vista previa (búfer reducido) no influye en la exportación', async () => {
    const result = await exportPhoto({ ...photo(3072, 4080), previewWidth: 10, previewHeight: 10 }, structuredClone(DEFAULT_CONFIG));
    expect([result.width, result.height]).toEqual([3072, 4080]);
  });
});

describe('los motores no leen medidas del DOM', () => {
  it.each(['render.ts', 'image.ts', 'canvas.ts', 'layout.ts'])('%s no usa tamaño CSS ni la ventana', (file) => {
    const source = readFileSync(new URL(`../src/lib/engines/${file}`, import.meta.url), 'utf8');
    expect(source).not.toMatch(/clientWidth|clientHeight|offsetWidth|offsetHeight|getBoundingClientRect|devicePixelRatio|innerWidth|innerHeight|matchMedia|getComputedStyle/);
  });
});
