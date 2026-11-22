import { FONT_OPTIONS, isFontId } from '$lib/engines/fonts';
import {
  PRESET_NAME_MAX,
  PresetError
} from '$lib/types/preset';
import type {
  CompositionMode,
  Distribution,
  EmblemConfig,
  ExportConfig,
  ExportFormat,
  PatternConfig,
  ProtectionConfig,
  TextStyle
} from '$lib/types/watermark';

/**
 * Validación estricta de datos que llegan de IndexedDB o de la interfaz. Construye un objeto NUEVO
 * copiando solo los campos conocidos: lo que sobre (p. ej. una foto colada por error) se descarta.
 * Los rangos son los mismos que permiten los controles del editor.
 */

const MODES: readonly CompositionMode[] = ['pattern', 'emblem', 'both'];
const DISTRIBUTIONS: readonly Distribution[] = ['grid', 'staggered'];
const FORMATS: readonly ExportFormat[] = ['jpeg', 'png'];
const COLOR = /^#[0-9a-fA-F]{6}$/;
const TEXT_MAX = 80;

function bad(path: string, hint: string): never {
  throw new PresetError('invalid-config', `La configuración guardada no es válida (${path}: ${hint}).`);
}

function record(value: unknown, path: string): Record<string, unknown> {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) bad(path, 'se esperaba un objeto');
  return value as Record<string, unknown>;
}

function num(value: unknown, path: string, min: number, max: number): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) bad(path, 'se esperaba un número');
  if (value < min || value > max) bad(path, `debe estar entre ${min} y ${max}`);
  return value;
}

function oneOf<T extends string>(value: unknown, path: string, allowed: readonly T[]): T {
  if (typeof value !== 'string' || !(allowed as readonly string[]).includes(value)) {
    bad(path, `valor no reconocido`);
  }
  return value as T;
}

function textStyle(value: unknown, path: string, allowUnknownFonts: boolean): TextStyle {
  const v = record(value, path);
  if (typeof v.text !== 'string' || v.text.length > TEXT_MAX) bad(`${path}.text`, `texto de hasta ${TEXT_MAX} caracteres`);
  if (typeof v.fontId !== 'string' || v.fontId === '') bad(`${path}.fontId`, 'falta la tipografía');
  if (!allowUnknownFonts && !isFontId(v.fontId)) {
    throw new PresetError('font-missing', `La tipografía «${v.fontId}» ya no está disponible en PhotoGuard.`);
  }
  if (typeof v.bold !== 'boolean') bad(`${path}.bold`, 'se esperaba verdadero o falso');
  if (typeof v.color !== 'string' || !COLOR.test(v.color)) bad(`${path}.color`, 'color #rrggbb');
  return {
    text: v.text,
    fontId: v.fontId,
    bold: v.bold,
    size: num(v.size, `${path}.size`, 1, 30),
    color: v.color,
    thickness: num(v.thickness, `${path}.thickness`, 0, 12),
    opacity: num(v.opacity, `${path}.opacity`, 1, 100),
    rotation: num(v.rotation, `${path}.rotation`, -180, 180)
  };
}

function pattern(value: unknown, allowUnknownFonts: boolean): PatternConfig {
  const v = record(value, 'pattern');
  return {
    ...textStyle(v, 'pattern', allowUnknownFonts),
    gapX: num(v.gapX, 'pattern.gapX', 0, 40),
    gapY: num(v.gapY, 'pattern.gapY', 0, 40),
    distribution: oneOf(v.distribution, 'pattern.distribution', DISTRIBUTIONS)
  };
}

function emblem(value: unknown, allowUnknownFonts: boolean): EmblemConfig {
  const v = record(value, 'emblem');
  // Hoy solo existe el emblema de texto; la variante de imagen llegará con Emblem Studio.
  oneOf(v.kind, 'emblem.kind', ['text'] as const);
  return {
    ...textStyle(v, 'emblem', allowUnknownFonts),
    kind: 'text',
    x: num(v.x, 'emblem.x', 0, 100),
    y: num(v.y, 'emblem.y', 0, 100)
  };
}

function exportConfig(value: unknown): ExportConfig {
  const v = record(value, 'export');
  return {
    format: oneOf(v.format, 'export.format', FORMATS),
    quality: num(v.quality, 'export.quality', 50, 100)
  };
}

export interface ParseOptions {
  /**
   * Al LEER de IndexedDB se admiten ids de fuente desconocidos para poder listar, renombrar o
   * eliminar el preset. Al ESCRIBIR o APLICAR siempre se rechazan (nunca se sustituye una fuente).
   */
  allowUnknownFonts?: boolean;
}

export function parseProtectionConfig(input: unknown, options: ParseOptions = {}): ProtectionConfig {
  const allow = options.allowUnknownFonts ?? false;
  const v = record(input, 'config');
  return {
    mode: oneOf(v.mode, 'mode', MODES),
    pattern: pattern(v.pattern, allow),
    emblem: emblem(v.emblem, allow),
    export: exportConfig(v.export)
  };
}

/** Ids de fuente de un preset que ya no existen (solo cuentan los estilos que el modo usa). */
export function findMissingFontIds(config: ProtectionConfig): string[] {
  const ids: string[] = [];
  if (config.mode !== 'emblem') ids.push(config.pattern.fontId);
  if (config.mode !== 'pattern') ids.push(config.emblem.fontId);
  return [...new Set(ids.filter((id) => !isFontId(id)))];
}

export function fontLabel(fontId: string): string {
  return FONT_OPTIONS.find((f) => f.id === fontId)?.label ?? `${fontId} (no disponible)`;
}

export function normalizePresetName(input: unknown): string {
  if (typeof input !== 'string') throw new PresetError('invalid-name', 'Escribe un nombre para el preset.');
  const name = input.replace(/\s+/g, ' ').trim();
  if (name === '') throw new PresetError('invalid-name', 'Escribe un nombre para el preset.');
  if (name.length > PRESET_NAME_MAX) {
    throw new PresetError('invalid-name', `El nombre admite hasta ${PRESET_NAME_MAX} caracteres.`);
  }
  return name;
}