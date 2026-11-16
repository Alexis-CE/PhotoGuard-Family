<script lang="ts">
  import Segmented from './Segmented.svelte';
  import Slider from './Slider.svelte';
  import TextStyleFields from './TextStyleFields.svelte';
  import { workspace as ws } from '$lib/state/workspace.svelte';
  import type { CompositionMode, Distribution, ExportFormat } from '$lib/types/watermark';

  const modes: { value: CompositionMode; label: string }[] = [
    { value: 'pattern', label: 'Patrón' },
    { value: 'both', label: 'Híbrido' },
    { value: 'emblem', label: 'Emblema' }
  ];
  const distributions: { value: Distribution; label: string }[] = [
    { value: 'staggered', label: 'Escalonada' },
    { value: 'grid', label: 'Cuadrícula' }
  ];
  const formats: { value: ExportFormat; label: string }[] = [
    { value: 'jpeg', label: 'JPEG' },
    { value: 'png', label: 'PNG' }
  ];
  const anchors = [15, 50, 85];
  const anchorNames = ['arriba', 'centro', 'abajo'];
  const anchorCols = ['izquierda', 'centro', 'derecha'];

  const showPattern = $derived(ws.config.mode !== 'emblem');
  const showEmblem = $derived(ws.config.mode !== 'pattern');
</script>

<div class="panel">
  <section>
    <h2>Composición</h2>
    <Segmented label="Modo de composición" options={modes} bind:value={ws.config.mode} />
  </section>

  {#if showPattern}
    <section>
      <h2>Patrón repetido</h2>
      <TextStyleFields bind:style={ws.config.pattern} />
      <Slider label="Separación horizontal" bind:value={ws.config.pattern.gapX} min={0} max={40} step={0.5} unit="%" />
      <Slider label="Separación vertical" bind:value={ws.config.pattern.gapY} min={0} max={40} step={0.5} unit="%" />
      <div class="field">
        <span class="cap">Distribución</span>
        <Segmented label="Distribución del patrón" options={distributions} bind:value={ws.config.pattern.distribution} />
      </div>
    </section>
  {/if}

  {#if showEmblem}
    <section>
      <h2>Emblema central</h2>
      <TextStyleFields bind:style={ws.config.emblem} />
      <div class="field">
        <span class="cap">Posición</span>
        <div class="anchors" role="group" aria-label="Posición rápida del emblema">
          {#each anchors as ay, row (ay)}
            {#each anchors as ax, col (ax)}
              <button
                type="button"
                class:on={ws.config.emblem.x === ax && ws.config.emblem.y === ay}
                aria-label="Emblema {anchorNames[row]} {anchorCols[col]}"
                onclick={() => {
                  ws.config.emblem.x = ax;
                  ws.config.emblem.y = ay;
                }}
              ></button>
            {/each}
          {/each}
        </div>
      </div>
      <Slider label="Posición horizontal" bind:value={ws.config.emblem.x} min={0} max={100} unit="%" />
      <Slider label="Posición vertical" bind:value={ws.config.emblem.y} min={0} max={100} unit="%" />
    </section>
  {/if}

  <section>
    <h2>Exportación</h2>
    <Segmented label="Formato de exportación" options={formats} bind:value={ws.config.export.format} />
    {#if ws.config.export.format === 'jpeg'}
      <Slider label="Calidad JPEG" bind:value={ws.config.export.quality} min={50} max={100} unit="%" />
    {:else}
      <p class="note">PNG conserva todos los detalles, pero el archivo pesa bastante más.</p>
    {/if}
    <p class="note">Se exporta a la resolución original de la foto (con el límite de píxeles del navegador).</p>
  </section>

  <button type="button" class="btn ghost reset" onclick={() => ws.resetConfig()}>Restablecer valores</button>
</div>

<style>
  .panel {
    display: flex;
    flex-direction: column;
    gap: 14px;
    padding: 16px;
  }

  section {
    display: flex;
    flex-direction: column;
    gap: 12px;
    padding: 14px;
    background: var(--surface);
    border: 1px solid var(--border);
    border-radius: var(--radius);
  }

  h2 {
    font-size: 12px;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    color: var(--muted);
    font-weight: 600;
  }

  .field {
    display: flex;
    flex-direction: column;
    gap: 6px;
  }

  .cap {
    font-size: 13px;
    color: var(--muted);
  }

  .anchors {
    display: grid;
    grid-template-columns: repeat(3, 34px);
    gap: 6px;
  }

  .anchors button {
    height: 34px;
    background: var(--bg);
    border: 1px solid var(--border);
    border-radius: 6px;
    position: relative;
  }

  .anchors button::after {
    content: '';
    position: absolute;
    inset: 12px;
    border-radius: 50%;
    background: var(--muted);
  }

  .anchors button.on {
    border-color: var(--accent);
  }

  .anchors button.on::after {
    background: var(--accent);
  }

  .note {
    font-size: 12.5px;
    color: var(--muted);
  }

  .reset {
    align-self: flex-start;
  }
</style>
