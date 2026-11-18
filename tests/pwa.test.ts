import { describe, expect, it } from 'vitest';
import { detectPlatform } from '../src/lib/utils/platform';
import {
  describeMissingResource,
  getResourceState,
  MODEL_CACHE_NAME,
  MODEL_RESOURCES
} from '../src/lib/services/resources';

const base = { maxTouchPoints: 0, displayModeStandalone: false };

describe('detectPlatform', () => {
  it('Android Chrome es móvil y no está instalada', () => {
    const p = detectPlatform({
      ...base,
      maxTouchPoints: 5,
      userAgent: 'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 Chrome/130.0 Mobile Safari/537.36'
    });
    expect(p).toEqual({ isIOS: false, isAndroid: true, isMobile: true, isStandalone: false });
  });

  it('iPhone Safari es iOS móvil; navigator.standalone indica app instalada', () => {
    const ua = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 Version/17.0 Mobile Safari/604.1';
    expect(detectPlatform({ ...base, maxTouchPoints: 5, userAgent: ua }).isIOS).toBe(true);
    expect(detectPlatform({ ...base, maxTouchPoints: 5, userAgent: ua, navigatorStandalone: true }).isStandalone).toBe(true);
  });

  it('iPadOS (se presenta como Macintosh con táctil) cuenta como iOS', () => {
    const ua = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 Version/17.0 Safari/605.1.15';
    expect(detectPlatform({ ...base, maxTouchPoints: 5, userAgent: ua }).isIOS).toBe(true);
  });

  it('escritorio (Windows, Linux, macOS real) NO es móvil → sin promoción de instalación', () => {
    const uas = [
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/130.0 Safari/537.36 Edg/130.0',
      'Mozilla/5.0 (X11; Linux x86_64; rv:130.0) Gecko/20100101 Firefox/130.0',
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 Version/17.0 Safari/605.1.15'
    ];
    for (const userAgent of uas) {
      expect(detectPlatform({ ...base, userAgent }).isMobile).toBe(false);
    }
  });

  it('display-mode: standalone marca la app como instalada', () => {
    const p = detectPlatform({ ...base, userAgent: 'Android', displayModeStandalone: true });
    expect(p.isStandalone).toBe(true);
  });
});

describe('recursos offline (modelos)', () => {
  const storageWith = (urls: string[]) => ({
    open: async (name: string) => {
      expect(name).toBe(MODEL_CACHE_NAME);
      return { match: async (url: string) => (urls.includes(url) ? ({} as Response) : undefined) };
    }
  });

  it('en esta fase no hay modelos registrados (no se descarga nada)', () => {
    expect(MODEL_RESOURCES).toHaveLength(0);
  });

  it('distingue guardado, faltante y no soportado', async () => {
    const storage = storageWith(['/m/a.onnx']) as unknown as CacheStorage;
    expect(await getResourceState('/m/a.onnx', storage)).toBe('cached');
    expect(await getResourceState('/m/b.onnx', storage)).toBe('missing');
    expect(await getResourceState('/m/a.onnx', undefined)).toBe('unsupported');
    const broken = { open: async () => { throw new Error('boom'); } } as unknown as CacheStorage;
    expect(await getResourceState('/m/a.onnx', broken)).toBe('unsupported');
  });

  it('el aviso cambia según haya conexión o no', () => {
    const r = { id: 'bg', label: 'Modelo de fondo', url: '/m/bg.onnx', approxBytes: 45 * 1024 * 1024 };
    expect(describeMissingResource(r, true)).toMatch(/descargar.*45 MB.*sin conexión/s);
    expect(describeMissingResource(r, false)).toMatch(/Conéctate a internet/);
  });
});
