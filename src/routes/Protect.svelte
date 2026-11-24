<script lang="ts">
  import ControlPanel from '$lib/components/ControlPanel.svelte';
  import FilePicker from '$lib/components/FilePicker.svelte';
  import Preview from '$lib/components/Preview.svelte';
  import { workspace as ws } from '$lib/state/workspace.svelte';

  let picker = $state<ReturnType<typeof FilePicker> | null>(null);
  let dragging = $state(false);

  function onDrop(event: DragEvent): void {
    event.preventDefault();
    dragging = false;
    const file = event.dataTransfer?.files?.[0];
    if (file) void ws.importFile(file);
  }
</script>

<FilePicker bind:this={picker} onpick={(file) => void ws.importFile(file)} />

<div class="protect">
  <div
    class="stage"
    class:dragging
    role="region"
    aria-label="Área de trabajo: vista previa"
    ondragover={(e) => {
      e.preventDefault();
      dragging = true;
    }}
    ondragleave={() => (dragging = false)}
    ondrop={onDrop}
  >
    <div class="toolbar">
      <p class="file">
        {#if ws.photo}
          <strong>{ws.photo.name}</strong>
          <span>{ws.photo.width} × {ws.photo.height} px</span>
        {:else}
          <span>Sin fotografía</span>
        {/if}
      </p>
      <div class="actions">
        <button type="button" class="btn" onclick={() => picker?.open('gallery')} disabled={ws.loading}>Galería</button>
        <button type="button" class="btn" onclick={() => picker?.open('camera')} disabled={ws.loading}>Cámara</button>
        <button type="button" class="btn" onclick={() => picker?.open('files')} disabled={ws.loading}>Archivos</button>
        <button
          type="button"
          class="btn primary"
          onclick={() => void ws.exportCurrent()}
          disabled={!ws.photo || ws.exporting || ws.loading}
        >
          {ws.exporting ? 'Exportando…' : 'Exportar'}
        </button>
      </div>
    </div>

    {#if ws.error}
      <div class="banner error" role="alert">
        <span>{ws.error}</span>
        <button type="button" class="x" aria-label="Cerrar aviso" onclick={() => ws.dismissMessages()}>×</button>
      </div>
    {/if}
    {#if ws.notice}
      <div class="banner" role="status">
        <span>{ws.notice}</span>
        <button type="button" class="x" aria-label="Cerrar aviso" onclick={() => ws.dismissMessages()}>×</button>
      </div>
    {/if}

    <div class="canvas-area">
      {#if ws.photo}
        <Preview />
        {#if ws.loading}<div class="veil">Abriendo foto…</div>{/if}
      {:else if ws.loading}
        <div class="empty"><div class="spinner" aria-hidden="true"></div><p>Abriendo foto…</p></div>
      {:else}
        <div class="empty">
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <rect x="3" y="5" width="18" height="14" rx="2" />
            <circle cx="9" cy="11" r="2" />
            <path d="M21 16l-5-5-8 8" />
          </svg>
          <h2>Abre una fotografía</h2>
          <p>Arrástrala aquí o elígela de tu dispositivo.<br />JPG, JFIF, PNG o WEBP · se procesa sin salir de este equipo.</p>
          <div class="pick">
            <button type="button" class="btn primary" onclick={() => picker?.open('gallery')}>Galería</button>
            <button type="button" class="btn" onclick={() => picker?.open('camera')}>Cámara</button>
            <button type="button" class="btn" onclick={() => picker?.open('files')}>Archivos</button>
          </div>
        </div>
      {/if}
    </div>
  </div>

  <aside class="side" aria-label="Controles de la marca de agua">
    <ControlPanel />
  </aside>
</div>

<style>
  .protect {
    display: grid;
    grid-template-columns: minmax(0, 1fr) 360px;
    height: 100%;
    min-height: 0;
  }

  .stage {
    display: flex;
    flex-direction: column;
    min-width: 0;
    min-height: 0;
    padding: 14px 16px 16px;
    gap: 10px;
    background:
      radial-gradient(1200px 600px at 50% 0%, #17181c 0%, var(--bg) 70%);
    transition: box-shadow 0.15s;
  }

  .stage.dragging {
    box-shadow: inset 0 0 0 2px var(--accent);
  }

  .toolbar {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    flex-wrap: wrap;
  }

  .file {
    display: flex;
    flex-direction: column;
    min-width: 0;
    font-size: 13px;
    color: var(--muted);
  }

  .file strong {
    color: var(--text);
    font-weight: 550;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    max-width: 38ch;
  }

  .actions {
    display: flex;
    gap: 8px;
    flex-wrap: wrap;
  }

  .pick {
    display: flex;
    gap: 8px;
    flex-wrap: wrap;
    justify-content: center;
  }

  .banner {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 12px;
    padding: 10px 12px;
    border: 1px solid var(--border);
    background: var(--surface);
    border-radius: 8px;
    font-size: 13.5px;
  }

  .banner.error {
    border-color: var(--danger);
    color: #ffd2cc;
  }

  .x {
    flex: none;
    width: 24px;
    height: 24px;
    line-height: 1;
    background: transparent;
    border: 0;
    color: inherit;
    font-size: 20px;
  }

  .canvas-area {
    position: relative;
    flex: 1;
    min-height: 0;
    display: grid;
  }

  .empty {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 10px;
    text-align: center;
    border: 1.5px dashed var(--border);
    border-radius: 14px;
    padding: 24px;
    color: var(--muted);
  }

  .empty svg {
    width: 44px;
    height: 44px;
    fill: none;
    stroke: var(--accent);
    stroke-width: 1.5;
    stroke-linecap: round;
    stroke-linejoin: round;
  }

  .empty h2 {
    color: var(--text);
    font-size: 19px;
  }

  .veil {
    position: absolute;
    inset: 0;
    display: grid;
    place-items: center;
    background: rgba(15, 16, 18, 0.6);
    border-radius: 8px;
  }

  .spinner {
    width: 28px;
    height: 28px;
    border: 3px solid var(--border);
    border-top-color: var(--accent);
    border-radius: 50%;
    animation: spin 0.8s linear infinite;
  }

  @keyframes spin {
    to {
      transform: rotate(360deg);
    }
  }

  .side {
    min-height: 0;
    overflow-y: auto;
    background: var(--bg);
    border-left: 1px solid var(--border);
  }

  @media (max-width: 860px) {
    .protect {
      display: flex;
      flex-direction: column;
      height: 100%;
      overflow-y: auto;
    }

    /* La vista previa queda fija arriba mientras se desplazan los controles. */
    .stage {
      position: sticky;
      top: 0;
      z-index: 2;
      flex: none;
      height: 56dvh;
      padding: 10px 12px;
      background: var(--bg);
      border-bottom: 1px solid var(--border);
    }

    .side {
      overflow: visible;
      border-left: 0;
    }

    .file strong {
      max-width: 22ch;
    }
  }
</style>
