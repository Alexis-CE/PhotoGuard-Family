import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ImageImportError, loadPhoto } from '../src/lib/engines/image';
import {
  ACCEPT_ATTRIBUTE,
  buildOutputName,
  kindFromMime,
  SNIFF_BYTES,
  validateFileMeta,
  verifyImageContent
} from '../src/lib/utils/files';

type Kind = 'jpeg' | 'png' | 'webp' | 'text' | 'exe';

const HEADS: Record<Kind, number[]> = {
  jpeg: [0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00, 0x01],
  png: [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x0d],
  webp: [0x52, 0x49, 0x46, 0x46, 0x24, 0x00, 0x00, 0x00, 0x57, 0x45, 0x42, 0x50],
  text: [...new TextEncoder().encode('hola mundo!!')],
  exe: [0x4d, 0x5a, 0x90, 0x00, 0x03, 0x00, 0x00, 0x00, 0x04, 0x00, 0x00, 0x00]
};

function makeFile(name: string, type: string, kind: Kind, total = 64): File {
  const bytes = new Uint8Array(total);
  bytes.set(HEADS[kind].slice(0, total));
  return new File([bytes], name, { type });
}

const bitmap = { width: 400, height: 300, close: vi.fn() };
const decoder = vi.fn(async (..._args: unknown[]) => bitmap);

class FakeCanvas {
  constructor(
    public width: number,
    public height: number
  ) {}
  getContext() {
    return { imageSmoothingEnabled: false, imageSmoothingQuality: 'low', drawImage: vi.fn() };
  }
}

beforeEach(() => {
  decoder.mockClear();
  vi.stubGlobal('createImageBitmap', decoder);
  vi.stubGlobal('OffscreenCanvas', FakeCanvas);
});
afterEach(() => vi.unstubAllGlobals());

async function importError(file: File): Promise<ImageImportError> {
  try {
    await loadPhoto(file);
  } catch (error) {
    expect(error).toBeInstanceOf(ImageImportError);
    return error as ImageImportError;
  }
  throw new Error(`Se esperaba rechazo para ${file.name}`);
}

describe('selector de archivos', () => {
  it('declara image/* y .jfif', () => {
    expect(ACCEPT_ATTRIBUTE).toBe('image/*,.jfif');
  });
});

describe('JFIF', () => {
  it('con MIME vacío y firma JPEG se acepta', async () => {
    const file = makeFile('foto.jfif', '', 'jpeg');
    await expect(loadPhoto(file)).resolves.toMatchObject({ width: 400, height: 300, name: 'foto.jfif' });
  });

  it.each(['image/jfif', 'image/pjpeg', 'image/jpeg'])('con MIME %s y firma JPEG se acepta', async (mime) => {
    await expect(loadPhoto(makeFile('FOTO.JFIF', mime, 'jpeg'))).resolves.toBeDefined();
  });

  it.each([
    ['foto.jpg', 'image/jpeg'],
    ['foto.jfif', ''],
    ['foto.jfif', 'image/jfif']
  ])('un PNG renombrado a %s (MIME «%s») se rechaza con un mensaje claro', async (name, mime) => {
    const error = await importError(makeFile(name, mime, 'png'));
    expect(error.message).toMatch(/su contenido es PNG/);
    expect(error.message).toContain('.png');
    expect(decoder).not.toHaveBeenCalled();
  });

  it.each(['text', 'exe'] as const)('%s renombrado a .jfif se rechaza sin llegar al decodificador', async (kind) => {
    const error = await importError(makeFile('malo.jfif', '', kind));
    expect(error.message).toMatch(/no es una imagen JPG, PNG o WEBP válida/);
    expect(decoder).not.toHaveBeenCalled();
  });

  it('exporta como .jpg (nunca .jfif)', () => {
    expect(buildOutputName('jpeg')).toMatch(/^pg-\d{6}-[0-9a-z]{3}\.jpg$/);
  });
});

describe('JPEG, PNG y WEBP válidos (regresión de lo que ya funcionaba)', () => {
  it.each([
    ['a.jpg', 'image/jpeg', 'jpeg'],
    ['a.JPEG', 'image/jpeg', 'jpeg'],
    ['a.jpg', '', 'jpeg'],
    ['a.png', 'image/png', 'png'],
    ['a.PNG', '', 'png'],
    ['a.webp', 'image/webp', 'webp'],
    ['a.webp', '', 'webp']
  ] as const)('%s (MIME «%s») con contenido %s se acepta', async (name, mime, kind) => {
    await expect(loadPhoto(makeFile(name, mime, kind))).resolves.toBeDefined();
  });

  it('un MIME genérico o desconocido no bloquea si la extensión y la firma coinciden', async () => {
    await expect(loadPhoto(makeFile('a.jpg', 'application/octet-stream', 'jpeg'))).resolves.toBeDefined();
    expect(kindFromMime('application/octet-stream')).toBeNull();
    expect(kindFromMime('image/jpeg; charset=binary')).toBe('jpeg');
  });

  it('el MIME reconocible que contradice el contenido se rechaza', async () => {
    const error = await importError(makeFile('a.jpg', 'image/png', 'jpeg'));
    expect(error.message).toMatch(/se presenta como PNG, pero su contenido es JPEG/);
  });

  it('otras extensiones siguen rechazadas', () => {
    expect(validateFileMeta({ name: 'a.gif', size: 10 })).toMatch(/Formato no compatible \(\.gif\)/);
    expect(validateFileMeta({ name: 'a.heic', size: 10 })).toMatch(/Formato no compatible/);
  });
});

describe('archivos diminutos', () => {
  it.each([
    ['vacío', 0],
    ['4 bytes (solo la cabecera JPEG)', 4],
    ['11 bytes', SNIFF_BYTES - 1]
  ])('%s se rechaza sin errores inesperados', async (_label, size) => {
    const error = await importError(makeFile('chico.jfif', '', 'jpeg', size));
    expect(error.message).toMatch(/vacío|demasiado pequeño/);
    expect(decoder).not.toHaveBeenCalled();
  });

  it('verifyImageContent no falla con búferes vacíos', () => {
    expect(verifyImageContent({ name: 'a.jpg', type: '' }, new Uint8Array(0))).toMatch(/demasiado pequeño/);
  });
});

describe('lectura y decodificación', () => {
  it('solo lee los primeros 12 bytes con file.slice(0, 12)', async () => {
    const file = makeFile('grande.jfif', '', 'jpeg', 5_000);
    const slice = vi.spyOn(file, 'slice');
    await loadPhoto(file);
    expect(slice).toHaveBeenCalledTimes(1);
    expect(slice).toHaveBeenCalledWith(0, 12);
  });

  it('pasa el File ORIGINAL al decodificador (sin crear otro Blob)', async () => {
    const file = makeFile('orig.jfif', '', 'jpeg');
    await loadPhoto(file);
    expect(decoder).toHaveBeenCalledTimes(1);
    expect(decoder.mock.calls[0][0]).toBe(file);
  });
});