export type ImageKind = 'jpeg' | 'png' | 'webp';

/** `.jfif` es un JPEG con contenedor JFIF: se decodifica igual que un .jpg. */
export const ACCEPTED_EXTENSIONS = ['jpg', 'jpeg', 'jfif', 'png', 'webp'] as const;
/** `image/*` por compatibilidad entre selectores; `.jfif` explícito porque algunos sistemas no lo asocian a imagen. */
export const ACCEPT_ATTRIBUTE = 'image/*,.jfif';
/** Bytes que se leen del inicio del archivo para comprobar su firma. */
export const SNIFF_BYTES = 12;

const EXTENSION_KIND: Readonly<Record<string, ImageKind>> = {
  jpg: 'jpeg',
  jpeg: 'jpeg',
  jfif: 'jpeg',
  png: 'png',
  webp: 'webp'
};

const MIME_KIND: Readonly<Record<string, ImageKind>> = {
  'image/jpeg': 'jpeg',
  'image/pjpeg': 'jpeg',
  'image/jfif': 'jpeg',
  'image/png': 'png',
  'image/webp': 'webp'
};

const KIND_LABEL: Readonly<Record<ImageKind, string>> = { jpeg: 'JPEG', png: 'PNG', webp: 'WEBP' };
const KIND_EXTENSION: Readonly<Record<ImageKind, string>> = { jpeg: '.jpg', png: '.png', webp: '.webp' };
export const MAX_FILE_BYTES = 80 * 1024 * 1024;

/**
 * Límite de área de canvas conservador (≈16.7 MP). Safari en iOS históricamente falla o
 * devuelve imágenes vacías por encima de este tamaño. 🔍 Verificar en dispositivos reales.
 */
export const MAX_CANVAS_PIXELS = 16_777_216;

/** Detecta el formato real por firma binaria (no se fía de la extensión). */
export function sniffImageType(bytes: Uint8Array): ImageKind | null {
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return 'jpeg';
  if (
    bytes.length >= 8 &&
    bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47 &&
    bytes[4] === 0x0d && bytes[5] === 0x0a && bytes[6] === 0x1a && bytes[7] === 0x0a
  ) {
    return 'png';
  }
  // RIFF....WEBP
  if (
    bytes.length >= 12 &&
    bytes[0] === 0x52 && bytes[1] === 0x49 && bytes[2] === 0x46 && bytes[3] === 0x46 &&
    bytes[8] === 0x57 && bytes[9] === 0x45 && bytes[10] === 0x42 && bytes[11] === 0x50
  ) {
    return 'webp';
  }
  return null;
}

/** Formato que la extensión del nombre dice que es (null si no es una extensión admitida). */
export function kindFromExtension(name: string): ImageKind | null {
  return EXTENSION_KIND[extensionOf(name)] ?? null;
}

/**
 * Formato que declara el MIME (null si está vacío, es genérico como application/octet-stream o no es
 * uno de los admitidos). Un MIME desconocido NO es motivo de rechazo: lo decide la firma binaria.
 */
export function kindFromMime(type: string): ImageKind | null {
  return MIME_KIND[type.split(';')[0].trim().toLowerCase()] ?? null;
}

/**
 * Comprueba que el contenido real coincide con el formato esperado. La extensión (y el MIME, si es
 * reconocible) solo dicen qué se ESPERA; la firma binaria de los primeros `SNIFF_BYTES` bytes es la
 * que manda. Devuelve un mensaje para el usuario o null si todo coincide.
 */
export function verifyImageContent(file: { name: string; type: string }, head: Uint8Array): string | null {
  if (head.length < SNIFF_BYTES) return 'El archivo es demasiado pequeño para ser una imagen válida.';
  const actual = sniffImageType(head);
  if (!actual) return 'El contenido no es una imagen JPG, PNG o WEBP válida (aunque la extensión lo parezca).';

  const byName = kindFromExtension(file.name);
  if (!byName) return 'Formato no compatible. Usa JPG, JFIF, PNG o WEBP.';
  const claimed = [byName, kindFromMime(file.type)].find((kind) => kind !== null && kind !== actual);
  if (claimed) {
    return `El archivo se presenta como ${KIND_LABEL[claimed]}, pero su contenido es ${KIND_LABEL[actual]}. Cámbiale la extensión a ${KIND_EXTENSION[actual]} e inténtalo de nuevo.`;
  }
  return null;
}
function extensionOf(name: string): string {
  const dot = name.lastIndexOf('.');
  return dot === -1 ? '' : name.slice(dot + 1).toLowerCase();
}

/** Validación previa a la lectura. Devuelve un mensaje para el usuario o null si es válido. */
export function validateFileMeta(file: { name: string; size: number }): string | null {
  if (file.size === 0) return 'El archivo está vacío.';
  if (file.size > MAX_FILE_BYTES) {
    return `El archivo pesa ${(file.size / 1024 / 1024).toFixed(0)} MB; el máximo es ${MAX_FILE_BYTES / 1024 / 1024} MB.`;
  }
  const ext = extensionOf(file.name);
  if (!(ACCEPTED_EXTENSIONS as readonly string[]).includes(ext)) {
    return `Formato no compatible${ext ? ` (.${ext})` : ''}. Usa JPG, JFIF, PNG o WEBP.`;
  }
  return null;
}

/** Reduce (sin deformar) para no superar un área máxima de píxeles. */
export function fitToArea(
  width: number,
  height: number,
  maxPixels: number
): { width: number; height: number; scaled: boolean } {
  if (width * height <= maxPixels) return { width, height, scaled: false };
  const scale = Math.sqrt(maxPixels / (width * height));
  return {
    width: Math.max(1, Math.floor(width * scale)),
    height: Math.max(1, Math.floor(height * scale)),
    scaled: true
  };
}

/**
 * Nombre de salida corto y neutro: `pg-AAMMDD-xxx.jpg`. No reutiliza el nombre del archivo original
 * (que puede traer nombres de personas, de herramientas o rutas). El sufijo aleatorio de 3
 * caracteres evita choques si se exportan varias fotos el mismo día.
 */
export function buildOutputName(
  format: 'jpeg' | 'png',
  now: Date = new Date(),
  random: () => number = Math.random
): string {
  const yy = String(now.getFullYear()).slice(2);
  const mm = String(now.getMonth() + 1).padStart(2, '0');
  const dd = String(now.getDate()).padStart(2, '0');
  const tag = Math.floor(random() * 36 ** 3).toString(36).padStart(3, '0');
  return `pg-${yy}${mm}${dd}-${tag}.${format === 'jpeg' ? 'jpg' : 'png'}`;
}
