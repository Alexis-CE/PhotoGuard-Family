<script lang="ts">
  import { workspace as ws } from '$lib/state/workspace.svelte';
  import { renderComposition } from '$lib/engines/render';

  let canvas: HTMLCanvasElement | undefined = $state();
  let renderFailed = $state(false);

  // Reacciona a la foto y a CUALQUIER cambio de configuración (el snapshot lee todo el árbol).
  $effect(() => {
    const photo = ws.photo;
    const config = $state.snapshot(ws.config);
    const el = canvas;
    if (!photo || !el) return;

    const frame = requestAnimationFrame(() => {
      try {
        if (el.width !== photo.previewWidth || el.height !== photo.previewHeight) {
          el.width = photo.previewWidth;
          el.height = photo.previewHeight;
        }
        const ctx = el.getContext('2d');
        if (!ctx) throw new Error('Sin contexto 2D');
        ctx.clearRect(0, 0, el.width, el.height);
        // Misma función y mismos parámetros que la exportación; solo cambia la resolución.
        renderComposition(ctx, photo.preview, el.width, el.height, config, {
          background: config.export.format === 'jpeg' ? '#ffffff' : undefined
        });
        renderFailed = false;
      } catch (error) {
        console.error(error);
        renderFailed = true;
      }
    });
    return () => cancelAnimationFrame(frame);
  });
</script>

<div class="frame">
  <canvas bind:this={canvas} aria-label="Vista previa de la foto protegida"></canvas>
  {#if renderFailed}
    <p class="fail" role="alert">No se pudo dibujar la vista previa.</p>
  {/if}
</div>

<style>
  .frame {
    position: relative;
    width: 100%;
    height: 100%;
    display: grid;
    place-items: center;
    min-height: 0;
    min-width: 0;
  }

  canvas {
    display: block;
    width: auto;
    height: auto;
    max-width: 100%;
    max-height: 100%;
    border-radius: 4px;
    box-shadow: 0 0 0 1px #000, 0 14px 40px rgba(0, 0, 0, 0.55);
  }

  .fail {
    position: absolute;
    bottom: 8px;
    color: var(--danger);
    font-size: 13px;
  }
</style>
