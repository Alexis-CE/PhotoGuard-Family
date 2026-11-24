<script lang="ts">
  import Segmented from './Segmented.svelte';
  import Slider from './Slider.svelte';
  import TextStyleFields from './TextStyleFields.svelte';
  import { workspace as ws } from '$lib/state/workspace.svelte';
  import type { Distribution, ExportFormat } from '$lib/types/watermark';

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

  /**
   * Escritorio: todo abierto (hay espacio en la columna lateral). Móvil: todo plegado para reducir
   * el desplazamiento. El usuario puede abrir/cerrar cada grupo; el estado se conserva al cambiar de modo.
   */
  const roomy = typeof matchMedia === 'function' && matchMedia('(min-width: 861px)').matches;
  let open = $state({ pattern: roomy, emblem: roomy, export: roomy });
</script>

<div class="panel">
  {#if showPattern}
    <details class="group" bind:open={open.pattern}>
      <summary><span class="title">Patrón repetido</span></summary>
      <div class="body">
        <TextStyleFields bind:style={ws.config.pattern} />
        <Slider label="Separación horizontal" bind:value={ws.config.pattern.gapX} min={0} max={40} step={0.5} unit="%" />
        <Slider label="Separación vertical" bind:value={ws.config.pattern.gapY} min={0} max={40} step={0.5} unit="%" />
        <div class="field">
          <span class="cap">Distribución</span>
          <Segmented label="Distribución del patrón" options={distributions} bind:value={ws.config.pattern.distribution} />
        </div>
      </div>
    </details>
  {/if}

  {#if showEmblem}
    <details class="group" bind:open={open.emblem}>
      <summary><span class="title">Emblema central</span></summary>
      <div class="body">
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
      </div>
    </details>
  {/if}

  <details class="group" bind:open={open.export}>
    <summary><span class="title">Exportación</span></summary>
    <div class="body">
      <Segmented label="Formato de exportación" options={formats} bind:value={ws.config.export.format} />
      {#if ws.config.export.format === 'jpeg'}
        <Slider label="Calidad JPEG" bind:value={ws.config.export.quality} min={50} max={100} unit="%" />
      {:else}
        <p class="note">PNG conserva todos los detalles, pero el archivo pesa bastante más.</p>
      {/if}
      <p class="note">Se exporta a la resolución original de la foto (con el límite de píxeles del navegador).</p>
    </div>
  </details>

  <button type="button" class="btn ghost reset" onclick={() => ws.resetConfig()}>Restablecer valores</button>
</div>

<style>
  .panel {
    display: flex;
    flex-direction: column;
    gap: 12px;
    padding: 16px;
  }

  .group {
    background: var(--surface);
    border: 1px solid var(--border);
    border-radius: var(--radius);
  }

  summary {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 10px;
    min-height: 48px;
    padding: 0 14px;
    cursor: pointer;
    list-style: none;
    border-radius: var(--radius);
    -webkit-tap-highlight-color: transparent;
  }

  summary::-webkit-details-marker {
    display: none;
  }

  summary::after {
    content: '';
    flex: none;
    width: 8px;
    height: 8px;
    border-right: 2px solid var(--muted);
    border-bottom: 2px solid var(--muted);
    transform: rotate(45deg) translate(-2px, -2px);
    transition: transform 0.15s;
  }

  .group[open] > summary::after {
    transform: rotate(-135deg) translate(-2px, -2px);
  }

  .group[open] > summary {
    border-bottom: 1px solid var(--border);
    border-bottom-left-radius: 0;
    border-bottom-right-radius: 0;
  }

  .title {
    font-size: 12px;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    color: var(--muted);
    font-weight: 600;
  }

  .body {
    display: flex;
    flex-direction: column;
    gap: 12px;
    padding: 14px;
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

  @media (max-width: 860px) {
    .panel {
      padding: 12px;
    }
  }
</style>
