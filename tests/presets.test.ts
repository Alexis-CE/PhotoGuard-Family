import 'fake-indexeddb/auto';
import { openDB } from 'idb';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { DB_NAME, DB_VERSION, MIGRATIONS, type PhotoGuardConnection, type UpgradeTransaction } from '../src/lib/services/db';
import { toStorageError } from '../src/lib/services/db';
import { PresetStore, type PresetStoreOptions } from '../src/lib/services/presetStore';
import { normalizePresetName, parseProtectionConfig } from '../src/lib/services/presetValidation';
import { checkPersistence, requestPersistence } from '../src/lib/services/storagePersistence';
import {
  FACTORY_PRESET_ID,
  PRESET_SCHEMA_VERSION,
  PresetError,
  StorageError,
  getFactoryPreset
} from '../src/lib/types/preset';
import { DEFAULT_CONFIG, type ProtectionConfig } from '../src/lib/types/watermark';

let counter = 0;
const opened: PresetStore[] = [];

const newDbName = (): string => `pg-test-${++counter}`;

function makeStore(dbName: string, options: PresetStoreOptions = {}): PresetStore {
  let clock = 1_000;
  const store = new PresetStore({ dbName, now: () => (clock += 10), ...options });
  opened.push(store);
  return store;
}

function config(change?: (c: ProtectionConfig) => void): ProtectionConfig {
  const c = structuredClone(DEFAULT_CONFIG);
  change?.(c);
  return c;
}

async function rejection(promise: Promise<unknown>): Promise<unknown> {
  try {
    await promise;
  } catch (error) {
    return error;
  }
  throw new Error('Se esperaba un rechazo y la promesa se resolvió.');
}

afterEach(() => {
  opened.splice(0).forEach((s) => s.close());
  vi.unstubAllGlobals();
});

describe('base de datos y migraciones', () => {
  it('crea la base con las tres tablas y la versión actual', async () => {
    const name = newDbName();
    await makeStore(name).list();
    const raw = await openDB(name);
    expect([...raw.objectStoreNames].sort()).toEqual(['assets', 'meta', 'presets']);
    expect(raw.version).toBe(DB_VERSION);
    raw.close();
    expect(DB_NAME).toBe('photoguard-family');
  });

  it('una migración nueva se ejecuta una sola vez y conserva los datos existentes', async () => {
    const name = newDbName();
    const v1 = makeStore(name);
    const created = await v1.create('Antes de migrar', config());
    v1.close();

    const ran: number[] = [];
    const migrations = {
      ...MIGRATIONS,
      2: (db: PhotoGuardConnection) => {
        ran.push(2);
        db.createObjectStore('extra' as never);
      }
    };
    const v2 = makeStore(name, { dbVersion: 2, migrations });
    expect((await v2.list()).map((p) => p.id)).toContain(created.id);
    v2.close();
    await makeStore(name, { dbVersion: 2, migrations }).list();
    expect(ran).toEqual([2]);
    const raw = await openDB(name);
    expect(raw.version).toBe(2);
    expect([...raw.objectStoreNames]).toContain('extra');
    raw.close();
  });

  it('una base nueva ejecuta todas las migraciones en orden', async () => {
    const order: number[] = [];
    const migrations = {
      1: (db: PhotoGuardConnection, tx: UpgradeTransaction) => {
        order.push(1);
        MIGRATIONS[1](db, tx);
      },
      2: () => void order.push(2),
      3: () => void order.push(3)
    };
    await makeStore(newDbName(), { dbVersion: 3, migrations }).list();
    expect(order).toEqual([1, 2, 3]);
  });

  it('si falta una migración la actualización se aborta y los datos siguen intactos', async () => {
    const name = newDbName();
    const v1 = makeStore(name);
    const created = await v1.create('Intacto', config());
    v1.close();
    const error = await rejection(makeStore(name, { dbVersion: 2, migrations: { ...MIGRATIONS } }).list());
    expect(error).toBeInstanceOf(StorageError);
    expect((await makeStore(name).get(created.id))?.name).toBe('Intacto');
  });

  it('abrir con una versión menor que la guardada da un error de versión comprensible', async () => {
    const name = newDbName();
    const newer = makeStore(name, { dbVersion: 2, migrations: { ...MIGRATIONS, 2: () => {} } });
    await newer.list();
    newer.close();
    const error = await rejection(makeStore(name).list());
    expect(error).toBeInstanceOf(StorageError);
    expect((error as StorageError).code).toBe('version');
  });
});

describe('preset de fábrica', () => {
  it('está disponible desde la primera ejecución y no se guarda en la base (no hay duplicados)', async () => {
    const name = newDbName();
    for (let i = 0; i < 3; i++) {
      const store = makeStore(name);
      const list = await store.list();
      expect(list).toHaveLength(1);
      expect(list[0].id).toBe(FACTORY_PRESET_ID);
      store.close();
    }
    const raw = await openDB(name);
    expect(await raw.count('presets')).toBe(0);
    raw.close();
  });

  it('es de solo lectura: no se modifica, no se elimina y no se elige como predeterminado', async () => {
    const store = makeStore(newDbName());
    const errors = await Promise.all([
      rejection(store.update(FACTORY_PRESET_ID, { name: 'Otro' })),
      rejection(store.update(FACTORY_PRESET_ID, { config: config() })),
      rejection(store.remove(FACTORY_PRESET_ID)),
      rejection(store.setDefault(FACTORY_PRESET_ID))
    ]);
    for (const error of errors) {
      expect(error).toBeInstanceOf(PresetError);
      expect((error as PresetError).code).toBe('factory-readonly');
    }
    expect((await store.get(FACTORY_PRESET_ID))?.name).toBe('De fábrica');
  });

  it('se puede duplicar: la copia es independiente, editable y con id nuevo', async () => {
    const store = makeStore(newDbName());
    const copy = await store.duplicate(FACTORY_PRESET_ID);
    expect(copy.id).not.toBe(FACTORY_PRESET_ID);
    expect(copy.name).toBe('De fábrica (copia)');
    const edited = await store.update(copy.id, { name: 'Mi base', config: config((c) => (c.pattern.size = 9)) });
    expect(edited.config.pattern.size).toBe(9);
    expect((await store.get(FACTORY_PRESET_ID))?.config.pattern.size).toBe(DEFAULT_CONFIG.pattern.size);
  });

  it('las copias que devuelve el store no alteran el original en memoria', () => {
    const a = getFactoryPreset();
    a.config.pattern.size = 99;
    expect(getFactoryPreset().config.pattern.size).toBe(DEFAULT_CONFIG.pattern.size);
  });
});

describe('crear, leer, actualizar, duplicar y eliminar', () => {
  it('crea y lee un preset; el listado pone el de fábrica primero y luego por orden de creación', async () => {
    const store = makeStore(newDbName());
    const a = await store.create('  Primero  ', config());
    const b = await store.create('Segundo', config());
    expect(a.name).toBe('Primero');
    expect(a.schemaVersion).toBe(PRESET_SCHEMA_VERSION);
    expect(a.assetIds).toEqual([]);
    expect((await store.list()).map((p) => p.name)).toEqual(['De fábrica', 'Primero', 'Segundo']);
    expect(await store.get(b.id)).toEqual(b);
    expect(await store.get('no-existe')).toBeNull();
  });

  it('actualiza nombre y/o configuración y refresca la fecha de modificación', async () => {
    const store = makeStore(newDbName());
    const p = await store.create('Uno', config());
    const renamed = await store.update(p.id, { name: 'Uno bis' });
    expect(renamed.name).toBe('Uno bis');
    expect(renamed.config).toEqual(p.config);
    expect(renamed.createdAt).toBe(p.createdAt);
    expect(renamed.updatedAt).toBeGreaterThan(p.updatedAt);
    await store.update(p.id, { config: config((c) => (c.export.quality = 70)) });
    const back = await store.get(p.id);
    expect(back?.name).toBe('Uno bis');
    expect(back?.config.export.quality).toBe(70);
    expect(await rejection(store.update('no-existe', { name: 'x' }))).toMatchObject({ code: 'not-found' });
  });

  it('duplica con id nuevo, copia independiente y nombre «(copia)»', async () => {
    const store = makeStore(newDbName());
    const p = await store.create('Original', config((c) => (c.emblem.fontId = 'roboto')));
    const copy = await store.duplicate(p.id);
    expect(copy.id).not.toBe(p.id);
    expect(copy.name).toBe('Original (copia)');
    expect(copy.config).toEqual(p.config);
    await store.update(copy.id, { config: config((c) => (c.mode = 'pattern')) });
    expect((await store.get(p.id))?.config.mode).toBe('both');
    expect(await store.duplicate(p.id, 'Con nombre')).toMatchObject({ name: 'Con nombre' });
  });

  it('el nombre sugerido de una copia cabe aunque el original use el máximo de caracteres', async () => {
    const store = makeStore(newDbName());
    const p = await store.create('x'.repeat(60), config());
    const copy = await store.duplicate(p.id);
    expect(copy.name.length).toBeLessThanOrEqual(60);
    expect(copy.name.endsWith('(copia)')).toBe(true);
  });

  it('elimina un preset de usuario y avisa si ya no existe', async () => {
    const store = makeStore(newDbName());
    const p = await store.create('Temporal', config());
    await store.remove(p.id);
    expect((await store.list()).map((x) => x.id)).toEqual([FACTORY_PRESET_ID]);
    expect(await rejection(store.remove(p.id))).toMatchObject({ code: 'not-found' });
  });
});
describe('predeterminado', () => {
  it('sin elección, el efectivo es el de fábrica y no cuenta como «predeterminado elegido»', async () => {
    const store = makeStore(newDbName());
    expect(await store.getDefaultId()).toBeNull();
    expect((await store.getEffectiveDefault()).id).toBe(FACTORY_PRESET_ID);
  });

  it('se elige uno propio, se puede cambiar y quitar', async () => {
    const store = makeStore(newDbName());
    const a = await store.create('A', config());
    const b = await store.create('B', config());
    await store.setDefault(a.id);
    expect(await store.getDefaultId()).toBe(a.id);
    await store.setDefault(b.id);
    expect((await store.getEffectiveDefault()).id).toBe(b.id);
    await store.setDefault(null);
    expect(await store.getDefaultId()).toBeNull();
    expect(await rejection(store.setDefault('no-existe'))).toMatchObject({ code: 'not-found' });
  });

  it('al eliminar el predeterminado se vuelve al de fábrica', async () => {
    const store = makeStore(newDbName());
    const a = await store.create('A', config());
    await store.setDefault(a.id);
    await store.remove(a.id);
    expect(await store.getDefaultId()).toBeNull();
    expect((await store.getEffectiveDefault()).id).toBe(FACTORY_PRESET_ID);
  });

  it('eliminar un preset que NO es el predeterminado conserva la elección', async () => {
    const store = makeStore(newDbName());
    const a = await store.create('A', config());
    const b = await store.create('B', config());
    await store.setDefault(a.id);
    await store.remove(b.id);
    expect(await store.getDefaultId()).toBe(a.id);
  });
});

describe('persistencia tras cerrar y volver a abrir la conexión', () => {
  it('presets y predeterminado sobreviven a una conexión nueva', async () => {
    const name = newDbName();
    const first = makeStore(name);
    const p = await first.create('Sobrevivo', config((c) => (c.pattern.bold = true)));
    await first.setDefault(p.id);
    first.close();

    const second = makeStore(name);
    expect((await second.list()).map((x) => x.name)).toEqual(['De fábrica', 'Sobrevivo']);
    expect(await second.getDefaultId()).toBe(p.id);
    expect((await second.get(p.id))?.config.pattern.bold).toBe(true);
  });

  it('conserva fontId y bold de patrón y emblema (peso 700 real)', async () => {
    const name = newDbName();
    const first = makeStore(name);
    const p = await first.create(
      'Tipos',
      config((c) => {
        c.pattern.fontId = 'source-sans-3';
        c.pattern.bold = true;
        c.emblem.fontId = 'roboto';
        c.emblem.bold = false;
      })
    );
    first.close();
    const back = await makeStore(name).get(p.id);
    expect(back?.config.pattern).toMatchObject({ fontId: 'source-sans-3', bold: true });
    expect(back?.config.emblem).toMatchObject({ fontId: 'roboto', bold: false });
  });
});

describe('Blobs (preparación para emblemas importados)', () => {
  const bytes = Uint8Array.from([0x89, 0x50, 0x4e, 0x47, 1, 2, 3, 4]);

  it('guarda un Blob y lo recupera idéntico tras reabrir la base', async () => {
    const name = newDbName();
    const first = makeStore(name);
    const id = await first.putAsset(new Blob([bytes], { type: 'image/png' }), 'emblema.png');
    first.close();
    const asset = await makeStore(name).getAsset(id);
    expect(asset).not.toBeNull();
    expect(asset?.mimeType).toBe('image/png');
    expect(asset?.name).toBe('emblema.png');
    expect(asset?.blob.size).toBe(bytes.length);
    expect(new Uint8Array(await asset!.blob.arrayBuffer())).toEqual(bytes);
  });

  it('rechaza Blobs vacíos o valores que no son Blob', async () => {
    const store = makeStore(newDbName());
    expect(await rejection(store.putAsset(new Blob([])))).toMatchObject({ code: 'invalid-asset' });
    expect(await rejection(store.putAsset('no-blob' as unknown as Blob))).toMatchObject({ code: 'invalid-asset' });
  });

  it('un preset solo puede referenciar recursos que existen', async () => {
    const store = makeStore(newDbName());
    expect(await rejection(store.create('Roto', config(), { assetIds: ['fantasma'] }))).toMatchObject({ code: 'invalid-asset' });
    expect(await store.list()).toHaveLength(1);
  });

  it('al eliminar un preset se borran sus Blobs huérfanos, pero no los compartidos', async () => {
    const store = makeStore(newDbName());
    const assetId = await store.putAsset(new Blob([bytes], { type: 'image/png' }));
    const a = await store.create('A', config(), { assetIds: [assetId] });
    const b = await store.duplicate(a.id, 'B');
    expect(b.assetIds).toEqual([assetId]);
    await store.remove(a.id);
    expect(await store.getAsset(assetId)).not.toBeNull();
    await store.remove(b.id);
    expect(await store.getAsset(assetId)).toBeNull();
  });
});

describe('validación', () => {
  it('normaliza el nombre y rechaza vacíos, solo espacios y excesos', () => {
    expect(normalizePresetName('  Mi   preset  ')).toBe('Mi preset');
    for (const bad of ['', '   ', 'x'.repeat(61), 42, null, undefined]) {
      expect(() => normalizePresetName(bad)).toThrowError(PresetError);
    }
  });

  it('rechaza configuraciones inválidas al crear y no guarda nada', async () => {
    const store = makeStore(newDbName());
    const cases: Record<string, (c: ProtectionConfig) => void> = {
      'opacidad fuera de rango': (c) => (c.pattern.opacity = 500),
      'número no finito': (c) => (c.emblem.size = Number.NaN),
      'modo desconocido': (c) => ((c as { mode: string }).mode = 'otro'),
      'color inválido': (c) => (c.pattern.color = 'rojo'),
      'calidad fuera de rango': (c) => (c.export.quality = 10),
      'formato desconocido': (c) => ((c.export as { format: string }).format = 'gif'),
      'bold no booleano': (c) => ((c.pattern as { bold: unknown }).bold = 'si')
    };
    for (const [label, change] of Object.entries(cases)) {
      const error = await rejection(store.create('Mala', config(change)));
      expect(error, label).toBeInstanceOf(PresetError);
      expect((error as PresetError).code, label).toBe('invalid-config');
    }
    expect(await rejection(store.create('Mala', { mode: 'both' } as unknown as ProtectionConfig))).toBeInstanceOf(PresetError);
    expect(await rejection(store.create('', config()))).toMatchObject({ code: 'invalid-name' });
    expect(await store.list()).toHaveLength(1);
  });

  it('una tipografía desconocida se rechaza al guardar (no se sustituye por otra)', async () => {
    const store = makeStore(newDbName());
    const error = await rejection(store.create('Fuente rara', config((c) => (c.pattern.fontId = 'comic-sans'))));
    expect(error).toMatchObject({ code: 'font-missing' });
    expect((error as PresetError).message).toContain('comic-sans');
  });

  it('solo copia campos conocidos: una foto colada en la configuración no se guarda', async () => {
    const store = makeStore(newDbName());
    const dirty = config() as ProtectionConfig & { photo?: Blob };
    dirty.photo = new Blob(['foto']);
    (dirty.pattern as unknown as { original: string }).original = 'IMG_privada.jpg';
    const saved = await store.create('Limpio', dirty);
    expect(Object.keys(saved.config).sort()).toEqual(['emblem', 'export', 'mode', 'pattern']);
    expect(JSON.stringify(saved)).not.toContain('IMG_privada');
    expect(parseProtectionConfig(saved.config)).toEqual(saved.config);
  });
});

describe('registros dañados y errores de almacenamiento', () => {
  it('omite registros corruptos o de una versión futura, y conserva los demás', async () => {
    const name = newDbName();
    const store = makeStore(name);
    const good = await store.create('Bueno', config());
    const raw = await openDB(name);
    await raw.put('presets', { id: 'sin-config', schemaVersion: 1, name: 'x', createdAt: 1, updatedAt: 1 });
    await raw.put('presets', { ...good, id: 'futuro', schemaVersion: 99 });
    raw.close();
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    expect((await store.list()).map((p) => p.name)).toEqual(['De fábrica', 'Bueno']);
    expect(warn).toHaveBeenCalled();
    warn.mockRestore();
  });

  it('un preset guardado con una fuente que ya no existe se lista, pero no pasa la validación estricta', async () => {
    const name = newDbName();
    const store = makeStore(name);
    const good = await store.create('Con fuente', config());
    const raw = await openDB(name);
    const stale = structuredClone(good);
    stale.id = 'vieja';
    stale.name = 'Fuente vieja';
    stale.config.pattern.fontId = 'fuente-retirada';
    await raw.put('presets', stale);
    raw.close();
    const found = (await store.list()).find((p) => p.id === 'vieja');
    expect(found?.config.pattern.fontId).toBe('fuente-retirada');
    expect(() => parseProtectionConfig(found!.config)).toThrowError(/fuente-retirada/);
    expect((await store.update('vieja', { name: 'Renombrado' })).name).toBe('Renombrado');
  });

  it('sin IndexedDB devuelve un error de almacenamiento «unsupported»', async () => {
    vi.stubGlobal('indexedDB', undefined);
    const error = await rejection(makeStore(newDbName()).list());
    expect(error).toBeInstanceOf(StorageError);
    expect((error as StorageError).code).toBe('unsupported');
  });

  it('traduce los errores del navegador a mensajes comprensibles', () => {
    expect(toStorageError(new DOMException('lleno', 'QuotaExceededError')).code).toBe('quota');
    expect(toStorageError(new DOMException('v', 'VersionError')).code).toBe('version');
    expect(toStorageError(new DOMException('s', 'SecurityError')).code).toBe('denied');
    expect(toStorageError(new Error('raro')).code).toBe('failed');
  });
});

describe('almacenamiento persistente (navigator.storage.persist)', () => {
  it('sin API: «unsupported» y sin lanzar', async () => {
    expect(await checkPersistence(undefined)).toBe('unsupported');
    expect(await requestPersistence(undefined)).toBe('unsupported');
    expect(await requestPersistence({})).toBe('unsupported');
  });

  it('consultar no pide nada; pedir solo llama a persist() si aún no es persistente', async () => {
    const persist = vi.fn(async () => true);
    expect(await checkPersistence({ persisted: async () => false, persist })).toBe('not-persistent');
    expect(persist).not.toHaveBeenCalled();
    expect(await requestPersistence({ persisted: async () => false, persist })).toBe('persistent');
    expect(persist).toHaveBeenCalledTimes(1);
    expect(await requestPersistence({ persisted: async () => true, persist })).toBe('persistent');
    expect(persist).toHaveBeenCalledTimes(1);
  });

  it('un rechazo del navegador no es un error, y una excepción se contiene', async () => {
    expect(await requestPersistence({ persisted: async () => false, persist: async () => false })).toBe('not-persistent');
    expect(
      await requestPersistence({
        persisted: async () => false,
        persist: async () => {
          throw new Error('boom');
        }
      })
    ).toBe('unknown');
  });
});