import type { ProtectionConfig } from '$lib/types/watermark';
import {
  buildOutputName,
  fitToArea,
  MAX_CANVAS_PIXELS,
  sniffImageType,
  validateFileMeta
} from '$lib/utils/files';
import { canvasToBlob, createCanvas, getContext, releaseCanvas, type Canvas2D } from './canvas';
import { renderComposition } from './render';

/** Lado largo del búfer de vista previa. La preview se compone aquí, no sobre la foto completa. */
export const PREVIEW_MAX_SIDE = 1600;
/** Por encima de esto ni siquiera intentamos decodificar (≈ 150 MP). */
const MAX_DECODE_PIXELS = 150_000_000;

export class ImageImportError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ImageImportError';
  }
}

export interface LoadedPhoto {
  name: string;
  /** Dimensiones tras aplicar la orientación EXIF */
  width: number;
  height: number;
  full: CanvasImageSource;
  preview: Canvas2D;
  previewWidth: number;
  previewHeight: number;
  /** Libera bitmap y canvas. Llamar al reemplazar o descartar la foto. */
  dispose(): void;
}

interface Decoded {
  source: CanvasImageSource;
  width: number;
  height: number;
  release(): void;
}

async function decode(file: File): Promise<Decoded> {
  // Camino principal: respeta EXIF explícitamente.
  try {
    const bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' });
    return { source: bitmap, width: bitmap.width, height: bitmap.height, release: () => bitmap.close() };
  } catch {
    // Camino alterno para navegadores sin createImageBitmap(Blob, opciones): <img> aplica EXIF por defecto.
  }

  const url = URL.createObjectURL(file);
  const img = new Image();
  img.decoding = 'async';
  img.src = url;
  try {
    await img.decode();
  } catch {
    URL.revokeObjectURL(url);
    throw new ImageImportError('No se pudo leer la imagen: el archivo parece dañado.');
  }
  return {
    source: img,
    width: img.naturalWidth,
    height: img.naturalHeight,
    release: () => URL.revokeObjectURL(url)
  };
}

export async function loadPhoto(file: File): Promise<LoadedPhoto> {
  const metaError = validateFileMeta(file);
  if (metaError) throw new ImageImportError(metaError);

  const head = new Uint8Array(await file.slice(0, 12).arrayBuffer());
  if (!sniffImageType(head)) {
    throw new ImageImportError('El contenido no es una imagen JPG, PNG o WEBP válida (aunque la extensión lo parezca).');
  }

  let decoded: Decoded;
  try {
    decoded = await decode(file);
  } catch (error) {
    if (error instanceof ImageImportError) throw error;
    throw new ImageImportError('No se pudo abrir la imagen. Puede estar dañada o ser demasiado grande para este dispositivo.');
  }

  const { width, height } = decoded;
  if (!width || !height || width * height > MAX_DECODE_PIXELS) {
    decoded.release();
    throw new ImageImportError('La imagen es demasiado grande para procesarse en este dispositivo.');
  }

  const scale = Math.min(1, PREVIEW_MAX_SIDE / Math.max(width, height));
  const previewWidth = Math.max(1, Math.round(width * scale));
  const previewHeight = Math.max(1, Math.round(height * scale));
  const preview = createCanvas(previewWidth, previewHeight);
  const previewCtx = getContext(preview);
  previewCtx.imageSmoothingEnabled = true;
  previewCtx.imageSmoothingQuality = 'high';
  previewCtx.drawImage(decoded.source, 0, 0, previewWidth, previewHeight);

  return {
    name: file.name,
    width,
    height,
    full: decoded.source,
    preview,
    previewWidth,
    previewHeight,
    dispose() {
      decoded.release();
      releaseCanvas(preview);
    }
  };
}

export interface ExportResult {
  blob: Blob;
  filename: string;
  width: number;
  height: number;
  /** true si se redujo para respetar el límite de píxeles del navegador */
  downscaled: boolean;
}

/** Renderiza a resolución completa con la misma función que la vista previa y codifica el archivo. */
export async function exportPhoto(photo: LoadedPhoto, config: ProtectionConfig): Promise<ExportResult> {
  const size = fitToArea(photo.width, photo.height, MAX_CANVAS_PIXELS);
  const canvas = createCanvas(size.width, size.height);
  try {
    const ctx = getContext(canvas);
    const isJpeg = config.export.format === 'jpeg';
    renderComposition(ctx, photo.full, size.width, size.height, config, {
      background: isJpeg ? '#ffffff' : undefined
    });
    const blob = await canvasToBlob(
      canvas,
      isJpeg ? 'image/jpeg' : 'image/png',
      isJpeg ? config.export.quality / 100 : undefined
    );
    return {
      blob,
      filename: buildOutputName(config.export.format),
      width: size.width,
      height: size.height,
      downscaled: size.scaled
    };
  } finally {
    releaseCanvas(canvas);
  }
}
