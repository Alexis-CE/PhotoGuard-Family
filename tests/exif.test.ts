import { describe, expect, it } from 'vitest';
import { buildJpegWithExif, containsAscii, inspectJpeg, listPngChunks } from '../scripts/lib/jpeg.mjs';

/** JPEG sintético mínimo (estructura válida: SOI, APP0/JFIF, SOS, datos, EOI). No necesita decodificarse. */
function syntheticJpeg(): Uint8Array {
  const app0 = [0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00, 0x01, 0x01, 0x00, 0x00, 0x01, 0x00, 0x01, 0x00, 0x00];
  const sos = [0xff, 0xda, 0x00, 0x08, 0x01, 0x01, 0x00, 0x00, 0x3f, 0x00];
  return Uint8Array.from([0xff, 0xd8, ...app0, ...sos, 0x12, 0x34, 0x56, 0xff, 0xd9]);
}

describe('inspectJpeg (el oráculo de la prueba de privacidad)', () => {
  it('un JPEG limpio es válido y no tiene APP1', () => {
    const r = inspectJpeg(syntheticJpeg());
    expect(r.valid).toBe(true);
    expect(r.app1).toHaveLength(0);
    expect(r.hasExifString).toBe(false);
    expect(r.segments.map((s) => s.name)).toEqual(['APP0', 'SOS']);
  });

  it('DETECTA un APP1/Exif inyectado (si no lo detectara, la prueba real no valdría)', () => {
    const marked = buildJpegWithExif(syntheticJpeg(), { orientation: 6, marker: 'PG-GPS-TEST' });
    const r = inspectJpeg(marked);
    expect(r.valid).toBe(true);
    expect(r.app1).toHaveLength(1);
    expect(r.app1[0].kind).toBe('exif');
    expect(r.hasExifString).toBe(true);
    expect(containsAscii(marked, 'PG-GPS-TEST')).toBe(true);
    expect(r.segments.map((s) => s.name)).toEqual(['APP1', 'APP0', 'SOS']);
  });

  it('el EXIF sintético lleva la orientación pedida', () => {
    const marked = buildJpegWithExif(syntheticJpeg(), { orientation: 6 });
    const start = r1(marked);
    // TIFF empieza tras "Exif\0\0"; 2.ª entrada del IFD es Orientation (tag 0x0112) con valor 6.
    const dv = new DataView(marked.buffer, marked.byteOffset);
    expect(dv.getUint16(start + 8 + 2 + 12, true)).toBe(0x0112);
    expect(dv.getUint16(start + 8 + 2 + 12 + 8, true)).toBe(6);
  });

  it('rechaza lo que no es un JPEG o está truncado', () => {
    expect(inspectJpeg(Uint8Array.from([0x00, 0x01, 0x02])).valid).toBe(false);
    const truncated = syntheticJpeg().slice(0, -2); // sin EOI
    expect(inspectJpeg(truncated).valid).toBe(false);
    expect(() => buildJpegWithExif(Uint8Array.from([1, 2, 3]))).toThrow();
  });
});

describe('listPngChunks', () => {
  const sig = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
  const chunk = (type: string, data: number[] = []) => [
    0, 0, 0, data.length,
    ...[...type].map((c) => c.charCodeAt(0)),
    ...data,
    0, 0, 0, 0
  ];

  it('lista los chunks en orden y delata metadatos (eXIf, tEXt…)', () => {
    const png = Uint8Array.from([...sig, ...chunk('IHDR', new Array(13).fill(0)), ...chunk('eXIf', [1, 2]), ...chunk('IDAT', [9]), ...chunk('IEND')]);
    expect(listPngChunks(png)).toEqual(['IHDR', 'eXIf', 'IDAT', 'IEND']);
  });

  it('lanza si no es PNG', () => {
    expect(() => listPngChunks(Uint8Array.from([1, 2, 3, 4, 5, 6, 7, 8]))).toThrow();
  });
});

/** Offset del inicio del TIFF dentro del JPEG con Exif ("Exif\0\0" ocupa 6 bytes tras el encabezado del segmento). */
function r1(bytes: Uint8Array): number {
  const i = inspectJpeg(bytes).app1[0].offset;
  return i + 4 + 6;
}