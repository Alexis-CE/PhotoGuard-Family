import { describe, expect, it } from 'vitest';
import type { Canvas2D, Ctx2D } from '../src/lib/engines/canvas';
import { renderComposition } from '../src/lib/engines/render';
import { DEFAULT_CONFIG, type ProtectionConfig } from '../src/lib/types/watermark';

/** Contexto falso que registra llamadas y asignaciones, para verificar la lógica sin un navegador. */
function fakeCtx() {
  const calls: { name: string; args: unknown[] }[] = [];
  const sets: { prop: string; value: unknown }[] = [];
  const ctx = new Proxy(
    {},
    {
      get(_t, key) {
        const name = String(key);
        if (name === 'measureText') return (text: string) => ({ width: text.length * 10 });
        return (...args: unknown[]) => {
          calls.push({ name, args });
        };
      },
      set(_t, key, value) {
        sets.push({ prop: String(key), value });
        return true;
      }
    }
  );
  return { ctx: ctx as unknown as Ctx2D, calls, sets };
}

function setup(config: ProtectionConfig) {
  const target = fakeCtx();
  const layer = fakeCtx();
  const fakeLayer = { width: 100, height: 100, getContext: () => layer.ctx } as unknown as Canvas2D;
  renderComposition(target.ctx, {} as CanvasImageSource, 600, 400, config, {
    layerFactory: () => fakeLayer
  });
  const count = (c: typeof target, name: string) => c.calls.filter((x) => x.name === name).length;
  const alphas = target.sets.filter((s) => s.prop === 'globalAlpha').map((s) => s.value);
  return { target, layer, count, alphas, fakeLayer };
}

const cfg = (patch: Partial<ProtectionConfig>): ProtectionConfig => ({
  ...structuredClone(DEFAULT_CONFIG),
  ...patch
});

describe('renderComposition', () => {
  it('modo híbrido: foto + capa de patrón + capa de emblema, cada una con su opacidad', () => {
    const r = setup(cfg({ mode: 'both' }));
    expect(r.count(r.target, 'drawImage')).toBe(3);
    expect(r.alphas).toContain(DEFAULT_CONFIG.pattern.opacity / 100);
    expect(r.alphas).toContain(DEFAULT_CONFIG.emblem.opacity / 100);
    // El emblema es una sola repetición; el patrón, muchas.
    expect(r.count(r.layer, 'fillText')).toBeGreaterThan(5);
  });

  it('solo patrón: no compone la capa del emblema', () => {
    const r = setup(cfg({ mode: 'pattern' }));
    expect(r.count(r.target, 'drawImage')).toBe(2);
    expect(r.alphas).not.toContain(DEFAULT_CONFIG.emblem.opacity / 100);
  });

  it('solo emblema: dibuja un único texto en su posición', () => {
    const config = cfg({ mode: 'emblem' });
    config.emblem.x = 25;
    config.emblem.y = 75;
    const r = setup(config);
    expect(r.count(r.target, 'drawImage')).toBe(2);
    expect(r.count(r.layer, 'fillText')).toBe(1);
    const translate = r.layer.calls.find((c) => c.name === 'translate');
    expect(translate?.args).toEqual([150, 300]); // 25% de 600, 75% de 400
  });

  it('texto vacío: no dibuja esa marca (sin capas ni opacidades fantasma)', () => {
    const config = cfg({ mode: 'both' });
    config.pattern.text = '   ';
    config.emblem.text = '';
    const r = setup(config);
    expect(r.count(r.target, 'drawImage')).toBe(1);
    expect(r.count(r.layer, 'fillText')).toBe(0);
  });

  it('grosor 0 no dibuja contorno; grosor > 0 sí', () => {
    const thin = cfg({ mode: 'emblem' });
    thin.emblem.thickness = 0;
    const flat = setup(thin);
    expect(flat.count(flat.layer, 'strokeText')).toBe(0);

    const thick = cfg({ mode: 'emblem' });
    thick.emblem.thickness = 5;
    const r = setup(thick);
    expect(r.count(r.layer, 'strokeText')).toBe(1);
  });

  it('libera la capa temporal al terminar', () => {
    const r = setup(cfg({ mode: 'both' }));
    expect(r.fakeLayer.width).toBe(0);
    expect(r.fakeLayer.height).toBe(0);
  });

  it('rechaza tamaños de salida inválidos', () => {
    const t = fakeCtx();
    expect(() => renderComposition(t.ctx, {} as CanvasImageSource, 0, 100, DEFAULT_CONFIG)).toThrow();
  });
});

describe('renderComposition · tipografías', () => {
  it('usa peso 700 solo con negrita y la familia elegida, en patrón y emblema', () => {
    const config = cfg({ mode: 'both' });
    config.pattern.fontId = 'roboto';
    config.pattern.bold = false;
    config.emblem.fontId = 'source-sans-3';
    config.emblem.bold = true;
    const r = setup(config);
    const fonts = r.layer.sets.filter((s) => s.prop === 'font').map((s) => String(s.value));
    expect(fonts[0]).toMatch(/^400 [\d.]+px "Roboto"/);
    expect(fonts[1]).toMatch(/^700 [\d.]+px "Source Sans 3"/);
  });
});