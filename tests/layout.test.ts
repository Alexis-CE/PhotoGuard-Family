import { describe, expect, it } from 'vitest';
import { DEFAULT_MAX_TILES, patternCells } from '../src/lib/engines/layout';

const base = { width: 1200, height: 800, cellWidth: 300, cellHeight: 120 };

function nearestDistance(points: { x: number; y: number }[], px: number, py: number): number {
  let best = Infinity;
  for (const p of points) best = Math.min(best, Math.hypot(p.x - px, p.y - py));
  return best;
}

describe('patternCells', () => {
  it('cubre toda la imagen en cualquier rotación (círculo circunscrito)', () => {
    for (const staggered of [false, true]) {
      const cells = patternCells({ ...base, staggered });
      const radius = Math.hypot(base.width, base.height) / 2;
      const maxGap = Math.hypot(base.cellWidth, base.cellHeight) / 2 + 1e-6;
      for (let a = 0; a < 360; a += 15) {
        for (const r of [0, radius * 0.5, radius * 0.98]) {
          const x = Math.cos((a * Math.PI) / 180) * r;
          const y = Math.sin((a * Math.PI) / 180) * r;
          expect(nearestDistance(cells, x, y)).toBeLessThanOrEqual(maxGap);
        }
      }
    }
  });

  it('no coloca un mosaico justo en el centro (ahí va el emblema)', () => {
    const cells = patternCells({ ...base, staggered: false });
    expect(cells.some((p) => p.x === 0 && p.y === 0)).toBe(false);
  });

  it('en modo escalonado, las filas contiguas se desplazan medio paso', () => {
    const cells = patternCells({ ...base, staggered: true });
    const rowA = cells.filter((p) => p.y === 0.5 * base.cellHeight).map((p) => p.x);
    const rowB = cells.filter((p) => p.y === 1.5 * base.cellHeight).map((p) => p.x);
    expect(rowA.length).toBeGreaterThan(2);
    const offset = Math.abs(rowA[0] - rowB[0]) % base.cellWidth;
    expect(Math.min(offset, base.cellWidth - offset)).toBeCloseTo(base.cellWidth / 2, 6);
  });

  it('en cuadrícula, todas las filas comparten las mismas columnas', () => {
    const cells = patternCells({ ...base, staggered: false });
    const xs = new Set(cells.filter((p) => p.y === 0.5 * base.cellHeight).map((p) => p.x));
    const xs2 = new Set(cells.filter((p) => p.y === 1.5 * base.cellHeight).map((p) => p.x));
    expect([...xs].sort()).toEqual([...xs2].sort());
  });

  it('respeta el tope de repeticiones con separaciones diminutas', () => {
    const cells = patternCells({ width: 4000, height: 3000, cellWidth: 2, cellHeight: 2, staggered: true });
    expect(cells.length).toBeGreaterThan(0);
    expect(cells.length).toBeLessThanOrEqual(DEFAULT_MAX_TILES);
  });

  it('tolera entradas inválidas sin romperse', () => {
    expect(patternCells({ ...base, width: 0, staggered: false })).toEqual([]);
    expect(patternCells({ ...base, cellWidth: Number.NaN, staggered: false })).toEqual([]);
    expect(patternCells({ ...base, cellWidth: -50, cellHeight: 0, staggered: false }).length).toBeGreaterThan(0);
  });
});
