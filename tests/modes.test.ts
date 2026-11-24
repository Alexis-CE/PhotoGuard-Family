import { describe, expect, it } from 'vitest';
import { blockedMessage, modeParts, nextMode, type ModeTarget } from '../src/lib/utils/modes';
import type { CompositionMode } from '../src/lib/types/watermark';

const MODES: CompositionMode[] = ['pattern', 'emblem', 'both'];

describe('modeParts: los tres checkboxes reflejan config.mode', () => {
  it.each([
    ['pattern', { pattern: true, emblem: false, hybrid: false }],
    ['emblem', { pattern: false, emblem: true, hybrid: false }],
    ['both', { pattern: true, emblem: true, hybrid: true }]
  ] as const)('%s', (mode, expected) => {
    expect(modeParts(mode)).toEqual(expected);
  });

  it('Híbrido es exactamente Patrón y Emblema a la vez', () => {
    for (const mode of MODES) {
      const p = modeParts(mode);
      expect(p.hybrid).toBe(p.pattern && p.emblem);
    }
  });
});

describe('nextMode: transiciones', () => {
  it.each([
    // [modo actual, control, marcado, resultado]
    ['pattern', 'emblem', true, 'both'],
    ['emblem', 'pattern', true, 'both'],
    ['both', 'pattern', false, 'emblem'],
    ['both', 'emblem', false, 'pattern'],
    ['pattern', 'hybrid', true, 'both'],
    ['emblem', 'hybrid', true, 'both']
  ] as [CompositionMode, ModeTarget, boolean, CompositionMode][])('%s + %s=%s → %s', (mode, target, checked, expected) => {
    expect(nextMode(mode, target, checked)).toBe(expected);
  });

  it('no permite dejar Patrón y Emblema apagados', () => {
    expect(nextMode('pattern', 'pattern', false)).toBeNull();
    expect(nextMode('emblem', 'emblem', false)).toBeNull();
  });

  it('desmarcar Híbrido (apagaría ambos) está bloqueado', () => {
    expect(nextMode('both', 'hybrid', false)).toBeNull();
  });

  it('toda combinación alcanzable es un modo válido, con al menos un componente activo', () => {
    for (const start of MODES) {
      for (const target of ['pattern', 'emblem', 'hybrid'] as const) {
        for (const checked of [true, false]) {
          const next = nextMode(start, target, checked);
          if (next === null) continue;
          expect(MODES).toContain(next);
          const p = modeParts(next);
          expect(p.pattern || p.emblem).toBe(true);
        }
      }
    }
  });

  it('desactivar y volver a activar un componente regresa al modo original', () => {
    expect(nextMode(nextMode('both', 'pattern', false)!, 'pattern', true)).toBe('both');
    expect(nextMode(nextMode('both', 'emblem', false)!, 'emblem', true)).toBe('both');
  });

  it('hay mensaje para cada bloqueo', () => {
    expect(blockedMessage('hybrid')).toMatch(/híbrido/i);
    expect(blockedMessage('pattern')).toMatch(/al menos/);
  });
});
