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
  it('añade sufijo y ajusta la extensión al formato', () => {
    expect(buildOutputName('vacaciones.HEIC.png', 'jpeg')).toBe('vacaciones.HEIC-protegida.jpg');
    expect(buildOutputName('foto.webp', 'png')).toBe('foto-protegida.png');
  });

  it('sanea caracteres peligrosos y nombres vacíos', () => {
    expect(buildOutputName('a/b:c*.jpg', 'jpeg')).toBe('a_b_c_-protegida.jpg');
    expect(buildOutputName('.jpg', 'jpeg')).toBe('.jpg-protegida.jpg');
    expect(buildOutputName('', 'png')).toBe('foto-protegida.png');
  });
});

describe('fuentes', () => {
  it('resuelve ids conocidos y cae a la primera si el id no existe', () => {
    for (const f of FONT_OPTIONS) expect(resolveFontStack(f.id)).toBe(f.stack);
    expect(resolveFontStack('no-existe')).toBe(FONT_OPTIONS[0].stack);
  });
});
