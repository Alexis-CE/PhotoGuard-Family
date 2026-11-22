/**
 * Modelo de configuración de protección.
 *
 * Todas las medidas de tamaño son relativas (% del lado corto de la imagen) para que
 * la vista previa y la exportación a resolución completa produzcan la MISMA composición.
 */

export type CompositionMode = 'pattern' | 'emblem' | 'both';
export type Distribution = 'grid' | 'staggered';
export type ExportFormat = 'jpeg' | 'png';

export interface TextStyle {
  text: string;
  /** id de FONT_OPTIONS (estable): inter | roboto | montserrat | source-sans-3 */
  fontId: string;
  /** Negrita real (peso 700 de la familia); false = 400 */
  bold: boolean;
  /** % del lado corto de la imagen */
  size: number;
  color: string;
  /** Grosor: contorno del mismo color, % del tamaño de la fuente (0 = sin contorno) */
  thickness: number;
  /** 0–100 */
  opacity: number;
  /** grados, sentido horario */
  rotation: number;
}

export interface PatternConfig extends TextStyle {
  /** separación horizontal entre repeticiones, % del lado corto */
  gapX: number;
  /** separación vertical entre repeticiones, % del lado corto */
  gapY: number;
  distribution: Distribution;
}

export interface TextEmblem extends TextStyle {
  kind: 'text';
  /** centro del emblema, % del ancho */
  x: number;
  /** centro del emblema, % del alto */
  y: number;
}

/**
 * Fase posterior: `| ImageEmblem` (PNG con transparencia). El render ya despacha por `kind`
 * con una comprobación exhaustiva, así que añadir la variante obliga a manejarla.
 */
export type EmblemConfig = TextEmblem;

export interface ExportConfig {
  format: ExportFormat;
  /** 50–100, solo aplica a JPEG */
  quality: number;
}

export interface ProtectionConfig {
  mode: CompositionMode;
  pattern: PatternConfig;
  emblem: EmblemConfig;
  export: ExportConfig;
}

/** Valores iniciales editables; ningún texto es obligatorio. */
export const DEFAULT_CONFIG: ProtectionConfig = {
  mode: 'both',
  pattern: {
    text: '© Mi Familia',
    fontId: 'inter',
    bold: false,
    size: 4,
    color: '#ffffff',
    thickness: 2,
    opacity: 22,
    rotation: -30,
    gapX: 6,
    gapY: 8,
    distribution: 'staggered'
  },
  emblem: {
    kind: 'text',
    text: 'Mi Familia',
    fontId: 'montserrat',
    bold: true,
    size: 12,
    color: '#ffffff',
    thickness: 0,
    opacity: 55,
    rotation: 0,
    x: 50,
    y: 50
  },
  export: {
    format: 'jpeg',
    quality: 92
  }
};
