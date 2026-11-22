import { DEFAULT_CONFIG, type ProtectionConfig } from './watermark';

/**
 * Modelo de presets persistentes.
 *
 * Un preset guarda SOLO la configuración del editor (`ProtectionConfig`), nunca fotografías.
 * Es el mismo modelo que usa el estado compartido: no existe un segundo sistema de configuración.
 */

/** Versión del formato de UN preset (independiente de la versión del esquema de IndexedDB). */
export const PRESET_SCHEMA_VERSION = 1;
export const PRESET_NAME_MAX = 60;

/** Id reservado del preset de fábrica. Vive en el código, no en IndexedDB. */
export const FACTORY_PRESET_ID = 'factory-default';
export const FACTORY_PRESET_NAME = 'De fábrica';

export interface PresetRecord {
  /** UUID; único. `FACTORY_PRESET_ID` está reservado. */
  id: string;
  name: string;
  schemaVersion: number;
  /** Milisegundos desde epoch */
  createdAt: number;
  updatedAt: number;
  config: ProtectionConfig;
  /**
   * Ids de recursos Blob (tabla `assets`) que usa este preset. Hoy siempre vacío: preparado
   * para los emblemas importados de Emblem Studio. Se guardan Blobs, nunca rutas ni blob: URLs.
   */
  assetIds: string[];
}

export interface AssetRecord {
  id: string;
  blob: Blob;
  mimeType: string;
  name: string | null;
  createdAt: number;
}

export type PresetErrorCode =
  | 'invalid-name'
  | 'invalid-config'
  | 'font-missing'
  | 'factory-readonly'
  | 'not-found'
  | 'invalid-asset';

/** Error de dominio: el dato o la operación no son válidos. El mensaje es apto para mostrarse. */
export class PresetError extends Error {
  readonly code: PresetErrorCode;
  constructor(code: PresetErrorCode, message: string) {
    super(message);
    this.name = 'PresetError';
    this.code = code;
  }
}

export type StorageErrorCode = 'unsupported' | 'denied' | 'quota' | 'version' | 'failed';

/** Error del almacenamiento local (IndexedDB). El mensaje es apto para mostrarse. */
export class StorageError extends Error {
  readonly code: StorageErrorCode;
  constructor(code: StorageErrorCode, message: string, options?: { cause?: unknown }) {
    super(message, options);
    this.name = 'StorageError';
    this.code = code;
  }
}

function deepFreeze<T>(value: T): T {
  if (value && typeof value === 'object') {
    for (const child of Object.values(value)) deepFreeze(child);
    Object.freeze(value);
  }
  return value;
}

const FACTORY: Readonly<PresetRecord> = deepFreeze({
  id: FACTORY_PRESET_ID,
  name: FACTORY_PRESET_NAME,
  schemaVersion: PRESET_SCHEMA_VERSION,
  createdAt: 0,
  updatedAt: 0,
  config: structuredClone(DEFAULT_CONFIG),
  assetIds: []
});

export function isFactoryPreset(preset: Pick<PresetRecord, 'id'> | string): boolean {
  return (typeof preset === 'string' ? preset : preset.id) === FACTORY_PRESET_ID;
}

/** Copia independiente del preset de fábrica (el original está congelado). */
export function getFactoryPreset(): PresetRecord {
  return structuredClone(FACTORY) as PresetRecord;
}