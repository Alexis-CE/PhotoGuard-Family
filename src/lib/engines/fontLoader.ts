import type { ProtectionConfig, TextStyle } from '$lib/types/watermark';
import { fontWeightFor, resolveFontStack } from './fonts';

export class FontLoadError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'FontLoadError';
  }
}

/** Descriptor CSS exacto que usa el render (peso + tamaño + pila). */
export function fontSpec(style: Pick<TextStyle, 'fontId' | 'bold'>, px = 16): string {
  return `${fontWeightFor(style.bold)} ${px}px ${resolveFontStack(style.fontId)}`;
}

type FontLoader = Pick<FontFaceSet, 'load'>;

/**
 * Espera a que las tipografías que el render va a usar estén CARGADAS. Sin esto, el primer
 * dibujo (o una exportación inmediata) podría usar la fuente de reemplazo del navegador.
 * Si una fuente no existe o falla, lanza error: nunca se exporta con una fuente sustituta.
 *
 * Solo carga las fuentes del modo activo (patrón y/o emblema).
 */
export async function ensureFontsLoaded(
  config: ProtectionConfig,
  loader: FontLoader | undefined = globalThis.document?.fonts
): Promise<void> {
  if (!loader) throw new FontLoadError('Este navegador no permite comprobar la carga de tipografías.');

  const styles: TextStyle[] = [];
  if (config.mode !== 'emblem') styles.push(config.pattern);
  if (config.mode !== 'pattern') styles.push(config.emblem);

  await Promise.all(
    styles.map(async (style) => {
      const spec = fontSpec(style);
      let faces: FontFace[];
      try {
        faces = await loader.load(spec, style.text || ' ');
      } catch {
        throw new FontLoadError(`No se pudo cargar la tipografía «${style.fontId}».`);
      }
      if (faces.length === 0) {
        throw new FontLoadError(`La tipografía «${style.fontId}» no está disponible en este dispositivo.`);
      }
    })
  );
}
