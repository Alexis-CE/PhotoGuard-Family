/**
 * Tipografías incluidas. Los `id` son ESTABLES (se guardarán en los presets): no renombrar.
 * Los archivos viven en /public/fonts y se declaran en src/styles/fonts.css.
 */
export const FONT_IDS = ['inter', 'roboto', 'montserrat', 'source-sans-3'] as const;
export type FontId = (typeof FONT_IDS)[number];

/** Pesos incluidos. `bold` en la configuración equivale a 700. */
export const FONT_WEIGHTS = [400, 700] as const;

export interface FontOption {
  id: FontId;
  label: string;
  /** Nombre de familia tal como se declara en @font-face */
  family: string;
  /** Pila CSS usada en ctx.font; la genérica solo cubre glifos fuera del subset latino */
  stack: string;
}

export const FONT_OPTIONS: readonly FontOption[] = [
  { id: 'inter', label: 'Inter', family: 'Inter', stack: '"Inter", sans-serif' },
  { id: 'roboto', label: 'Roboto', family: 'Roboto', stack: '"Roboto", sans-serif' },
  { id: 'montserrat', label: 'Montserrat', family: 'Montserrat', stack: '"Montserrat", sans-serif' },
  { id: 'source-sans-3', label: 'Source Sans 3', family: 'Source Sans 3', stack: '"Source Sans 3", sans-serif' }
];

export function isFontId(value: string): value is FontId {
  return (FONT_IDS as readonly string[]).includes(value);
}

/** Un id desconocido cae a la primera fuente (la validación estricta es cosa de la importación). */
export function resolveFontStack(id: string): string {
  return (FONT_OPTIONS.find((f) => f.id === id) ?? FONT_OPTIONS[0]).stack;
}

export function fontWeightFor(bold: boolean): 400 | 700 {
  return bold ? 700 : 400;
}
