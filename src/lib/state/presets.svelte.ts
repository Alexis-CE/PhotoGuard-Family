import { ensureFontsLoaded, FontLoadError } from '$lib/engines/fontLoader';
import { getPresetStore, type PresetStore } from '$lib/services/presetStore';
import { findMissingFontIds, parseProtectionConfig } from '$lib/services/presetValidation';
import { checkPersistence, requestPersistence, type PersistenceStatus } from '$lib/services/storagePersistence';
import { workspace } from '$lib/state/workspace.svelte';
import { getFactoryPreset, isFactoryPreset, PresetError, StorageError, type PresetRecord } from '$lib/types/preset';
import type { ProtectionConfig } from '$lib/types/watermark';

/** Lo único que los presets necesitan del editor: leer y reemplazar su configuración. */
export interface ConfigTarget {
  config: ProtectionConfig;
  applyConfig(config: ProtectionConfig): void;
}

export interface PresetsDeps {
  store: PresetStore;
  target: ConfigTarget;
  ensureFonts: (config: ProtectionConfig) => Promise<void>;
  persistence: { check(): Promise<PersistenceStatus>; request(): Promise<PersistenceStatus> };
}

function messageOf(error: unknown): string {
  if (error instanceof PresetError || error instanceof StorageError || error instanceof FontLoadError) return error.message;
  console.error(error);
  return 'Ocurrió un error inesperado con los presets.';
}

/** Estado de la pantalla Presets. Toda la persistencia pasa por `PresetStore`. */
export class PresetsState {
  /** Preset de fábrica primero. Si el almacenamiento falla, queda solo el de fábrica. */
  items = $state.raw<PresetRecord[]>([getFactoryPreset()]);
  /** Predeterminado ELEGIDO por el usuario (null = se usa el de fábrica). */
  defaultId = $state<string | null>(null);
  loading = $state(false);
  busy = $state(false);
  error = $state<string | null>(null);
  notice = $state<string | null>(null);
  /** Id del último preset aplicado en esta sesión (para ofrecer «Ir a Proteger»). */
  appliedId = $state<string | null>(null);
  storageReady = $state(true);
  persistence = $state<PersistenceStatus>('unknown');

  readonly #deps: PresetsDeps;
  #initialized: Promise<void> | null = null;
  #persistenceAsked = false;

  constructor(deps: PresetsDeps) {
    this.#deps = deps;
  }

  init(): Promise<void> {
    return (this.#initialized ??= this.#init());
  }

  async #init(): Promise<void> {
    this.loading = true;
    try {
      this.persistence = await this.#deps.persistence.check();
      await this.refresh();
      // Al abrir la app se aplica el predeterminado ELEGIDO; el de fábrica ya es la configuración inicial.
      const chosen = this.defaultId;
      if (chosen) await this.apply(chosen, { quiet: true });
    } finally {
      this.loading = false;
    }
  }

  async refresh(): Promise<void> {
    try {
      const [items, defaultId] = await Promise.all([this.#deps.store.list(), this.#deps.store.getDefaultId()]);
      this.items = items;
      this.defaultId = defaultId;
      this.storageReady = true;
    } catch (error) {
      this.items = [getFactoryPreset()];
      this.defaultId = null;
      this.storageReady = false;
      this.error = messageOf(error);
    }
  }

  /** Ejecuta una operación mostrando errores comprensibles. Devuelve true si salió bien. */
  async #attempt(work: () => Promise<void>): Promise<boolean> {
    if (this.busy) return false;
    this.busy = true;
    this.error = null;
    this.notice = null;
    this.appliedId = null;
    try {
      await work();
      return true;
    } catch (error) {
      this.error = messageOf(error);
      return false;
    } finally {
      this.busy = false;
    }
  }

  #currentConfig(): ProtectionConfig {
    return $state.snapshot(this.#deps.target.config) as ProtectionConfig;
  }

  async saveCurrent(name: string): Promise<boolean> {
    const ok = await this.#attempt(async () => {
      const record = await this.#deps.store.create(name, this.#currentConfig());
      await this.refresh();
      this.notice = `Preset «${record.name}» guardado.`;
    });
    if (ok) await this.#askPersistenceOnce();
    return ok;
  }

  /**
   * Valida, espera la carga de tipografías y SOLO entonces reemplaza la configuración del editor.
   * Si algo falla, la configuración actual queda intacta (nunca se sustituye una fuente).
   */
  async apply(id: string, options: { quiet?: boolean } = {}): Promise<boolean> {
    const run = async () => {
      const preset = await this.#deps.store.get(id);
      if (!preset) throw new PresetError('not-found', 'Ese preset ya no existe.');
      const missing = findMissingFontIds(preset.config);
      if (missing.length > 0) {
        throw new PresetError(
          'font-missing',
          `No se aplicó «${preset.name}»: usa la tipografía «${missing[0]}», que ya no está disponible.`
        );
      }
      const config = parseProtectionConfig(preset.config);
      try {
        await this.#deps.ensureFonts(config);
      } catch (error) {
        if (error instanceof FontLoadError) throw new FontLoadError(`No se aplicó «${preset.name}»: ${error.message}`);
        throw error;
      }
      this.#deps.target.applyConfig(config);
      if (!options.quiet) {
        this.notice = `Preset «${preset.name}» aplicado.`;
        this.appliedId = preset.id;
      }
    };
    if (options.quiet) {
      // Arranque de la app: no se cambia `busy` ni se borran avisos del usuario.
      try {
        await run();
        return true;
      } catch (error) {
        this.error = messageOf(error);
        return false;
      }
    }
    return this.#attempt(run);
  }

  /** Cambia el nombre y, si se pide, reemplaza la configuración guardada por la actual del editor. */
  async edit(id: string, patch: { name: string; replaceConfig: boolean }): Promise<boolean> {
    return this.#attempt(async () => {
      const record = await this.#deps.store.update(id, {
        name: patch.name,
        config: patch.replaceConfig ? this.#currentConfig() : undefined
      });
      await this.refresh();
      this.notice = patch.replaceConfig
        ? `Preset «${record.name}» actualizado con la configuración actual.`
        : `Preset renombrado a «${record.name}».`;
    });
  }

  async duplicate(id: string): Promise<boolean> {
    return this.#attempt(async () => {
      const copy = await this.#deps.store.duplicate(id);
      await this.refresh();
      this.notice = `Se creó «${copy.name}».`;
    });
  }

  async remove(id: string): Promise<boolean> {
    return this.#attempt(async () => {
      const preset = this.items.find((p) => p.id === id);
      const wasDefault = this.defaultId === id;
      await this.#deps.store.remove(id);
      await this.refresh();
      this.notice = wasDefault
        ? `Preset «${preset?.name ?? ''}» eliminado. Era tu predeterminado: se usará el de fábrica.`
        : `Preset «${preset?.name ?? ''}» eliminado.`;
    });
  }

  /** `null` quita la elección y vuelve al preset de fábrica como predeterminado. */
  async setDefault(id: string | null): Promise<boolean> {
    return this.#attempt(async () => {
      if (id !== null && isFactoryPreset(id)) await this.#deps.store.setDefault(null);
      else await this.#deps.store.setDefault(id);
      await this.refresh();
      const name = id === null ? null : this.items.find((p) => p.id === id)?.name;
      this.notice = name ? `«${name}» se aplicará al abrir la app.` : 'Se usará el preset de fábrica al abrir la app.';
    });
  }

  dismissMessages(): void {
    this.error = null;
    this.notice = null;
    this.appliedId = null;
  }

  /** Se pide una sola vez por sesión, justo después del primer guardado del usuario. */
  async #askPersistenceOnce(): Promise<void> {
    if (this.#persistenceAsked || this.persistence === 'persistent') return;
    this.#persistenceAsked = true;
    this.persistence = await this.#deps.persistence.request();
  }
}

export const presets = new PresetsState({
  store: getPresetStore(),
  target: workspace,
  ensureFonts: (config) => ensureFontsLoaded(config),
  persistence: { check: () => checkPersistence(), request: () => requestPersistence() }
});