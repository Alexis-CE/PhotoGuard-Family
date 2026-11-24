<script lang="ts">
  import { workspace as ws } from '$lib/state/workspace.svelte';
  import { ensureFontsLoaded } from '$lib/engines/fontLoader';
  import { renderComposition } from '$lib/engines/render';

  let canvas: HTMLCanvasElement | undefined = $state();
  let renderFailed = $state(false);

  // Reacciona a la foto y a CUALQUIER cambio de configuración (el snapshot lee todo el árbol).
  $effect(() => {
    const photo = ws.photo;
    const config = $state.snapshot(ws.config);
    const el = canvas;
    if (!photo || !el) return;

    let cancelled = false;
    const frame = requestAnimationFrame(async () => {
      try {
        await ensureFontsLoaded(config);
        if (cancelled) return;
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
    return () => {
      cancelled = true;
      cancelAnimationFrame(frame);
    };
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
    /* Pista acotada al contenedor: así el max-height en % del canvas tiene una referencia definida. */
    grid-template-columns: minmax(0, 1fr);
    grid-template-rows: minmax(0, 1fr);
    place-items: center;
    min-height: 0;
    min-width: 0;
  }

  /*
   * Solo presentación: el búfer del canvas (width/height) no cambia, y la exportación usa su propio
   * canvas a resolución completa. Con ancho y alto en auto, las proporciones se conservan.
   */
  canvas {
    display: block;
    width: auto;
    height: auto;
    max-width: 100%;
    max-height: 100%;
    object-fit: contain;
    border-radius: 4px;
    box-shadow: 0 0 0 1px #000, 0 14px 40px rgba(0, 0, 0, 0.55);
  }

  @media (max-width: 860px) {
    .frame {
      height: auto;
      grid-template-rows: auto;
    }

    canvas {
      max-height: min(42vh, 440px); /* respaldo sin soporte de dvh */
      max-height: min(42dvh, 440px);
    }
  }

  .fail {
    position: absolute;
    bottom: 8px;
    color: var(--danger);
    font-size: 13px;
  }
</style>
