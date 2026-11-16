import { DEFAULT_CONFIG, type ProtectionConfig } from '$lib/types/watermark';
import { exportPhoto, ImageImportError, loadPhoto, type LoadedPhoto } from '$lib/engines/image';
import type { SectionId } from '$lib/sections';

function download(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  // Revocar en diferido: algunos navegadores móviles aún leen el blob tras el click.
  setTimeout(() => URL.revokeObjectURL(url), 30_000);
}

class Workspace {
  section = $state<SectionId>('protect');
  config = $state<ProtectionConfig>(structuredClone(DEFAULT_CONFIG));

  /** .raw: ImageBitmap/canvas no deben convertirse en proxies reactivos. */
  photo = $state.raw<LoadedPhoto | null>(null);
  loading = $state(false);
  exporting = $state(false);
  error = $state<string | null>(null);
  notice = $state<string | null>(null);

  #loadToken = 0;

  async importFile(file: File): Promise<void> {
    const token = ++this.#loadToken;
    this.loading = true;
    this.error = null;
    this.notice = null;
    try {
      const next = await loadPhoto(file);
      if (token !== this.#loadToken) {
        next.dispose();
        return;
      }
      const previous = this.photo;
      this.photo = next;
      previous?.dispose();
    } catch (error) {
      if (token === this.#loadToken) {
        this.error =
          error instanceof ImageImportError
            ? error.message
            : 'No se pudo abrir la imagen. Prueba con otro archivo.';
        if (!(error instanceof ImageImportError)) console.error(error);
      }
    } finally {
      if (token === this.#loadToken) this.loading = false;
    }
  }

  async exportCurrent(): Promise<void> {
    const photo = this.photo;
    if (!photo || this.exporting) return;
    this.exporting = true;
    this.error = null;
    this.notice = null;
    try {
      // Un ciclo de pintura para que el estado «Exportando…» se vea antes del trabajo pesado.
      await new Promise((resolve) => setTimeout(resolve, 30));
      const result = await exportPhoto(photo, $state.snapshot(this.config));
      download(result.blob, result.filename);
      if (result.downscaled) {
        this.notice = `La foto superaba el límite de píxeles de este navegador; se exportó a ${result.width}×${result.height}.`;
      }
    } catch (error) {
      console.error(error);
      this.error = 'No se pudo exportar la imagen. Prueba con otro formato o una foto más pequeña.';
    } finally {
      this.exporting = false;
    }
  }

  resetConfig(): void {
    this.config = structuredClone(DEFAULT_CONFIG);
  }

  dismissMessages(): void {
    this.error = null;
    this.notice = null;
  }
}

export const workspace = new Workspace();
