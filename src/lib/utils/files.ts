export type ImageKind = 'jpeg' | 'png' | 'webp';

export const ACCEPTED_EXTENSIONS = ['jpg', 'jpeg', 'png', 'webp'] as const;
export const ACCEPT_ATTRIBUTE = '.jpg,.jpeg,.png,.webp,image/jpeg,image/png,image/webp';
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
    return `Formato no compatible${ext ? ` (.${ext})` : ''}. Usa JPG, PNG o WEBP.`;
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

export function buildOutputName(originalName: string, format: 'jpeg' | 'png'): string {
  const dot = originalName.lastIndexOf('.');
  const stem = (dot > 0 ? originalName.slice(0, dot) : originalName)
    .replace(/[\\/:*?"<>|\u0000-\u001f]/g, '_')
    .trim();
  return `${stem || 'foto'}-protegida.${format === 'jpeg' ? 'jpg' : 'png'}`;
}
