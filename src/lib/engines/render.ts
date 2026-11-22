import type { EmblemConfig, PatternConfig, ProtectionConfig, TextStyle } from '$lib/types/watermark';
import { createCanvas, getContext, releaseCanvas, type Canvas2D, type Ctx2D } from './canvas';
import { fontWeightFor, resolveFontStack } from './fonts';
import { patternCells } from './layout';

export interface RenderOptions {
  /** Color de fondo bajo la foto (JPEG no tiene transparencia). */
  background?: string;
  /** Solo para pruebas: inyecta la fábrica de la capa temporal. */
  layerFactory?: (width: number, height: number) => Canvas2D;
}

/**
 * ÚNICA ruta de composición: la vista previa y la exportación llaman a esta función.
 * Dibuja únicamente la foto + marcas de agua; nada de la interfaz toca este canvas.
 *
 * Cada marca se dibuja primero opaca en una capa temporal y luego se compone UNA vez con su
 * opacidad. Así el contorno (grosor) y el relleno no se suman y las repeticiones que se
 * solapan no se oscurecen entre sí.
 */
export function renderComposition(
  target: Ctx2D,
  source: CanvasImageSource,
  outWidth: number,
  outHeight: number,
  config: ProtectionConfig,
  options: RenderOptions = {}
): void {
  if (outWidth <= 0 || outHeight <= 0) throw new Error('Tamaño de salida inválido.');

  target.save();
  target.globalAlpha = 1;
  if (options.background) {
    target.fillStyle = options.background;
    target.fillRect(0, 0, outWidth, outHeight);
  }
  target.imageSmoothingEnabled = true;
  target.imageSmoothingQuality = 'high';
  target.drawImage(source, 0, 0, outWidth, outHeight);
  target.restore();

  const showPattern = config.mode !== 'emblem' && hasText(config.pattern);
  const showEmblem = config.mode !== 'pattern' && hasText(config.emblem);
  if (!showPattern && !showEmblem) return;

  const layer = (options.layerFactory ?? createCanvas)(outWidth, outHeight);
  const layerCtx = getContext(layer);
  try {
    if (showPattern) {
      layerCtx.clearRect(0, 0, outWidth, outHeight);
      drawPattern(layerCtx, outWidth, outHeight, config.pattern);
      compositeLayer(target, layer, config.pattern.opacity);
    }
    if (showEmblem) {
      layerCtx.clearRect(0, 0, outWidth, outHeight);
      drawEmblem(layerCtx, outWidth, outHeight, config.emblem);
      compositeLayer(target, layer, config.emblem.opacity);
    }
  } finally {
    releaseCanvas(layer);
  }
}

function hasText(style: TextStyle): boolean {
  return cleanText(style.text).length > 0;
}

function cleanText(text: string): string {
  return text.replace(/\s+/g, ' ').trim();
}

function compositeLayer(target: Ctx2D, layer: Canvas2D, opacityPercent: number): void {
  target.save();
  target.globalAlpha = Math.min(1, Math.max(0, opacityPercent / 100));
  target.drawImage(layer, 0, 0);
  target.restore();
}

function fontPixels(style: TextStyle, width: number, height: number): number {
  return Math.max(1, (style.size / 100) * Math.min(width, height));
}

function prepareText(ctx: Ctx2D, style: TextStyle, fontPx: number): void {
  ctx.font = `${fontWeightFor(style.bold)} ${fontPx}px ${resolveFontStack(style.fontId)}`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = style.color;
  ctx.strokeStyle = style.color;
  ctx.lineJoin = 'round';
  ctx.lineWidth = (fontPx * style.thickness) / 100;
}

function paintText(ctx: Ctx2D, text: string, x: number, y: number, style: TextStyle): void {
  if (style.thickness > 0) ctx.strokeText(text, x, y);
  ctx.fillText(text, x, y);
}

function drawPattern(ctx: Ctx2D, width: number, height: number, pattern: PatternConfig): void {
  const text = cleanText(pattern.text);
  const minSide = Math.min(width, height);
  const fontPx = fontPixels(pattern, width, height);
  prepareText(ctx, pattern, fontPx);

  const textWidth = ctx.measureText(text).width + (fontPx * pattern.thickness) / 100;
  const cells = patternCells({
    width,
    height,
    cellWidth: textWidth + (pattern.gapX / 100) * minSide,
    cellHeight: fontPx + (pattern.gapY / 100) * minSide,
    staggered: pattern.distribution === 'staggered'
  });

  ctx.save();
  ctx.translate(width / 2, height / 2);
  ctx.rotate((pattern.rotation * Math.PI) / 180);
  for (const cell of cells) paintText(ctx, text, cell.x, cell.y, pattern);
  ctx.restore();
}

function drawEmblem(ctx: Ctx2D, width: number, height: number, emblem: EmblemConfig): void {
  switch (emblem.kind) {
    case 'text': {
      const fontPx = fontPixels(emblem, width, height);
      prepareText(ctx, emblem, fontPx);
      ctx.save();
      ctx.translate((emblem.x / 100) * width, (emblem.y / 100) * height);
      ctx.rotate((emblem.rotation * Math.PI) / 180);
      paintText(ctx, cleanText(emblem.text), 0, 0, emblem);
      ctx.restore();
      return;
    }
    default: {
      const unreachable: never = emblem.kind;
      throw new Error(`Tipo de emblema no soportado: ${String(unreachable)}`);
    }
  }
}
