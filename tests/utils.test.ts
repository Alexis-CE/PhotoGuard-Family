import { describe, expect, it } from 'vitest';
import { FONT_OPTIONS, resolveFontStack } from '../src/lib/engines/fonts';
import {
  buildOutputName,
  fitToArea,
  MAX_FILE_BYTES,
  sniffImageType,
  validateFileMeta
} from '../src/lib/utils/files';

describe('sniffImageType', () => {
  it('reconoce JPEG, PNG y WEBP por firma binaria', () => {
    expect(sniffImageType(Uint8Array.from([0xff, 0xd8, 0xff, 0xe0, 0, 0, 0, 0, 0, 0, 0, 0]))).toBe('jpeg');
    expect(sniffImageType(Uint8Array.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0]))).toBe('png');
    const webp = new TextEncoder().encode('RIFF\u0000\u0000\u0000\u0000WEBP');
    expect(sniffImageType(webp)).toBe('webp');
  });

  it('rechaza lo que no es imagen soportada (GIF, texto, vacío)', () => {
    expect(sniffImageType(new TextEncoder().encode('GIF89a......'))).toBeNull();
    expect(sniffImageType(new TextEncoder().encode('hola mundo!!'))).toBeNull();
    expect(sniffImageType(new Uint8Array(0))).toBeNull();
  });
});

describe('validateFileMeta', () => {
  it('acepta extensiones válidas sin importar mayúsculas', () => {
    expect(validateFileMeta({ name: 'IMG_0001.JPG', size: 1000 })).toBeNull();
    expect(validateFileMeta({ name: 'a.webp', size: 1 })).toBeNull();
  });

  it('da mensajes comprensibles para formatos, vacíos y pesos excesivos', () => {
    expect(validateFileMeta({ name: 'a.gif', size: 10 })).toMatch(/Formato no compatible \(\.gif\)/);
    expect(validateFileMeta({ name: 'sin_extension', size: 10 })).toMatch(/Formato no compatible/);
    expect(validateFileMeta({ name: 'a.png', size: 0 })).toMatch(/vacío/);
    expect(validateFileMeta({ name: 'a.png', size: MAX_FILE_BYTES + 1 })).toMatch(/máximo/);
  });
});

describe('fitToArea', () => {
  it('no toca imágenes dentro del límite', () => {
    expect(fitToArea(4000, 3000, 16_777_216)).toEqual({ width: 4000, height: 3000, scaled: false });
  });

  it('reduce sin deformar y sin pasarse del área', () => {
    const r = fitToArea(8000, 6000, 16_777_216);
    expect(r.scaled).toBe(true);
    expect(r.width * r.height).toBeLessThanOrEqual(16_777_216);
    expect(Math.abs(r.width / r.height - 8000 / 6000)).toBeLessThan(0.002);
  });
});

describe('buildOutputName', () => {
  const day = new Date(2026, 10, 18); // 18-nov-2026

  it('genera un nombre corto y neutro con extensión según el formato', () => {
    expect(buildOutputName('jpeg', day, () => 0)).toBe('pg-261118-000.jpg');
    expect(buildOutputName('png', day, () => 0.999999)).toBe('pg-261118-zzz.png');
  });

  it('no depende del nombre del archivo original (no puede filtrar nada de él)', () => {
    // La firma ya no recibe el nombre original: cualquier salida cumple el patrón.
    expect(buildOutputName('jpeg')).toMatch(/^pg-\d{6}-[0-9a-z]{3}\.jpg$/);
    expect(buildOutputName('png')).toMatch(/^pg-\d{6}-[0-9a-z]{3}\.png$/);
  });

  it('el sufijo aleatorio varía entre llamadas del mismo día', () => {
    const names = new Set(Array.from({ length: 200 }, () => buildOutputName('jpeg', day)));
    expect(names.size).toBeGreaterThan(150);
  });
});

describe('fuentes', () => {
  it('resuelve ids conocidos y cae a la primera si el id no existe', () => {
    for (const f of FONT_OPTIONS) expect(resolveFontStack(f.id)).toBe(f.stack);
    expect(resolveFontStack('no-existe')).toBe(FONT_OPTIONS[0].stack);
  });
});
