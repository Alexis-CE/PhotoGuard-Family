/**
 * Recursos pesados que se descargan UNA vez y quedan guardados para uso sin conexión
 * (p. ej. modelos de quitar fondo en una fase posterior).
 *
 * Viven en su propia Cache de la Cache API, separada del precache del Service Worker:
 * - una actualización de la app NO los borra (workbox solo limpia sus propios cachés),
 * - ni tocan IndexedDB, donde irán los presets y emblemas.
 *
 * En esta fase la lista está vacía: no se descarga ni se usa ningún modelo.
 */
export const MODEL_CACHE_NAME = 'photoguard-models-v1';

export interface ModelResource {
  id: string;
  label: string;
  url: string;
  approxBytes: number;
}

export const MODEL_RESOURCES: readonly ModelResource[] = [];

export type ResourceState = 'cached' | 'missing' | 'unsupported';

export async function getResourceState(
  url: string,
  storage: Pick<CacheStorage, 'open'> | undefined = globalThis.caches
): Promise<ResourceState> {
  if (!storage) return 'unsupported';
  try {
    const cache = await storage.open(MODEL_CACHE_NAME);
    return (await cache.match(url)) ? 'cached' : 'missing';
  } catch {
    return 'unsupported';
  }
}

/** Texto para avisar al usuario cuando una función necesita un recurso aún no descargado. */
export function describeMissingResource(resource: ModelResource, online: boolean): string {
  const mb = Math.max(1, Math.round(resource.approxBytes / 1024 / 1024));
  return online
    ? `Esta función necesita descargar «${resource.label}» (≈ ${mb} MB) la primera vez. Después funcionará sin conexión.`
    : `Esta función necesita «${resource.label}» (≈ ${mb} MB), que aún no está en este dispositivo. Conéctate a internet una vez para descargarlo.`;
}
