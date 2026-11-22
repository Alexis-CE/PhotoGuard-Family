// Inspección binaria de JPEG/PNG para las pruebas de privacidad (sin dependencias).
// Lo usan tests/exif.test.ts (para comprobar que el "oráculo" detecta EXIF) y scripts/verify-pwa.mjs
// (para inspeccionar el archivo REAL que exporta PhotoGuard en un navegador).

const ascii = (u8) => String.fromCharCode(...u8);

export function containsAscii(bytes, text) {
  const needle = Uint8Array.from(text, (c) => c.charCodeAt(0));
  outer: for (let i = 0; i + needle.length <= bytes.length; i++) {
    for (let j = 0; j < needle.length; j++) if (bytes[i + j] !== needle[j]) continue outer;
    return true;
  }
  return false;
}

const NAMES = { 0xe0: 'APP0', 0xe1: 'APP1', 0xe2: 'APP2', 0xdb: 'DQT', 0xc0: 'SOF0', 0xc2: 'SOF2', 0xc4: 'DHT', 0xdd: 'DRI', 0xfe: 'COM', 0xda: 'SOS' };
const markerName = (m) => NAMES[m] ?? (m >= 0xe0 && m <= 0xef ? `APP${m - 0xe0}` : `0x${m.toString(16)}`);

/**
 * Recorre los segmentos hasta SOS. `valid` = empieza con SOI, llega a SOS y termina con EOI.
 * `app1` lista los segmentos APP1 (Exif o XMP); `kind` indica cuál.
 */
export function inspectJpeg(input) {
  const bytes = input instanceof Uint8Array ? input : new Uint8Array(input);
  const out = { valid: false, startsWithSOI: false, endsWithEOI: false, reachedSOS: false, segments: [], app1: [], hasExifString: false };
  out.startsWithSOI = bytes[0] === 0xff && bytes[1] === 0xd8;
  out.endsWithEOI = bytes.length >= 2 && bytes[bytes.length - 2] === 0xff && bytes[bytes.length - 1] === 0xd9;
  out.hasExifString = containsAscii(bytes, 'Exif\0\0');
  if (!out.startsWithSOI) return out;

  let i = 2;
  while (i + 4 <= bytes.length && bytes[i] === 0xff) {
    let marker = bytes[i + 1];
    while (marker === 0xff) { i++; marker = bytes[i + 1]; }
    if (marker === 0xd9) break;
    if (marker === 0xda) {
      out.segments.push({ marker, name: 'SOS', offset: i, length: 0 });
      out.reachedSOS = true;
      break;
    }
    if (marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7)) { i += 2; continue; }
    const length = (bytes[i + 2] << 8) | bytes[i + 3];
    if (length < 2 || i + 2 + length > bytes.length) break;
    const seg = { marker, name: markerName(marker), offset: i, length };
    if (marker === 0xe1) {
      const head = ascii(bytes.subarray(i + 4, i + 4 + 29));
      seg.kind = head.startsWith('Exif\0\0') ? 'exif' : head.includes('http://ns.adobe.com/xap') ? 'xmp' : 'otro';
      out.app1.push(seg);
    }
    out.segments.push(seg);
    i += 2 + length;
  }
  out.valid = out.startsWithSOI && out.reachedSOS && out.endsWithEOI;
  return out;
}

/**
 * Inserta un segmento APP1/Exif (TIFF little-endian) justo tras SOI, con Orientation y una
 * ImageDescription reconocible (`marker`) para poder buscarla en el resultado.
 */
export function buildJpegWithExif(jpeg, { orientation = 1, marker = '' } = {}) {
  const text = Uint8Array.from(`${marker}\0`, (c) => c.charCodeAt(0));
  const ifdOffset = 8;
  const entries = 2;
  const dataOffset = ifdOffset + 2 + entries * 12 + 4;
  const tiff = new Uint8Array(dataOffset + text.length);
  const dv = new DataView(tiff.buffer);
  tiff.set([0x49, 0x49], 0); // "II" little-endian
  dv.setUint16(2, 42, true);
  dv.setUint32(4, ifdOffset, true);
  dv.setUint16(ifdOffset, entries, true);
  // 0x010E ImageDescription (ASCII)
  let p = ifdOffset + 2;
  dv.setUint16(p, 0x010e, true); dv.setUint16(p + 2, 2, true); dv.setUint32(p + 4, text.length, true); dv.setUint32(p + 8, dataOffset, true);
  // 0x0112 Orientation (SHORT)
  p += 12;
  dv.setUint16(p, 0x0112, true); dv.setUint16(p + 2, 3, true); dv.setUint32(p + 4, 1, true); dv.setUint16(p + 8, orientation, true);
  dv.setUint32(ifdOffset + 2 + entries * 12, 0, true); // sin siguiente IFD
  tiff.set(text, dataOffset);

  const header = Uint8Array.from('Exif\0\0', (c) => c.charCodeAt(0));
  const payload = new Uint8Array(header.length + tiff.length);
  payload.set(header, 0);
  payload.set(tiff, header.length);

  const src = jpeg instanceof Uint8Array ? jpeg : new Uint8Array(jpeg);
  if (!(src[0] === 0xff && src[1] === 0xd8)) throw new Error('No es un JPEG (falta SOI).');
  const len = payload.length + 2;
  const out = new Uint8Array(src.length + 4 + payload.length);
  out.set(src.subarray(0, 2), 0);
  out.set([0xff, 0xe1, len >> 8, len & 0xff], 2);
  out.set(payload, 6);
  out.set(src.subarray(2), 6 + payload.length);
  return out;
}

/** Tipos de chunk de un PNG, en orden. Lanza si la firma no es PNG. */
export function listPngChunks(input) {
  const b = input instanceof Uint8Array ? input : new Uint8Array(input);
  const sig = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
  if (!sig.every((v, i) => b[i] === v)) throw new Error('No es un PNG.');
  const types = [];
  let i = 8;
  while (i + 12 <= b.length) {
    const len = ((b[i] << 24) | (b[i + 1] << 16) | (b[i + 2] << 8) | b[i + 3]) >>> 0;
    types.push(ascii(b.subarray(i + 4, i + 8)));
    i += 12 + len;
  }
  return types;
}