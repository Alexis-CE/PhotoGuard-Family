<script lang="ts">
  import InstallHelp from '$lib/components/InstallHelp.svelte';
  import { TOOLS } from '$lib/sections';
  import { workspace } from '$lib/state/workspace.svelte';
  import { pwa } from '$lib/services/pwa.svelte';
</script>

<div class="home">
  <header class="intro">
    <h2>¿Qué quieres hacer?</h2>
    <p>Protege tus fotos con marcas de agua. Todo se procesa en este dispositivo.</p>
  </header>

  <InstallHelp />

  <ul class="grid">
    {#each TOOLS as tool (tool.id)}
      <li>
        <button
          type="button"
          class="card"
          class:ready={tool.ready}
          onclick={() => workspace.go(tool.id)}
        >
          <svg viewBox="0 0 24 24" aria-hidden="true">{@html tool.icon}</svg>
          <span class="title">{tool.label}</span>
          <span class="summary">{tool.summary}</span>
          <span class="status" class:ready={tool.ready}>
            {tool.ready ? 'Disponible' : 'Próximamente · no operativa'}
          </span>
        </button>
      </li>
    {/each}
  </ul>

  {#if !pwa.online}
    <p class="offline" role="status">
      Sin conexión: PhotoGuard sigue funcionando con la versión guardada en este dispositivo.
    </p>
  {/if}
</div>

<style>
  .home {
    max-width: 980px;
    margin: 0 auto;
    padding: 28px 20px 40px;
    display: flex;
    flex-direction: column;
    gap: 22px;
  }

  h2 {
    font-size: 26px;
    margin-bottom: 4px;
  }

  .intro p {
    color: var(--muted);
  }

  .grid {
    list-style: none;
    margin: 0;
    padding: 0;
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(260px, 1fr));
    gap: 14px;
  }

  .card {
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    gap: 8px;
    width: 100%;
    height: 100%;
    padding: 18px;
    text-align: left;
    background: var(--surface);
    border: 1px solid var(--border);
    border-radius: 12px;
    transition: border-color 0.15s, transform 0.15s;
  }

  .card:hover {
    border-color: #44474e;
    transform: translateY(-1px);
  }

  .card.ready {
    border-color: color-mix(in srgb, var(--accent) 55%, var(--border));
  }

  svg {
    width: 28px;
    height: 28px;
    fill: none;
    stroke: var(--muted);
    stroke-width: 1.6;
    stroke-linecap: round;
    stroke-linejoin: round;
  }

  .card.ready svg {
    stroke: var(--accent);
  }

  .title {
    font-size: 17px;
    font-weight: 650;
  }

  .summary {
    flex: 1;
    color: var(--muted);
    font-size: 14px;
  }

  .status {
    margin-top: 4px;
    padding: 2px 10px;
    border: 1px dashed var(--border);
    border-radius: 99px;
    font-size: 12px;
    color: var(--muted);
  }

  .status.ready {
    border: 1px solid var(--accent);
    color: var(--accent);
  }

  .offline {
    padding: 10px 12px;
    background: var(--surface);
    border: 1px solid var(--border);
    border-radius: 8px;
    font-size: 13.5px;
    color: var(--muted);
  }

  @media (prefers-reduced-motion: reduce) {
    .card:hover {
      transform: none;
    }
  }
</style>
