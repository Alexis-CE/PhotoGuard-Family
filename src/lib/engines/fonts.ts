export interface FontOption {
  id: string;
  label: string;
  /** Pila CSS usada tal cual en ctx.font */
  stack: string;
}

/**
 * Fuentes del sistema (sin descargas ni red). Su aspecto exacto depende del dispositivo:
 * en una fase posterior se empaquetarán fuentes OFL en /public/fonts para que un preset
 * se vea igual en teléfono y computadora.
 */
export const FONT_OPTIONS: readonly FontOption[] = [
  { id: 'sans', label: 'Sans (Arial)', stack: 'Arial, Helvetica, sans-serif' },
  { id: 'serif', label: 'Serif (Georgia)', stack: 'Georgia, "Times New Roman", serif' },
  { id: 'mono', label: 'Mono (Courier)', stack: '"Courier New", Courier, monospace' },
  { id: 'impact', label: 'Impact', stack: 'Impact, "Arial Black", sans-serif' },
  { id: 'humanist', label: 'Humanista (Trebuchet)', stack: '"Trebuchet MS", Verdana, sans-serif' },
  { id: 'script', label: 'Manuscrita', stack: '"Brush Script MT", "Segoe Script", cursive' }
];

export function resolveFontStack(id: string): string {
  return (FONT_OPTIONS.find((f) => f.id === id) ?? FONT_OPTIONS[0]).stack;
}
