import type { ProtectionConfig } from '$lib/types/watermark';
import {
  FACTORY_PRESET_ID,
  PRESET_NAME_MAX,
  PRESET_SCHEMA_VERSION,
  PresetError,
  getFactoryPreset,
  isFactoryPreset,
  type AssetRecord,
  type PresetRecord
} from '$lib/types/preset';
import {
  META_DEFAULT_PRESET,
  openPhotoGuardDB,
  toStorageError,
  type Migration,
  type PhotoGuardConnection
} from './db';
import { normalizePresetName, parseProtectionConfig } from './presetValidation';

export interface PresetStoreOptions {
  dbName?: string;
  dbVersion?: number;
  /** Solo para pruebas de migración. */
  migrations?: Readonly<Record<number, Migration>>;
  now?: () => number;
  newId?: () => string;
}

function assetIdsOf(raw: unknown): string[] {
  const ids = (raw as { assetIds?: unknown } | null)?.assetIds;
  return Array.isArray(ids) ? ids.filter((x): x is string => typeof x === 'string') : [];
}

/**
 * Si una petición falla a mitad de transacción, 	x.done también se rechaza; sin un manejador se vería
 * como «unhandled rejection» en la consola. Los wait tx.done de cada operación siguen viendo el error.
 */
function watch<T extends { done: Promise<void> }>(tx: T): T {
  tx.done.catch(() => {});
  return tx;
}

function randomId(): string {
  if (typeof crypto?.randomUUID === 'function') return crypto.randomUUID();
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Lee un registro de IndexedDB y lo convierte al modelo actual. Devuelve null si está corrupto o es
 * de una versión más nueva que la que esta app entiende (se omite del listado, no se rompe).
 * Aquí irán las funciones de actualización de registros cuando `PRESET_SCHEMA_VERSION` suba.
 */
function readRecord(raw: unknown): PresetRecord | null {
  try {
    if (raw === null || typeof raw !== 'object') return null;
    const r = raw as Record<string, unknown>;
    if (typeof r.id !== 'string' || r.id === '' || r.id === FACTORY_PRESET_ID) return null;
    if (typeof r.schemaVersion !== 'number' || r.schemaVersion < 1 || r.schemaVersion > PRESET_SCHEMA_VERSION) return null;
    if (typeof r.createdAt !== 'number' || typeof r.updatedAt !== 'number') return null;
    return {
      id: r.id,
      name: normalizePresetName(r.name),
      schemaVersion: PRESET_SCHEMA_VERSION,
      createdAt: r.createdAt,
      updatedAt: r.updatedAt,
      // Tolerante con fuentes desconocidas: el preset se lista, pero no se puede aplicar.
      config: parseProtectionConfig(r.config, { allowUnknownFonts: true }),
      assetIds: assetIdsOf(r)
    };
  } catch {
    return null;
  }
}

/**
 * Único punto de acceso a los presets guardados. Los componentes NO tocan IndexedDB.
 * El preset de fábrica vive en el código: no se guarda, así que no puede duplicarse al reiniciar
 * ni modificarse, y siempre refleja los valores de la versión instalada.
 */
export class PresetStore {
  readonly #options: PresetStoreOptions;
  readonly #now: () => number;
  readonly #newId: () => string;
  #connection: PhotoGuardConnection | null = null;
  #opening: Promise<PhotoGuardConnection> | null = null;

  constructor(options: PresetStoreOptions = {}) {
    this.#options = options;
    this.#now = options.now ?? (() => Date.now());
    this.#newId = options.newId ?? randomId;
  }

  async #db(): Promise<PhotoGuardConnection> {
    if (this.#connection) return this.#connection;
    this.#opening ??= openPhotoGuardDB({
      name: this.#options.dbName,
      version: this.#options.dbVersion,
      migrations: this.#options.migrations
    }).then(
      (db) => {
        // Otra pestaña pide actualizar la base: cerrar para no bloquearla y reabrir al próximo uso.
        db.addEventListener('versionchange', () => this.close());
        db.addEventListener('close', () => {
          if (this.#connection === db) this.#connection = null;
        });
        this.#connection = db;
        this.#opening = null;
        return db;
      },
      (error: unknown) => {
        this.#opening = null;
        throw error;
      }
    );
    return this.#opening;
  }

  async #run<T>(work: (db: PhotoGuardConnection) => Promise<T>): Promise<T> {
    try {
      return await work(await this.#db());
    } catch (error) {
      if (error instanceof PresetError) throw error;
      throw toStorageError(error);
    }
  }

  close(): void {
    this.#connection?.close();
    this.#connection = null;
    this.#opening = null;
  }

  /** Preset de fábrica primero, luego los del usuario por orden de creación. */
  async list(): Promise<PresetRecord[]> {
    return this.#run(async (db) => {
      const raws = await db.getAll('presets');
      const user = raws.map(readRecord).filter((p): p is PresetRecord => p !== null);
      if (user.length !== raws.length) {
        console.warn(`PhotoGuard: ${raws.length - user.length} preset(s) ilegibles se omitieron del listado.`);
      }
      user.sort((a, b) => a.createdAt - b.createdAt || a.id.localeCompare(b.id));
      return [getFactoryPreset(), ...user];
    });
  }

  async get(id: string): Promise<PresetRecord | null> {
    if (isFactoryPreset(id)) return getFactoryPreset();
    return this.#run(async (db) => readRecord(await db.get('presets', id)));
  }

  async create(name: string, config: ProtectionConfig, options: { assetIds?: string[] } = {}): Promise<PresetRecord> {
    const cleanName = normalizePresetName(name);
    const cleanConfig = parseProtectionConfig(config);
    const assetIds = [...new Set(options.assetIds ?? [])];
    return this.#run(async (db) => {
      const tx = watch(db.transaction(['presets', 'assets'], 'readwrite'));
      for (const assetId of assetIds) {
        if ((await tx.objectStore('assets').getKey(assetId)) === undefined) {
          throw new PresetError('invalid-asset', 'El preset hace referencia a una imagen que no está guardada.');
        }
      }
      const now = this.#now();
      const record: PresetRecord = {
        id: this.#newId(),
        name: cleanName,
        schemaVersion: PRESET_SCHEMA_VERSION,
        createdAt: now,
        updatedAt: now,
        config: cleanConfig,
        assetIds
      };
      await tx.objectStore('presets').add(record);
      await tx.done;
      return record;
    });
  }

  /** Cambia el nombre y/o reemplaza la configuración guardada. El preset de fábrica no se toca. */
  async update(id: string, patch: { name?: string; config?: ProtectionConfig }): Promise<PresetRecord> {
    if (isFactoryPreset(id)) throw new PresetError('factory-readonly', 'El preset de fábrica no se puede modificar. Duplícalo para editar una copia.');
    const name = patch.name === undefined ? undefined : normalizePresetName(patch.name);
    const config = patch.config === undefined ? undefined : parseProtectionConfig(patch.config);
    return this.#run(async (db) => {
      const tx = watch(db.transaction('presets', 'readwrite'));
      const existing = readRecord(await tx.store.get(id));
      if (!existing) {
        throw new PresetError('not-found', 'Ese preset ya no existe.');
      }
      const next: PresetRecord = {
        ...existing,
        name: name ?? existing.name,
        config: config ?? existing.config,
        updatedAt: this.#now()
      };
      await tx.store.put(next);
      await tx.done;
      return next;
    });
  }

  /** Copia independiente (id nuevo). Sirve también con el preset de fábrica. */
  async duplicate(id: string, name?: string): Promise<PresetRecord> {
    const source = await this.get(id);
    if (!source) throw new PresetError('not-found', 'Ese preset ya no existe.');
    const base = name === undefined ? `${source.name.slice(0, PRESET_NAME_MAX - 9)} (copia)` : name;
    const cleanName = normalizePresetName(base);
    return this.#run(async (db) => {
      const now = this.#now();
      const copy: PresetRecord = {
        id: this.#newId(),
        name: cleanName,
        schemaVersion: PRESET_SCHEMA_VERSION,
        createdAt: now,
        updatedAt: now,
        config: structuredClone(source.config),
        assetIds: [...source.assetIds]
      };
      await db.add('presets', copy);
      return copy;
    });
  }

  /**
   * Elimina un preset de usuario. Si era el predeterminado, se limpia la elección y el efectivo
   * pasa a ser el de fábrica. Los Blobs que ningún otro preset use se eliminan también.
   */
  async remove(id: string): Promise<void> {
    if (isFactoryPreset(id)) throw new PresetError('factory-readonly', 'El preset de fábrica no se puede eliminar.');
    await this.#run(async (db) => {
      const tx = watch(db.transaction(['presets', 'assets', 'meta'], 'readwrite'));
      const raw = (await tx.objectStore('presets').get(id)) as { assetIds?: unknown } | undefined;
      if (raw === undefined) {
        throw new PresetError('not-found', 'Ese preset ya no existe.');
      }
      await tx.objectStore('presets').delete(id);
      if ((await tx.objectStore('meta').get(META_DEFAULT_PRESET)) === id) {
        await tx.objectStore('meta').delete(META_DEFAULT_PRESET);
      }
      const orphanCandidates = assetIdsOf(raw);
      if (orphanCandidates.length > 0) {
        const stillUsed = new Set<string>();
        for (const other of await tx.objectStore('presets').getAll()) {
          for (const assetId of assetIdsOf(other)) stillUsed.add(assetId);
        }
        for (const assetId of orphanCandidates) {
          if (!stillUsed.has(assetId)) await tx.objectStore('assets').delete(assetId);
        }
      }
      await tx.done;
    });
  }

  /** `null` quita la elección: el predeterminado efectivo vuelve a ser el de fábrica. */
  async setDefault(id: string | null): Promise<void> {
    if (id !== null && isFactoryPreset(id)) {
      throw new PresetError(
        'factory-readonly',
        'El preset de fábrica se usa cuando no hay uno elegido; elige uno de tus presets o quita la elección.'
      );
    }
    await this.#run(async (db) => {
      const tx = watch(db.transaction(['presets', 'meta'], 'readwrite'));
      if (id === null) {
        await tx.objectStore('meta').delete(META_DEFAULT_PRESET);
      } else {
        if (!readRecord(await tx.objectStore('presets').get(id))) {
          throw new PresetError('not-found', 'Ese preset ya no existe.');
        }
        await tx.objectStore('meta').put(id, META_DEFAULT_PRESET);
      }
      await tx.done;
    });
  }

  /** Id del predeterminado ELEGIDO por el usuario, o null (si no hay o ya no existe). */
  async getDefaultId(): Promise<string | null> {
    return this.#run(async (db) => {
      const id = await db.get('meta', META_DEFAULT_PRESET);
      if (typeof id !== 'string') return null;
      return readRecord(await db.get('presets', id)) ? id : null;
    });
  }

  /** Predeterminado efectivo: el elegido por el usuario o, si no hay, el de fábrica. */
  async getEffectiveDefault(): Promise<PresetRecord> {
    const id = await this.getDefaultId();
    return (id && (await this.get(id))) || getFactoryPreset();
  }

  async putAsset(blob: Blob, name: string | null = null): Promise<string> {
    if (!(blob instanceof Blob) || blob.size === 0) {
      throw new PresetError('invalid-asset', 'La imagen está vacía o no es válida.');
    }
    const record: AssetRecord = { id: this.#newId(), blob, mimeType: blob.type, name, createdAt: this.#now() };
    await this.#run((db) => db.add('assets', record));
    return record.id;
  }

  async getAsset(id: string): Promise<AssetRecord | null> {
    return this.#run(async (db) => (await db.get('assets', id)) ?? null);
  }
}

let shared: PresetStore | null = null;

/** Instancia única de la app (base `photoguard-family`). */
export function getPresetStore(): PresetStore {
  return (shared ??= new PresetStore());
}