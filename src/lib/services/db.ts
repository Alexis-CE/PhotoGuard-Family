import { openDB, type DBSchema, type IDBPDatabase, type IDBPTransaction, type StoreNames } from 'idb';
import { StorageError, type AssetRecord, type PresetRecord } from '$lib/types/preset';

/**
 * Base de datos local de PhotoGuard Family (IndexedDB mediante `idb`).
 *
 * - `presets`: un registro por preset de USUARIO (el de fábrica vive en el código).
 * - `assets`: Blobs (futuros emblemas importados). Se guardan los bytes, no rutas ni blob: URLs.
 * - `meta`: valores sueltos (hoy: `defaultPresetId`).
 *
 * Las fotografías originales NUNCA se guardan aquí.
 */
export const DB_NAME = 'photoguard-family';
export const DB_VERSION = 1;
export const META_DEFAULT_PRESET = 'defaultPresetId';

export interface PhotoGuardDB extends DBSchema {
  presets: { key: string; value: PresetRecord };
  assets: { key: string; value: AssetRecord };
  meta: { key: string; value: unknown };
}

export type PhotoGuardConnection = IDBPDatabase<PhotoGuardDB>;
export type UpgradeTransaction = IDBPTransaction<PhotoGuardDB, StoreNames<PhotoGuardDB>[], 'versionchange'>;

/**
 * Migración que lleva la base a la versión `N` (clave del mapa). Se ejecutan en orden dentro de la
 * transacción `versionchange`, así que deben ser síncronas o esperar solo peticiones de IndexedDB
 * (cualquier otra espera cierra la transacción). Si lanzan, la transacción se aborta y la base
 * queda como estaba.
 */
export type Migration = (db: PhotoGuardConnection, tx: UpgradeTransaction) => void;

export const MIGRATIONS: Readonly<Record<number, Migration>> = {
  1: (db) => {
    db.createObjectStore('presets', { keyPath: 'id' });
    db.createObjectStore('assets', { keyPath: 'id' });
    db.createObjectStore('meta');
  }
};

export function runMigrations(
  db: PhotoGuardConnection,
  oldVersion: number,
  newVersion: number,
  tx: UpgradeTransaction,
  migrations: Readonly<Record<number, Migration>> = MIGRATIONS
): void {
  for (let version = oldVersion + 1; version <= newVersion; version++) {
    const migrate = migrations[version];
    if (!migrate) throw new Error(`Falta la migración a la versión ${version} de la base de datos.`);
    migrate(db, tx);
  }
}

export function toStorageError(error: unknown): StorageError {
  if (error instanceof StorageError) return error;
  const name = (error as { name?: unknown } | null)?.name;
  switch (name) {
    case 'QuotaExceededError':
      return new StorageError('quota', 'No hay espacio suficiente en el almacenamiento de este dispositivo.', { cause: error });
    case 'VersionError':
      return new StorageError(
        'version',
        'Los datos guardados son de una versión más nueva de PhotoGuard. Actualiza la app para usarlos.',
        { cause: error }
      );
    case 'SecurityError':
    case 'NotAllowedError':
      return new StorageError(
        'denied',
        'El navegador no permite guardar datos locales (¿modo privado o permisos bloqueados?).',
        { cause: error }
      );
    default:
      return new StorageError('failed', 'No se pudo acceder al almacenamiento local de este dispositivo.', { cause: error });
  }
}

export interface OpenOptions {
  name?: string;
  version?: number;
  /** Solo para pruebas de migración. */
  migrations?: Readonly<Record<number, Migration>>;
}

export async function openPhotoGuardDB(options: OpenOptions = {}): Promise<PhotoGuardConnection> {
  if (typeof indexedDB === 'undefined') {
    throw new StorageError('unsupported', 'Este navegador no ofrece almacenamiento local (IndexedDB).');
  }
  const { name = DB_NAME, version = DB_VERSION, migrations = MIGRATIONS } = options;
  try {
    return await openDB<PhotoGuardDB>(name, version, {
      upgrade(db, oldVersion, newVersion, tx) {
        // Si una migración lanza, la transacción se aborta: el error ya llega por openDB(), no como rechazo suelto.
        tx.done.catch(() => {});
        runMigrations(db, oldVersion, newVersion ?? version, tx, migrations);
      }
    });
  } catch (error) {
    throw toStorageError(error);
  }
}