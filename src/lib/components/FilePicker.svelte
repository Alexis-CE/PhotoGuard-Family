<script lang="ts">
  import { IMPORT_INPUTS, type ImageSource } from '$lib/utils/files';

  let { onpick }: { onpick: (file: File) => void } = $props();

  const inputs: Partial<Record<ImageSource, HTMLInputElement>> = $state({});

  /** Abre el selector del origen indicado: galería de fotos, cámara o administrador de archivos. */
  export function open(source: ImageSource): void {
    inputs[source]?.click();
  }

  function handleChange(event: Event): void {
    const input = event.currentTarget as HTMLInputElement;
    const file = input.files?.[0];
    if (file) onpick(file);
    // Permite elegir de nuevo el mismo archivo.
    input.value = '';
  }
</script>

<!-- Tres inputs independientes: solo el de cámara usa `capture`; el de galería solo declara MIME. -->
<input
  bind:this={inputs.gallery}
  type="file"
  accept={IMPORT_INPUTS.gallery.accept}
  hidden
  onchange={handleChange}
/>
<input
  bind:this={inputs.camera}
  type="file"
  accept={IMPORT_INPUTS.camera.accept}
  capture={IMPORT_INPUTS.camera.capture}
  hidden
  onchange={handleChange}
/>
<input bind:this={inputs.files} type="file" accept={IMPORT_INPUTS.files.accept} hidden onchange={handleChange} />