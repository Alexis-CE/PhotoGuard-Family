/**
 * Abstracción mínima de canvas. Usa OffscreenCanvas cuando existe (también dentro de un
 * Web Worker, que es el siguiente paso previsto) y cae a <canvas> en navegadores sin él.
 */

export type Canvas2D = HTMLCanvasElement | OffscreenCanvas;
export type Ctx2D = CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D;

export function createCanvas(width: number, height: number): Canvas2D {
  const w = Math.max(1, Math.round(width));
  const h = Math.max(1, Math.round(height));
  if (typeof OffscreenCanvas !== 'undefined') return new OffscreenCanvas(w, h);
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  return canvas;
}

export function getContext(canvas: Canvas2D): Ctx2D {
  const ctx = (canvas as HTMLCanvasElement).getContext('2d') as Ctx2D | null;
  if (!ctx) throw new Error('No se pudo crear el contexto 2D del canvas.');
  return ctx;
}

/** Libera el búfer de píxeles (importante en móviles: Safari retiene la memoria del canvas). */
export function releaseCanvas(canvas: Canvas2D): void {
  canvas.width = 0;
  canvas.height = 0;
}

export async function canvasToBlob(canvas: Canvas2D, type: string, quality?: number): Promise<Blob> {
  if (typeof OffscreenCanvas !== 'undefined' && canvas instanceof OffscreenCanvas) {
    return canvas.convertToBlob({ type, quality });
  }
  const el = canvas as HTMLCanvasElement;
  return new Promise<Blob>((resolve, reject) => {
    el.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error('El navegador no pudo codificar la imagen.'))),
      type,
      quality
    );
  });
}
