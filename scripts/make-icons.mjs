// Genera los iconos PNG de la PWA a partir de la misma geometría que public/icons/icon.svg.
// Sin dependencias: solo Node (zlib). Uso: node scripts/make-icons.mjs
import { deflateSync } from 'node:zlib';
import { mkdirSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const OUT = join(dirname(fileURLToPath(import.meta.url)), '..', 'public', 'icons');
const BG = [0x17, 0x18, 0x1b];
const ORANGE = [0xf2, 0xa3, 0x3a];

// Geometría en un lienzo de 64×64 (igual que el SVG).
function sample(x, y, rounded) {
  if (rounded) {
    // rect redondeado rx=14
    const r = 14;
    const cx = Math.min(Math.max(x, r), 64 - r);
    const cy = Math.min(Math.max(y, r), 64 - r);
    if (Math.hypot(x - cx, y - cy) > r) return null; // transparente
  }
  const d = Math.hypot(x - 32, y - 32);
  if (Math.hypot(x - 37, y - 27) <= 2.4) return BG;
  if (d <= 8) return ORANGE;
  if (d >= 17 && d <= 21) return ORANGE;
  return BG;
}

function render(size, rounded) {
  const SS = 4;
  const raw = Buffer.alloc(size * (size * 4 + 1));
  let o = 0;
  for (let py = 0; py < size; py++) {
    raw[o++] = 0; // filtro 0
    for (let px = 0; px < size; px++) {
      let r = 0, g = 0, b = 0, a = 0;
      for (let sy = 0; sy < SS; sy++) {
        for (let sx = 0; sx < SS; sx++) {
          const x = ((px + (sx + 0.5) / SS) / size) * 64;
          const y = ((py + (sy + 0.5) / SS) / size) * 64;
          const c = sample(x, y, rounded);
          if (c) { r += c[0]; g += c[1]; b += c[2]; a += 255; }
        }
      }
      const n = SS * SS;
      const cover = a / 255;
      raw[o++] = cover ? Math.round(r / cover) : 0;
      raw[o++] = cover ? Math.round(g / cover) : 0;
      raw[o++] = cover ? Math.round(b / cover) : 0;
      raw[o++] = Math.round(a / n);
    }
  }
  return raw;
}

const CRC_TABLE = Array.from({ length: 256 }, (_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});
function crc32(buf) {
  let c = 0xffffffff;
  for (const byte of buf) c = CRC_TABLE[(c ^ byte) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}
function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([len, body, crc]);
}
function png(size, rounded) {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; // profundidad
  ihdr[9] = 6; // RGBA
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(render(size, rounded), { level: 9 })),
    chunk('IEND', Buffer.alloc(0))
  ]);
}

mkdirSync(OUT, { recursive: true });
const files = [
  ['icon-192.png', 192, true],
  ['icon-512.png', 512, true],
  // maskable y apple-touch: a sangre (sin esquinas transparentes); el SO aplica su propia máscara.
  ['icon-maskable-512.png', 512, false],
  ['apple-touch-icon.png', 180, false]
];
for (const [name, size, rounded] of files) {
  writeFileSync(join(OUT, name), png(size, rounded));
  console.log(`✓ ${name} (${size}×${size})`);
}
