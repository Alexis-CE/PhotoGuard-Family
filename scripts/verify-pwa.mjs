// Verificación de la PWA en un Chromium REAL (Edge o Chrome) controlado por CDP, sirviendo dist/
// bajo /photoguard-family/ (como GitHub Pages). Opcional: requiere Edge/Chrome instalados.
//   npm run build && node scripts/verify-pwa.mjs
// Comprueba: manifest/instalabilidad, SW, offline, navegación a Inicio, flujo de actualización,
// supervivencia de IndexedDB/localStorage/Cache de modelos y que el editor+exportación sigan bien.
import { spawn, execSync } from 'node:child_process';
import { existsSync, mkdtempSync, readFileSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { buildJpegWithExif, containsAscii, inspectJpeg, listPngChunks } from './lib/jpeg.mjs';

const ROOT = join(import.meta.dirname, '..');
const PORT = 4180;
const DEBUG = 9333;
const BASE = `http://localhost:${PORT}/photoguard-family/`;
const BROWSERS = [
  'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
  'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
  'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe'
];
const browserPath = BROWSERS.find(existsSync);
if (!browserPath) throw new Error('No se encontró Edge ni Chrome.');

let failures = 0;
const check = (name, ok, detail = '') => {
  if (!ok) failures++;
  console.log(`${ok ? '✓' : '✗'} ${name}${detail ? ` — ${detail}` : ''}`);
};
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const FAMILIES = { inter: 'Inter', roboto: 'Roboto', montserrat: 'Montserrat', 'source-sans-3': 'Source Sans 3' };
const FONT_SPECS = Object.values(FAMILIES).flatMap((fam) => [400, 700].map((w) => `${w} 16px "${fam}"`));

const server = spawn(process.execPath, [join(ROOT, 'scripts', 'serve-subpath.mjs'), String(PORT)], { stdio: 'ignore' });
const profile = mkdtempSync(join(tmpdir(), 'pg-verify-'));
const browser = spawn(
  browserPath,
  ['--headless=new', `--remote-debugging-port=${DEBUG}`, `--user-data-dir=${profile}`, '--no-first-run', '--no-default-browser-check', '--disable-gpu', 'about:blank'],
  { stdio: 'ignore' }
);

const cleanupFiles = () => {
  try { execSync(`taskkill /PID ${browser.pid} /T /F`, { stdio: 'ignore' }); } catch {}
  server.kill();
  try { rmSync(profile, { recursive: true, force: true }); } catch {}
};
process.on('exit', cleanupFiles);

for (let i = 0; i < 60; i++) {
  try { if ((await fetch(`http://127.0.0.1:${DEBUG}/json/version`)).ok) break; } catch {}
  await sleep(250);
}
const target = await (await fetch(`http://127.0.0.1:${DEBUG}/json/new?about:blank`, { method: 'PUT' })).json();
const ws = new WebSocket(target.webSocketDebuggerUrl);
await new Promise((r) => (ws.onopen = r));

let nextId = 0;
const pending = new Map();
const listeners = new Map();
const consoleErrors = [];
ws.onmessage = ({ data }) => {
  const msg = JSON.parse(data);
  if (msg.id && pending.has(msg.id)) {
    const { res, rej } = pending.get(msg.id);
    pending.delete(msg.id);
    msg.error ? rej(new Error(msg.error.message)) : res(msg.result);
  } else if (msg.method) {
    (listeners.get(msg.method) ?? []).forEach((fn) => fn(msg.params));
  }
};
const send = (method, params = {}) =>
  new Promise((res, rej) => {
    const id = ++nextId;
    pending.set(id, { res, rej });
    ws.send(JSON.stringify({ id, method, params }));
  });
const once = (method) => new Promise((r) => { const fn = (p) => { listeners.get(method).splice(listeners.get(method).indexOf(fn), 1); r(p); }; listeners.set(method, [...(listeners.get(method) ?? []), fn]); });
const on = (method, fn) => listeners.set(method, [...(listeners.get(method) ?? []), fn]);

on('Runtime.exceptionThrown', (p) => consoleErrors.push(`excepción: ${p.exceptionDetails.exception?.description ?? p.exceptionDetails.text}`));
on('Runtime.consoleAPICalled', (p) => { if (p.type === 'error') consoleErrors.push(`console.error: ${p.args.map((a) => a.value ?? a.description).join(' ')}`); });
on('Log.entryAdded', (p) => { if (p.entry.level === 'error') consoleErrors.push(`log: ${p.entry.text} ${p.entry.url ?? ''}`); });

const ev = async (expression) => {
  const r = await send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true });
  if (r.exceptionDetails) throw new Error(r.exceptionDetails.exception?.description ?? r.exceptionDetails.text);
  return r.result.value;
};
const waitFor = async (expression, timeout = 15000) => {
  const t = Date.now();
  while (Date.now() - t < timeout) {
    try { const v = await ev(expression); if (v) return v; } catch {}
    await sleep(200);
  }
  return false;
};
const navigate = async (url) => { const l = once('Page.loadEventFired'); await send('Page.navigate', { url }); await l; };
const reload = async () => { const l = once('Page.loadEventFired'); await send('Page.reload'); await l; };

await send('Page.enable'); await send('Runtime.enable'); await send('Log.enable'); await send('Network.enable');

// ---------- Fase A: instalabilidad, SW, offline, navegación ----------
console.log('\n== A. Instalabilidad, Service Worker y offline ==');
await navigate(BASE);
const scope = await waitFor('navigator.serviceWorker.ready.then(r => r.scope)', 20000);
check('Service Worker registrado con alcance de la ruta del repo', scope === BASE, String(scope));

const manifest = await send('Page.getAppManifest');
check('Manifest sin errores', (manifest.errors ?? []).length === 0, JSON.stringify(manifest.errors));
const m = JSON.parse(manifest.data || '{}');
check('Manifest: nombres, standalone, scope', m.name === 'PhotoGuard Family' && m.short_name === 'PhotoGuard' && m.display === 'standalone', `${m.name}/${m.short_name}/${m.display}`);
check('Manifest URL bajo el repo', manifest.url === `${BASE}manifest.webmanifest`, manifest.url);
const inst = await send('Page.getInstallabilityErrors');
check('Chromium no reporta errores de instalabilidad', (inst.installabilityErrors ?? []).length === 0, JSON.stringify(inst.installabilityErrors));

const icons = await ev(`Promise.all(${JSON.stringify(m.icons ?? [])}.map(async i => { const r = await fetch(new URL(i.src, ${JSON.stringify(manifest.url)})); const b = await createImageBitmap(await r.blob()); return [i.src, i.purpose, r.status, b.width, b.height]; }))`);
check('Iconos 192, 512 y maskable 512 cargan con su tamaño', JSON.stringify(icons.map((i) => i.slice(2))) === JSON.stringify([[200, 192, 192], [200, 512, 512], [200, 512, 512]]), JSON.stringify(icons));
const apple = await ev(`fetch(document.querySelector('link[rel=apple-touch-icon]').href).then(r => r.status)`);
check('apple-touch-icon carga (iOS)', apple === 200, String(apple));

const cards = await ev(`[...document.querySelectorAll('.card')].map(c => c.querySelector('.title').textContent + ' | ' + c.querySelector('.status').textContent.trim())`);
check('Inicio muestra las 5 herramientas', cards.length === 5, JSON.stringify(cards));
check('Solo Proteger figura «Disponible»', cards.filter((c) => c.endsWith('Disponible')).length === 1 && cards[0].startsWith('Proteger'));
check('Sin promoción de instalación en escritorio', (await ev(`document.querySelector('.install')`)) === null);

const precache = await ev(`caches.keys().then(async ks => { const k = ks.find(x => x.includes('precache')); return k ? (await (await caches.open(k)).keys()).map(r => new URL(r.url).pathname) : []; })`);
check('Precache incluye HTML, JS, CSS e iconos', ['index.html', '.js', '.css', 'icon-192.png'].every((p) => precache.some((u) => u.includes(p))), `${precache.length} entradas`);
check('Precache incluye las 8 fuentes WOFF2 (offline)', precache.filter((u) => u.endsWith('.woff2')).length === 8, `${precache.filter((u) => u.endsWith('.woff2')).length} WOFF2`);

await reload();
check('Tras recargar, la página está controlada por el SW', await waitFor('navigator.serviceWorker.controller !== null'));
await send('Network.emulateNetworkConditions', { offline: true, latency: 0, downloadThroughput: -1, uploadThroughput: -1 });
await reload();
const offlineCards = await ev(`document.querySelectorAll('.card').length`);
check('OFFLINE: la app carga y muestra Inicio', offlineCards === 5, `${offlineCards} tarjetas`);
check('OFFLINE: se muestra el aviso «Sin conexión»', await waitFor(`document.querySelector('.chip')?.textContent.includes('Sin conexión')`, 3000));
const offlineFonts = await ev(`Promise.all(${JSON.stringify(FONT_SPECS)}.map((s) => document.fonts.load(s).then((f) => f.length)))`);
check('OFFLINE: las 4 familias × 2 pesos se cargan desde la caché', offlineFonts.length === 8 && offlineFonts.every((n) => n > 0), JSON.stringify(offlineFonts));
await send('Network.emulateNetworkConditions', { offline: false, latency: 0, downloadThroughput: -1, uploadThroughput: -1 });
await reload();

console.log('\n== Navegación y regresiones de la Fase 1 ==');
await ev(`document.querySelectorAll('.card')[0].click()`);
check('Proteger abre desde Inicio', await waitFor(`document.querySelector('.protect') !== null`, 3000) && (await ev('history.state.section')) === 'protect');
await ev('history.back()');
check('«Atrás» vuelve a Inicio', await waitFor(`document.querySelector('.home') !== null`, 3000));
await ev(`document.querySelectorAll('.card')[0].click()`);
await waitFor(`document.querySelector('.protect')`);
await reload();
check('Al recargar SIEMPRE se abre Inicio (no recuerda la herramienta)', await waitFor(`document.querySelector('.home') !== null && document.querySelector('.protect') === null`, 4000));

const importPhoto = async () => {
  await ev(`document.querySelectorAll('.card')[0].click()`);
  await waitFor(`document.querySelector('.protect')`);
  await ev(`(async () => {
    const c = document.createElement('canvas'); c.width = 800; c.height = 600;
    const g = c.getContext('2d'); const grad = g.createLinearGradient(0, 0, 800, 600);
    grad.addColorStop(0, '#2a6'); grad.addColorStop(1, '#36c'); g.fillStyle = grad; g.fillRect(0, 0, 800, 600);
    const blob = await new Promise(r => c.toBlob(r, 'image/jpeg', 0.95));
    window.__src = blob;
    const input = document.querySelector('input[type=file]');
    const dt = new DataTransfer(); dt.items.add(new File([blob], 'prueba.jpg', { type: 'image/jpeg' }));
    input.files = dt.files; input.dispatchEvent(new Event('change', { bubbles: true }));
    return true;
  })()`);
  return waitFor(`document.querySelector('.frame canvas') && document.querySelector('.file strong')?.textContent === 'prueba.jpg'`, 8000);
};
check('Editor: importar foto y mostrar vista previa', await importPhoto());

await ev(`window.__blobs = []; const o = URL.createObjectURL.bind(URL); URL.createObjectURL = (b) => { window.__blobs.push(b); return o(b); }; true`);
await ev(`[...document.querySelectorAll('button')].find(b => b.textContent.trim() === 'Exportar').click()`);
check('Exportación genera un archivo', await waitFor('window.__blobs.length > 0', 10000));
const exp = await ev(`(async () => {
  const b = window.__blobs[0]; const out = await createImageBitmap(b); const src = await createImageBitmap(window.__src);
  const px = (bm) => { const c = document.createElement('canvas'); c.width = bm.width; c.height = bm.height; const g = c.getContext('2d'); g.drawImage(bm, 0, 0); return g.getImageData(0, 0, bm.width, bm.height).data; };
  const a = px(out), s = px(src); let diff = 0; for (let i = 0; i < a.length; i += 4) if (Math.abs(a[i] - s[i]) > 24 || Math.abs(a[i+1] - s[i+1]) > 24) diff++;
  return { type: b.type, size: b.size, w: out.width, h: out.height, diffPct: +(100 * diff / (out.width * out.height)).toFixed(2) };
})()`);
check('Exportación: JPEG a la resolución original', exp.type === 'image/jpeg' && exp.w === 800 && exp.h === 600, JSON.stringify(exp));
check('Exportación: la marca de agua modifica píxeles (no es la foto sin tocar)', exp.diffPct > 0.5, `${exp.diffPct}% de píxeles distintos`);

// ---------- Fase C: tipografías locales y eliminación de EXIF ----------
console.log('\n== C. Tipografías locales y eliminación de EXIF ==');
await ev(`window.__b64 = (blob) => new Promise((res) => { const fr = new FileReader(); fr.onload = () => res(String(fr.result).split(',')[1]); fr.readAsDataURL(blob); }); window.__imgs = {}; true`);

const exportNow = async () => {
  await ev('window.__blobs.length = 0; true');
  await ev(`[...document.querySelectorAll('button')].find((b) => b.textContent.trim() === 'Exportar').click()`);
  if (!(await waitFor('window.__blobs.length > 0', 20000))) throw new Error('La exportación no generó archivo');
  const b64 = await ev('window.__b64(window.__blobs[0])');
  const meta = await ev(`(async () => { const bm = await createImageBitmap(window.__blobs[0]); return { type: window.__blobs[0].type, w: bm.width, h: bm.height }; })()`);
  return { bytes: Buffer.from(b64, 'base64'), ...meta };
};

// 1) EXIF: JPEG sintético con APP1/Exif (GPS-marcador + orientación 6) por el flujo REAL de la app
const baseB64 = await ev(`(async () => {
  const c = document.createElement('canvas'); c.width = 800; c.height = 600;
  const g = c.getContext('2d'); const gr = g.createLinearGradient(0, 0, 800, 600);
  gr.addColorStop(0, '#c63'); gr.addColorStop(1, '#39c'); g.fillStyle = gr; g.fillRect(0, 0, 800, 600);
  g.fillStyle = '#fff'; g.fillRect(40, 40, 120, 60);
  const b = await new Promise((r) => c.toBlob(r, 'image/jpeg', 0.95));
  return window.__b64(b);
})()`);
const withExif = buildJpegWithExif(Buffer.from(baseB64, 'base64'), { orientation: 6, marker: 'PG-GPS-TEST-19.4326N' });
const pre = inspectJpeg(withExif);
check('Entrada sintética: JPEG con APP1/Exif (orientación 6 y marcador de GPS de prueba)', pre.valid && pre.app1.length === 1 && pre.app1[0].kind === 'exif' && containsAscii(withExif, 'PG-GPS-TEST'), pre.segments.map((s) => s.name).join(','));
await ev(`(async () => {
  const u8 = Uint8Array.from(atob(${JSON.stringify(Buffer.from(withExif).toString('base64'))}), (c) => c.charCodeAt(0));
  const dt = new DataTransfer(); dt.items.add(new File([u8], 'IMG_exif.jpg', { type: 'image/jpeg' }));
  const input = document.querySelector('input[type=file]'); input.files = dt.files;
  input.dispatchEvent(new Event('change', { bubbles: true })); return true;
})()`);
check('Importar el JPEG con EXIF aplica la orientación (600 × 800)', await waitFor(`document.querySelector('.file strong')?.textContent === 'IMG_exif.jpg' && document.querySelector('.file span')?.textContent.includes('600 × 800')`, 10000));

const outJ = await exportNow();
const post = inspectJpeg(outJ.bytes);
console.log(`  evidencia: segmentos del JPEG exportado = [${post.segments.map((s) => s.name).join(', ')}], bytes iniciales ${outJ.bytes.subarray(0, 4).toString('hex')}`);
check('EXIF: el JPEG exportado es válido (SOI → SOS → EOI)', outJ.type === 'image/jpeg' && post.valid);
check('EXIF: NO contiene ningún segmento APP1 (Exif/XMP)', post.app1.length === 0, `${post.app1.length} APP1`);
check('EXIF: no queda la cadena «Exif» ni el marcador de GPS de prueba', !post.hasExifString && !containsAscii(outJ.bytes, 'PG-GPS-TEST'));
check('EXIF: la orientación quedó aplicada a los píxeles (600×800), sin etiqueta residual', outJ.w === 600 && outJ.h === 800, `${outJ.w}×${outJ.h}`);

await ev(`[...document.querySelectorAll('.segmented label')].find((l) => l.textContent.trim() === 'PNG').click()`);
await sleep(300);
const outP = await exportNow();
const pngChunks = listPngChunks(outP.bytes);
check('PNG exportado: sin chunks eXIf/tEXt/iTXt/zTXt (solo se comprobó esto)', outP.type === 'image/png' && !pngChunks.some((c) => ['eXIf', 'tEXt', 'iTXt', 'zTXt'].includes(c)), `chunks distintos: ${[...new Set(pngChunks)].join(', ')}`);
await ev(`[...document.querySelectorAll('.segmented label')].find((l) => l.textContent.trim() === 'JPEG').click()`);
await sleep(300);

// 2) Tipografías: cada familia y peso se usa de verdad, y vista previa = exportación
const setAll = (id, bold) => ev(`(() => {
  for (const s of document.querySelectorAll('select')) { s.value = ${JSON.stringify(id)}; s.dispatchEvent(new Event('change', { bubbles: true })); }
  for (const c of document.querySelectorAll('input[type=checkbox]')) { if (c.checked !== ${bold}) c.click(); }
  return document.querySelectorAll('select').length;
})()`);
const pairDiff = (k1, k2) => ev(`(() => { const a = window.__imgs[${JSON.stringify(k1)}], b = window.__imgs[${JSON.stringify(k2)}]; let n = 0; for (let i = 0; i < a.length; i += 4) if (Math.abs(a[i] - b[i]) > 24 || Math.abs(a[i + 1] - b[i + 1]) > 24 || Math.abs(a[i + 2] - b[i + 2]) > 24) n++; return +(100 * n / (a.length / 4)).toFixed(2); })()`);
let worstPreview = 0;
let sizeMismatch = false;
for (const bold of [false, true]) {
  for (const id of Object.keys(FAMILIES)) {
    await setAll(id, bold);
    await sleep(700);
    await exportNow();
    const d = await ev(`(async () => {
      const bm = await createImageBitmap(window.__blobs[0]);
      const c = document.createElement('canvas'); c.width = bm.width; c.height = bm.height;
      const g = c.getContext('2d'); g.drawImage(bm, 0, 0);
      const a = g.getImageData(0, 0, c.width, c.height).data;
      window.__imgs[${JSON.stringify(`${id}-${bold}`)}] = a;
      const pv = document.querySelector('.frame canvas');
      if (pv.width !== c.width || pv.height !== c.height) return { mismatch: true };
      const b = pv.getContext('2d').getImageData(0, 0, pv.width, pv.height).data;
      let sum = 0; for (let i = 0; i < a.length; i += 4) sum += Math.abs(a[i] - b[i]) + Math.abs(a[i + 1] - b[i + 1]) + Math.abs(a[i + 2] - b[i + 2]);
      return { mean: sum / ((a.length / 4) * 3) };
    })()`);
    if (d.mismatch) sizeMismatch = true; else worstPreview = Math.max(worstPreview, d.mean);
  }
}
check('Vista previa = exportación (mismo tamaño y diferencia media < 4/255 en las 8 combinaciones)', !sizeMismatch && worstPreview < 4, `peor diferencia media: ${worstPreview.toFixed(2)}`);
const famDiffs = {};
for (const id of Object.keys(FAMILIES).slice(1)) famDiffs[id] = await pairDiff('inter-false', `${id}-false`);
check('Cada familia produce una exportación distinta de Inter (no hay fuente sustituta)', Object.values(famDiffs).every((v) => v > 0.2), JSON.stringify(famDiffs));
const boldDiffs = {};
for (const id of Object.keys(FAMILIES)) boldDiffs[id] = await pairDiff(`${id}-false`, `${id}-true`);
check('La negrita (700) cambia el resultado en las 4 familias', Object.values(boldDiffs).every((v) => v > 0.1), JSON.stringify(boldDiffs));
const loadedFaces = await ev(`[...document.fonts].filter((f) => f.status === 'loaded').map((f) => f.family.replace(/"/g, '') + '|' + f.weight)`);
const expectedFaces = Object.values(FAMILIES).flatMap((fam) => ['400', '700'].map((w) => `${fam}|${w}`));
check('Las 8 caras locales (4 familias × 400/700) quedan cargadas en document.fonts', expectedFaces.every((x) => loadedFaces.includes(x)), `${loadedFaces.length} cargadas`);
await ev(`[...document.querySelectorAll('button')].find((b) => b.textContent.trim() === 'Restablecer valores').click()`);

// ---------- Fase B: actualización ----------
console.log('\n== B. Actualización (nueva versión desplegada) ==');
await ev(`(async () => {
  localStorage.setItem('pg-verify', 'vive');
  await new Promise((res, rej) => { const r = indexedDB.open('pg-verify', 1); r.onupgradeneeded = () => r.result.createObjectStore('s'); r.onsuccess = () => { const t = r.result.transaction('s', 'readwrite'); t.objectStore('s').put('preset-de-prueba', 'k'); t.oncomplete = res; t.onerror = rej; }; r.onerror = rej; });
  await (await caches.open('photoguard-models-v1')).put('/modelo-falso.onnx', new Response('x'));
  return true;
})()`);
const scriptBefore = await ev(`document.querySelector('script[type=module]').src`);

const cssPath = join(ROOT, 'src', 'styles', 'global.css');
const cssOriginal = readFileSync(cssPath, 'utf8');
writeFileSync(cssPath, cssOriginal + '\nbody{--verify-update:1}\n');
try {
  execSync('npm run build', { cwd: ROOT, stdio: 'ignore' });
} finally {
  writeFileSync(cssPath, cssOriginal);
}
await ev(`navigator.serviceWorker.getRegistration().then(r => r.update())`);
check('Aviso «Hay una nueva versión» aparece', await waitFor(`document.querySelector('.toast h3')?.textContent.includes('nueva versión')`, 20000));
check('Mientras tanto la versión actual sigue funcionando (editor abierto)', (await ev(`document.querySelector('.frame canvas') !== null`)) === true);

await ev(`[...document.querySelectorAll('.toast button')].find(b => b.textContent.includes('Más tarde')).click()`);
check('«Más tarde» pospone el aviso y deja un acceso en el encabezado', await waitFor(`!document.querySelector('.toast') && document.querySelector('.chip.update')`, 3000));
await ev(`document.querySelector('.chip.update').click()`);
await waitFor(`document.querySelector('.toast')`, 3000);
await ev(`[...document.querySelectorAll('.toast button')].find(b => b.textContent.trim() === 'Actualizar').click()`);
check('Con una foto abierta pide confirmación antes de recargar', await waitFor(`document.querySelector('.toast p')?.textContent.includes('se cerrará la foto')`, 3000));
await ev(`[...document.querySelectorAll('.toast button')].find(b => b.textContent.includes('Cancelar')).click()`);
check('Cancelar no recarga (la foto sigue abierta)', await waitFor(`!document.querySelector('.toast')`, 3000) && (await ev(`document.querySelector('.frame canvas') !== null`)));
await ev(`document.querySelector('.chip.update').click()`);
await waitFor(`document.querySelector('.toast')`, 3000);
await ev(`[...document.querySelectorAll('.toast button')].find(b => b.textContent.trim() === 'Actualizar').click()`);
const loaded = once('Page.loadEventFired');
await ev(`[...document.querySelectorAll('.toast button')].find(b => b.textContent.includes('Sí, actualizar')).click()`);
await loaded;
await sleep(1500);
const scriptAfter = await ev(`document.querySelector('script[type=module]').src`);
check('Tras aceptar, la app se recarga con la versión nueva', scriptBefore !== scriptAfter, `${scriptBefore.split('/').pop()} → ${scriptAfter.split('/').pop()}`);
check('La página queda controlada por el SW nuevo y sin aviso pendiente', (await waitFor('navigator.serviceWorker.controller !== null')) && (await ev(`document.querySelector('.toast')`)) === null);
const survived = await ev(`(async () => ({
  ls: localStorage.getItem('pg-verify'),
  idb: await new Promise((res, rej) => { const r = indexedDB.open('pg-verify', 1); r.onsuccess = () => { const q = r.result.transaction('s').objectStore('s').get('k'); q.onsuccess = () => res(q.result); q.onerror = rej; }; r.onerror = rej; }),
  model: !!(await (await caches.open('photoguard-models-v1')).match('/modelo-falso.onnx'))
}))()`);
check('IndexedDB, localStorage y caché de modelos sobreviven a la actualización', survived.ls === 'vive' && survived.idb === 'preset-de-prueba' && survived.model === true, JSON.stringify(survived));

// ---------- Resumen ----------
const real = consoleErrors.filter((e) => !/Failed to load resource.*(404|offline)|ERR_INTERNET_DISCONNECTED/i.test(e));
console.log('\n== Errores de consola ==');
check('Sin errores de consola/excepciones inesperadas', real.length === 0, real.slice(0, 4).join(' | '));
console.log(failures ? `\n✗ ${failures} comprobación(es) fallida(s)` : '\n✓ Todo en orden');
try { execSync('npm run build', { cwd: ROOT, stdio: 'ignore' }); } catch {}
process.exit(failures ? 1 : 0);
