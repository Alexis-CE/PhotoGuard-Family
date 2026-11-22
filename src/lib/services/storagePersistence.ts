/**
 * Almacenamiento persistente del navegador (`navigator.storage.persist()`).
 * Sin garantías: el navegador decide, y borrar los datos del sitio siempre elimina los presets.
 */
export type PersistenceStatus = 'persistent' | 'not-persistent' | 'unsupported' | 'unknown';

type StorageManagerLike = Partial<Pick<StorageManager, 'persisted' | 'persist'>>;

function defaultStorage(): StorageManagerLike | undefined {
  return globalThis.navigator?.storage;
}

/** Solo consulta; no muestra ningún aviso al usuario. */
export async function checkPersistence(storage: StorageManagerLike | undefined = defaultStorage()): Promise<PersistenceStatus> {
  if (!storage?.persisted) return 'unsupported';
  try {
    return (await storage.persisted()) ? 'persistent' : 'not-persistent';
  } catch {
    return 'unknown';
  }
}

/** Pide persistencia (si aún no la hay). Un rechazo no es un error: la app sigue funcionando. */
export async function requestPersistence(storage: StorageManagerLike | undefined = defaultStorage()): Promise<PersistenceStatus> {
  if (!storage?.persist) return 'unsupported';
  try {
    if (storage.persisted && (await storage.persisted())) return 'persistent';
    return (await storage.persist()) ? 'persistent' : 'not-persistent';
  } catch {
    return 'unknown';
  }
}