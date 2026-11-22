import { describe, expect, it } from 'vitest';
import { existsSync, readFileSync, statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import {
  FONT_IDS,
  FONT_OPTIONS,
  FONT_WEIGHTS,
  fontWeightFor,
  isFontId,
  resolveFontStack
} from '../src/lib/engines/fonts';
import { ensureFontsLoaded, FontLoadError, fontSpec } from '../src/lib/engines/fontLoader';
import { DEFAULT_CONFIG, type ProtectionConfig } from '../src/lib/types/watermark';

const path = (p: string) => fileURLToPath(new URL(`../${p}`, import.meta.url));
const read = (p: string) => readFileSync(path(p), 'utf8');
const woff2 = (id: string, weight: number) => `public/fonts/${id}/${id}-latin-${weight}-normal.woff2`;

const FAMILY: Record<string, string> = {
  inter: 'Inter',
  roboto: 'Roboto',
  montserrat: 'Montserrat',
  'source-sans-3': 'Source Sans 3'
};

describe('registro de tipografías', () => {
  it('son exactamente las cuatro familias, con ids estables y en orden', () => {
    expect([...FONT_IDS]).toEqual(['inter', 'roboto', 'montserrat', 'source-sans-3']);
    expect(FONT_OPTIONS.map((f) => f.id)).toEqual([...FONT_IDS]);
    expect(new Set(FONT_OPTIONS.map((f) => f.family)).size).toBe(4);
    for (const f of FONT_OPTIONS) {
      expect(f.family).toBe(FAMILY[f.id]);
      expect(f.stack.startsWith(`"${f.family}"`)).toBe(true);
    }
  });

  it('ya no quedan las fuentes del sistema anteriores', () => {
    for (const old of ['sans', 'serif', 'mono', 'impact', 'humanist', 'script']) expect(isFontId(old)).toBe(false);
  });

  it('un id desconocido cae a la primera familia', () => {
    expect(resolveFontStack('no-existe')).toBe(FONT_OPTIONS[0].stack);
  });

  it('solo hay pesos 400 y 700; negrita = 700', () => {
    expect([...FONT_WEIGHTS]).toEqual([400, 700]);
    expect(fontWeightFor(false)).toBe(400);
    expect(fontWeightFor(true)).toBe(700);
  });

  it('la configuración por defecto usa ids válidos', () => {
    expect(isFontId(DEFAULT_CONFIG.pattern.fontId)).toBe(true);
    expect(isFontId(DEFAULT_CONFIG.emblem.fontId)).toBe(true);
  });
});

describe('archivos locales', () => {
  it('existen los 8 WOFF2 (4 familias × pesos 400 y 700), válidos y livianos', () => {
    let total = 0;
    for (const id of FONT_IDS) {
      for (const weight of FONT_WEIGHTS) {
        const file = path(woff2(id, weight));
        expect(existsSync(file), woff2(id, weight)).toBe(true);
        const bytes = readFileSync(file);
        expect(bytes.subarray(0, 4).toString('ascii'), `${id} ${weight}`).toBe('wOF2');
        expect(bytes.length).toBeGreaterThan(5_000);
        expect(bytes.length).toBeLessThan(60_000);
        total += statSync(file).size;
      }
    }
    expect(total).toBeLessThan(200_000);
  });

  it('no hay otros pesos ni formatos incluidos', () => {
    for (const id of FONT_IDS) {
      for (const w of [100, 200, 300, 500, 600, 800, 900]) expect(existsSync(path(woff2(id, w)))).toBe(false);
    }
  });

  it('fonts.css declara las 8 @font-face con rutas locales que existen', () => {
    const css = read('src/styles/fonts.css');
    const blocks = css.match(/@font-face\s*{[^}]*}/g) ?? [];
    expect(blocks).toHaveLength(8);
    for (const id of FONT_IDS) {
      for (const weight of FONT_WEIGHTS) {
        const block = blocks.find(
          (b) => b.includes(`font-family: '${FAMILY[id]}'`) && b.includes(`font-weight: ${weight};`)
        );
        expect(block, `${id} ${weight}`).toBeDefined();
        expect(block).toContain(`url('/fonts/${id}/${id}-latin-${weight}-normal.woff2')`);
        expect(block).toContain('format(\'woff2\')');
        expect(block).toContain('font-display: block');
      }
    }
  });

  it('no hay solicitudes externas de fuentes (Google Fonts, CDNs)', () => {
    for (const file of ['index.html', 'src/styles/fonts.css', 'src/styles/global.css', 'vite.config.ts']) {
      const text = read(file);
      expect(text, file).not.toMatch(/fonts\.googleapis|fonts\.gstatic|cdn\.|unpkg|jsdelivr/i);
    }
    expect(read('src/styles/fonts.css')).not.toMatch(/url\(\s*['"]?https?:/i);
  });

  it('la licencia viaja junto a las fuentes publicadas (public/fonts/<id>/LICENSE.txt)', () => {
    for (const id of FONT_IDS) {
      const file = `public/fonts/${id}/LICENSE.txt`;
      expect(existsSync(path(file)), file).toBe(true);
      expect(read(file)).toBe(read(`LICENSES/fonts/${id}-OFL-1.1.txt`));
    }
  });

  it('cada familia trae su licencia OFL 1.1 en LICENSES/fonts', () => {
    for (const id of FONT_IDS) {
      const file = `LICENSES/fonts/${id}-OFL-1.1.txt`;
      expect(existsSync(path(file)), file).toBe(true);
      const text = read(file);
      expect(text).toMatch(/SIL Open Font License/i);
      expect(text).toMatch(/Version 1\.1/);
    }
  });
});

describe('carga antes de renderizar', () => {
  const cfg = (mode: ProtectionConfig['mode']): ProtectionConfig => ({ ...structuredClone(DEFAULT_CONFIG), mode });
  const face = {} as FontFace;

  it('fontSpec usa el peso y la pila exactos del render', () => {
    expect(fontSpec({ fontId: 'montserrat', bold: true })).toBe('700 16px "Montserrat", sans-serif');
    expect(fontSpec({ fontId: 'source-sans-3', bold: false }, 40)).toBe('400 40px "Source Sans 3", sans-serif');
  });

  it('solo pide las fuentes del modo activo', async () => {
    const asked: string[] = [];
    const loader = { load: async (spec: string) => (asked.push(spec), [face]) };
    await ensureFontsLoaded(cfg('both'), loader);
    expect(asked).toHaveLength(2);
    asked.length = 0;
    await ensureFontsLoaded(cfg('pattern'), loader);
    expect(asked).toEqual([fontSpec(DEFAULT_CONFIG.pattern)]);
    asked.length = 0;
    await ensureFontsLoaded(cfg('emblem'), loader);
    expect(asked).toEqual([fontSpec(DEFAULT_CONFIG.emblem)]);
  });

  it('no resuelve hasta que la fuente termina de cargar', async () => {
    let release!: () => void;
    const gate = new Promise<FontFace[]>((r) => (release = () => r([face])));
    let done = false;
    const p = ensureFontsLoaded(cfg('pattern'), { load: () => gate }).then(() => (done = true));
    await Promise.resolve();
    expect(done).toBe(false);
    release();
    await p;
    expect(done).toBe(true);
  });

  it('falla (no usa una fuente sustituta) si la fuente no existe o no carga', async () => {
    await expect(ensureFontsLoaded(cfg('both'), { load: async () => [] })).rejects.toBeInstanceOf(FontLoadError);
    await expect(
      ensureFontsLoaded(cfg('both'), { load: async () => { throw new Error('red'); } })
    ).rejects.toBeInstanceOf(FontLoadError);
  });

  it('exportPhoto y la vista previa esperan las fuentes ANTES de dibujar', () => {
    const exportSrc = read('src/lib/engines/image.ts');
    expect(exportSrc.indexOf('await ensureFontsLoaded(config)')).toBeGreaterThan(-1);
    expect(exportSrc.indexOf('await ensureFontsLoaded(config)')).toBeLessThan(exportSrc.indexOf('renderComposition('));

    const previewSrc = read('src/lib/components/Preview.svelte');
    expect(previewSrc.indexOf('await ensureFontsLoaded(config)')).toBeGreaterThan(-1);
    expect(previewSrc.indexOf('await ensureFontsLoaded(config)')).toBeLessThan(previewSrc.indexOf('renderComposition('));
  });
});