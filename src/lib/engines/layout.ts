/**
 * Geometría pura del patrón repetido (sin DOM ni canvas → testeable en Node).
 *
 * El patrón se calcula en un marco de referencia centrado en la imagen y SIN rotar;
 * el renderizador rota ese marco, así los mosaicos cubren toda la foto con cualquier ángulo.
 */

export interface Point {
  x: number;
  y: number;
}

export interface PatternLayoutInput {
  width: number;
  height: number;
  /** ancho + separación horizontal, en px */
  cellWidth: number;
  /** alto + separación vertical, en px */
  cellHeight: number;
  staggered: boolean;
  maxTiles?: number;
}

/** Tope de repeticiones por imagen: protege la RAM/CPU del móvil con separaciones diminutas. */
export const DEFAULT_MAX_TILES = 4000;

function build(radius: number, cw: number, ch: number, staggered: boolean): Point[] {
  const limit = radius + Math.hypot(cw, ch) / 2;
  const rows = Math.ceil(limit / ch) + 1;
  const cols = Math.ceil(limit / cw) + 1;
  const points: Point[] = [];

  for (let j = -rows; j <= rows; j++) {
    // Medio paso de desfase: el centro de la foto queda en un hueco, no encima de un texto,
    // y el emblema central no choca de lleno con una repetición.
    const y = (j + 0.5) * ch;
    const shift = staggered && Math.abs(j) % 2 === 1 ? cw / 2 : 0;
    for (let i = -cols; i <= cols; i++) {
      const x = (i + 0.5) * cw + shift;
      if (x * x + y * y <= limit * limit) points.push({ x, y });
    }
  }
  return points;
}

/** Centros de cada repetición, relativos al centro de la imagen, en el marco sin rotar. */
export function patternCells(input: PatternLayoutInput): Point[] {
  const { width, height, staggered } = input;
  const maxTiles = input.maxTiles ?? DEFAULT_MAX_TILES;

  const finite = [width, height, input.cellWidth, input.cellHeight].every(Number.isFinite);
  if (!finite || width <= 0 || height <= 0 || maxTiles <= 0) return [];

  let cw = Math.max(1, input.cellWidth);
  let ch = Math.max(1, input.cellHeight);
  const radius = Math.hypot(width, height) / 2;

  // Pre-escala barata antes de generar puntos (evita millones de iteraciones con celdas de 1 px).
  const estimated = (Math.PI * radius * radius) / (cw * ch);
  if (estimated > maxTiles) {
    const k = Math.sqrt(estimated / maxTiles);
    cw *= k;
    ch *= k;
  }

  let points = build(radius, cw, ch, staggered);
  for (let attempt = 0; attempt < 6 && points.length > maxTiles; attempt++) {
    const k = Math.sqrt(points.length / maxTiles) * 1.02;
    cw *= k;
    ch *= k;
    points = build(radius, cw, ch, staggered);
  }
  return points;
}
