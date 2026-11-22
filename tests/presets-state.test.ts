import 'fake-indexeddb/auto';
import { openDB } from 'idb';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { FontLoadError, fontSpec } from '../src/lib/engines/fontLoader';
import { PresetStore } from '../src/lib/services/presetStore';
import type { PersistenceStatus } from '../src/lib/services/storagePersistence';
import { PresetsState, type PresetsDeps } from '../src/lib/state/presets.svelte';
import { workspace } from '../src/lib/state/workspace.svelte';
import { FACTORY_PRESET_ID } from '../src/lib/types/preset';
import { DEFAULT_CONFIG } from '../src/lib/types/watermark';

let counter = 0;
const stores: PresetStore[] = [];

function setup(overrides: Partial<PresetsDeps> & { dbName?: string; persistence?: PresetsDeps['persistence'] } = {}) {
  const dbName = overrides.dbName ?? `pg-state-${++counter}`;
  const store = overrides.store ?? new PresetStore({ dbName });
  stores.push(store);
  const request = vi.fn(async (): Promise<PersistenceStatus> => 'persistent');
  const deps: PresetsDeps = {
    store,
    target: workspace,
    ensureFonts: overrides.ensureFonts ?? (async () => {}),
    persistence: overrides.persistence ?? { check: async () => 'not-persistent', request }
  };
  return { state: new PresetsState(deps), store, dbName, request };
}

function customize(): void {
  workspace.config.mode = 'pattern';
  workspace.config.pattern.fontId = 'source-sans-3';
  workspace.config.pattern.bold = true;
  workspace.config.pattern.size = 7.5;
  workspace.config.emblem.fontId = 'roboto';
  workspace.config.emblem.bold = false;
  workspace.config.export.format = 'png';
}

beforeEach(() => workspace.resetConfig());
afterEach(() => {
  stores.splice(0).forEach((s) => s.close());
  vi.unstubAllGlobals();
});

describe('integración presets ↔ estado del editor', () => {
  it('guardar y aplicar actualiza la configuración que leen la vista previa y la exportación', async () => {
    const { state } = setup();
    customize();
    const saved = structuredClone(workspace.config);
    expect(await state.saveCurrent('Mi preset')).toBe(true);
    expect(state.items.map((p) => p.name)).toEqual(['De fábrica', 'Mi preset']);

    workspace.resetConfig();
    expect(workspace.config.pattern.fontId).toBe('inter');
    const id = state.items[1].id;
    expect(await state.apply(id)).toBe(true);

    // Vista previa y exportación leen workspace.config (exportCurrent usa $state.snapshot de él).
    expect(workspace.config).toEqual(saved);
    expect(workspace.config.pattern).toMatchObject({ fontId: 'source-sans-3', bold: true, size: 7.5 });
    expect(workspace.config.export.format).toBe('png');
    // El peso tipográfico real (700) y la pila de fuente salen del mismo fontId/bold guardado.
    expect(fontSpec(workspace.config.pattern)).toBe('700 16px "Source Sans 3", sans-serif');
    expect(fontSpec(workspace.config.emblem)).toBe('400 16px "Roboto", sans-serif');
    expect(state.notice).toContain('aplicado');
    expect(state.appliedId).toBe(id);
  });

  it('aplicar copia la configuración: editar el editor después no altera el preset guardado', async () => {
    const { state, store } = setup();
    await state.saveCurrent('Base');
    const id = state.items[1].id;
    await state.apply(id);
    workspace.config.pattern.size = 29;
    expect((await store.get(id))?.config.pattern.size).toBe(DEFAULT_CONFIG.pattern.size);
  });

  it('el preset de fábrica se puede aplicar y restablece los valores de fábrica', async () => {
    const { state } = setup();
    customize();
    expect(await state.apply(FACTORY_PRESET_ID)).toBe(true);
    expect(workspace.config).toEqual(DEFAULT_CONFIG);
  });

  it('si falla la carga de tipografías, NO se aplica ni se sustituye la fuente', async () => {
    const { state } = setup({
      ensureFonts: async () => {
        throw new FontLoadError('No se pudo cargar la tipografía «inter».');
      }
    });
    customize();
    await state.saveCurrent('Con fuente');
    workspace.resetConfig();
    const before = structuredClone(workspace.config);
    expect(await state.apply(state.items[1].id)).toBe(false);
    expect(workspace.config).toEqual(before);
    expect(state.error).toMatch(/No se aplicó «Con fuente».*tipografía/);
  });

  it('un preset con una fuente retirada no se aplica y el error nombra la fuente', async () => {
    const { state, dbName } = setup();
    await state.saveCurrent('Vieja');
    const raw = await openDB(dbName);
    const record = await raw.get('presets', state.items[1].id);
    record.config.emblem.fontId = 'fuente-retirada';
    await raw.put('presets', record);
    raw.close();
    await state.refresh();

    customize();
    const before = structuredClone(workspace.config);
    expect(await state.apply(record.id)).toBe(false);
    expect(workspace.config).toEqual(before);
    expect(state.error).toContain('fuente-retirada');
  });

  it('editar: renombra y, si se pide, reemplaza la configuración por la actual', async () => {
    const { state, store } = setup();
    await state.saveCurrent('Uno');
    const id = state.items[1].id;
    customize();
    expect(await state.edit(id, { name: 'Uno renombrado', replaceConfig: false })).toBe(true);
    expect((await store.get(id))?.config.mode).toBe('both');
    expect(await state.edit(id, { name: 'Uno renombrado', replaceConfig: true })).toBe(true);
    expect((await store.get(id))?.config.pattern.fontId).toBe('source-sans-3');
    expect(state.items[1].name).toBe('Uno renombrado');
  });

  it('el preset de fábrica no se puede editar ni eliminar desde el estado', async () => {
    const { state } = setup();
    expect(await state.edit(FACTORY_PRESET_ID, { name: 'Otro', replaceConfig: false })).toBe(false);
    expect(state.error).toMatch(/fábrica/);
    expect(await state.remove(FACTORY_PRESET_ID)).toBe(false);
    expect(state.items).toHaveLength(1);
  });

  it('un nombre vacío da un error comprensible y no guarda nada', async () => {
    const { state } = setup();
    expect(await state.saveCurrent('   ')).toBe(false);
    expect(state.error).toMatch(/nombre/i);
    expect(state.items).toHaveLength(1);
  });
});

describe('predeterminado y arranque', () => {
  it('al iniciar se aplica el predeterminado ELEGIDO y no el de fábrica', async () => {
    const first = setup();
    customize();
    await first.state.saveCurrent('Mi favorito');
    await first.state.setDefault(first.state.items[1].id);
    expect(first.state.defaultId).toBe(first.state.items[1].id);
    first.store.close();

    workspace.resetConfig();
    const second = setup({ dbName: first.dbName });
    await second.state.init();
    expect(workspace.config.pattern.fontId).toBe('source-sans-3');
    expect(second.state.defaultId).not.toBeNull();
  });

  it('al eliminar el predeterminado se vuelve al de fábrica y así arranca la app', async () => {
    const first = setup();
    customize();
    await first.state.saveCurrent('Temporal');
    const id = first.state.items[1].id;
    await first.state.setDefault(id);
    expect(await first.state.remove(id)).toBe(true);
    expect(first.state.defaultId).toBeNull();
    expect(first.state.notice).toMatch(/predeterminado.*fábrica/);
    first.store.close();

    workspace.resetConfig();
    const second = setup({ dbName: first.dbName });
    await second.state.init();
    expect(second.state.defaultId).toBeNull();
    expect(workspace.config).toEqual(DEFAULT_CONFIG);
  });

  it('quitar el predeterminado deja la elección vacía', async () => {
    const { state } = setup();
    await state.saveCurrent('A');
    await state.setDefault(state.items[1].id);
    expect(await state.setDefault(null)).toBe(true);
    expect(state.defaultId).toBeNull();
  });
});

describe('almacenamiento persistente y fallos', () => {
  it('pide persistencia una sola vez, después del primer guardado', async () => {
    const { state, request } = setup();
    await state.init();
    expect(request).not.toHaveBeenCalled();
    expect(state.persistence).toBe('not-persistent');
    await state.saveCurrent('Uno');
    await state.saveCurrent('Dos');
    expect(request).toHaveBeenCalledTimes(1);
    expect(state.persistence).toBe('persistent');
  });

  it('si el navegador la rechaza, se guarda igual y se informa el estado', async () => {
    const { state } = setup({ persistence: { check: async () => 'not-persistent', request: async () => 'not-persistent' } });
    expect(await state.saveCurrent('Uno')).toBe(true);
    expect(state.persistence).toBe('not-persistent');
    expect(state.error).toBeNull();
  });

  it('sin IndexedDB la app sigue usable: queda el preset de fábrica y se avisa', async () => {
    vi.stubGlobal('indexedDB', undefined);
    const { state } = setup();
    await state.init();
    expect(state.storageReady).toBe(false);
    expect(state.items.map((p) => p.id)).toEqual([FACTORY_PRESET_ID]);
    expect(state.error).toMatch(/almacenamiento local/);
    customize();
    expect(await state.apply(FACTORY_PRESET_ID)).toBe(true);
    expect(workspace.config).toEqual(DEFAULT_CONFIG);
    expect(await state.saveCurrent('No puede')).toBe(false);
  });
});