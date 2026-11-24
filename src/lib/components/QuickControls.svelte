<script lang="ts">
  import Segmented from './Segmented.svelte';
  import { workspace as ws } from '$lib/state/workspace.svelte';
  import type { CompositionMode } from '$lib/types/watermark';

  const modes: { value: CompositionMode; label: string }[] = [
    { value: 'pattern', label: 'Patrón' },
    { value: 'both', label: 'Híbrido' },
    { value: 'emblem', label: 'Emblema' }
  ];
</script>

<!-- Controles de uso frecuente: siempre visibles, antes de la vista previa. -->
<section class="quick" aria-label="Controles rápidos">
  <div class="block">
    <span class="cap">Modo de protección</span>
    <Segmented label="Modo de protección" options={modes} bind:value={ws.config.mode} />
  </div>
</section>

<style>
  .quick {
    display: flex;
    flex-direction: column;
    gap: 10px;
  }

  .block {
    display: flex;
    flex-direction: column;
    gap: 6px;
  }

  .cap {
    font-size: 12px;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    color: var(--muted);
    font-weight: 600;
  }
</style>
