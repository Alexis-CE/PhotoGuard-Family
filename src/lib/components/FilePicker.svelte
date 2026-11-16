<script lang="ts">
  import { ACCEPT_ATTRIBUTE } from '$lib/utils/files';

  let { onpick }: { onpick: (file: File) => void } = $props();

  let input: HTMLInputElement | undefined = $state();

  export function open(): void {
    input?.click();
  }

  function handleChange(): void {
    const file = input?.files?.[0];
    if (file) onpick(file);
    // Permite elegir de nuevo el mismo archivo.
    if (input) input.value = '';
  }
</script>

<input bind:this={input} type="file" accept={ACCEPT_ATTRIBUTE} hidden onchange={handleChange} />
