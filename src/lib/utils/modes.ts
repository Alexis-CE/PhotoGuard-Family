import type { CompositionMode } from '$lib/types/watermark';

/**
 * Los tres checkboxes de modo son una vista de `config.mode` (no hay una tercera capa):
 *   Patrón  = el patrón participa      (mode 'pattern' o 'both')
 *   Emblema = el emblema participa     (mode 'emblem' o 'both')
 *   Híbrido = ambos participan         (mode 'both')
 * Funciones puras: la interfaz solo las llama y aplica el resultado.
 */
export type ModeTarget = 'pattern' | 'emblem' | 'hybrid';

export interface ModeParts {
  pattern: boolean;
  emblem: boolean;
  hybrid: boolean;
}

export function modeParts(mode: CompositionMode): ModeParts {
  return { pattern: mode !== 'emblem', emblem: mode !== 'pattern', hybrid: mode === 'both' };
}

function fromParts(pattern: boolean, emblem: boolean): CompositionMode | null {
  if (pattern && emblem) return 'both';
  if (pattern) return 'pattern';
  if (emblem) return 'emblem';
  return null;
}

/**
 * Modo resultante tras marcar/desmarcar un control, o `null` si el cambio está bloqueado porque
 * dejaría Patrón y Emblema desactivados a la vez (incluye desmarcar Híbrido, que apagaría ambos).
 */
export function nextMode(mode: CompositionMode, target: ModeTarget, checked: boolean): CompositionMode | null {
  if (target === 'hybrid') return checked ? 'both' : null;
  const parts = modeParts(mode);
  return target === 'pattern' ? fromParts(checked, parts.emblem) : fromParts(parts.pattern, checked);
}

/** Texto para el usuario cuando `nextMode` bloquea el cambio. */
export function blockedMessage(target: ModeTarget): string {
  return target === 'hybrid'
    ? 'Para salir del modo híbrido, desmarca Patrón o Emblema.'
    : 'Debe quedar activo al menos Patrón o Emblema.';
}
