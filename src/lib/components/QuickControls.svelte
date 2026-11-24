<script lang="ts">
  import ModeToggles from './ModeToggles.svelte';
  import PresetBar from './PresetBar.svelte';
</script>

<!-- Controles de uso frecuente: siempre visibles, antes de la vista previa. -->
<section class="quick" aria-label="Controles rápidos">
  <div class="block">
    <span class="cap">Modo de protección</span>
    <ModeToggles />
  </div>
  <PresetBar />
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
