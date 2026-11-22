// Copia las fuentes WOFF2 (subset latino, pesos 400 y 700) y sus licencias desde Fontsource.
// Se ejecuta a mano (`npm run fonts`) al cambiar de versión; los archivos resultantes SE COMMITEAN
// (public/fonts y LICENSES/fonts), así la app no depende de node_modules ni de la red.
import { copyFileSync, mkdirSync, readFileSync, existsSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { join } from 'node:path';

const ROOT = join(import.meta.dirname, '..');
const FAMILIES = ['inter', 'roboto', 'montserrat', 'source-sans-3'];
const WEIGHTS = [400, 700];

for (const id of FAMILIES) {
  const pkg = join(ROOT, 'node_modules', '@fontsource', id);
  if (!existsSync(pkg)) throw new Error(`Falta @fontsource/${id}: ejecuta npm install`);
  const meta = JSON.parse(readFileSync(join(pkg, 'package.json'), 'utf8'));
  if (meta.license !== 'OFL-1.1') throw new Error(`@fontsource/${id} declara licencia ${meta.license}, se esperaba OFL-1.1`);

  const outDir = join(ROOT, 'public', 'fonts', id);
  mkdirSync(outDir, { recursive: true });
  for (const weight of WEIGHTS) {
    const name = `${id}-latin-${weight}-normal.woff2`;
    copyFileSync(join(pkg, 'files', name), join(outDir, name));
    const hash = createHash('sha256').update(readFileSync(join(outDir, name))).digest('hex');
    console.log(`✓ ${id}@${meta.version}  ${name}  sha256:${hash.slice(0, 16)}…`);
  }
  copyFileSync(join(pkg, 'LICENSE'), join(outDir, 'LICENSE.txt')); // viaja con las fuentes publicadas
  mkdirSync(join(ROOT, 'LICENSES', 'fonts'), { recursive: true });
  copyFileSync(join(pkg, 'LICENSE'), join(ROOT, 'LICENSES', 'fonts', `${id}-OFL-1.1.txt`));
}
