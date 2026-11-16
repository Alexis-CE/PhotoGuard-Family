<script lang="ts">
  import type { SectionDef } from '$lib/sections';

  let { section }: { section: SectionDef } = $props();
</script>

<div class="wrap">
  <span class="badge">Próximamente · no operativo</span>
  <h2>{section.label}</h2>
  <p class="lead">{section.summary}</p>

  <h3>Planeado para una fase posterior</h3>
  <ul>
    {#each section.planned as item (item)}
      <li>{item}</li>
    {/each}
  </ul>
  <p class="hint">Por ahora, esta sección no hace nada: usa «Proteger» para componer y exportar fotos.</p>
</div>

<style>
  .wrap {
    max-width: 560px;
    margin: 0 auto;
    padding: 48px 22px;
    display: flex;
    flex-direction: column;
    gap: 14px;
  }

  .badge {
    align-self: flex-start;
    padding: 3px 10px;
    border: 1px dashed var(--accent);
    border-radius: 99px;
    color: var(--accent);
    font-size: 12px;
  }

  h2 {
    font-size: 26px;
  }

  h3 {
    margin-top: 12px;
    font-size: 13px;
    letter-spacing: 0.06em;
    text-transform: uppercase;
    color: var(--muted);
  }

  .lead {
    color: var(--muted);
  }

  ul {
    margin: 0;
    padding-left: 20px;
    display: flex;
    flex-direction: column;
    gap: 6px;
  }

  .hint {
    margin-top: 10px;
    font-size: 13px;
    color: var(--muted);
  }
</style>
